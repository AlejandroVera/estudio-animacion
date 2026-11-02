import type { Character, Ease, Keyframe, Pose, Tracks } from './types'

export const KEY_EPS = 1 / 120

export const DEFAULTS = {
  rot: 0,
  x: 0,
  y: 0,
  scale: 1,
  gazeX: 0,
  gazeY: 0,
  blink: 0,
  mouth: 'cerrada',
  brows: 'neutral',
} as const

function ease(kind: Ease, u: number): number {
  if (kind === 'lineal') return u
  if (kind === 'salto') return 0
  // suave: entrada y salida cúbica
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
}

export function evalTrack(keys: Keyframe[] | undefined, t: number, fallback: number | string): number | string {
  if (!keys || keys.length === 0) return fallback
  if (t <= keys[0].t) return keys[0].v
  const last = keys[keys.length - 1]
  if (t >= last.t) return last.v
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]
    const b = keys[i + 1]
    if (t >= a.t && t < b.t) {
      if (typeof a.v !== 'number' || typeof b.v !== 'number') return a.v
      const u = ease(a.ease, (t - a.t) / (b.t - a.t))
      return a.v + (b.v - a.v) * u
    }
  }
  return last.v
}

const num = (v: number | string) => (typeof v === 'number' ? v : Number(v) || 0)
const str = (v: number | string) => String(v)

export function poseAt(character: Character, tracks: Tracks, t: number): Pose {
  const parts: Pose['parts'] = {}
  const variants: Pose['variants'] = {}
  for (const p of character.parts) {
    const vk = tracks[`part:${p.id}:v`]
    if (vk?.length && !p.role) variants[p.id] = str(evalTrack(vk, t, p.defaultVariant))
    const k = `part:${p.id}:`
    parts[p.id] = {
      rot: num(evalTrack(tracks[k + 'rot'], t, DEFAULTS.rot)),
      x: num(evalTrack(tracks[k + 'x'], t, DEFAULTS.x)),
      y: num(evalTrack(tracks[k + 'y'], t, DEFAULTS.y)),
      scale: num(evalTrack(tracks[k + 'scale'], t, DEFAULTS.scale)),
    }
  }
  return {
    parts,
    gazeX: num(evalTrack(tracks['face:gazeX'], t, DEFAULTS.gazeX)),
    gazeY: num(evalTrack(tracks['face:gazeY'], t, DEFAULTS.gazeY)),
    blink: num(evalTrack(tracks['face:blink'], t, DEFAULTS.blink)),
    mouth: str(evalTrack(tracks['face:mouth'], t, DEFAULTS.mouth)),
    brows: str(evalTrack(tracks['face:brows'], t, DEFAULTS.brows)),
    variants,
  }
}

/** Devuelve una copia de las pistas con la clave puesta (o actualizada) en el instante t. */
export function setKey(tracks: Tracks, channel: string, t: number, v: number | string, easeKind?: Ease): Tracks {
  const keys = [...(tracks[channel] ?? [])]
  const isStep = typeof v === 'string'
  const i = keys.findIndex((k) => Math.abs(k.t - t) < KEY_EPS)
  if (i >= 0) keys[i] = { ...keys[i], v, ease: easeKind ?? keys[i].ease }
  else keys.push({ t, v, ease: easeKind ?? (isStep ? 'salto' : 'suave') })
  keys.sort((a, b) => a.t - b.t)
  return { ...tracks, [channel]: keys }
}

export function removeKey(tracks: Tracks, channel: string, t: number): Tracks {
  const keys = (tracks[channel] ?? []).filter((k) => Math.abs(k.t - t) >= KEY_EPS)
  const next = { ...tracks }
  if (keys.length) next[channel] = keys
  else delete next[channel]
  return next
}

export function moveKey(tracks: Tracks, channel: string, from: number, to: number): Tracks {
  const keys = tracks[channel] ?? []
  const moving = keys.find((k) => Math.abs(k.t - from) < KEY_EPS)
  if (!moving) return tracks
  const rest = keys.filter((k) => k !== moving && Math.abs(k.t - to) >= KEY_EPS)
  const next = [...rest, { ...moving, t: to }].sort((a, b) => a.t - b.t)
  return { ...tracks, [channel]: next }
}

/** Nombre legible de un canal para la línea de tiempo. */
export function channelLabel(character: Character, channel: string): string {
  const faceNames: Record<string, string> = {
    'face:gazeX': 'Mirada ↔',
    'face:gazeY': 'Mirada ↕',
    'face:blink': 'Párpados',
    'face:mouth': 'Boca',
    'face:brows': 'Cejas',
  }
  if (faceNames[channel]) return faceNames[channel]
  const [, id, prop] = channel.split(':')
  const part = character.parts.find((p) => p.id === id)
  const propNames: Record<string, string> = { rot: 'giro', x: 'mover ↔', y: 'mover ↕', scale: 'tamaño', v: 'dibujo' }
  return `${part?.name ?? id} · ${propNames[prop] ?? prop}`
}
