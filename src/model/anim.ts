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

/** Duración del cambio de postura de un personaje expresivo (s). */
export const POP = 0.1

/** Dibujos intermedios: variantes «entre:A__B» de una pieza por poses. */
export const ENTRE = 'entre:'
/** Tiempo que se ve el dibujo intermedio antes de llegar a la pose nueva (s). */
const T_ENTRE = 0.1

/** Dibujo intermedio para ir de la pose a a la b (o el de reposo↔b / a↔reposo si no hay uno directo). */
export function intermedio(p: Character['parts'][number], a: string, b: string): string | null {
  const v = p.variants
  for (const k of [`${a}__${b}`, `${b}__${a}`]) if (v[ENTRE + k]) return ENTRE + k
  const r = p.defaultVariant
  if (a !== r && b !== r) {
    // Hacia un gesto: el intermedio desde reposo; volviendo de un gesto: el intermedio hacia reposo
    for (const k of [`${r}__${b}`, `${r}__${a}`]) if (v[ENTRE + k]) return ENTRE + k
  }
  return null
}

/**
 * Cambio de pose fluido: un poco antes de cada clave se muestra el dibujo intermedio (fundiéndose
 * desde la pose anterior) y al llegar a la clave se funde del intermedio a la pose nueva.
 */
function transicion(p: Character['parts'][number], vk: Keyframe[], t: number): { v: string; prev?: string; u: number } | null {
  const fade = p.fade ?? 0.07
  let k = -1
  for (let i = 0; i < vk.length; i++) if (vk[i].t <= t) k = i
  const actual = k >= 0 ? str(vk[k].v) : p.defaultVariant
  const sig = vk[k + 1]
  if (sig && str(sig.v) !== actual && sig.t - t < T_ENTRE) {
    const mid = intermedio(p, actual, str(sig.v))
    if (mid) {
      const u = (t - (sig.t - T_ENTRE)) / fade
      return u < 1 ? { v: mid, prev: actual, u } : { v: mid, u: 1 }
    }
  }
  if (k < 0) return null
  const antes = k > 0 ? str(vk[k - 1].v) : vk[0].t > 0 ? p.defaultVariant : null
  if (antes === null || antes === actual || t - vk[k].t >= fade) return null
  const desde = vk[k].t - (k > 0 ? vk[k - 1].t : 0) > T_ENTRE ? intermedio(p, antes, actual) ?? antes : antes
  return { v: actual, prev: desde, u: (t - vk[k].t) / fade }
}

export function poseAt(character: Character, tracks: Tracks, t: number): Pose {
  const parts: Pose['parts'] = {}
  const variants: Pose['variants'] = {}
  const fades: NonNullable<Pose['fades']> = {}
  const mouth = str(evalTrack(tracks['face:mouth'], t, DEFAULTS.mouth))
  for (const p of character.parts) {
    const vk = tracks[`part:${p.id}:v`]
    if (character.expresivo && !p.parent) {
      // Personaje expresivo: la postura es la clave; para hablar se usa su versión con la boca al revés
      let v = vk?.length ? str(evalTrack(vk, t, p.defaultVariant)) : p.defaultVariant
      if (!p.variants[v]) v = p.defaultVariant // postura de otro personaje
      const abierta = ['abierta', 'E', 'O', 'grito'].includes(mouth)
      const alt = abierta !== character.expresivo.abiertas.includes(v)
      variants[p.id] = alt && p.variants[v + '~b'] ? v + '~b' : v
      // Corte seco (como en la referencia) y un parpadeo justo después de cambiar de postura
      if (vk?.length) {
        let k = -1
        for (let i = 0; i < vk.length; i++) if (vk[i].t <= t) k = i
        const dt = k >= 0 ? t - vk[k].t : -1
        if (k >= 0 && (k > 0 || vk[0].t > 0) && dt > 0.04 && dt < 0.12 && p.variants[v + '~c']) variants[p.id] = v + '~c'
      }
    } else if (vk?.length && !p.role) {
      variants[p.id] = str(evalTrack(vk, t, p.defaultVariant))
      if (p.fade) {
        const tr = transicion(p, vk, t)
        if (tr) {
          variants[p.id] = tr.v
          if (tr.prev) fades[p.id] = { prev: tr.prev, u: tr.u }
        }
      }
    }
    const k = `part:${p.id}:`
    parts[p.id] = {
      rot: (character.idle?.[p.id] ?? 0) + num(evalTrack(tracks[k + 'rot'], t, DEFAULTS.rot)),
      x: num(evalTrack(tracks[k + 'x'], t, DEFAULTS.x)),
      y: num(evalTrack(tracks[k + 'y'], t, DEFAULTS.y)),
      scale: num(evalTrack(tracks[k + 'scale'], t, DEFAULTS.scale)),
    }
  }
  // Expresivo con capas de cara: en la familia tranquila (t_*) la boca y los ojos van por su cuenta
  // (como en la referencia: brazos, ojos y boca cambian en momentos distintos)
  const raizX = character.expresivo ? character.parts.find((p) => !p.parent) : undefined
  if (raizX) {
    const cuerpo = (variants[raizX.id] ?? raizX.defaultVariant).split('~')[0]
    const ex = character.expresivo!
    const conCapas = cuerpo.startsWith('t_') && !ex.sinCapas?.includes(cuerpo) && character.parts.some((p) => p.id === 'boca' || p.id === 'ojos')
    const boca = character.parts.find((p) => p.id === 'boca')
    const ojos = character.parts.find((p) => p.id === 'ojos')
    if (conCapas) {
      variants[raizX.id] = variants[raizX.id] === cuerpo + '~c' ? cuerpo + '~c' : cuerpo
      const forma = mouth === 'O' ? 'o' : mouth === 'E' ? 'dientes' : ['abierta', 'grito'].includes(mouth) ? 'abierta' : 'nada'
      if (boca) variants.boca = boca.variants[forma] ? forma : 'nada'
      const brows = str(evalTrack(tracks['face:brows'], t, 'nada'))
      // Mirada: la que pida la animación; si no, la de la postura; si no, al frente (a cámara)
      const porDefecto = ex.ojosPorDefecto?.[cuerpo] ?? (ojos?.variants.frente ? 'frente' : 'nada')
      // «nada»/«neutral» = la mirada normal de la postura (al frente), nunca los ojos del dibujo original
      if (ojos) variants.ojos = variants[raizX.id].endsWith('~c') ? 'cerrados' : brows !== 'nada' && ojos.variants[brows] ? brows : porDefecto
      if (variants[raizX.id].endsWith('~c')) variants[raizX.id] = cuerpo
    } else {
      if (boca) variants.boca = 'nada'
      if (ojos) variants.ojos = 'nada'
      // Sin capas (gags o mano delante de la cara): su propia boca abierta (~b) al hablar
      const v = variants[raizX.id] ?? raizX.defaultVariant
      const abierta = ['abierta', 'E', 'O', 'grito'].includes(mouth)
      if (!v.includes('~')) {
        const alt = abierta !== ex.abiertas.includes(v)
        if (alt && raizX.variants[v + '~b']) variants[raizX.id] = v + '~b'
      }
    }
  }
  return {
    parts,
    gazeX: num(evalTrack(tracks['face:gazeX'], t, DEFAULTS.gazeX)),
    gazeY: num(evalTrack(tracks['face:gazeY'], t, DEFAULTS.gazeY)),
    blink: num(evalTrack(tracks['face:blink'], t, DEFAULTS.blink)),
    mouth,
    brows: str(evalTrack(tracks['face:brows'], t, DEFAULTS.brows)),
    variants,
    fades,
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

/** Nombres de las capas de fondo (los pone la línea de tiempo antes de pedir etiquetas). */
export const layerNames: Record<string, string> = {}

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
  const cam: Record<string, string> = { 'cam:zoom': 'Cámara · zoom', 'cam:x': 'Cámara · mover ↔', 'cam:y': 'Cámara · mover ↕' }
  if (cam[channel]) return cam[channel]
  if (channel.startsWith('bg:')) {
    const [, id, prop] = channel.split(':')
    const n: Record<string, string> = { x: 'mover ↔', y: 'mover ↕', scale: 'tamaño', rot: 'giro', opacity: 'opacidad' }
    return `${layerNames[id] ?? 'Fondo'} · ${n[prop] ?? prop}`
  }
  const [, id, prop] = channel.split(':')
  const part = character.parts.find((p) => p.id === id)
  const propNames: Record<string, string> = { rot: 'giro', x: 'mover ↔', y: 'mover ↕', scale: 'tamaño', v: 'dibujo' }
  return `${part?.name ?? id} · ${propNames[prop] ?? prop}`
}
