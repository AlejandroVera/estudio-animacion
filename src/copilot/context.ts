// Prepara lo que el copiloto necesita saber del personaje y de la animación actual,
// y aplica su respuesta como claves de animación.

import { KEY_EPS, poseAt, removeKey, setKey } from '../model/anim'
import { expandGesture, GESTOS } from '../model/gestures'
import { layout } from '../model/render'
import type { Character, Ease, Project, Tracks } from '../model/types'

export interface CopilotResult {
  mensaje: string
  duracion: number
  borrar: { canal: string; desde: number; hasta: number }[]
  gestos?: { nombre: string; t: number; lado: 'der' | 'izq'; velocidad: number }[]
  claves: { canal: string; t: number; valor: string; transicion: Ease }[]
}

const FACE_NUMERIC = ['face:gazeX', 'face:gazeY', 'face:blink']
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d

/** Hacia dónde apunta cada pieza en reposo (grados de pantalla: 0 derecha, 90 abajo). */
function restAngles(character: Character, project: Project): Record<string, number> {
  const inst = project.instances[0]
  const placed = layout(character, inst, poseAt(character, {}, 0), true)
  const byId = new Map(placed.map((p) => [p.part.id, p]))
  const out: Record<string, number> = {}
  for (const pl of placed) {
    if (pl.part.role) continue
    const from = new DOMPoint(pl.matrix.e, pl.matrix.f)
    const child = character.parts.find((c) => c.parent === pl.part.id && !c.role && byId.has(c.id))
    let to: DOMPoint
    if (child) {
      const cm = byId.get(child.id)!.matrix
      to = new DOMPoint(cm.e, cm.f)
    } else {
      const a = character.assets[pl.assetId]
      to = pl.matrix.transformPoint(new DOMPoint(a.w / 2 - pl.part.anchor.x, a.h / 2 - pl.part.anchor.y))
    }
    out[pl.part.id] = Math.round((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI)
  }
  return out
}

export function buildContext(project: Project, character: Character, time: number, selectedPart: string | null) {
  const inst = project.instances[0]
  const angles = restAngles(character, project)
  const variantsOf = (role: string) => Object.keys(character.parts.find((p) => p.role === role)?.variants ?? {})
  const pistas: Record<string, [number, number | string, Ease][]> = {}
  for (const [ch, keys] of Object.entries(inst.tracks)) {
    pistas[ch] = keys.map((k) => [round(k.t), typeof k.v === 'number' ? round(k.v) : k.v, k.ease])
  }
  return {
    duracion: project.duration,
    fps: project.fps,
    instante_actual: round(time),
    pieza_seleccionada: selectedPart,
    voz: project.audio
      ? { empieza: round(project.audio.start), termina: round(project.audio.start + project.audio.duration), nota: 'La boca ya se mueve con la voz: no animes face:mouth en ese tramo.' }
      : null,
    personaje: {
      nombre: character.name,
      piezas: character.parts
        .filter((p) => !p.role)
        .map((p) => ({
          id: p.id,
          nombre: p.name,
          cuelga_de: p.parent,
          angulo_reposo: angles[p.id],
          ...(Object.keys(p.variants).length > 1 ? { dibujos: Object.keys(p.variants) } : {}),
        })),
      nota_lados: '"izq" y "der" se refieren al lado de la PANTALLA, no al del personaje.',
      bocas: variantsOf('mouth'),
      cejas: variantsOf('brows'),
      expresiones: character.expressions,
    },
    guion: project.guion
      ? project.guion.escenas.map((e, i) => ({ n: i + 1, dialogo: e.dialogo, accion: e.accion, plano: e.plano, expresion: e.expresion, duracion: e.duracion, gestos: e.gestos, fondo: e.fondo }))
      : null,
    fondos: (project.fondos ?? []).map((l) => ({ id: l.id, nombre: l.name, delante: !!l.delante })),
    gestos_disponibles: GESTOS.map((g) => ({
      nombre: g.id,
      descripcion: g.descripcion,
      duracion: g.duracion,
      lado: g.lados === 'uno' ? 'elige "der" o "izq"' : 'da igual',
    })),
    pistas,
  }
}

/** Aplica la respuesta del copiloto. Devuelve las pistas y duración nuevas, y cuántas claves puso. */
export function applyCopilot(
  result: CopilotResult,
  project: Project,
  character: Character,
): { tracks: Tracks; duration: number; added: number } {
  const fps = project.fps
  const snap = (t: number) => Math.max(0, Math.round(t * fps) / fps)
  const duration = result.duracion > 0 ? Math.min(120, Math.max(1, result.duracion)) : project.duration
  let tracks: Tracks = { ...project.instances[0].tracks }

  for (const b of result.borrar ?? []) {
    for (const ch of Object.keys(tracks)) {
      if (b.canal !== '*' && b.canal !== ch) continue
      for (const k of tracks[ch] ?? []) {
        if (k.t >= b.desde - KEY_EPS && k.t <= b.hasta + KEY_EPS) tracks = removeKey(tracks, ch, k.t)
      }
    }
  }

  // Gestos de la biblioteca: se convierten en claves para este personaje y sustituyen lo que
  // hubiera en sus canales durante el gesto.
  const extra: CopilotResult['claves'] = []
  let end = duration
  for (const g of result.gestos ?? []) {
    const gesto = GESTOS.find((x) => x.id === g.nombre)
    if (!gesto) continue
    const lado = g.lado === 'izq' ? 'izq' : 'der'
    const t0 = Math.max(0, snap(g.t))
    const r = expandGesture(gesto, lado, t0, Math.min(3, Math.max(0.3, g.velocidad || 1)), character, project.instances[0])
    const fin = r.fin
    // Mientras el personaje habla, la boca la lleva la voz: el gesto no la toca.
    const a = project.audio
    const habla = (t: number) => !!a && t >= a.start - KEY_EPS && t <= a.start + a.duration + KEY_EPS
    const claves = r.claves.filter((c) => !(c.canal === 'face:mouth' && habla(c.t)))
    const canales = r.canales.filter((c) => !(c === 'face:mouth' && a && t0 < a.start + a.duration && fin > a.start))
    for (const ch of canales) {
      for (const k of tracks[ch] ?? []) {
        if (k.t >= t0 - KEY_EPS && k.t <= fin + KEY_EPS) tracks = removeKey(tracks, ch, k.t)
      }
    }
    extra.push(...claves)
    end = Math.max(end, fin)
  }
  const finalDuration = Math.min(120, Math.ceil(end * 2) / 2)

  const partIds = new Set(character.parts.map((p) => p.id))
  const variants = (role: string) => new Set(Object.keys(character.parts.find((p) => p.role === role)?.variants ?? {}))
  const mouths = variants('mouth')
  const brows = variants('brows')
  let added = 0
  for (const k of [...extra, ...(result.claves ?? [])]) {
    const t = Math.min(finalDuration, snap(k.t))
    const ease: Ease = ['suave', 'lineal', 'salto'].includes(k.transicion) ? k.transicion : 'suave'
    let value: number | string
    if (k.canal === 'face:mouth' || k.canal === 'face:brows') {
      if (!(k.canal === 'face:mouth' ? mouths : brows).has(k.valor)) continue
      value = k.valor
    } else if (/^cam:(x|y|zoom)$/.test(k.canal) || /^bg:[^:]+:(x|y|scale|rot|opacity)$/.test(k.canal)) {
      if (k.canal.startsWith('bg:') && !(project.fondos ?? []).some((l) => l.id === k.canal.split(':')[1])) continue
      value = Number(String(k.valor).replace(',', '.'))
      if (!Number.isFinite(value)) continue
      if (k.canal === 'cam:zoom') value = Math.max(0.3, Math.min(4, value))
      if (k.canal.endsWith(':opacity')) value = Math.max(0, Math.min(1, value))
    } else if (/^part:[^:]+:v$/.test(k.canal)) {
      const part = character.parts.find((p) => p.id === k.canal.split(':')[1])
      if (!part?.variants[k.valor]) continue
      value = k.valor
    } else {
      const m = /^part:([^:]+):(rot|x|y|scale)$/.exec(k.canal)
      if (!(FACE_NUMERIC.includes(k.canal) || (m && partIds.has(m[1])))) continue
      value = Number(String(k.valor).replace(',', '.'))
      if (!Number.isFinite(value)) continue
      if (k.canal === 'face:blink') value = Math.max(0, Math.min(1, value))
      if (k.canal === 'face:gazeX' || k.canal === 'face:gazeY') value = Math.max(-1, Math.min(1, value))
      if (m?.[2] === 'scale') value = Math.max(0.1, Math.min(4, value))
    }
    tracks = setKey(tracks, k.canal, t, value, typeof value === 'string' ? 'salto' : ease)
    added++
  }
  return { tracks, duration: finalDuration, added }
}
