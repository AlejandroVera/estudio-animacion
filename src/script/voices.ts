// Voces del guion con ElevenLabs: una voz por escena con diálogo. Cada audio se guarda en el
// navegador por voz + texto, así repetir el montaje no gasta caracteres de nuevo. Las escenas se
// alargan o acortan a lo que dura su frase, los audios se unen en una sola pista y la boca se
// sincroniza con ella.

import { gesticular, type Palabra } from './emocion'
import { decodeAudio, loadAudio, saveAudio } from '../audio/storage'
import type { Character, Escena, Objeto, Part, Plano, Rotulo, Tracks } from '../model/types'
import { fondosPorVinetas, generateSceneBackgrounds } from './images'
import { encuadre, fondoDeIndicaciones, planoDeIndicaciones } from './scenes'
import { DESCRIPCIONES, MIRADAS } from '../model/characters/chicoRosaExpresivo'
import { cargarExtras, dibujarPostura, REVISION } from './posturas'
import { ponerObjetos, type ObjetoPedido } from './objetos'
import { activeCharacter, useStore } from '../store'
import { animateScenes } from './scenes'

export interface Voz {
  id: string
  nombre: string
  tipo?: string
  idioma?: string
}

const headers = (pass: string) => ({ 'content-type': 'application/json', 'x-clave-estudio': pass })

export async function listVoices(pass: string): Promise<Voz[]> {
  const res = await fetch('/api/voz', { headers: headers(pass) })
  const d = await res.json().catch(() => ({}))
  if (res.status === 401) throw new Error('La contraseña del estudio no es correcta.')
  if (!res.ok) throw new Error(d.error ?? `Error ${res.status}`)
  return d.voces
}

function hash(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}

export type Modelo = 'eleven_v3' | 'eleven_multilingual_v2'
interface Alineacion {
  characters: string[]
  character_start_times_seconds: number[]
  character_end_times_seconds: number[]
}

/** Lee el guion entero de una vez (entonación continua) y devuelve el audio y el tiempo de cada letra. */
/**
 * Acorta los silencios largos entre palabras/frases (ElevenLabs deja 0,5-0,8 s en cada punto y, con el
 * ritmo de estos vídeos, suena a que la voz se corta). Cada pausa queda como mucho en ~0,3 s, con un
 * fundido mínimo en el corte, y los tiempos de cada letra se mueven a la vez (la boca sigue a la voz).
 */
function acortarPausas(buf: AudioBuffer, al: Alineacion, maxPausa = 0.3): { buf: AudioBuffer; al: Alineacion } {
  const ini = al.character_start_times_seconds
  const fin = al.character_end_times_seconds
  const letra = (c: string) => /[\p{L}\p{N}]/u.test(c)
  const cortes: [number, number][] = []
  let ultimaFin = -1
  for (let i = 0; i < al.characters.length; i++) {
    if (!letra(al.characters[i])) continue
    if (ultimaFin >= 0) {
      const hueco = ini[i] - ultimaFin
      if (hueco > maxPausa + 0.1) {
        const quitar = hueco - maxPausa
        const a = ultimaFin + maxPausa / 2
        cortes.push([a, a + quitar])
      }
    }
    ultimaFin = fin[i]
  }
  if (!cortes.length) return { buf, al }
  const sr = buf.sampleRate
  const quitado = cortes.reduce((s, [a, b]) => s + (b - a), 0)
  const nuevo = new AudioBuffer({ length: Math.max(1, Math.round((buf.duration - quitado) * sr)), numberOfChannels: buf.numberOfChannels, sampleRate: sr })
  const fade = Math.round(0.008 * sr)
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c)
    const dst = nuevo.getChannelData(c)
    let o = 0
    let desde = 0
    for (const [a, b] of [...cortes, [buf.duration, buf.duration] as [number, number]]) {
      const i0 = Math.round(desde * sr), i1 = Math.min(src.length, Math.round(a * sr))
      for (let i = i0; i < i1 && o < dst.length; i++, o++) {
        // fundidos de 8 ms a cada lado del corte (sin chasquidos)
        const k = Math.min(1, (i - i0) / fade, (i1 - i) / fade)
        dst[o] = src[i] * (desde === 0 && i - i0 < fade ? 1 : Math.max(0, k))
      }
      desde = b
    }
  }
  const mover = (t: number) => {
    let d = 0
    for (const [a, b] of cortes) {
      if (t >= b) d += b - a
      else if (t > a) d += t - a
    }
    return t - d
  }
  return {
    buf: nuevo,
    al: { ...al, character_start_times_seconds: ini.map(mover), character_end_times_seconds: fin.map(mover) },
  }
}

async function lectura(texto: string, voz: string, modelo: Modelo, pass: string): Promise<{ buf: AudioBuffer; al: Alineacion }> {
  const id = `ttsfull-${voz}-${modelo}-${hash(texto)}`
  let alBlob = await loadAudio(id + '-al')
  if (!(await loadAudio(id)) || !alBlob) {
    const res = await fetch('/api/voz', { method: 'POST', headers: headers(pass), body: JSON.stringify({ texto, voz, modelo, tiempos: true }) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(res.status === 401 ? 'La contraseña del estudio no es correcta.' : d.error ?? `Error ${res.status}`)
    const bytes = Uint8Array.from(atob(d.audio), (c) => c.charCodeAt(0))
    await saveAudio(id, new Blob([bytes], { type: 'audio/mpeg' }))
    alBlob = new Blob([JSON.stringify(d.alineacion)], { type: 'application/json' })
    await saveAudio(id + '-al', alBlob)
  }
  const buf = await decodeAudio(id)
  if (!buf) throw new Error('No se pudo leer el audio generado.')
  return { buf, al: JSON.parse(await alBlob.text()) }
}

/** Boca por letras: cada vocal abre la boca en su instante; m/b/p la cierran; en las pausas, cerrada. */
function visemas(al: Alineacion, desplaza: (t: number) => number | null, fps: number, mouths: string[]) {
  const has = (m: string) => mouths.includes(m)
  const forma = (c: string): string | null => {
    const l = c.toLowerCase()
    if ('aá'.includes(l)) return has('abierta') ? 'abierta' : 'O'
    if ('eéií'.includes(l)) return has('E') ? 'E' : 'abierta'
    if ('oóuúü'.includes(l)) return has('O') ? 'O' : 'abierta'
    if ('mbpv'.includes(l)) return has('MBP') ? 'MBP' : 'cerrada'
    if ('fdtsnlrzcj'.includes(l)) return has('E') ? 'E' : null // dientes y lengua: boca entreabierta
    if ('gkqxyhñ'.includes(l)) return null // mantiene la forma anterior
    return 'pausa'
  }
  // Cada letra propone una forma en su fotograma; si caen varias en el mismo, gana la más visible
  // (pausa > vocal/labios > consonante).
  const porFotograma = new Map<number, { v: string; p: number }>()
  const put = (t: number, v: string, p: number) => {
    const f = Math.round(t * fps)
    const prev = porFotograma.get(f)
    if (!prev || p >= prev.p) porFotograma.set(f, { v, p })
  }
  const n = al.characters.length
  for (let i = 0; i < n; i++) {
    const t = desplaza(al.character_start_times_seconds[i])
    if (t === null) continue
    const c = al.characters[i]
    const f = forma(c)
    if (f === 'pausa') {
      const sig = i + 1 < n ? al.character_start_times_seconds[i + 1] - al.character_end_times_seconds[i] : 1
      const dur = al.character_end_times_seconds[i] - al.character_start_times_seconds[i]
      if (sig > 0.12 || dur > 0.12 || /[.,;:!?…\n]/.test(c)) put(t, 'cerrada', 3)
    } else if (f) put(t, f, /[aeiouáéíóúü]/i.test(c) || f === 'MBP' ? 2 : 1)
  }
  const fin = desplaza(al.character_end_times_seconds[n - 1] ?? 0)
  if (fin !== null) put(fin, 'cerrada', 3)
  const keys: { t: number; v: string }[] = []
  for (const f of [...porFotograma.keys()].sort((x, y) => x - y)) {
    const v = porFotograma.get(f)!.v
    if (keys.length && keys[keys.length - 1].v === v) continue
    keys.push({ t: f / fps, v })
  }
  return keys.map((k) => ({ t: k.t, v: k.v, ease: 'salto' as const }))
}

/**
 * Boca a golpes para personajes de dos bocas (abierta/cerrada): se abre al empezar cada vocal y se
 * cierra al terminarla, con un mínimo de 2 fotogramas en cada estado (como la animación limitada).
 */
function silabas(al: Alineacion, desplaza: (t: number) => number | null, fps: number) {
  const ab: [number, number, string][] = []
  for (let i = 0; i < al.characters.length; i++) {
    if (!/[aeiouáéíóúü]/i.test(al.characters[i])) continue
    let j = i
    while (j + 1 < al.characters.length && /[aeiouáéíóúüy]/i.test(al.characters[j + 1])) j++ // diptongos
    const a = desplaza(al.character_start_times_seconds[i])
    const b = desplaza(al.character_end_times_seconds[j])
    // Forma según la vocal: a → abierta, e/i → dientes, o/u → «o»
    const vo = al.characters[i].toLowerCase()
    const forma = 'oóuú'.includes(vo) ? 'O' : 'eéií'.includes(vo) ? 'E' : 'abierta'
    if (a !== null && b !== null) ab.push([Math.round(a * fps), Math.max(Math.round(a * fps) + 2, Math.round(b * fps)), forma])
    i = j
  }
  const keys: { t: number; v: string; ease: 'salto' }[] = [{ t: 0, v: 'cerrada', ease: 'salto' }]
  let finAnterior = -10
  for (const [a, b, forma] of ab) {
    if (a - finAnterior < 2 && keys.length > 1) {
      // vocal pegada a la anterior: se alarga la apertura en vez de cerrar un instante
      keys.pop()
    } else keys.push({ t: a / fps, v: forma, ease: 'salto' })
    keys.push({ t: b / fps, v: 'cerrada', ease: 'salto' })
    finAnterior = b
  }
  return keys
}

export type Vineta = { t: number; escena: number; fondo: string; plano: Plano; lado: 'izq' | 'centro' | 'der' }

/** Pide a /api/actuar las posturas por palabra y las convierte en claves exactas (0,08 s antes). */
/** Petición al director (la misma para ver el plan antes y para generar después). */
function cuerpoDirector(ch: Character, raiz: Part, escenas: Escena[], palabrasDe: (i: number) => string[], indicaciones: string) {
  const ojosPart = ch.parts.find((p) => p.id === 'ojos')
  const extras = Object.fromEntries((useStore.getState().project.posturasExtra ?? []).map((e) => [e.nombre, `(a medida) ${e.descripcion}`]))
  const posturas = { ...Object.fromEntries(Object.keys(raiz.variants).filter((v) => !v.includes('~') && DESCRIPCIONES[v]).map((v) => [v, DESCRIPCIONES[v]])), ...extras }
  return {
    posturas,
    indicaciones: indicaciones.trim() || undefined,
    escenas: escenas
      .map((e, i) => ({ escena: i, emocion: e.expresion, palabras: palabrasDe(i), indicaciones: e.indicaciones?.trim() || undefined }))
      .filter((e) => e.palabras.length),
    nuevasMax: ch.expresivo?.base ? Math.min(8, 5 + escenas.filter((e) => e.indicaciones?.trim()).length) : 0,
    escenografia: true,
    objetosMax: Math.min(16, 4 * escenas.length),
    vinetas: true,
    ...(ojosPart ? { miradas: Object.fromEntries(Object.entries(MIRADAS).filter(([k]) => k === 'propios' || ojosPart.variants[k])) } : {}),
  }
}

/** Clave del plan: el mismo guion (palabras de cada escena) con las mismas indicaciones = el mismo plan. */
const clavePlan = (cuerpo: { escenas: unknown; indicaciones?: string }) => hash(JSON.stringify({ e: cuerpo.escenas, i: cuerpo.indicaciones ?? '' }))

/** Pide el plan al director, o devuelve el que ya se vio con «Ver el plan» si el guion no ha cambiado. */
async function planDirector(cuerpo: ReturnType<typeof cuerpoDirector>, pass: string, usarGuardado: boolean) {
  const clave = clavePlan(cuerpo)
  const guardado = useStore.getState().project.planDirector
  if (usarGuardado && guardado?.clave === clave) return guardado.plan as PlanDirector
  const res = await fetch('/api/actuar', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-clave-estudio': pass },
    body: JSON.stringify(cuerpo),
  })
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `error ${res.status}`)
  const plan = (await res.json()) as PlanDirector
  useStore.setState((st) => ({ project: { ...st.project, planDirector: { clave, plan } } }))
  return plan
}

export type PlanDirector = {
  historia?: string
  vinetas?: { escena: number; palabra: number; idea?: string; motivo?: string; fondo: string; tamano: Plano; lado?: Vineta['lado'] }[]
  objetos?: { escena: number; palabra: number; que: string; dibujo: string; pos: Objeto['pos']; flecha?: boolean; motivo?: string }[]
  fondos?: { escena: number; fondo: string }[]
  rotulos?: { escena: number; palabra: number; texto: string; color: Rotulo['color']; pos: Rotulo['pos']; estilo?: Rotulo['estilo']; flecha?: boolean; motivo?: string }[]
  cambios: { escena: number; palabra: number; postura: string; motivo?: string }[]
  miradas?: { escena: number; palabra: number; ojos: string }[]
  nuevas?: { nombre: string; dibujo: string; que_expresa: string; motivo?: string }[]
}

/** Palabras de un texto tal y como las cuenta la voz (letras y números seguidos). */
export const palabrasDeTexto = (t: string) => t.match(/[\p{L}\p{N}]+/gu) ?? []

/**
 * «Ver el plan»: lo que el director haría con este guion, SIN generar la voz ni dibujar nada (solo una
 * consulta a la IA de texto). Se guarda y «Generar voces y animar» usa ese mismo plan.
 */
export async function verPlan(escenas: Escena[], pass: string, indicaciones = '') {
  const st = useStore.getState()
  const ch = activeCharacter(st.project)
  const raiz = ch.parts.find((p) => !p.parent && Object.keys(p.variants).length > 1)
  if (!ch.expresivo || !raiz) throw new Error('Este personaje no tiene director.')
  const cuerpo = cuerpoDirector(ch, raiz, escenas, (i) => palabrasDeTexto(escenas[i].dialogo), indicaciones)
  const plan = await planDirector(cuerpo, pass, false)
  return { plan, palabras: escenas.map((e) => palabrasDeTexto(e.dialogo)) }
}

/** Palabras con peso de un lugar («el sofá del salón» → sofa, salon), sin tildes. */
function clavesLugar(f: string) {
  const vacias = new Set(['casa', 'mismo', 'misma', 'noche', 'tarde', 'dia', 'manana', 'otra', 'otro', 'lado', 'donde', 'desde', 'hacia', 'entre', 'sobre', 'blanco', 'fondo', 'lleno', 'llena', 'vacio', 'vacia', 'grande', 'pequeno', 'pequena', 'viejo', 'vieja'])
  return f
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4 && !vacias.has(w))
}

/**
 * Continuidad de lugares (en un vídeo de un minuto salían 15 sitios distintos, y «el sofá» se dibujaba
 * tres veces distinto): 1) un lugar que nombra lo mismo que uno anterior (sofá, cafetería…) usa su
 * MISMO texto, así se reutiliza el mismo dibujo; 2) como mucho un lugar por cada ~10 s: se quedan los
 * que más tiempo ocupan y los demás siguen en el lugar de antes. Los que pide el usuario no se tocan.
 */
export function unificarLugares<T extends { t: number; fondo: string }>(vs: T[], duracion: number, delUsuario: (v: T) => boolean): T[] {
  const out = vs.map((v) => ({ ...v }))
  const vistos: { texto: string; claves: string[] }[] = []
  for (const v of out) {
    if (/^blanco\b/i.test(v.fondo.trim()) || delUsuario(v)) continue
    const k = clavesLugar(v.fondo)
    const igual = vistos.find((l) => l.texto === v.fondo || l.claves.some((c) => k.some((w) => w.slice(0, 5) === c.slice(0, 5))))
    if (igual) v.fondo = igual.texto
    else vistos.push({ texto: v.fondo, claves: k })
  }
  const max = Math.max(2, Math.round(duracion / 10))
  const tiempo = new Map<string, number>()
  out.forEach((v, i) => {
    if (/^blanco\b/i.test(v.fondo.trim())) return
    tiempo.set(v.fondo, (tiempo.get(v.fondo) ?? 0) + ((out[i + 1]?.t ?? duracion) - v.t))
  })
  const fijos = new Set(out.filter(delUsuario).map((v) => v.fondo))
  const quedan = new Set([...fijos, ...[...tiempo.keys()].filter((f) => !fijos.has(f)).sort((a, b) => tiempo.get(b)! - tiempo.get(a)!).slice(0, Math.max(0, max - fijos.size))])
  let anterior = ''
  for (const v of out) {
    if (/^blanco\b/i.test(v.fondo.trim())) continue
    if (!quedan.has(v.fondo)) v.fondo = anterior || out.find((x) => quedan.has(x.fondo))?.fondo || v.fondo
    anterior = v.fondo
  }
  return out
}

async function dirigir(palabras: Palabra[], escenas: (Escena & { inicio: number })[], ch: Character, raiz: Part, pass: string, fps: number, onProgress?: (m: string) => void, indicaciones = '') {
  const porEscena = escenas.map((e) => palabras.filter((w) => w.t >= e.inicio - 0.05 && w.t < e.inicio + e.duracion - 0.05))
  const cuerpo = cuerpoDirector(ch, raiz, escenas, (i) => porEscena[i].map((w) => w.texto), indicaciones)
  const plan = await planDirector(cuerpo, pass, true)
  const ojosPart = ch.parts.find((p) => p.id === 'ojos')
  const { cambios, miradas, nuevas, fondos, rotulos, objetos, vinetas } = structuredClone(plan)
  // Gestos a medida: se dibujan con IA (los que ya existan en el proyecto se reutilizan)
  for (const n of (nuevas ?? []).slice(0, 8)) {
    const nombre = 't_x_' + n.nombre.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
    if (!cambios.some((c) => c.postura === 'x_' + n.nombre || c.postura === nombre)) continue
    cambios.forEach((c) => {
      if (c.postura === 'x_' + n.nombre) c.postura = nombre
    })
    const st = useStore.getState()
    if (st.project.posturasExtra?.some((e) => e.nombre === nombre)) continue
    try {
      onProgress?.(`Dibujando un gesto a medida: ${n.que_expresa}…`)
      const dib = await dibujarPostura(activeCharacter(st.project), n.dibujo)
      const lista = [...(useStore.getState().project.posturasExtra ?? []), { nombre, descripcion: n.que_expresa, ...dib, revisada: REVISION }]
      useStore.getState().setProjectProps({ posturasExtra: lista })
      await cargarExtras()
    } catch {
      // si no se puede dibujar, ese cambio se ignora y quedan los demás
    }
  }
  raiz = activeCharacter(useStore.getState().project).parts.find((p) => !p.parent) ?? raiz
  // Si la IA marca una palabra corta (y, que, el, con…), el gesto pasa a la siguiente palabra con peso
  const conPeso = (esc: number, i: number) => {
    const ws = porEscena[esc] ?? []
    let j = i
    while (ws[j] && ws[j].texto.replace(/[^\p{L}\p{N}]/gu, '').length <= 3 && j + 1 < ws.length && j - i < 2) j++
    return ws[j]
  }
  const ojos: { t: number; v: string; ease: 'salto' }[] = []
  for (const mi of [...(miradas ?? [])].sort((a, b) => a.escena - b.escena || a.palabra - b.palabra)) {
    const w = conPeso(mi.escena, mi.palabra)
    const v = mi.ojos === 'propios' ? 'nada' : mi.ojos
    if (!w || !(v === 'nada' || ojosPart?.variants[v])) continue
    ojos.push({ t: Math.max(0, Math.round((w.t - 0.05) * fps) / fps), v, ease: 'salto' })
  }
  const keys: { t: number; v: string; ease: 'salto' }[] = []
  for (const c of [...cambios].sort((a, b) => a.escena - b.escena || a.palabra - b.palabra)) {
    const w = conPeso(c.escena, c.palabra)
    if (!w || !raiz.variants[c.postura]) continue
    const t = Math.max(0, Math.round((w.t - 0.08) * fps) / fps)
    const prev = keys[keys.length - 1]
    if (prev && prev.v === c.postura) continue
    if (prev && t - prev.t < 0.9) {
      keys[keys.length - 1] = { t: prev.t, v: c.postura, ease: 'salto' } // dos cambios casi juntos: gana el último
      continue
    }
    keys.push({ t, v: c.postura, ease: 'salto' })
  }
  if (!keys.length) return null
  // Una mirada dura como mucho hasta el siguiente cambio de postura (la postura nueva trae sus ojos)
  const ojosFin: typeof ojos = []
  for (const o of ojos) {
    ojosFin.push(o)
    const sig = keys.find((k) => k.t > o.t)
    if (o.v !== 'nada' && sig && !ojos.some((x) => x.t > o.t && x.t < sig.t)) ojosFin.push({ t: sig.t, v: 'nada', ease: 'salto' })
  }
  // Viñetas (montaje): cada una empieza justo antes de su palabra; la primera, al principio
  const fin = escenas.length ? escenas[escenas.length - 1].inicio + escenas[escenas.length - 1].duracion : 0
  const vins: Vineta[] = []
  for (const v of [...(vinetas ?? [])].sort((a, b) => a.escena - b.escena || a.palabra - b.palabra)) {
    const e = escenas[v.escena]
    const w = porEscena[v.escena]?.[v.palabra]
    if (!e) continue
    let t = v.palabra === 0 || !w ? e.inicio : Math.max(e.inicio, Math.round((w.t - 0.08) * fps) / fps)
    if (!vins.length) t = 0
    // Cortes demasiado seguidos: se queda el último
    if (vins.length && t - vins[vins.length - 1].t < 1.2) vins.pop()
    if (!vins.length) t = 0
    vins.push({ t, escena: v.escena, fondo: v.fondo.trim() || 'blanco', plano: v.tamano, lado: v.lado ?? 'centro' })
  }
  // Lo que aparece en escena se va al cortar a la viñeta siguiente (o al acabar su escena si no hay viñetas)
  const finDe = (t: number, esc: number) => {
    const sig = vins.find((v) => v.t > t + 1e-3)
    const e = escenas[esc]
    return vins.length ? (sig ? sig.t : fin) : e.inicio + e.duracion
  }
  // Índice de la viñeta en la que cae un instante
  const vinDe = (t: number) => {
    let k = -1
    vins.forEach((v, i) => {
      if (v.t <= t + 1e-3) k = i
    })
    return k >= 0 ? k : undefined
  }
  // Rótulos: aparecen en su palabra y se quedan hasta que acaba la escena
  const rots: Rotulo[] = []
  for (const r of rotulos ?? []) {
    const w = porEscena[r.escena]?.[r.palabra]
    const e = escenas[r.escena]
    if (!w || !e || !r.texto.trim()) continue
    const tr = Math.round(w.t * fps) / fps
    rots.push({ id: `r${r.escena}-${r.palabra}-${rots.length}`, t: tr, fin: Math.max(finDe(tr, r.escena), Math.min(tr + 1.6, e.inicio + e.duracion + 1)), texto: r.texto.trim().slice(0, 40), color: r.color, pos: r.pos, estilo: r.estilo, flecha: r.flecha, vin: vinDe(tr) })
  }
  // Texto escaso (como «Estoy Tiesa»): como mucho 1 rótulo por viñeta (3 si el usuario pide rótulos en esa
  // escena) y uno cada 5 s en total; los que pide el usuario van primero
  {
    const pedido = (r: Rotulo) => {
      const e = escenas.find((x) => r.t >= x.inicio - 0.05 && r.t < x.inicio + x.duracion)
      return /r[óo]tulo/i.test(e?.indicaciones ?? '')
    }
    const porVin = new Map<string, Rotulo[]>()
    for (const r of rots) {
      const k = String(r.vin ?? r.fin)
      porVin.set(k, [...(porVin.get(k) ?? []), r])
    }
    const prioridad = (r: Rotulo) => (pedido(r) ? 0 : r.estilo === 'cartel' ? 1 : r.estilo === 'nota' ? 2 : 3)
    let quedan: Rotulo[] = []
    for (const lista of porVin.values()) {
      const max = lista.some(pedido) ? 3 : 1
      quedan.push(...[...lista].sort((a, b) => prioridad(a) - prioridad(b) || b.t - a.t).slice(0, max))
    }
    const tope = Math.max(2, Math.ceil(fin / 5))
    if (quedan.length > tope) quedan = [...quedan].sort((a, b) => prioridad(a) - prioridad(b)).slice(0, tope)
    const ids = new Set(quedan.map((r) => r.id))
    rots.splice(0, rots.length, ...rots.filter((r) => ids.has(r.id)))
  }
  // Objetos: aparecen en su palabra (un pelín antes) y se quedan hasta el final de la escena
  const objs: ObjetoPedido[] = []
  for (const o of objetos ?? []) {
    const w = conPeso(o.escena, o.palabra)
    const e = escenas[o.escena]
    if (!w || !e || !o.dibujo.trim()) continue
    const to = Math.max(e.inicio, Math.round((w.t - 0.08) * fps) / fps)
    objs.push({ flecha: o.flecha, vin: vinDe(to), t: to, fin: finDe(to, o.escena), pos: o.pos, que: o.que, dibujo: o.dibujo.trim() })
  }
  // Nada flotando sin sentido: lo que no sujeta ni tiene delante va en un bocadillo (algo que imagina),
  // como mucho uno por viñeta
  {
    const conBocadillo = new Set<string>()
    const quedan = objs.filter((o) => {
      if (o.pos === 'mano' || o.pos === 'delante') return true
      const k = String(o.vin ?? o.fin)
      if (conBocadillo.has(k)) return false
      conBocadillo.add(k)
      o.pos = 'pensamiento'
      return true
    })
    objs.splice(0, objs.length, ...quedan)
  }
  const fondoDe = new Map((fondos ?? []).map((f) => [f.escena, f.fondo.trim()]))
  return {
    posturas: keys,
    ojos: ojosFin.length ? [{ t: 0, v: 'nada', ease: 'salto' as const }, ...ojosFin] : [],
    rotulos: rots,
    objetos: objs,
    vinetas: vins,
    fondos: escenas.map((_, i) => fondoDe.get(i) ?? ''),
  }
}

function wav(buf: AudioBuffer): Blob {
  const data = buf.getChannelData(0)
  const sr = buf.sampleRate
  const out = new DataView(new ArrayBuffer(44 + data.length * 2))
  const w = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF')
  out.setUint32(4, 36 + data.length * 2, true)
  w(8, 'WAVEfmt ')
  out.setUint32(16, 16, true)
  out.setUint16(20, 1, true)
  out.setUint16(22, 1, true)
  out.setUint32(24, sr, true)
  out.setUint32(28, sr * 2, true)
  out.setUint16(32, 2, true)
  out.setUint16(34, 16, true)
  w(36, 'data')
  out.setUint32(40, data.length * 2, true)
  for (let i = 0; i < data.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 0x7fff, true)
  return new Blob([out], { type: 'audio/wav' })
}

const LEAD = 0.15 // la frase empieza un poco después del corte de cámara
const TAIL = 0.6 // respiro al final del vídeo

/**
 * Voz del guion: se lee entero de una vez con ElevenLabs, el audio se reparte entre las escenas según
 * cuándo empieza cada frase, las escenas duran lo que su frase y la boca sigue las letras.
 */
export async function voiceScript(escenas: Escena[], texto: string, voz: Voz, pass: string, onProgress: (msg: string) => void, modelo: Modelo = 'eleven_multilingual_v2', indicaciones = '') {
  let aviso = ''
  const conTexto = escenas.map((e, i) => ({ i, d: e.dialogo.trim() })).filter((x) => x.d)
  if (!conTexto.length) throw new Error('Ninguna escena tiene diálogo.')
  // Texto completo y dónde empieza cada frase dentro de él
  let completo = ''
  const rangos = new Map<number, [number, number]>()
  for (const { i, d } of conTexto) {
    // Texto seguido (un espacio, no párrafos): ElevenLabs lo lee de corrido, sin pausa ni cambio de
    // entonación en cada escena
    if (completo) completo += ' '
    rangos.set(i, [completo.length, completo.length + d.length])
    completo += d
  }
  onProgress(`Generando la voz (${voz.nombre})…`)
  const leida = await lectura(completo, voz.id, modelo, pass)
  // Las pausas largas entre frases (0,5-0,8 s de silencio total) sonaban a voz entrecortada: se acortan
  const { buf, al } = acortarPausas(leida.buf, leida.al)
  const ini = al.character_start_times_seconds
  const finT = al.character_end_times_seconds
  // Tramo de audio de cada escena: desde un poco antes de su primera letra hasta antes de la siguiente frase
  const tramoAudio = new Map<number, [number, number]>()
  conTexto.forEach(({ i }, k) => {
    const [a, b] = rangos.get(i)!
    const desde = Math.max(0, ini[a] - 0.06)
    const sig = conTexto[k + 1] ? rangos.get(conTexto[k + 1].i)![0] : null
    const hasta = sig !== null ? Math.max(finT[b - 1], ini[sig] - 0.06) : Math.min(buf.duration, finT[b - 1] + 0.25)
    tramoAudio.set(i, [desde, hasta])
  })
  // Sin huecos: cada escena dura exactamente su tramo de audio (el respiro inicial solo en la primera
  // y el final solo en la última), así la voz suena seguida como la leyó ElevenLabs
  const fps0 = useStore.getState().project.fps
  const ajustadas = escenas.map((e, i) => {
    const tr = tramoAudio.get(i)
    const extra = (i === 0 ? LEAD : 0) + (i === escenas.length - 1 ? TAIL : 0)
    // El tamaño que pida el usuario en las indicaciones manda («pequeño», «primer plano»…)
    const pl = planoDeIndicaciones(e.indicaciones)
    const e2 = pl ? { ...e, plano: pl } : e
    return tr ? { ...e2, duracion: Math.round((tr[1] - tr[0] + extra) * fps0) / fps0 } : e2
  })

  onProgress('Montando la animación…')
  const st = useStore.getState()
  const ch = activeCharacter(st.project)
  const m = animateScenes(ajustadas, st.project, ch)

  const sr = 44100
  const ctx = new OfflineAudioContext(1, Math.ceil((m.duration + 0.5) * sr), sr)
  const sitio = new Map<number, number>() // desplazamiento: tiempo del audio -> tiempo del vídeo
  // Las escenas seguidas con texto suenan como UN solo trozo continuo (sin cortes entre escenas)
  type Tramo = { pos: number; desde: number; hasta: number; escenas: number[] }
  const tramos: Tramo[] = []
  let tramo: Tramo | null = null as Tramo | null
  m.escenas.forEach((e, i) => {
    const tr = tramoAudio.get(i)
    if (!tr) {
      tramo = null
      return
    }
    if (tramo && Math.abs(tramo.hasta - tr[0]) < 1e-3) {
      tramo.hasta = tr[1]
      tramo.escenas.push(i)
    } else {
      tramo = { pos: e.inicio + (i === 0 ? LEAD : 0), desde: tr[0], hasta: tr[1], escenas: [i] }
      tramos.push(tramo)
    }
  })
  for (const tr of tramos) {
    const node = ctx.createBufferSource()
    node.buffer = buf
    node.connect(ctx.destination)
    node.start(tr.pos, tr.desde, tr.hasta - tr.desde)
    for (const i of tr.escenas) sitio.set(i, tr.pos - tr.desde)
  }
  const mezcla = await ctx.startRendering()
  const audioId = `voces-${Date.now()}`
  await saveAudio(audioId, wav(mezcla))

  // Cada letra se lleva al momento del vídeo en que suena (según el tramo de su escena)
  const desplaza = (t: number) => {
    for (const [i, [a, b]] of tramoAudio) if (t >= a - 1e-3 && t < b) return t + sitio.get(i)!
    return null
  }
  const mouths = ch.expresivo ? ['cerrada', 'abierta', 'O', 'MBP'] : Object.keys(ch.parts.find((p) => p.role === 'mouth')?.variants ?? {})
  const tracks: Tracks = { ...m.tracks, 'face:mouth': ch.expresivo ? silabas(al, desplaza, st.project.fps) : visemas(al, desplaza, st.project.fps, mouths) }

  // Personaje por poses: los cambios de pose sueltos caen al empezar una palabra, como al gesticular
  const raiz = ch.parts.find((p) => !p.parent && Object.keys(p.variants).length > 1)
  const canal = raiz ? `part:${raiz.id}:v` : ''
  if (raiz && tracks[canal]?.length) {
    const palabras: number[] = []
    for (let i = 0; i < al.characters.length; i++) {
      const c = al.characters[i]
      const antes = i > 0 ? al.characters[i - 1] : ' '
      if (/[\p{L}\p{N}]/u.test(c) && !/[\p{L}\p{N}]/u.test(antes)) {
        const tv = desplaza(al.character_start_times_seconds[i])
        if (tv !== null) palabras.push(tv)
      }
    }
    const ks = [...tracks[canal]].sort((a, b) => a.t - b.t)
    const fps = st.project.fps
    for (let i = 0; i < ks.length; i++) {
      const antes = i > 0 ? ks[i].t - ks[i - 1].t : Infinity
      const despues = i + 1 < ks.length ? ks[i + 1].t - ks[i].t : Infinity
      if (!palabras.length) continue
      if (!ch.expresivo && (antes < 0.6 || despues < 0.6)) continue // secuencias rápidas (saludar) no se tocan
      // Cada cambio cae justo antes de empezar la palabra más cercana (el expresivo, siempre)
      const cerca = palabras.reduce((b, w) => (Math.abs(w - 0.08 - ks[i].t) < Math.abs(b - 0.08 - ks[i].t) ? w : b))
      const nuevo = Math.round((cerca - 0.08) * fps) / fps
      const max = ch.expresivo ? 0.9 : 0.35
      if (Math.abs(nuevo - ks[i].t) <= max && (i === 0 || nuevo - ks[i - 1].t > 0.3) && (i + 1 >= ks.length || ks[i + 1].t - nuevo > 0.3)) ks[i] = { ...ks[i], t: nuevo }
    }
    tracks[canal] = ks
  }

  // Gesticulación según lo que dice: cabeceos, cejas, parpadeos en pausas y emoción de la escena
  const palabras: Palabra[] = []
  let enPregunta = false
  for (let i = 0; i < al.characters.length; i++) {
    const c = al.characters[i]
    if (c === '¿') enPregunta = true
    const antes = i > 0 ? al.characters[i - 1] : ' '
    if (/[\p{L}\p{N}]/u.test(c) && !/[\p{L}\p{N}]/u.test(antes)) {
      let j = i
      while (j + 1 < al.characters.length && /[\p{L}\p{N}]/u.test(al.characters[j + 1])) j++
      const t0 = desplaza(al.character_start_times_seconds[i])
      const t1 = desplaza(al.character_end_times_seconds[j])
      const sigue = al.characters.slice(j + 1, j + 4).join('')
      const punt = (sigue.match(/^\s*([,.;:?!…])/) ?? [])[1] ?? ''
      if (t0 !== null && t1 !== null) palabras.push({ t: t0, fin: t1, texto: al.characters.slice(i, j + 1).join(''), punt, pregunta: enPregunta })
      if (punt === '?') enPregunta = false
    }
  }
  let rotulosNuevos: Rotulo[] | null = null
  let fondosNuevos: string[] | null = null
  let objetosNuevos: ObjetoPedido[] | null = null
  let vinetasNuevas: Vineta[] | null = null
  // Expresivo: una IA «directora» decide en qué palabra cambia de postura y a cuál, según lo que dice
  if (ch.expresivo && raiz && palabras.length) {
    onProgress('Dirigiendo los gestos según el guion…')
    const dir = await dirigir(palabras, m.escenas, ch, raiz, pass, st.project.fps, onProgress, indicaciones).catch((e) => {
      aviso = `La IA directora no respondió (${e instanceof Error ? e.message : e}); los gestos se han elegido con reglas simples.`
      return null
    })
    if (dir) {
      tracks[`part:${raiz.id}:v`] = dir.posturas
      // Lo que sujeta en la mano: en esa palabra pasa a la postura de sujetar y la mantiene un rato
      const palma = ch.expresivo?.palma
      if (palma && raiz.variants[palma.postura]) {
        for (const o of dir.objetos.filter((x) => x.pos === 'mano')) {
          const ks = (tracks[`part:${raiz.id}:v`] ?? []).filter((k) => k.t < o.t - 1e-3 || k.t >= o.t + 1.5)
          ks.push({ t: o.t, v: palma.postura, ease: 'salto' })
          tracks[`part:${raiz.id}:v`] = ks.sort((a, b) => a.t - b.t)
        }
      }
      if (dir.ojos.length) tracks['face:brows'] = dir.ojos
      rotulosNuevos = dir.rotulos
      fondosNuevos = dir.fondos
      // Un bocadillo que repite lo que ya está haciendo (el móvil en la mano y un móvil en el bocadillo) sobra
      {
        const extras = useStore.getState().project.posturasExtra ?? []
        const claves = [...(tracks[`part:${raiz.id}:v`] ?? [])].sort((a, b) => a.t - b.t)
        const palabras = (x: string) => new Set(x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z]+/).filter((w) => w.length >= 4))
        dir.objetos = dir.objetos.filter((o) => {
          if (o.pos !== 'pensamiento') return true
          const activa = claves.filter((k) => k.t <= o.t + 1e-3).pop()?.v
          const ex = typeof activa === 'string' ? extras.find((e) => e.nombre === activa) : undefined
          if (!ex) return true
          const enGesto = palabras(ex.nombre.replace('t_x_', '') + ' ' + ex.descripcion)
          return ![...palabras(o.que)].some((w) => [...enGesto].some((g) => g.startsWith(w.slice(0, 5)) || w.startsWith(g.slice(0, 5))))
        })
      }
      objetosNuevos = dir.objetos
      if (dir.vinetas.length) vinetasNuevas = dir.vinetas
    }
  }
  // Montaje por viñetas: lo que pida el usuario en cada escena manda (fondo y tamaño); con «plano fijo»
  // (todas las escenas en general) no hay cambios de tamaño
  if (vinetasNuevas) {
    const fijo = m.escenas.every((e) => e.plano === 'general')
    vinetasNuevas = vinetasNuevas.map((v) => {
      const e = m.escenas[v.escena]
      return {
        ...v,
        fondo: fondoDeIndicaciones(e.indicaciones) || v.fondo,
        plano: planoDeIndicaciones(e.indicaciones) || (fijo ? 'general' : v.plano),
      }
    })
    vinetasNuevas = unificarLugares(vinetasNuevas, m.duration, (v) => !!fondoDeIndicaciones(m.escenas[v.escena]?.indicaciones))
    // «Pequeño» solo tiene sentido en un lugar; en blanco queda un muñequito perdido (y en horizontal,
    // el cuerpo entero sobre blanco también)
    const ancho = st.project.width > st.project.height
    vinetasNuevas = vinetasNuevas.map((v) =>
      /^blanco\b/i.test(v.fondo) && (v.plano === 'lejos' || (ancho && v.plano === 'general')) ? { ...v, plano: 'medio' } : v,
    )
    // Una viñeta a un lado sin nada que mostrar en el otro queda coja: al centro
    // y el lado NO cambia al azar: se mantiene mientras siga en el mismo lugar (mismo fondo seguido) y
    // solo cambia al cambiar de lugar. Un tramo sin nada que mostrar va al centro.
    const conContenido = new Set([...(rotulosNuevos ?? []), ...(objetosNuevos ?? [])].map((x) => x.vin))
    {
      const vs = vinetasNuevas
      let i = 0
      while (i < vs.length) {
        let j = i
        while (j + 1 < vs.length && vs[j + 1].fondo === vs[i].fondo) j++
        const idx = Array.from({ length: j - i + 1 }, (_, k) => i + k)
        const conAlgo = idx.filter((k) => conContenido.has(k))
        const lado = conAlgo.length ? (conAlgo.map((k) => vs[k].lado).find((l) => l !== 'centro') ?? 'izq') : 'centro'
        for (const k of idx) vs[k] = { ...vs[k], lado }
        i = j + 1
      }
    }
    // En vertical no hay sitio a los lados: siempre en el centro (el contenido va arriba y a los lados)
    if (st.project.width <= st.project.height * 1.1) vinetasNuevas = vinetasNuevas.map((v) => ({ ...v, lado: 'centro' as const }))
    for (const c of Object.keys(tracks)) if (c.startsWith('cam:') || c === `part:${raiz?.id}:scale` || c === `part:${raiz?.id}:x`) delete tracks[c]
    for (const v of vinetasNuevas) {
      const s0 = encuadre(v.plano, st.project, ch)
      for (const [canal, val] of [['cam:zoom', s0.zoom], ['cam:x', s0.x], ['cam:y', s0.y]] as const)
        tracks[canal] = [...(tracks[canal] ?? []), { t: v.t, v: Math.round(val * 1000) / 1000, ease: 'salto' }]
      if (raiz) tracks[`part:${raiz.id}:scale`] = [...(tracks[`part:${raiz.id}:scale`] ?? []), { t: v.t, v: v.plano === 'lejos' ? 0.7 : 1, ease: 'salto' }]
      // A un lado (como «Estoy Tiesa»): el personaje se desplaza y el otro lado queda para el contenido
      if (raiz) {
        const W = st.project.width
        const inst0 = st.project.instances[0]
        const objetivo = v.lado === 'izq' ? W * 0.27 : v.lado === 'der' ? W * 0.73 : W / 2
        const dx = (objetivo - W / 2) / s0.zoom / inst0.scale
        tracks[`part:${raiz.id}:x`] = [...(tracks[`part:${raiz.id}:x`] ?? []), { t: v.t, v: Math.round(dx), ease: 'salto' }]
      }
    }
    fondosNuevos = null
  }
  // El fondo que escriba el usuario en las indicaciones («Fondo: un salón…») manda sobre el director
  const pedidos = m.escenas.map((e) => fondoDeIndicaciones(e.indicaciones))
  if (!vinetasNuevas && pedidos.some(Boolean)) fondosNuevos = m.escenas.map((e, i) => pedidos[i] || fondosNuevos?.[i] || e.fondo || '')
  const conGestos = gesticular(tracks, palabras, ch, m.escenas)

  const [inst, ...rest] = useStore.getState().project.instances
  // Proyecto actual (puede traer gestos a medida recién dibujados)
  const actual = useStore.getState().project
  st.commit({
    ...actual,
    duration: m.duration,
    audio: { id: audioId, name: `Voces (${voz.nombre})`, start: 0, duration: mezcla.duration },
    guion: { texto, escenas: m.escenas.map(({ inicio: _i, ...e }, i) => ({ ...e, fondo: fondosNuevos?.[i] || e.fondo })), voz, indicaciones },
    instances: [{ ...inst, tracks: conGestos }, ...rest],
    ...(rotulosNuevos ? { rotulos: rotulosNuevos } : {}),
    vinetas: vinetasNuevas ? vinetasNuevas.map((v, i) => ({ t: v.t, fin: vinetasNuevas![i + 1]?.t ?? m.duration, lado: v.lado })) : undefined,
  })
  // Fondos de cada escena (lugares dibujados en el estilo del personaje o blanco), ya en su sitio
  if (fondosNuevos?.some(Boolean)) {
    try {
      await generateSceneBackgrounds(useStore.getState().project.guion!.escenas, onProgress)
    } catch (e) {
      aviso += ` No se pudieron generar los fondos: ${e instanceof Error ? e.message : e}.`
    }
  }
  // Fondos de cada viñeta
  if (vinetasNuevas) {
    try {
      await fondosPorVinetas(vinetasNuevas, onProgress)
    } catch (e) {
      aviso += ` No se pudieron generar los fondos: ${e instanceof Error ? e.message : e}.`
    }
  }
  // Objetos que aparecen en escena (lo que cuenta, dibujado), como en «Estoy Tiesa»
  if (objetosNuevos) {
    const fallos = await ponerObjetos(objetosNuevos, onProgress).catch(() => objetosNuevos!.length)
    if (fallos) aviso += ` No se pudieron dibujar ${fallos} objeto(s) de las escenas.`
  }
  st.setTime(0)
  st.setPlaying(true)
  return { escenas: ajustadas, duracion: m.duration, aviso }
}
