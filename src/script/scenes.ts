// Guion → escenas → animación. Las escenas van una detrás de otra en la línea de tiempo; cada una
// lleva gestos de la biblioteca, su plano de cámara (cortes entre escenas), su expresión y una boca
// que «habla» siguiendo el texto (hasta que haya voz real, que la sustituye).

import { applyCopilot, type CopilotResult } from '../copilot/context'
import { poseAt, setKey } from '../model/anim'
import { GESTOS } from '../model/gestures'
import { layout } from '../model/render'
import type { Character, Escena, Plano, Project } from '../model/types'

const uid = () => Math.random().toString(36).slice(2, 9)

/** Duración razonable para decir un texto en español (~2,6 palabras por segundo). */
export function estimateDuration(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  const pauses = (text.match(/[,;:]/g) ?? []).length * 0.25 + (text.match(/[.!?…]/g) ?? []).length * 0.35
  return Math.max(2, Math.round((words / 2.6 + pauses + 0.8) * 10) / 10)
}

/** Divide un guion en escenas sin IA: un párrafo (o línea) por escena, con gestos variados. */
export function scenesFromText(texto: string): Escena[] {
  const trozos = texto
    .split(/\n\s*\n|\n/)
    .map((t) => t.trim())
    .filter(Boolean)
  const planos: Plano[] = ['general', 'medio', 'primer', 'medio']
  return trozos.map((t, i) => {
    const pregunta = /\?/.test(t)
    const exclama = /!/.test(t)
    const nombre = i === 0 ? 'saludar' : pregunta ? 'encogerse' : exclama ? 'celebrar' : i % 3 === 1 ? 'explicar' : i % 3 === 2 ? 'senalar' : 'asentir'
    return {
      id: uid(),
      dialogo: t,
      accion: '',
      plano: planos[i % planos.length],
      expresion: exclama ? 'Contento' : pregunta ? 'Sorprendido' : 'Neutral',
      duracion: estimateDuration(t),
      gestos: [{ nombre, t: 0.3, lado: 'der' as const, velocidad: 1 }],
      fondo: '',
    }
  })
}

const vowelMouth = (c: string): string | null => {
  if ('aá'.includes(c)) return 'abierta'
  if ('eéií'.includes(c)) return 'E'
  if ('oóuú'.includes(c)) return 'O'
  if ('mbpv'.includes(c)) return 'MBP'
  return null
}

/** Claves de boca que imitan hablar el texto entre t0 y t1 (por sílabas aproximadas). */
export function textMouthKeys(text: string, t0: number, t1: number, fps: number) {
  const out: { canal: string; t: number; valor: string; transicion: 'salto' }[] = []
  const clean = text.toLowerCase().replace(/[^a-záéíóúüñ\s,.;:!?…]/g, '')
  const units: string[] = []
  for (const ch of clean) {
    if (/[,;:]/.test(ch)) units.push('pausa', 'pausa')
    else if (/[.!?…]/.test(ch)) units.push('pausa', 'pausa', 'pausa')
    else if (ch === ' ') units.push('cerrada')
    else {
      const m = vowelMouth(ch)
      if (m) units.push(m)
    }
  }
  if (!units.length) return out
  const step = Math.max(1 / fps, (t1 - t0) / units.length)
  let last = ''
  units.forEach((u, i) => {
    const v = u === 'pausa' ? 'cerrada' : u
    const t = Math.round((t0 + i * step) * fps) / fps
    if (v !== last && (!out.length || t - out[out.length - 1].t >= 1.5 / fps)) {
      out.push({ canal: 'face:mouth', t, valor: v, transicion: 'salto' })
      last = v
    }
  })
  out.push({ canal: 'face:mouth', t: Math.round(t1 * fps) / fps, valor: 'cerrada', transicion: 'salto' })
  return out
}

/** Encuadre de cada plano: zoom y desplazamiento de cámara hacia la cabeza del personaje. */
function shot(plano: Plano, project: Project, character: Character) {
  if (plano === 'general' || plano === 'lejos') return { zoom: 1, x: 0, y: 0 }
  const inst = project.instances[0]
  const pl = layout(character, inst, poseAt(character, {}, 0)).find((p) => p.part.id === 'cabeza')
  const a = pl && character.assets[pl.assetId]
  const raizPl = character.expresivo ? layout(character, inst, poseAt(character, {}, 0)).find((p) => !p.part.parent) : undefined
  const ce = character.expresivo?.cabeza
  const head = pl && a
    ? pl.matrix.transformPoint(new DOMPoint(a.w / 2 - pl.part.anchor.x, a.h / 2 - pl.part.anchor.y))
    : raizPl && ce
      ? raizPl.matrix.transformPoint(new DOMPoint(ce.x - raizPl.part.anchor.x, ce.y - raizPl.part.anchor.y))
      : { x: inst.x, y: inst.y - 600 }
  const zoom = plano === 'primer' ? 1.8 : 1.35
  // La cabeza queda en el tercio superior del encuadre, sin que la cámara salga del vídeo (si no,
  // asomaría el color de fondo por arriba o por los lados)
  const y = head.y + (plano === 'primer' ? 0.12 : 0.22) * (project.height / zoom) - project.height / 2
  const x = head.x - project.width / 2
  const my = (project.height / 2) * (1 - 1 / zoom)
  const mx = (project.width / 2) * (1 - 1 / zoom)
  return { zoom, x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) }
}

export interface Montaje {
  tracks: Project['instances'][0]['tracks']
  duration: number
  escenas: (Escena & { inicio: number })[]
}

/** Convierte todas las escenas en una animación nueva (sustituye la que hubiera). */
export function animateScenes(escenas: Escena[], project: Project, character: Character): Montaje {
  const fps = project.fps
  const con = escenas.map((e) => ({ ...e }))
  let t = 0
  const placed: (Escena & { inicio: number })[] = []
  const result: CopilotResult = { mensaje: '', duracion: 0, borrar: [{ canal: '*', desde: 0, hasta: 9999 }], gestos: [], claves: [] }
  const has = (n: string) => GESTOS.some((g) => g.id === n)
  const expr = character.expressions
  // Personaje por poses (la pieza raíz tiene varios dibujos)
  const raiz = character.parts.find((p) => !p.parent && Object.keys(p.variants).length > 1)
  let semilla = 7
  const rnd = () => {
    semilla = (semilla * 9301 + 49297) % 233280
    return semilla / 233280
  }
  let ultimaPose = ''
  for (const e of con) {
    const dur = Math.max(1, e.duracion || estimateDuration(e.dialogo))
    const inicio = Math.round(t * fps) / fps
    placed.push({ ...e, duracion: dur, inicio })
    // Corte de cámara al empezar la escena
    const s = shot(e.plano, project, character)
    for (const [canal, v] of [['cam:zoom', s.zoom], ['cam:x', s.x], ['cam:y', s.y]] as const) {
      result.claves.push({ canal, t: inicio, valor: String(Math.round(v * 1000) / 1000), transicion: 'salto' })
    }
    // «Lejos»: el personaje más pequeño (desde los pies) con el fondo igual
    const raizP = character.parts.find((p) => !p.parent)
    if (raizP && character.expresivo)
      result.claves.push({ canal: `part:${raizP.id}:scale`, t: inicio, valor: e.plano === 'lejos' ? '0.7' : '1', transicion: 'salto' })
    // Expresión (cejas) y gestos
    const ex = expr[e.expresion] ?? expr.Neutral
    if (ex) result.claves.push({ canal: 'face:brows', t: inicio, valor: ex.brows, transicion: 'salto' })
    const ocupado: [number, number][] = []
    for (const g of e.gestos ?? []) {
      if (!has(g.nombre)) continue
      const t0 = inicio + Math.max(0, Math.min(dur - 0.3, g.t))
      result.gestos!.push({ ...g, t: t0 })
      const gd = character.expresivo ? 1.2 : (GESTOS.find((x) => x.id === g.nombre)?.duracion ?? 2) / (g.velocidad || 1)
      ocupado.push([t0, t0 + gd])
    }
    // Mientras habla, nadie se queda quieto: los huecos sin gesto se rellenan.
    if (e.dialogo.trim() && raiz && character.expresivo) {
      // Expresivo (estilo «Estoy Tiesa»): una postura con su cara por cada trozo de frase, de golpe,
      // elegida por lo que dice (pregunta, números, exclamación…) y por la emoción de la escena.
      const ex = character.expresivo
      const ok = (p?: string) => !!p && !!raiz.variants[p]
      const tranquilas = [...(ex.emociones[e.expresion] ?? []), ...ex.calma].filter(ok)
      const trozos = e.dialogo.match(/[^,.;:!?…]+[,.;:!?…]*/g) ?? [e.dialogo]
      // Trozos de 4 a 8 palabras (unos 1,5-3 s): se juntan los cortos y se parten los largos
      const grupos: string[] = []
      for (const tz of trozos) {
        const last = grupos[grupos.length - 1]
        if (last && last.split(/\s+/).filter(Boolean).length < 4) grupos[grupos.length - 1] = last + tz
        else grupos.push(tz)
      }
      for (let i = 0; i < grupos.length; i++) {
        const w = grupos[i].split(/\s+/).filter(Boolean)
        if (w.length > 8) grupos.splice(i, 1, w.slice(0, Math.ceil(w.length / 2)).join(' ') + ' ', w.slice(Math.ceil(w.length / 2)).join(' '))
      }
      const total = grupos.reduce((n, g) => n + g.length, 0) || 1
      let acum = 0
      let idx = Math.floor(rnd() * tranquilas.length)
      const pick = (l: string[]) => {
        const c = l.filter(ok)
        if (!c.length) return undefined
        let p = c[Math.floor(rnd() * c.length)]
        if (p === ultimaPose && c.length > 1) p = c[(c.indexOf(p) + 1) % c.length]
        return p
      }
      grupos.forEach((g, gi) => {
        const t = inicio + 0.1 + (acum / total) * Math.max(0.5, dur - 0.4)
        acum += g.length
        if (ocupado.some(([a, b]) => t >= a - 0.8 && t < b)) return
        const low = g.toLowerCase()
        let pose: string | undefined
        // Lo exagerado, solo de vez en cuando: al empezar una escena con emoción o en una exclamación
        if (gi === 0 && ok(ex.gag[e.expresion])) pose = ex.gag[e.expresion]
        else if (/!/.test(g) && e.expresion !== 'Neutral' && ok(ex.gag[e.expresion]) && rnd() < 0.5) pose = ex.gag[e.expresion]
        else if (/coment|suscr/.test(low)) pose = ex.comentario
        else if (/\bhola\b/.test(low)) pose = ex.saludo
        else if (/\?/.test(g)) pose = pick(ex.pregunta)
        else if (/\d|\b(uno|dos|tres|primer|segund|tercer)/.test(low)) pose = pick(ex.numero)
        if (!ok(pose) || pose === ultimaPose) {
          pose = tranquilas[idx++ % tranquilas.length]
          if (pose === ultimaPose) pose = tranquilas[idx++ % tranquilas.length]
        }
        if (!pose || pose === ultimaPose) return
        ultimaPose = pose
        result.claves.push({ canal: `part:${raiz.id}:v`, t, valor: pose, transicion: 'salto' })
      })
    } else if (e.dialogo.trim() && raiz) {
      // Personaje por poses, como habla una persona: las manos tienen una postura de descanso
      // (juntas o a la altura de la cintura) y de vez en cuando salen a un gesto y vuelven.
      // Solo se cambia entre poses que tienen dibujo intermedio, y sin prisas.
      // La emoción de la escena cambia el estilo: triste = recogido y quieto; contento = más abierto
      const triste = /triste/i.test(e.expresion)
      const contento = /contento|sorprendido/i.test(e.expresion)
      const CASA = (triste ? ['manos_juntas'] : contento ? ['hablar_b', 'explicar'] : ['manos_juntas', 'hablar_b']).filter((p) => raiz.variants[p])
      const ACENTO = (triste ? ['hablar_b'] : contento ? ['hablar_a', 'hablar_c', 'explicar'] : ['hablar_a', 'explicar', 'hablar_c']).filter((p) => raiz.variants[p])
      let cur = inicio + 0.3
      let lado = placed.length % 2 ? 1 : -1
      let acento = !CASA.includes(ultimaPose ?? '')
      while (cur < inicio + dur - 0.9 && CASA.length && ACENTO.length) {
        const choca = ocupado.find(([a, b]) => cur < b && cur + 1.1 > a)
        if (choca) {
          cur = choca[1] + 0.1
          continue
        }
        const sig = Math.min(inicio + dur, ocupado.filter(([a]) => a > cur).reduce((m, [a]) => Math.min(m, a), Infinity))
        acento = !acento
        const lista = acento ? ACENTO : CASA
        let pose = lista[Math.floor(rnd() * lista.length)]
        if (pose === ultimaPose) pose = lista[(lista.indexOf(pose) + 1) % lista.length]
        if (pose !== ultimaPose) result.claves.push({ canal: `part:${raiz.id}:v`, t: cur, valor: pose, transicion: 'salto' })
        ultimaPose = pose
        result.claves.push({ canal: 'part:cabeza:rot', t: cur + 0.12, valor: String(acento ? lado * (1.5 + rnd() * 1.5) : 0), transicion: 'suave' })
        if (acento) lado = -lado
        const hold = acento ? 1.4 + rnd() * 0.8 : (contento ? 1.6 : triste ? 3 : 2.2) + rnd() * 1.4
        cur += Math.min(hold, Math.max(1.1, sig - cur))
      }
    } else if (e.dialogo.trim()) {
      const HD = GESTOS.find((x) => x.id === 'hablar')!.duracion
      let cur = inicio + 0.2
      let lado: 'der' | 'izq' = placed.length % 2 ? 'izq' : 'der'
      while (cur + HD / 1.7 <= inicio + dur - 0.1) {
        const choca = ocupado.find(([a, b]) => cur < b + 0.1 && cur + HD > a - 0.1)
        if (choca) {
          cur = choca[1] + 0.15
          continue
        }
        const hueco = Math.min(inicio + dur - 0.1, ocupado.filter(([a]) => a > cur).reduce((m, [a]) => Math.min(m, a - 0.1), Infinity)) - cur
        const vel = Math.min(1.7, Math.max(1, HD / hueco))
        if (HD / vel > hueco + 1e-3) break
        result.gestos!.push({ nombre: 'hablar', t: cur, lado, velocidad: vel })
        ocupado.push([cur, cur + HD / vel])
        cur += HD / vel + 0.15
        lado = lado === 'der' ? 'izq' : 'der'
      }
    }
    t += dur
  }
  const total = Math.max(1, Math.ceil(t * 2) / 2)
  result.duracion = total
  const base: Project = { ...project, duration: total, audio: undefined, instances: [{ ...project.instances[0], tracks: {} }] }
  const r = applyCopilot(result, base, character)
  // La boca va al final para que los gestos no la pisen
  let tracks = { ...r.tracks }
  if (raiz) {
    // Por poses: si un gesto termina en reposo y enseguida empieza otra pose, se salta el reposo
    // (si no, se ve un parpadeo de brazos bajando y subiendo)
    const canal = `part:${raiz.id}:v`
    const ks = [...(tracks[canal] ?? [])].sort((a, b) => a.t - b.t)
    tracks[canal] = ks.filter((k, i) => !(k.v === raiz.defaultVariant && ks[i + 1] && ks[i + 1].t - k.t < 0.9))
  }
  delete tracks['face:mouth']
  const mouth: { canal: string; t: number; valor: string; transicion: 'salto' }[] = []
  for (const e of placed) {
    if (e.dialogo.trim()) mouth.push(...textMouthKeys(e.dialogo, e.inicio + 0.15, e.inicio + e.duracion - 0.3, fps))
    const ex = expr[e.expresion] ?? expr.Neutral
    if (ex && !e.dialogo.trim()) mouth.push({ canal: 'face:mouth', t: e.inicio, valor: ex.mouth, transicion: 'salto' })
  }
  tracks['face:mouth'] = mouth
    .sort((a, b) => a.t - b.t)
    .filter((k, i, arr) => !arr[i + 1] || Math.abs(arr[i + 1].t - k.t) > 1e-3)
    .map((k) => ({ t: k.t, v: k.valor, ease: 'salto' as const }))
  tracks = { ...tracks, ...backgroundKeys(placed, total, fps) }
  return { tracks, duration: total, escenas: placed }
}

/**
 * Claves de las capas de fondo asociadas a escenas: cada capa se ve solo en sus escenas (cambio en
 * seco en el corte) y se acerca despacio mientras dura su tramo.
 */
export function backgroundKeys(placed: (Escena & { inicio: number })[], total: number, fps: number) {
  const r = (x: number) => Math.round(x * fps) / fps
  const tramos: { id: string; desde: number; hasta: number }[] = []
  for (const e of placed) {
    if (!e.capa) continue
    const last = tramos[tramos.length - 1]
    if (last && last.id === e.capa && Math.abs(last.hasta - e.inicio) < 1e-3) last.hasta = e.inicio + e.duracion
    else tramos.push({ id: e.capa, desde: e.inicio, hasta: e.inicio + e.duracion })
  }
  let tr: Project['instances'][0]['tracks'] = {}
  const fin = Math.max(0, ...placed.map((e) => e.inicio + e.duracion))
  for (const t of tramos) {
    const op = `bg:${t.id}:opacity`
    if (!tr[op]) tr = setKey(tr, op, 0, t.desde > 1e-3 ? 0 : 1, 'salto')
    tr = setKey(tr, op, r(t.desde), 1, 'salto')
    // El fondo de la última escena se queda hasta el final del vídeo
    if (t.hasta < fin - 1e-3 && t.hasta < total - 1e-3) tr = setKey(tr, op, r(t.hasta), 0, 'salto')
    tr = setKey(tr, `bg:${t.id}:scale`, r(t.desde), 1, 'lineal')
    tr = setKey(tr, `bg:${t.id}:scale`, r(t.hasta) - 1 / fps, 1, 'lineal') // fondo fijo, sin zoom (como la referencia)
  }
  return tr
}

/** Tamaño pedido en las indicaciones de la escena («pequeño», «primer plano», «de cintura arriba»…). */
export function planoDeIndicaciones(texto?: string): Plano | null {
  const t = (texto ?? '').toLowerCase()
  if (!t.trim()) return null
  if (/primer[oa]? plano|primerísimo|muy grande|solo la cara|cara de cerca|cara grande/.test(t)) return 'primer'
  if (/plano medio|cintura|medio cuerpo|más grande|\bgrande\b|más cerca|de cerca/.test(t)) return 'medio'
  if (/peque[ñn]o|lejos|plano lejano|plano abierto/.test(t)) return 'lejos'
  if (/plano general|cuerpo entero|tamaño normal/.test(t)) return 'general'
  return null
}

/** Fondo pedido en las indicaciones de la escena («Fondo: una cocina…», «fondo blanco»). */
export function fondoDeIndicaciones(texto?: string): string | null {
  const t = texto ?? ''
  if (/fondo\s+blanco/i.test(t)) return 'blanco'
  const m = t.match(/fondo\s*(?::|de\b|con\b)\s*([^.\n;]+)/i)
  if (!m) return null
  const d = m[1].trim()
  return d.length >= 3 ? d.slice(0, 120) : null
}
