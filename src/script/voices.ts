// Voces del guion con ElevenLabs: una voz por escena con diálogo. Cada audio se guarda en el
// navegador por voz + texto, así repetir el montaje no gasta caracteres de nuevo. Las escenas se
// alargan o acortan a lo que dura su frase, los audios se unen en una sola pista y la boca se
// sincroniza con ella.

import { gesticular, type Palabra } from './emocion'
import { decodeAudio, loadAudio, saveAudio } from '../audio/storage'
import type { Character, Escena, Objeto, Part, Plano, Rotulo, Tracks } from '../model/types'
import { fondosPorVinetas, generateSceneBackgrounds } from './images'
import { encuadre, escalaPlano, fondoDeIndicaciones, planoDeIndicaciones, scenesFromText } from './scenes'
import { DESCRIPCIONES, MIRADAS } from '../model/characters/chicoRosaExpresivo'
import { cargarExtras, dibujarPostura, REVISION } from './posturas'
import { ponerObjetos, type ObjetoPedido } from './objetos'
import { activeCharacter, useStore } from '../store'
import { REPARTO } from '../model/reparto'
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

/** Voz propia: el audio que sube el usuario, guardado en el navegador. */
export type VozPropia = { audioId: string; nombre: string }

/**
 * Transcribe la voz propia con ElevenLabs y la convierte en la misma «alineación» (cada letra con su
 * instante) que da la voz generada; así todo lo demás (boca, director, viñetas) funciona igual. Se manda
 * a 16 kHz mono en trozos de 100 s (límite de tamaño del servidor) y se guarda: no se paga dos veces.
 */
async function lecturaPropia(propia: VozPropia, pass: string, onProgress: (m: string) => void): Promise<{ buf: AudioBuffer; al: Alineacion }> {
  const buf = await decodeAudio(propia.audioId)
  if (!buf) throw new Error('No encuentro tu audio en este navegador: vuelve a subirlo.')
  const idAl = `stt-${propia.audioId}`
  const guardada = await loadAudio(idAl)
  if (guardada) return { buf, al: JSON.parse(await guardada.text()) }
  const sr = 16000
  const off = new OfflineAudioContext(1, Math.ceil(buf.duration * sr), sr)
  const src = off.createBufferSource()
  src.buffer = buf
  src.connect(off.destination)
  src.start()
  const mono = await off.startRendering()
  const al: Alineacion = { characters: [], character_start_times_seconds: [], character_end_times_seconds: [] }
  const TROZO = 100
  const nTrozos = Math.ceil(mono.duration / TROZO)
  for (let k = 0; k < nTrozos; k++) {
    onProgress(nTrozos > 1 ? `Escuchando tu voz (${k + 1} de ${nTrozos})…` : 'Escuchando tu voz…')
    const a = Math.round(k * TROZO * sr), b = Math.min(mono.length, Math.round((k + 1) * TROZO * sr))
    const parte = new AudioBuffer({ length: b - a, numberOfChannels: 1, sampleRate: sr })
    parte.copyToChannel(mono.getChannelData(0).slice(a, b), 0)
    const res = await fetch('/api/transcribir', { method: 'POST', headers: { 'content-type': 'audio/wav', 'x-clave-estudio': pass }, body: wav(parte) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(res.status === 401 ? 'La contraseña del estudio no es correcta.' : d.error ?? `Error ${res.status}`)
    const t0 = k * TROZO
    if (al.characters.length) {
      al.characters.push(' ')
      al.character_start_times_seconds.push(t0)
      al.character_end_times_seconds.push(t0)
    }
    for (const w of d.palabras as { texto: string; inicio: number; fin: number; tipo: string }[]) {
      const letras = [...(w.tipo === 'spacing' ? ' ' : w.texto)]
      const dur = Math.max(0, w.fin - w.inicio) / Math.max(1, letras.length)
      letras.forEach((c, i) => {
        al.characters.push(c)
        al.character_start_times_seconds.push(t0 + w.inicio + i * dur)
        al.character_end_times_seconds.push(t0 + w.inicio + (i + 1) * dur)
      })
    }
  }
  if (!al.characters.some((c) => /\p{L}/u.test(c))) throw new Error('No se entiende ninguna palabra en tu audio (¿es solo voz, sin música?).')
  await saveAudio(idAl, new Blob([JSON.stringify(al)], { type: 'application/json' }))
  return { buf, al }
}

const normal = (w: string) => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Palabras de la alineación con el índice de su primera y última letra. */
function palabrasDeAlineacion(al: Alineacion) {
  const out: { texto: string; a: number; b: number }[] = []
  for (let i = 0; i < al.characters.length; i++) {
    if (!/[\p{L}\p{N}]/u.test(al.characters[i]) || (i > 0 && /[\p{L}\p{N}]/u.test(al.characters[i - 1]))) continue
    let j = i
    while (j + 1 < al.characters.length && /[\p{L}\p{N}]/u.test(al.characters[j + 1])) j++
    out.push({ texto: al.characters.slice(i, j + 1).join(''), a: i, b: j + 1 })
  }
  return out
}

/**
 * Dónde cae cada escena en la voz propia: se empareja el texto de las escenas con lo que se oye (aunque
 * no sea idéntico: palabras de más o de menos) y cada escena va desde su primera palabra reconocida hasta
 * la siguiente escena. Devuelve el rango de letras de cada escena en la alineación.
 */
function rangosEnVozPropia(al: Alineacion, conTexto: { i: number; d: string }[]) {
  const oidas = palabrasDeAlineacion(al)
  const guion: { esc: number; w: string }[] = conTexto.flatMap(({ i, d }) => palabrasDeTexto(d).map((w) => ({ esc: i, w: normal(w) })))
  const A = oidas.map((o) => normal(o.texto)), B = guion.map((g) => g.w)
  const n = A.length, m = B.length
  // Emparejamiento por la subsecuencia común más larga
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let x = n - 1; x >= 0; x--) for (let y = m - 1; y >= 0; y--) L[x][y] = A[x] === B[y] ? L[x + 1][y + 1] + 1 : Math.max(L[x + 1][y], L[x][y + 1])
  const parejas: { x: number; esc: number }[] = []
  for (let x = 0, y = 0; x < n && y < m; ) {
    if (A[x] === B[y]) {
      parejas.push({ x, esc: guion[y].esc })
      x++
      y++
    } else if (L[x + 1][y] >= L[x][y + 1]) x++
    else y++
  }
  // Una escena cuenta como dicha si se reconoce una parte razonable de sus palabras (si no, coincidencias
  // sueltas de «la», «no», «en»… le daban un trozo de audio que no era suyo)
  const primera = new Map<number, number>() // escena -> índice de la primera palabra oída que le corresponde
  for (const { i } of conTexto) {
    const total = guion.filter((g) => g.esc === i).length
    const suyas = parejas.filter((p) => p.esc === i)
    const largas = suyas.filter((p) => A[p.x].length >= 4).length
    if (suyas.length >= Math.max(2, total * 0.4) && largas >= 1) primera.set(i, suyas[0].x)
  }
  const rangos = new Map<number, [number, number]>()
  const orden = conTexto.map((c) => c.i).filter((i) => primera.has(i))
  orden.forEach((i, k) => {
    const desde = k === 0 ? 0 : primera.get(i)!
    const hasta = k + 1 < orden.length ? primera.get(orden[k + 1])! : oidas.length
    if (hasta <= desde) return
    rangos.set(i, [oidas[desde].a, oidas[hasta - 1].b])
  })
  return rangos
}

/** Si no hay guion escrito, las escenas salen de lo que se oye (una o dos frases cada una). */
export function escenasDeVoz(al: Alineacion): Escena[] {
  const texto = al.characters.join('').replace(/\s+/g, ' ').trim()
  const frases = texto.match(/[^.!?…]+[.!?…]*/g)?.map((f) => f.trim()).filter(Boolean) ?? [texto]
  const trozos: string[] = []
  let actual = ''
  for (const f of frases) {
    if (actual && (actual + ' ' + f).split(' ').length > 22) {
      trozos.push(actual)
      actual = f
    } else actual = actual ? actual + ' ' + f : f
  }
  if (actual) trozos.push(actual)
  return scenesFromText(trozos.join('\n')).map((e) => ({ ...e, gestos: [] }))
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

export type Movimiento = 'ninguno' | 'entra' | 'sale' | 'se_mueve' | 'salta'
export type Vineta = { t: number; escena: number; fondo: string; plano: Plano; lado: 'izq' | 'centro' | 'der'; inserto?: string; movimiento?: Movimiento; hacia?: 'izq' | 'centro' | 'der'; cambio?: string; otro?: [number, number] }

/** Pide a /api/actuar las posturas por palabra y las convierte en claves exactas (0,08 s antes). */
/**
 * Modo de montaje: «escenas» (como Estoy Tiesa: cada plano es un dibujo de la situación con el protagonista
 * dentro y su boca animada encima) o «muneco» (el personaje de posturas delante de fondos).
 */
export type ModoVideo = 'escenas' | 'muneco'
export const MODO_KEY = 'estudio-animacion:modo'
export function modoVideo(): ModoVideo {
  try {
    return localStorage.getItem(MODO_KEY) === 'muneco' ? 'muneco' : 'escenas'
  } catch {
    return 'escenas'
  }
}

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
    modo: modoVideo(),
    // En modo escenas las acciones y la gente van dibujadas en cada plano: sin gestos a medida ni reparto
    nuevasMax: modoVideo() === 'escenas' ? 0 : ch.expresivo?.base ? Math.min(8, 5 + escenas.filter((e) => e.indicaciones?.trim()).length) : 0,
    escenografia: true,
    objetosMax: Math.min(16, 4 * escenas.length),
    vinetas: true,
    reparto: modoVideo() === 'escenas' ? {} : Object.fromEntries(REPARTO.map((r) => [r.id, { quien: r.quien, posturas: r.posturas }])),
    ...(ojosPart ? { miradas: Object.fromEntries(Object.entries(MIRADAS).filter(([k]) => k === 'propios' || ojosPart.variants[k])) } : {}),
  }
}

/** Clave del plan: el mismo guion (palabras de cada escena) con las mismas indicaciones = el mismo plan. */
const clavePlan = (cuerpo: { escenas: unknown; indicaciones?: string; modo?: string }) => hash(JSON.stringify({ e: cuerpo.escenas, i: cuerpo.indicaciones ?? '', m: cuerpo.modo ?? '' }))

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
  vinetas?: { escena: number; palabra: number; idea?: string; motivo?: string; fondo: string; tamano: Plano; lado?: Vineta['lado']; inserto?: string; movimiento?: Movimiento; hacia?: Vineta['lado']; cambio?: string; palabra_cambio?: number; cambio2?: string; palabra_cambio2?: number; cambio3?: string; palabra_cambio3?: number; cambio4?: string; palabra_cambio4?: number }[]
  objetos?: { escena: number; palabra: number; que: string; dibujo: string; pos: Objeto['pos']; flecha?: boolean; motivo?: string; movimiento?: Objeto['mov']; hacia?: Objeto['hacia']; tamano?: Objeto['tam'] }[]
  fondos?: { escena: number; fondo: string }[]
  rotulos?: { escena: number; palabra: number; texto: string; color: Rotulo['color']; pos: Rotulo['pos']; estilo?: Rotulo['estilo']; flecha?: boolean; motivo?: string }[]
  cambios: { escena: number; palabra: number; postura: string; motivo?: string }[]
  miradas?: { escena: number; palabra: number; ojos: string }[]
  nuevas?: { nombre: string; dibujo: string; que_expresa: string; motivo?: string }[]
  secundarios?: { quien: string; escena: number; palabra: number; postura: string; lado: 'izq' | 'der'; movimiento: 'ninguno' | 'entra' | 'sale'; motivo?: string }[]
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

/**
 * EL PERSONAJE SE MUEVE (como en un capítulo de dibujos, no un busto parlante): entra en escena caminando,
 * va a otro sitio, sale o salta. Caminar = los dos dibujos de paso (t_andar_a/b) alternándose cada 0,16 s
 * con un bote, deslizándose por la pantalla; los dibujos caminan hacia la izquierda, así que hacia la
 * derecha se dibuja en espejo (canal `pj:espejo`). Al llegar vuelve a la postura que tocaba.
 */
function moverPersonaje(tracks: Tracks, vinetas: Vineta[], dur: number, raiz: Part, project: { width: number; height: number; fps: number; instances: { scale: number }[] }, ch: Character) {
  if (!raiz.variants.t_andar_a || !raiz.variants.t_andar_b) return
  const R = raiz.id
  const X = `part:${R}:x`, Y = `part:${R}:y`, V = `part:${R}:v`, E = 'pj:espejo'
  const W = project.width
  const vertical = W <= project.height * 1.1
  const fps = project.fps
  const r = (t: number) => Math.round(t * fps) / fps
  const sitio = { izq: vertical ? 0.3 : 0.27, centro: 0.5, der: vertical ? 0.7 : 0.73 }
  const valor = (canal: string, t: number) => {
    const ks = (tracks[canal] ?? []).filter((k) => k.t <= t + 1e-4)
    return ks.length ? ks[ks.length - 1].v : undefined
  }
  const quitar = (canal: string, a: number, b: number) => (tracks[canal] = (tracks[canal] ?? []).filter((k) => k.t < a - 1e-4 || k.t > b + 1e-4))
  const poner = (canal: string, t: number, v: number | string, ease: 'salto' | 'lineal' | 'suave') => {
    tracks[canal] = [...(tracks[canal] ?? []).filter((k) => Math.abs(k.t - t) > 1e-4), { t, v, ease }].sort((a, b) => a.t - b.t)
  }
  // Moverse solo cuando tiene sentido en un capítulo (si no, «se mueve raro, sin sentido»): entra solo en
  // la PRIMERA viñeta de un lugar, sale solo en la ÚLTIMA, cambiar de sitio como mucho una vez por vídeo, el
  // respingo solo con una cara exagerada, y en total como mucho un movimiento cada ~8 s
  const conCuerpo = vinetas.filter((x) => !x.inserto)
  let cambios = 0, ultimoMov = -99
  for (const v of vinetas) {
    if (!v.movimiento || v.inserto) continue
    const k = conCuerpo.indexOf(v)
    const primeraDelLugar = k === 0 || conCuerpo[k - 1].fondo !== v.fondo
    const ultimaDelLugar = k === conCuerpo.length - 1 || conCuerpo[k + 1].fondo !== v.fondo
    const postura = String(valor(V, v.t + 0.3) ?? '')
    const ok =
      (v.movimiento === 'entra' && primeraDelLugar) ||
      (v.movimiento === 'sale' && ultimaDelLugar && k < conCuerpo.length - 1) ||
      (v.movimiento === 'se_mueve' && cambios++ < 1) ||
      (v.movimiento === 'salta' && /^t_e_|^(enfado|llorar|celebrar|mejillas|stop)$/.test(postura))
    if (!ok || v.t - ultimoMov < 8) v.movimiento = undefined
    else ultimoMov = v.t
  }
  // Donde se quedó tras moverse: en las viñetas siguientes del mismo lugar sigue ahí (no salta de sitio)
  let ultimo: { fondo: string; frac: number } | null = null
  vinetas.forEach((v, i) => {
    const t0 = v.t, t1 = vinetas[i + 1]?.t ?? dur
    const zoom = encuadre(v.plano, project as never, ch).zoom
    const dxDe = (frac: number) => Math.round(((frac - 0.5) * W) / zoom / project.instances[0].scale)
    if (v.inserto) return
    if (ultimo && ultimo.fondo !== v.fondo) ultimo = null
    if (!v.movimiento || v.movimiento === 'salta') {
      if (ultimo && (v.plano === 'general' || v.plano === 'lejos')) poner(X, r(t0), dxDe(ultimo.frac), 'salto')
    }
    if (!v.movimiento) return
    if (v.movimiento === 'salta') {
      // Respingo: sube y baja en 0,35 s
      const a = r(t0 + 0.04)
      poner(Y, a, 0, 'suave')
      poner(Y, r(a + 0.14), -160, 'suave')
      poner(Y, r(a + 0.32), 0, 'salto')
      return
    }
    const aqui = Number(valor(X, t0) ?? 0)
    const fracAqui = ultimo ? ultimo.frac : 0.5 + (aqui * zoom * project.instances[0].scale) / W
    const hacia = v.hacia ?? (v.movimiento === 'sale' ? 'izq' : 'centro')
    let desde: number, hasta: number
    if (v.movimiento === 'entra') {
      hasta = sitio[hacia]
      desde = hacia === 'izq' ? -0.25 : 1.25 // entra por el borde más cercano (al centro, por la derecha)
    } else if (v.movimiento === 'sale') {
      desde = fracAqui
      hasta = hacia === 'der' ? 1.3 : -0.3
    } else {
      desde = fracAqui
      hasta = sitio[hacia]
      if (Math.abs(hasta - desde) < 0.08) return
    }
    // Pasos de verdad: cada paso avanza lo que mide la zancada del dibujo (~560 px del personaje), así
    // los pies no patinan; pocos pasos largos y con decisión (0,22 s cada uno)
    const zancada = 560 * project.instances[0].scale * escalaPlano(v.plano) * zoom
    const distancia = Math.abs(hasta - desde) * W
    const PASO = 0.22
    const pasos = Math.max(2, Math.round(distancia / zancada))
    const paseo = pasos * PASO
    let a = r(t0 + 0.05)
    if (v.movimiento === 'sale') a = r(Math.max(t0 + 0.3, t1 - paseo - 0.1))
    const b = r(Math.min(t1 - 0.05, a + paseo))
    if (b - a < 0.4) return
    const vuelve = valor(V, b) ?? raiz.defaultVariant
    const despues = valor(V, t1) ?? raiz.defaultVariant // la postura de la viñeta siguiente (tras salir)
    // Posición: se desliza de un sitio a otro
    quitar(X, a, b)
    poner(X, r(t0), dxDe(desde), 'salto') // desde el principio de la viñeta, donde empieza a andar
    poner(X, a, dxDe(desde), 'lineal')
    poner(X, b, dxDe(hasta), 'salto')
    // Pasos con bote
    quitar(V, a, b)
    quitar(Y, a, b)
    let k = 0
    const paso = (b - a) / pasos
    for (let t = a; t < b - 0.05; t = r(t + paso), k++) {
      poner(V, t, k % 2 ? 't_andar_b' : 't_andar_a', 'salto')
      poner(Y, t, 0, 'suave')
      poner(Y, r(t + paso / 2), -10, 'suave')
    }
    poner(Y, b, 0, 'salto')
    if (v.movimiento !== 'sale') poner(V, b, vuelve, 'salto')
    else if (t1 < dur - 1e-3) poner(V, r(t1), despues, 'salto')
    ultimo = v.movimiento === 'sale' ? null : { fondo: v.fondo, frac: hasta }
    // Hacia la derecha, en espejo; al llegar mira otra vez como siempre
    if (hasta > desde) {
      poner(E, a, 1, 'salto')
      poner(E, b, 0, 'salto')
    }
  })
}

export type SecundarioEnEscena = { t: number; quien: string; postura: string; lado: 'izq' | 'der'; movimiento: 'ninguno' | 'entra' | 'sale' }
type Presencia = { quien: string; s: number; e: number; lado: 'izq' | 'der'; entra: boolean; sale: boolean; posturas: { t: number; v: string }[] }

/** Tramos en los que cada secundario está en escena (hasta «fuera», «sale» o un cambio de lugar). */
function presencias(sec: SecundarioEnEscena[], vinetas: Vineta[], dur: number): Presencia[] {
  const out: Presencia[] = []
  const cambioDeLugar = (t: number) => {
    const v0 = [...vinetas].reverse().find((v) => v.t <= t + 1e-3)
    const sig = vinetas.find((v) => v.t > t + 1e-3 && !v.inserto && v0 && v.fondo !== v0.fondo)
    return sig ? sig.t : dur
  }
  for (const quien of [...new Set(sec.map((x) => x.quien))]) {
    let abierta: Presencia | null = null
    for (const x of sec.filter((y) => y.quien === quien)) {
      if (abierta && x.t >= abierta.e) abierta = null
      if (x.postura === 'fuera' || x.movimiento === 'sale') {
        if (abierta) {
          abierta.e = x.t + (x.movimiento === 'sale' ? 1.2 : 0)
          abierta.sale = x.movimiento === 'sale'
          if (x.postura !== 'fuera') abierta.posturas.push({ t: x.t, v: x.postura })
          abierta = null
        }
        continue
      }
      if (!abierta) {
        abierta = { quien, s: x.t, e: cambioDeLugar(x.t), lado: x.lado, entra: x.movimiento === 'entra', sale: false, posturas: [] }
        out.push(abierta)
      }
      abierta.posturas.push({ t: x.t, v: x.postura })
    }
  }
  return out.map((p) => ({ ...p, e: Math.min(p.e, dur) })).filter((p) => p.e - p.s > 0.5)
}

/**
 * EL REPARTO EN ESCENA: cada secundario es otra instancia animada (sus posturas, caminando al entrar o
 * salir), en su lado del cuadro y mirando al narrador, que se pone al otro lado mirándola a ella. Fuera
 * de sus tramos no se ve (canal `pj:visible`).
 */
function ponerReparto(narr: Tracks, pres: Presencia[], vinetas: Vineta[], project: { width: number; height: number; fps: number; instances: { x: number; y: number; scale: number }[] }, ch: Character, raizN: Part, dur: number) {
  const fps = project.fps
  const r = (t: number) => Math.round(t * fps) / fps
  const W = project.width
  const vertical = W <= project.height * 1.1
  const inst0 = project.instances[0]
  const poner = (tr: Tracks, canal: string, t: number, v: number | string, ease: 'salto' | 'lineal' | 'suave') => {
    tr[canal] = [...(tr[canal] ?? []).filter((k) => Math.abs(k.t - t) > 1e-4), { t: r(t), v, ease }].sort((a, b) => a.t - b.t)
  }
  const valor = (tr: Tracks, canal: string, t: number) => [...(tr[canal] ?? [])].filter((k) => k.t <= t + 1e-4).pop()?.v
  const instancias: { characterId: string; x: number; y: number; scale: number; tracks: Tracks }[] = []
  const personajes: Record<string, Character> = {}
  const RN = raizN.id
  for (const sec of REPARTO) {
    const mias = pres.filter((p) => p.quien === sec.id)
    if (!mias.length) continue
    const c = sec.make()
    const raiz = c.parts.find((p) => !p.parent)!
    const escala = inst0.scale * (raizN.anchor.y / raiz.anchor.y) * sec.altura
    const tr: Tracks = { 'pj:visible': [{ t: 0, v: 0, ease: 'salto' }] }
    const R = raiz.id
    const dx = (frac: number) => Math.round(((frac - 0.5) * W) / escala)
    const dxN = (frac: number) => Math.round(((frac - 0.5) * W) / inst0.scale)
    // Tamaño: el mismo que el narrador en cada momento (lejos/general)
    tr[`part:${R}:scale`] = (narr[`part:${RN}:scale`] ?? []).map((k) => ({ ...k }))
    for (const p of mias) {
      const suFrac = p.lado === 'izq' ? (vertical ? 0.28 : 0.3) : vertical ? 0.72 : 0.7
      const narrFrac = p.lado === 'izq' ? (vertical ? 0.7 : 0.66) : vertical ? 0.3 : 0.34
      const fuera = p.lado === 'izq' ? -0.3 : 1.3
      const mira = p.lado === 'izq' ? 1 : 0 // sus dibujos miran a la izquierda: en el lado izquierdo, espejo
      poner(tr, 'pj:visible', p.s, 1, 'salto')
      poner(tr, 'pj:visible', p.e, 0, 'salto')
      // Entra / sale caminando desde su borde
      const paseo = (desde: number, hasta: number, a: number) => {
        const pasos = Math.max(2, Math.round((Math.abs(hasta - desde) * W) / (560 * 0.5)))
        const b = a + pasos * 0.22
        poner(tr, `part:${R}:x`, a, dx(desde), 'lineal')
        poner(tr, `part:${R}:x`, b, dx(hasta), 'salto')
        poner(tr, 'pj:espejo', a, hasta > desde ? 1 : 0, 'salto')
        for (let k = 0; k < pasos; k++) {
          const t = a + k * 0.22
          poner(tr, `part:${R}:v`, t, k % 2 ? 't_andar_b' : 't_andar_a', 'salto')
          poner(tr, `part:${R}:y`, t, 0, 'suave')
          poner(tr, `part:${R}:y`, t + 0.11, -10, 'suave')
        }
        poner(tr, `part:${R}:y`, b, 0, 'salto')
        return b
      }
      let listo = p.s
      if (p.entra) listo = paseo(fuera, suFrac, p.s)
      else poner(tr, `part:${R}:x`, p.s, dx(suFrac), 'salto')
      poner(tr, 'pj:espejo', listo, mira, 'salto')
      // Sus posturas (la primera, al llegar)
      p.posturas.forEach((x, i) => poner(tr, `part:${R}:v`, Math.max(x.t, i === 0 ? listo : x.t), x.v, 'salto'))
      if (p.sale) paseo(suFrac, fuera, Math.max(listo + 0.3, p.e - 1.1))
      // El narrador se aparta al otro lado dando dos pasos y la mira (sus posturas miran a la izquierda: si
      // ella está a la derecha, en espejo). Vuelve a su sitio en el siguiente corte de viñeta tras irse ella.
      const antesX = Number(valor(narr, `part:${RN}:x`, p.s) ?? 0)
      const antesE = valor(narr, 'pj:espejo', p.s) ?? 0
      const vuelta = vinetas.find((v) => v.t >= p.e - 1e-3)?.t ?? dur
      const fin = Math.min(dur, vuelta)
      const destino = dxN(narrFrac)
      narr[`part:${RN}:x`] = (narr[`part:${RN}:x`] ?? []).filter((k) => k.t < p.s - 1e-4 || k.t > fin + 1e-4)
      narr['pj:espejo'] = (narr['pj:espejo'] ?? []).filter((k) => k.t < p.s - 1e-4 || k.t > fin + 1e-4)
      const yaEsta = Math.abs(destino - antesX) < 40
      const llega = yaEsta ? p.s : p.s + 0.44
      if (!yaEsta && raizN.variants.t_andar_a) {
        const postura = valor(narr, `part:${RN}:v`, llega) ?? raizN.defaultVariant
        narr[`part:${RN}:v`] = (narr[`part:${RN}:v`] ?? []).filter((k) => k.t < p.s - 1e-4 || k.t > llega + 1e-4)
        poner(narr, `part:${RN}:x`, p.s, antesX, 'lineal')
        poner(narr, 'pj:espejo', p.s, destino > antesX ? 1 : 0, 'salto')
        poner(narr, `part:${RN}:v`, p.s, 't_andar_a', 'salto')
        poner(narr, `part:${RN}:v`, p.s + 0.22, 't_andar_b', 'salto')
        poner(narr, `part:${RN}:v`, llega, postura, 'salto')
      }
      poner(narr, `part:${RN}:x`, llega, destino, 'salto')
      poner(narr, 'pj:espejo', llega, p.lado === 'der' ? 1 : 0, 'salto')
      if (fin < dur - 1e-3) {
        poner(narr, `part:${RN}:x`, fin, antesX, 'salto')
        poner(narr, 'pj:espejo', fin, antesE, 'salto')
      }
    }
    actuarSecundario(tr, `part:${R}:v`, dur, fps)
    instancias.push({ characterId: c.id, x: inst0.x, y: inst0.y, scale: escala, tracks: tr })
    personajes[c.id] = c
  }
  void ch
  return { instancias, personajes }
}

/**
 * Cámara viva (animación limitada): en cada viñeta de más de 2,5 s la cámara se acerca un 3 % muy despacio
 * (el plano nunca está muerto) y, cuando el personaje cambia a una cara exagerada o un gag, da un empujón
 * rápido del 10 % hacia él (el golpe del chiste). Los insertos no se tocan.
 */
function camaraViva(tracks: Tracks, vinetas: Vineta[], dur: number, raizId: string, fps: number) {
  const r = (t: number) => Math.round(t * fps) / fps
  const zoomEn = (t: number) => Number([...(tracks['cam:zoom'] ?? [])].filter((k) => k.t <= t + 1e-4).pop()?.v ?? 1)
  // En escenas dibujadas la cámara NO se mueve (como en Estoy Tiesa): el acercamiento lento redibujaba el
  // plano entero en cada fotograma y el trazo «temblaba»
  if (modoVideo() === 'escenas') return
  const nuevos: { t: number; v: number; ease: 'salto' | 'lineal' | 'suave' }[] = []
  const fuertes = (tracks[`part:${raizId}:v`] ?? []).filter((k) => /^t_e_|^(enfado|llorar|celebrar|mejillas|stop)$/.test(String(k.v)))
  vinetas.forEach((v, i) => {
    const fin = vinetas[i + 1]?.t ?? dur
    const z = zoomEn(v.t + 1e-3)
    if (v.inserto && modoVideo() !== 'escenas') {
      nuevos.push({ t: r(v.t), v: z, ease: 'salto' })
      return
    }
    if (v.cambio) {
      // Mismo plano con otro dibujo: la cámara sigue donde iba (sin saltos)
      const sigue = Number(nuevos[nuevos.length - 1]?.v ?? z)
      nuevos.push({ t: r(v.t), v: sigue, ease: 'lineal' }, { t: r(fin - 0.04), v: Math.round(sigue * 1.02 * 1000) / 1000, ease: 'salto' })
      return
    }
    const golpe = fuertes.find((k) => k.t > v.t + 0.2 && k.t < fin - 0.4)
    if (golpe) {
      // Sostiene, y en el golpe se acerca de repente y se queda ahí hasta el corte
      nuevos.push({ t: r(v.t), v: z, ease: 'salto' }, { t: r(golpe.t - 0.02), v: z, ease: 'suave' }, { t: r(golpe.t + 0.2), v: Math.round(z * 1.1 * 1000) / 1000, ease: 'salto' })
    } else if (fin - v.t > 2.5) {
      nuevos.push({ t: r(v.t), v: z, ease: 'lineal' }, { t: r(fin - 0.04), v: Math.round(z * 1.03 * 1000) / 1000, ease: 'salto' })
    } else nuevos.push({ t: r(v.t), v: z, ease: 'salto' })
  })
  tracks['cam:zoom'] = nuevos.sort((a, b) => a.t - b.t)
}

/**
 * Actuación automática del reparto (que no se quede tiesa en una postura): los gestos de un momento pasan
 * solos a una postura de después (quitar → mirar el móvil, señalar → brazos cruzados, ilusión → reposo) y,
 * si «habla» mucho rato, alterna «habla» y «reposo» como quien gesticula al hablar.
 */
function actuarSecundario(tr: Tracks, canal: string, dur: number, fps: number) {
  const r = (t: number) => Math.round(t * fps) / fps
  const DESPUES: Record<string, [number, string]> = { quita: [1.0, 'movil'], senala: [1.4, 'cruzado'], ilusion: [1.8, 'reposo'], risa: [2.2, 'jarras'] }
  const ks = [...(tr[canal] ?? [])].sort((a, b) => a.t - b.t)
  const extra: typeof ks = []
  ks.forEach((k, i) => {
    const sig = ks[i + 1]?.t ?? dur
    const d = DESPUES[String(k.v)]
    if (d && sig - k.t > d[0] + 0.6) extra.push({ t: r(k.t + d[0]), v: d[1], ease: 'salto' })
    if (k.v === 'habla') for (let t = k.t + 1.1, n = 0; t < sig - 0.5; t += 1.1, n++) extra.push({ t: r(t), v: n % 2 ? 'habla' : 'reposo', ease: 'salto' })
  })
  tr[canal] = [...ks, ...extra].sort((a, b) => a.t - b.t)
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
  // Sin cambios de postura pero con planos dibujados (en escenas todos los planos son dibujos y el muñeco no
  // se ve): el plan vale igual; el muñeco se queda en reposo por debajo
  if (!keys.length) {
    const reposo = ['t_reposo', 'reposo'].find((x) => raiz.variants[x])
    if (!vinetas?.some((v) => v.inserto?.trim()) || !reposo) return null
    keys.push({ t: 0, v: reposo, ease: 'salto' })
  }
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
    // El corte cae al EMPEZAR la frase o el inciso (tras un punto o una coma), no a mitad: si la palabra
    // que dio el director está a 1-3 palabras de un comienzo de frase, se corta ahí (antes cortaba en
    // «y el camarero >me< mira…» y la imagen parecía ir a destiempo de la voz)
    const ws = porEscena[v.escena] ?? []
    let ip = v.palabra
    const empieza = (j: number) => j === 0 || /[,.;:?!…]/.test(ws[j - 1]?.punt ?? '')
    if (ws[ip] && !empieza(ip)) {
      const atras = [1, 2, 3].map((k) => ip - k).find((j) => j >= 0 && empieza(j))
      const delante = [1, 2].map((k) => ip + k).find((j) => j < ws.length && empieza(j))
      ip = atras ?? delante ?? ip
    }
    const w = ws[ip]
    if (!e) continue
    let t = ip === 0 || !w ? e.inicio : Math.max(e.inicio, Math.round((w.t - 0.08) * fps) / fps)
    if (!vins.length) t = 0
    // Cortes demasiado seguidos: se queda el último
    if (vins.length && t - vins[vins.length - 1].t < 1.2) vins.pop()
    if (!vins.length) t = 0
    // Inserto: dibujo a pantalla completa en vez del narrador (cámara general, él detrás no se ve)
    const inserto = v.inserto?.trim() || undefined
    // Moverse por la escena (entrar, ir a otro sitio, salir, saltar): solo con el cuerpo entero a la vista
    const mov = !inserto && v.movimiento && v.movimiento !== 'ninguno' ? v.movimiento : undefined
    const plano: Plano = inserto ? 'general' : mov && mov !== 'salta' && (v.tamano === 'medio' || v.tamano === 'primer') ? 'general' : v.tamano
    vins.push({ t, escena: v.escena, fondo: v.fondo.trim() || 'blanco', plano, lado: inserto ? 'centro' : v.lado ?? 'centro', inserto, movimiento: mov, hacia: v.hacia })
  }
  // Cambios de dibujo dentro del plano («cambio», «cambio2»): desde su palabra se ve el dibujo con la postura
  // cambiada (encadenados: el segundo parte del primero)
  const SEP = ' ⟶ '
  const finTotal = escenas.length ? escenas[escenas.length - 1].inicio + escenas[escenas.length - 1].duracion : 0
  for (const v of vinetas ?? []) {
    const texto = v.inserto?.trim()
    if (!texto) continue
    let cadena = ''
    for (const [cambio, pal] of [[v.cambio, v.palabra_cambio], [v.cambio2, v.palabra_cambio2], [v.cambio3, v.palabra_cambio3], [v.cambio4, v.palabra_cambio4]] as const) {
      if (!cambio?.trim() || (pal ?? -1) <= v.palabra) continue
      const w = porEscena[v.escena]?.[pal!]
      // El último dibujo de este plano que ya está puesto
      let k = -1
      vins.forEach((x, i) => {
        if (x.inserto === texto && (x.cambio ?? '') === cadena) k = i
      })
      if (!w || k < 0) break
      const tB = Math.round((w.t - 0.06) * fps) / fps
      const fin = vins[k + 1]?.t ?? finTotal
      if (tB - vins[k].t < 0.7 || fin - tB < 0.6) continue
      cadena = cadena ? cadena + SEP + cambio.trim() : cambio.trim()
      vins.splice(k + 1, 0, { ...vins[k], t: tB, cambio: cadena })
    }
    // (La boca de la otra persona ya no se mueve: solo se oye al narrador y parecía que hablaba ella con su voz)
  }
  // Un inserto es una imagen quieta: como mucho ~2,5 s; después vuelve el narrador (al empezar una palabra)
  for (let i = 0; i < vins.length && modoVideo() !== 'escenas'; i++) {
    const v = vins[i]
    const fin = vins[i + 1]?.t ?? (escenas.length ? escenas[escenas.length - 1].inicio + escenas[escenas.length - 1].duracion : v.t)
    if (!v.inserto || fin - v.t <= 3.2) continue
    const w = palabras.find((p) => p.t >= v.t + 2.2 && p.t <= v.t + 3)
    const t = Math.round(((w?.t ?? v.t + 2.5) - 0.08) * fps) / fps
    const anterior = [...vins.slice(0, i)].reverse().find((x) => !x.inserto)
    vins.splice(i + 1, 0, { t, escena: v.escena, fondo: v.fondo, plano: anterior?.plano === 'primer' ? 'medio' : anterior?.plano ?? 'medio', lado: 'centro' })
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
    // Un pelín antes de la palabra: si sale justo a la vez o después, se percibe tarde
    const tr = Math.max(e.inicio, Math.round((w.t - 0.12) * fps) / fps)
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
  // En escenas dibujadas no hay objetos sueltos encima (no casaban con el dibujo): todo va dentro del plano
  for (const o of modoVideo() === 'escenas' ? [] : objetos ?? []) {
    // En la palabra EXACTA en que lo nombra (antes se pasaba a la siguiente «con peso» y salía tarde)
    const w = porEscena[o.escena]?.[o.palabra] ?? conPeso(o.escena, o.palabra)
    const e = escenas[o.escena]
    if (!w || !e || !o.dibujo.trim()) continue
    const to = Math.max(e.inicio, Math.round((w.t - 0.12) * fps) / fps)
    const mov = o.movimiento && o.movimiento !== 'aparece' ? o.movimiento : undefined
    // Lo que cruza la escena pasa y se va en ~1,4 s; lo demás se queda hasta el corte
    // En escenas dibujadas, lo demás tampoco se queda colgado: como mucho 2 s (un flash, un móvil que vibra)
    const finO = Math.min(finDe(to, o.escena), to + (mov === 'cruza' ? 1.4 : modoVideo() === 'escenas' ? 2 : 1e9))
    objs.push({ flecha: o.flecha, vin: vinDe(to), t: to, fin: finO, pos: o.pos, que: o.que, dibujo: o.dibujo.trim(), mov, hacia: o.hacia, tam: o.tamano })
  }
  // En un inserto no se ve al narrador: nada en su mano, delante ni en su bocadillo
  for (let i = objs.length - 1; i >= 0; i--)
    if (objs[i].vin !== undefined && vins[objs[i].vin!]?.inserto && (modoVideo() !== 'escenas' || objs[i].pos === 'mano' || objs[i].pos === 'delante')) objs.splice(i, 1)
  // Nada flotando sin sentido: lo que no sujeta ni tiene delante va en un bocadillo (algo que imagina),
  // como mucho uno por viñeta
  {
    const conBocadillo = new Set<string>()
    const quedan = objs.filter((o) => {
      if (o.pos === 'mano' || o.pos === 'delante' || o.mov) return true
      const k = String(o.vin ?? o.fin)
      if (conBocadillo.has(k)) return false
      conBocadillo.add(k)
      o.pos = 'pensamiento'
      return true
    })
    objs.splice(0, objs.length, ...quedan)
  }
  const fondoDe = new Map((fondos ?? []).map((f) => [f.escena, f.fondo.trim()]))
  // Reparto: cada momento de un secundario en el instante de su palabra
  const secundarios: SecundarioEnEscena[] = []
  for (const x of plan.secundarios ?? []) {
    const r = REPARTO.find((y) => y.id === x.quien)
    const w = porEscena[x.escena]?.[x.palabra]
    if (!r || !w || (x.postura !== 'fuera' && !r.posturas[x.postura])) continue
    secundarios.push({ t: Math.max(0, Math.round((w.t - 0.08) * fps) / fps), quien: x.quien, postura: x.postura, lado: x.lado === 'der' ? 'der' : 'izq', movimiento: x.movimiento })
  }
  secundarios.sort((a, b) => a.t - b.t)
  return {
    secundarios,
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
export async function voiceScript(
  escenasIn: Escena[],
  texto: string,
  voz: Voz | null,
  pass: string,
  onProgress: (msg: string) => void,
  modelo: Modelo = 'eleven_multilingual_v2',
  indicaciones = '',
  propia?: VozPropia,
) {
  let aviso = ''
  let escenas = escenasIn
  let conTexto = escenas.map((e, i) => ({ i, d: e.dialogo.trim() })).filter((x) => x.d)
  if (!conTexto.length && !propia) throw new Error('Ninguna escena tiene diálogo.')
  if (!voz && !propia) throw new Error('Elige una voz o sube la tuya.')
  let rangos = new Map<number, [number, number]>()
  let leida: { buf: AudioBuffer; al: Alineacion }
  let nombreVoz: string
  if (propia) {
    // Voz propia: se escucha (transcribe) y cada escena se busca en lo que se oye
    leida = await lecturaPropia(propia, pass, onProgress)
    nombreVoz = propia.nombre
    if (!conTexto.length) {
      escenas = escenasDeVoz(leida.al)
      conTexto = escenas.map((e, i) => ({ i, d: e.dialogo.trim() })).filter((x) => x.d)
    }
    rangos = rangosEnVozPropia(leida.al, conTexto)
    const sinOir = conTexto.filter((c) => !rangos.has(c.i)).length
    if (!rangos.size) throw new Error('No encuentro el texto de las escenas en tu audio. Escribe en las escenas lo mismo que dices (o déjalas vacías y las hago yo con lo que se oye).')
    if (sinOir) aviso = `${sinOir} escena(s) no se oyen en tu audio y las he quitado. `
    // Las escenas con texto que no se dice se quitan (dejarían un silencio en medio de tu locución)
    const oidas = new Set(conTexto.filter((c) => rangos.has(c.i)).map((c) => c.i))
    const quedan = escenas.map((e, i) => ({ e, i })).filter(({ e, i }) => !e.dialogo.trim() || oidas.has(i))
    const nuevoIndice = new Map(quedan.map(({ i }, k) => [i, k]))
    escenas = quedan.map(({ e }) => e)
    rangos = new Map([...rangos].map(([i, r]) => [nuevoIndice.get(i)!, r]))
    conTexto = escenas.map((e, i) => ({ i, d: e.dialogo.trim() })).filter((x) => x.d && rangos.has(x.i))
  } else {
    // Texto completo y dónde empieza cada frase dentro de él
    let completo = ''
    for (const { i, d } of conTexto) {
      // Texto seguido (un espacio, no párrafos): ElevenLabs lo lee de corrido, sin pausa ni cambio de
      // entonación en cada escena
      if (completo) completo += ' '
      rangos.set(i, [completo.length, completo.length + d.length])
      completo += d
    }
    onProgress(`Generando la voz (${voz!.nombre})…`)
    leida = await lectura(completo, voz!.id, modelo, pass)
    nombreVoz = voz!.nombre
  }
  // Las pausas largas entre frases (0,5-0,8 s de silencio total) sonaban a voz entrecortada: se acortan
  // (en la voz propia solo los silencios largos de verdad: sus pausas son parte de cómo habla)
  const { buf, al } = acortarPausas(leida.buf, leida.al, propia ? 0.6 : 0.3)
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
  let secundariosNuevos: SecundarioEnEscena[] = []
  let presReparto: Presencia[] = []
  // Expresivo: una IA «directora» decide en qué palabra cambia de postura y a cuál, según lo que dice
  if (ch.expresivo && raiz && palabras.length) {
    onProgress('Dirigiendo los gestos según el guion…')
    const dir = await dirigir(palabras, m.escenas, ch, raiz, pass, st.project.fps, onProgress, indicaciones).catch((e) => {
      aviso = `La IA directora no respondió (${e instanceof Error ? e.message : e}); los gestos se han elegido con reglas simples.`
      return null
    })
    if (dir) {
      secundariosNuevos = dir.secundarios
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
        plano: v.inserto ? 'general' : planoDeIndicaciones(e.indicaciones) || (fijo ? 'general' : v.plano),
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
    // Los insertos (dibujo a pantalla completa) no llevan lado
    vinetasNuevas = vinetasNuevas.map((v) => (v.inserto ? { ...v, lado: 'centro' as const } : v))
    // En vertical no hay sitio a los lados: siempre en el centro (el contenido va arriba y a los lados)
    if (st.project.width <= st.project.height * 1.1) vinetasNuevas = vinetasNuevas.map((v) => ({ ...v, lado: 'centro' as const }))
    // Mientras hay alguien del reparto en escena, plano general (se ven los dos enteros)
    presReparto = presencias(secundariosNuevos, vinetasNuevas, m.duration)
    vinetasNuevas = vinetasNuevas.map((v, i, all) => {
      const fin = all[i + 1]?.t ?? m.duration
      const conAlguien = presReparto.some((p) => p.s < fin - 0.2 && p.e > v.t + 0.2)
      return conAlguien && !v.inserto ? { ...v, plano: v.plano === 'lejos' ? 'lejos' : 'general', lado: 'centro' } : v
    })
    for (const c of Object.keys(tracks)) if (c.startsWith('cam:') || c === `part:${raiz?.id}:scale` || c === `part:${raiz?.id}:x`) delete tracks[c]
    const lugares = [...new Set(vinetasNuevas.map((v) => v.fondo).filter((f) => !/^blanco\b/i.test(f)))]
    for (const v of vinetasNuevas) {
      const s0 = encuadre(v.plano, st.project, ch)
      for (const [canal, val] of [['cam:zoom', s0.zoom], ['cam:x', s0.x], ['cam:y', s0.y]] as const)
        tracks[canal] = [...(tracks[canal] ?? []), { t: v.t, v: Math.round(val * 1000) / 1000, ease: 'salto' }]
      if (raiz) tracks[`part:${raiz.id}:scale`] = [...(tracks[`part:${raiz.id}:scale`] ?? []), { t: v.t, v: escalaPlano(v.plano), ease: 'salto' }]
      // A un lado (como «Estoy Tiesa»): el personaje se desplaza y el otro lado queda para el contenido
      if (raiz) {
        const W = st.project.width
        const inst0 = st.project.instances[0]
        // En vertical, a cuerpo entero, cada lugar con el personaje en un sitio algo distinto (centro, a la
        // derecha con hueco a la izquierda, adonde señala su mano, o un poco a la izquierda): antes
        // siempre estaba plantado en el centro y todos los planos se parecían
        const vertical = W <= st.project.height * 1.1
        const nLugar = lugares.indexOf(v.fondo)
        const desvio = vertical && (v.plano === 'general' || v.plano === 'lejos') && !/^blanco\b/i.test(v.fondo) ? [0, 0.16, -0.12][nLugar % 3] : 0
        const objetivo = v.lado === 'izq' ? W * 0.27 : v.lado === 'der' ? W * 0.73 : W * (0.5 + desvio)
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
  // Se mueve por la escena donde lo pidió el director (entrar, ir a otro sitio, salir, saltar)
  const raizAhora = activeCharacter(useStore.getState().project).parts.find((p) => !p.parent) ?? raiz
  if (vinetasNuevas && raiz && ch.expresivo) moverPersonaje(conGestos, vinetasNuevas, m.duration, raizAhora!, st.project, ch)
  // CÁMARA VIVA: acercamiento lentísimo en cada viñeta larga y un empujón rápido en los momentos fuertes
  if (vinetasNuevas?.length && raizAhora) camaraViva(conGestos, vinetasNuevas, m.duration, raizAhora.id, st.project.fps)
  // El reparto (la hermana…) en escena con el narrador
  const reparto = presReparto.length && raizAhora ? ponerReparto(conGestos, presReparto, vinetasNuevas ?? [], st.project, ch, raizAhora, m.duration) : null

  const [inst, ...rest] = useStore.getState().project.instances
  // Proyecto actual (puede traer gestos a medida recién dibujados)
  const actual = useStore.getState().project
  st.commit({
    ...actual,
    duration: m.duration,
    audio: { id: audioId, name: `Voces (${nombreVoz})`, start: 0, duration: mezcla.duration },
    guion: { texto, escenas: m.escenas.map(({ inicio: _i, ...e }, i) => ({ ...e, fondo: fondosNuevos?.[i] || e.fondo })), voz: voz ?? undefined, indicaciones },
    // Los secundarios de antes se sustituyen por los de esta animación
    instances: [{ ...inst, tracks: conGestos }, ...rest.filter((i) => !REPARTO.some((r) => r.id === i.characterId)), ...(reparto?.instancias ?? [])],
    characters: { ...actual.characters, ...(reparto?.personajes ?? {}) },
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
