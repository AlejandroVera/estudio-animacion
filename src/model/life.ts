// «Vida automática»: pequeños movimientos que se suman a la animación al dibujar, sin crear
// claves, para que el personaje nunca parezca congelado: respiración, balanceo de cabeza y brazos,
// y parpadeos (solo si el usuario no ha animado los párpados).

import type { Pose, Tracks } from './types'

const TAU = Math.PI * 2

// Parpadeos pseudoaleatorios pero siempre en los mismos instantes (cada 2,4-4,8 s).
const BLINKS: number[] = (() => {
  const out: number[] = []
  let t = 1.1
  let seed = 7
  while (t < 600) {
    out.push(t)
    seed = (seed * 9301 + 49297) % 233280
    t += 2.4 + (seed / 233280) * 2.4
  }
  return out
})()

function blinkAt(t: number): number {
  for (const b of BLINKS) {
    if (b > t + 0.2) break
    const d = t - b
    if (d >= 0 && d < 0.16) return d < 0.06 ? d / 0.06 : 1 - (d - 0.06) / 0.1
  }
  return 0
}

/** Devuelve una copia de la pose con la vida automática sumada. */
export function withLife(pose: Pose, t: number, tracks: Tracks, armLength: number): Pose {
  const parts = { ...pose.parts }
  const add = (id: string, d: Partial<{ rot: number; x: number; y: number }>) => {
    const p = parts[id]
    if (!p) return
    parts[id] = { ...p, rot: p.rot + (d.rot ?? 0), x: p.x + (d.x ?? 0), y: p.y + (d.y ?? 0) }
  }
  const breath = Math.sin((TAU * t) / 3.6)
  add('cadera', { y: breath * armLength * 0.006 })
  add('torso', { rot: Math.sin((TAU * t) / 3.6 + 0.6) * 0.5 })
  add('cabeza', { rot: Math.sin((TAU * t) / 5.3 + 1.3) * 0.9, y: -breath * armLength * 0.004 })
  add('brazo_der', { rot: Math.sin((TAU * t) / 4.1 + 0.4) * 1.0 })
  add('brazo_izq', { rot: -Math.sin((TAU * t) / 4.4 + 2.1) * 1.0 })
  add('antebrazo_der', { rot: Math.sin((TAU * t) / 4.1 - 0.3) * 1.2 })
  add('antebrazo_izq', { rot: -Math.sin((TAU * t) / 4.4 + 1.4) * 1.2 })
  const blink = tracks['face:blink']?.length ? pose.blink : Math.max(pose.blink, blinkAt(t))
  return { ...pose, parts, blink }
}
