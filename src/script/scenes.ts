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
  if (plano === 'general') return { zoom: 1, x: 0, y: 0 }
  const inst = project.instances[0]
  const pl = layout(character, inst, poseAt(character, {}, 0)).find((p) => p.part.id === 'cabeza')
  const a = pl && character.assets[pl.assetId]
  const head = pl && a ? pl.matrix.transformPoint(new DOMPoint(a.w / 2 - pl.part.anchor.x, a.h / 2 - pl.part.anchor.y)) : { x: inst.x, y: inst.y - 600 }
  const zoom = plano === 'primer' ? 1.8 : 1.35
  // La cabeza queda en el tercio superior del encuadre
  const y = head.y + (plano === 'primer' ? 0.12 : 0.22) * (project.height / zoom) - project.height / 2
  return { zoom, x: head.x - project.width / 2, y }
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
  for (const e of con) {
    const dur = Math.max(1, e.duracion || estimateDuration(e.dialogo))
    const inicio = Math.round(t * fps) / fps
    placed.push({ ...e, duracion: dur, inicio })
    // Corte de cámara al empezar la escena
    const s = shot(e.plano, project, character)
    for (const [canal, v] of [['cam:zoom', s.zoom], ['cam:x', s.x], ['cam:y', s.y]] as const) {
      result.claves.push({ canal, t: inicio, valor: String(Math.round(v * 1000) / 1000), transicion: 'salto' })
    }
    // Expresión (cejas) y gestos
    const ex = expr[e.expresion] ?? expr.Neutral
    if (ex) result.claves.push({ canal: 'face:brows', t: inicio, valor: ex.brows, transicion: 'salto' })
    for (const g of e.gestos ?? []) {
      if (!has(g.nombre)) continue
      result.gestos!.push({ ...g, t: inicio + Math.max(0, Math.min(dur - 0.3, g.t)) })
    }
    t += dur
  }
  const total = Math.max(1, Math.ceil(t * 2) / 2)
  result.duracion = total
  const base: Project = { ...project, duration: total, audio: undefined, instances: [{ ...project.instances[0], tracks: {} }] }
  const r = applyCopilot(result, base, character)
  // La boca va al final para que los gestos no la pisen
  let tracks = { ...r.tracks }
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
    tr = setKey(tr, `bg:${t.id}:scale`, r(t.hasta) - 1 / fps, 1.06, 'lineal')
  }
  return tr
}
