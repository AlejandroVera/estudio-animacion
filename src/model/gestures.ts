// Biblioteca de gestos para el esqueleto estándar (cabeza, torso, cadera, brazo_*, antebrazo_*...).
//
// Los gestos se escriben para el lado DERECHO de la pantalla y en direcciones de pantalla
// (grados: 0 derecha, 90 abajo, -90 arriba), no en giros de un dibujo concreto. Al aplicarlos se
// traducen a los giros de cada personaje con el ángulo de reposo de sus piezas, y el lado
// izquierdo es el espejo. Así el mismo gesto sirve para cualquier personaje.

import { poseAt } from './anim'
import { layout } from './render'
import type { Character, CharacterInstance, Ease } from './types'

type Lado = 'der' | 'izq'

/** Valor de una clave de gesto. */
type V =
  | { dir: number } // dirección en pantalla (brazos)
  | { reposo: number } // giro respecto al reposo (positivo = horario en el lado derecho)
  | { alto: number } // desplazamiento vertical, en fracciones de la longitud del brazo (negativo = arriba)
  | { giro: number } // giro directo en grados (cabeza, torso), espejado según el lado
  | { mirada: number } // face:gazeX, espejado según el lado
  | { escala: number } // tamaño de la pieza (un antebrazo algo menor parece apuntar hacia la cámara)
  | number
  | string

/**
 * Canales del gesto:
 *  brazo / antebrazo         el del lado elegido      brazo2 / antebrazo2  el del otro lado
 *  hombros  (alto)           sube o baja los dos brazos desde el hombro
 *  cabeza, torso (giro)      cabeza_y, cadera_y (alto)
 *  mirada (mirada), mirada_y, boca, cejas
 */
interface GK {
  t: number
  c: string
  v: V
  e?: Ease
}

export interface Gesto {
  id: string
  nombre: string
  descripcion: string
  /** 'uno': se elige el lado; 'ambos'/'ninguno': simétrico o sin brazos. */
  lados: 'uno' | 'ambos' | 'ninguno'
  duracion: number
  claves: GK[]
}

const k = (t: number, c: string, v: V, e?: Ease): GK => ({ t, c, v, e })
const both = (t: number, c: 'brazo' | 'antebrazo', v: V, e?: Ease): GK[] => [k(t, c, v, e), k(t, `${c}2`, v, e)]

export const GESTOS: Gesto[] = [
  {
    id: 'saludar',
    nombre: 'Saludar',
    descripcion: 'Sube el brazo a la altura del hombro con el codo doblado y agita la mano; sonríe.',
    lados: 'uno',
    duracion: 2.6,
    claves: [
      k(0, 'brazo', { reposo: 0 }), k(0.18, 'brazo', { reposo: 6 }), k(0.55, 'brazo', { dir: -14 }), k(2.0, 'brazo', { dir: -14 }), k(2.45, 'brazo', { reposo: 0 }),
      k(0, 'antebrazo', { reposo: 0 }), k(0.3, 'antebrazo', { reposo: -15 }), k(0.62, 'antebrazo', { dir: -100 }), k(0.75, 'antebrazo', { dir: -88 }),
      k(0.95, 'antebrazo', { dir: -112 }), k(1.17, 'antebrazo', { dir: -68 }), k(1.39, 'antebrazo', { dir: -112 }), k(1.61, 'antebrazo', { dir: -68 }),
      k(1.83, 'antebrazo', { dir: -90 }), k(2.0, 'antebrazo', { dir: -90 }), k(2.55, 'antebrazo', { reposo: 0 }),
      k(0, 'torso', { giro: 0 }), k(0.55, 'torso', { giro: -2 }), k(2.0, 'torso', { giro: -2 }), k(2.5, 'torso', { giro: 0 }),
      k(0, 'cabeza', { giro: 0 }), k(0.6, 'cabeza', { giro: 5 }), k(2.0, 'cabeza', { giro: 5 }), k(2.6, 'cabeza', { giro: 0 }),
      k(0.3, 'boca', 'sonrisa'),
    ],
  },
  {
    id: 'encogerse',
    nombre: 'Encogerse de hombros',
    descripcion: 'Sube los hombros, codos junto al cuerpo y antebrazos hacia fuera; cabeza ladeada y cara de duda.',
    lados: 'ninguno',
    duracion: 1.9,
    claves: [
      k(0, 'hombros', { alto: 0 }), k(0.12, 'hombros', { alto: 0.02 }), k(0.38, 'hombros', { alto: -0.09 }), k(1.1, 'hombros', { alto: -0.09 }), k(1.5, 'hombros', { alto: 0 }),
      ...both(0, 'brazo', { reposo: 0 }), ...both(0.12, 'brazo', { reposo: 3 }), ...both(0.38, 'brazo', { dir: 84 }), ...both(1.1, 'brazo', { dir: 84 }), ...both(1.55, 'brazo', { reposo: 0 }),
      ...both(0, 'antebrazo', { reposo: 0 }), ...both(0.2, 'antebrazo', { reposo: 5 }), ...both(0.45, 'antebrazo', { dir: 24 }), ...both(0.56, 'antebrazo', { dir: 32 }),
      ...both(1.1, 'antebrazo', { dir: 32 }), ...both(1.62, 'antebrazo', { reposo: 0 }),
      ...both(0, 'antebrazo', { escala: 1 }), ...both(0.45, 'antebrazo', { escala: 0.82 }), ...both(1.1, 'antebrazo', { escala: 0.82 }), ...both(1.62, 'antebrazo', { escala: 1 }),
      k(0, 'cabeza', { giro: 0 }), k(0.4, 'cabeza', { giro: 7 }), k(1.1, 'cabeza', { giro: 7 }), k(1.6, 'cabeza', { giro: 0 }),
      k(0, 'cabeza_y', { alto: 0 }), k(0.38, 'cabeza_y', { alto: 0.05 }), k(1.1, 'cabeza_y', { alto: 0.05 }), k(1.5, 'cabeza_y', { alto: 0 }),
      k(0, 'cadera_y', { alto: 0 }), k(0.12, 'cadera_y', { alto: 0.015 }), k(0.38, 'cadera_y', { alto: -0.01 }), k(1.5, 'cadera_y', { alto: 0 }),
      k(0.25, 'cejas', 'triste'), k(0.25, 'boca', 'MBP'), k(1.7, 'cejas', 'neutral'), k(1.7, 'boca', 'cerrada'),
    ],
  },
  {
    id: 'senalar',
    nombre: 'Señalar',
    descripcion: 'Estira el brazo hacia un lado a la altura del pecho y mira hacia donde señala.',
    lados: 'uno',
    duracion: 2.2,
    claves: [
      k(0, 'brazo', { reposo: 0 }), k(0.15, 'brazo', { reposo: 5 }), k(0.45, 'brazo', { dir: -6 }), k(0.6, 'brazo', { dir: 0 }), k(1.7, 'brazo', { dir: 0 }), k(2.15, 'brazo', { reposo: 0 }),
      k(0, 'antebrazo', { reposo: 0 }), k(0.2, 'antebrazo', { reposo: -10 }), k(0.5, 'antebrazo', { dir: -10 }), k(0.65, 'antebrazo', { dir: 0 }), k(1.7, 'antebrazo', { dir: 0 }), k(2.2, 'antebrazo', { reposo: 0 }),
      k(0, 'torso', { giro: 0 }), k(0.45, 'torso', { giro: -2 }), k(1.7, 'torso', { giro: -2 }), k(2.2, 'torso', { giro: 0 }),
      k(0, 'cabeza', { giro: 0 }), k(0.5, 'cabeza', { giro: 4 }), k(1.7, 'cabeza', { giro: 4 }), k(2.2, 'cabeza', { giro: 0 }),
      k(0, 'mirada', { mirada: 0 }), k(0.35, 'mirada', { mirada: 0.85 }), k(1.75, 'mirada', { mirada: 0.85 }), k(2.05, 'mirada', { mirada: 0 }),
    ],
  },
  {
    id: 'pensar',
    nombre: 'Pensar',
    descripcion: 'Cruza el brazo por delante del pecho y apoya la mano en la barbilla; mira hacia arriba.',
    lados: 'uno',
    duracion: 3.0,
    claves: [
      k(0, 'brazo', { reposo: 0 }), k(0.5, 'brazo', { dir: 150 }), k(2.4, 'brazo', { dir: 150 }), k(2.9, 'brazo', { reposo: 0 }),
      k(0, 'antebrazo', { reposo: 0 }), k(0.25, 'antebrazo', { reposo: 10 }), k(0.6, 'antebrazo', { dir: -80 }), k(0.72, 'antebrazo', { dir: -74 }), k(2.4, 'antebrazo', { dir: -74 }), k(2.95, 'antebrazo', { reposo: 0 }),
      k(0, 'cabeza', { giro: 0 }), k(0.6, 'cabeza', { giro: -6 }), k(2.4, 'cabeza', { giro: -6 }), k(2.9, 'cabeza', { giro: 0 }),
      k(0, 'mirada', { mirada: 0 }), k(0.5, 'mirada', { mirada: -0.6 }), k(2.4, 'mirada', { mirada: -0.6 }), k(2.8, 'mirada', { mirada: 0 }),
      k(0, 'mirada_y', 0), k(0.5, 'mirada_y', -0.6), k(2.4, 'mirada_y', -0.6), k(2.8, 'mirada_y', 0),
      k(0.4, 'boca', 'MBP'), k(0.4, 'cejas', 'triste'), k(2.8, 'boca', 'cerrada'), k(2.8, 'cejas', 'neutral'),
    ],
  },
  {
    id: 'jarras',
    nombre: 'Brazos en jarra',
    descripcion: 'Manos en la cintura con los codos hacia fuera; postura firme o desafiante.',
    lados: 'ninguno',
    duracion: 2.6,
    claves: [
      ...both(0, 'brazo', { reposo: 0 }), ...both(0.4, 'brazo', { dir: 36 }), ...both(0.52, 'brazo', { dir: 40 }), ...both(2.1, 'brazo', { dir: 40 }), ...both(2.6, 'brazo', { reposo: 0 }),
      ...both(0, 'antebrazo', { reposo: 0 }), ...both(0.45, 'antebrazo', { dir: 150 }), ...both(0.55, 'antebrazo', { dir: 145 }), ...both(2.1, 'antebrazo', { dir: 145 }), ...both(2.6, 'antebrazo', { reposo: 0 }),
      k(0, 'cadera_y', { alto: 0 }), k(0.4, 'cadera_y', { alto: -0.015 }), k(0.6, 'cadera_y', { alto: 0 }),
      k(0, 'cabeza', { giro: 0 }), k(0.5, 'cabeza', { giro: -3 }), k(2.1, 'cabeza', { giro: -3 }), k(2.6, 'cabeza', { giro: 0 }),
    ],
  },
  {
    id: 'explicar',
    nombre: 'Explicar',
    descripcion: 'Gesticula con las dos manos, alternándolas, como quien explica algo.',
    lados: 'ninguno',
    duracion: 2.6,
    claves: [
      ...both(0, 'brazo', { reposo: 0 }), ...both(0.35, 'brazo', { dir: 80 }), ...both(2.1, 'brazo', { dir: 80 }), ...both(2.6, 'brazo', { reposo: 0 }),
      ...both(0, 'antebrazo', { reposo: 0 }),
      k(0.4, 'antebrazo', { dir: -20 }), k(0.7, 'antebrazo', { dir: 10 }), k(1.0, 'antebrazo', { dir: -25 }), k(1.3, 'antebrazo', { dir: 8 }), k(1.6, 'antebrazo', { dir: -20 }), k(2.1, 'antebrazo', { dir: 0 }),
      k(0.5, 'antebrazo2', { dir: 5 }), k(0.85, 'antebrazo2', { dir: -25 }), k(1.15, 'antebrazo2', { dir: 10 }), k(1.45, 'antebrazo2', { dir: -20 }), k(1.75, 'antebrazo2', { dir: 5 }), k(2.1, 'antebrazo2', { dir: 0 }),
      ...both(2.65, 'antebrazo', { reposo: 0 }),
      k(0, 'cabeza', { giro: 0 }), k(0.7, 'cabeza', { giro: 3 }), k(1.3, 'cabeza', { giro: -2 }), k(1.9, 'cabeza', { giro: 2 }), k(2.6, 'cabeza', { giro: 0 }),
    ],
  },
  {
    id: 'asentir',
    nombre: 'Asentir (sí)',
    descripcion: 'Mueve la cabeza arriba y abajo tres veces.',
    lados: 'ninguno',
    duracion: 1.2,
    claves: [
      k(0, 'cabeza_y', { alto: 0 }), k(0.15, 'cabeza_y', { alto: 0.06 }), k(0.35, 'cabeza_y', { alto: -0.015 }), k(0.55, 'cabeza_y', { alto: 0.06 }),
      k(0.75, 'cabeza_y', { alto: -0.015 }), k(0.95, 'cabeza_y', { alto: 0.04 }), k(1.15, 'cabeza_y', { alto: 0 }),
      k(0, 'cabeza', { giro: 0 }), k(0.15, 'cabeza', { giro: 2 }), k(0.55, 'cabeza', { giro: 2 }), k(1.15, 'cabeza', { giro: 0 }),
      k(0, 'mirada_y', 0), k(0.15, 'mirada_y', 0.5), k(0.95, 'mirada_y', 0.5), k(1.15, 'mirada_y', 0),
    ],
  },
  {
    id: 'negar',
    nombre: 'Negar (no)',
    descripcion: 'Mueve la cabeza a un lado y a otro, con la boca apretada.',
    lados: 'ninguno',
    duracion: 1.3,
    claves: [
      k(0, 'cabeza', { giro: 0 }), k(0.18, 'cabeza', { giro: -7 }), k(0.42, 'cabeza', { giro: 7 }), k(0.66, 'cabeza', { giro: -6 }), k(0.9, 'cabeza', { giro: 4 }), k(1.15, 'cabeza', { giro: 0 }),
      k(0, 'mirada', { mirada: 0 }), k(0.18, 'mirada', { mirada: -0.4 }), k(0.42, 'mirada', { mirada: 0.4 }), k(0.66, 'mirada', { mirada: -0.4 }), k(0.9, 'mirada', { mirada: 0.2 }), k(1.15, 'mirada', { mirada: 0 }),
      k(0.1, 'boca', 'MBP'), k(1.2, 'boca', 'cerrada'),
    ],
  },
  {
    id: 'celebrar',
    nombre: 'Celebrar',
    descripcion: 'Levanta los dos brazos con un pequeño salto y cara de alegría.',
    lados: 'ninguno',
    duracion: 1.9,
    claves: [
      ...both(0, 'brazo', { reposo: 0 }), ...both(0.12, 'brazo', { reposo: 6 }), ...both(0.35, 'brazo', { dir: -60 }), ...both(0.45, 'brazo', { dir: -55 }), ...both(1.35, 'brazo', { dir: -55 }), ...both(1.85, 'brazo', { reposo: 0 }),
      ...both(0, 'antebrazo', { reposo: 0 }), ...both(0.4, 'antebrazo', { dir: -85 }), ...both(0.5, 'antebrazo', { dir: -78 }), ...both(1.35, 'antebrazo', { dir: -78 }), ...both(1.9, 'antebrazo', { reposo: 0 }),
      k(0, 'cadera_y', { alto: 0 }), k(0.12, 'cadera_y', { alto: 0.03 }), k(0.35, 'cadera_y', { alto: -0.07 }), k(0.55, 'cadera_y', { alto: 0 }),
      k(0.75, 'cadera_y', { alto: -0.04 }), k(0.95, 'cadera_y', { alto: 0 }),
      k(0.25, 'boca', 'abierta'), k(0.25, 'cejas', 'sorprendido'), k(1.4, 'boca', 'sonrisa'), k(1.4, 'cejas', 'neutral'),
    ],
  },
  {
    id: 'sorpresa',
    nombre: 'Sorpresa',
    descripcion: 'Respingo: da un pequeño salto, abre los brazos y pone cara de asombro.',
    lados: 'ninguno',
    duracion: 1.3,
    claves: [
      k(0, 'cadera_y', { alto: 0 }), k(0.08, 'cadera_y', { alto: -0.04 }), k(0.3, 'cadera_y', { alto: 0 }),
      ...both(0, 'brazo', { reposo: 0 }), ...both(0.12, 'brazo', { reposo: -10 }), ...both(1.0, 'brazo', { reposo: -8 }), ...both(1.3, 'brazo', { reposo: 0 }),
      ...both(0, 'antebrazo', { reposo: 0 }), ...both(0.15, 'antebrazo', { reposo: -18 }), ...both(1.0, 'antebrazo', { reposo: -14 }), ...both(1.3, 'antebrazo', { reposo: 0 }),
      k(0, 'cabeza_y', { alto: 0 }), k(0.1, 'cabeza_y', { alto: -0.02 }), k(0.4, 'cabeza_y', { alto: 0 }),
      k(0.05, 'cejas', 'sorprendido'), k(0.05, 'boca', 'O'), k(1.15, 'cejas', 'neutral'), k(1.15, 'boca', 'cerrada'),
    ],
  },
]

export interface ClaveSalida {
  canal: string
  t: number
  valor: string
  transicion: Ease
}

const norm = (a: number) => {
  let x = ((a % 360) + 360) % 360
  if (x > 180) x -= 360
  return x
}

/** Ángulo de reposo en pantalla de cada pieza y longitud del brazo (para escalar desplazamientos). */
export function skeletonInfo(character: Character, inst: CharacterInstance) {
  const placed = layout(character, { ...inst, x: 0, y: 0, scale: 1 }, poseAt(character, {}, 0), true)
  const byId = new Map(placed.map((p) => [p.part.id, p]))
  const angles: Record<string, number> = {}
  for (const pl of placed) {
    if (pl.part.role) continue
    const child = character.parts.find((c) => c.parent === pl.part.id && !c.role && byId.has(c.id))
    let dx: number
    let dy: number
    if (child) {
      const cm = byId.get(child.id)!.matrix
      dx = cm.e - pl.matrix.e
      dy = cm.f - pl.matrix.f
    } else {
      const a = character.assets[pl.assetId]
      const p = pl.matrix.transformPoint(new DOMPoint(a.w / 2 - pl.part.anchor.x, a.h / 2 - pl.part.anchor.y))
      dx = p.x - pl.matrix.e
      dy = p.y - pl.matrix.f
    }
    angles[pl.part.id] = (Math.atan2(dy, dx) * 180) / Math.PI
  }
  const fore = character.parts.find((p) => p.id === 'antebrazo_der') ?? character.parts.find((p) => p.id === 'antebrazo_izq')
  const armLength = fore ? Math.hypot(fore.offset.x, fore.offset.y) : 200
  return { angles, armLength }
}

/** Convierte un gesto en claves para este personaje, empezando en t0. */
export function expandGesture(
  gesto: Gesto,
  lado: Lado,
  t0: number,
  velocidad: number,
  character: Character,
  inst: CharacterInstance,
): { claves: ClaveSalida[]; canales: string[]; fin: number } {
  const { angles, armLength } = skeletonInfo(character, inst)
  const has = (id: string) => character.parts.some((p) => p.id === id)
  const sideOf = (c: string) => (c.endsWith('2') ? (lado === 'der' ? 'izq' : 'der') : lado)
  const mirror = (s: Lado) => (s === 'der' ? 1 : -1)
  const speed = velocidad > 0 ? velocidad : 1
  const out: ClaveSalida[] = []
  // Giros de los brazos ya calculados, para encadenar el del antebrazo.
  const armRot: Record<Lado, { t: number; r: number }[]> = { der: [], izq: [] }
  const armRotAt = (s: Lado, t: number) => {
    const ks = armRot[s]
    if (!ks.length) return 0
    if (t <= ks[0].t) return ks[0].r
    for (let i = 0; i < ks.length - 1; i++) {
      if (t <= ks[i + 1].t) return ks[i].r + ((ks[i + 1].r - ks[i].r) * (t - ks[i].t)) / (ks[i + 1].t - ks[i].t)
    }
    return ks[ks.length - 1].r
  }
  const push = (canal: string, t: number, valor: number | string, e?: Ease) =>
    out.push({
      canal,
      t: t0 + t / speed,
      valor: typeof valor === 'number' ? String(Math.round(valor * 100) / 100) : valor,
      transicion: e ?? (typeof valor === 'string' ? 'salto' : 'suave'),
    })
  const dirOf = (d: number, s: Lado) => (s === 'der' ? d : 180 - d)

  // Primero los brazos (los antebrazos dependen de ellos).
  const ordered = [...gesto.claves].sort((a, b) => Number(a.c.startsWith('antebrazo')) - Number(b.c.startsWith('antebrazo')) || a.t - b.t)
  for (const g of ordered) {
    const v = g.v
    if (g.c === 'brazo' || g.c === 'brazo2' || g.c === 'antebrazo' || g.c === 'antebrazo2') {
      const s = sideOf(g.c)
      const isArm = g.c.startsWith('brazo')
      const id = `${isArm ? 'brazo' : 'antebrazo'}_${s}`
      if (!has(id) || typeof v !== 'object') continue
      if ('escala' in v) {
        push(`part:${id}:scale`, g.t, v.escala, g.e)
        continue
      }
      let rot: number
      if ('dir' in v) {
        const target = dirOf(v.dir, s)
        rot = isArm ? norm(target - angles[id]) : norm(target - angles[id] - armRotAt(s, g.t))
      } else if ('reposo' in v) {
        rot = v.reposo * mirror(s)
      } else continue
      if (isArm) armRot[s].push({ t: g.t, r: rot })
      push(`part:${id}:rot`, g.t, rot, g.e)
    } else if (g.c === 'hombros' && typeof v === 'object' && 'alto' in v) {
      for (const s of ['der', 'izq'] as Lado[]) if (has(`brazo_${s}`)) push(`part:brazo_${s}:y`, g.t, v.alto * armLength, g.e)
    } else if ((g.c === 'cabeza' || g.c === 'torso') && typeof v === 'object' && 'giro' in v) {
      if (has(g.c)) push(`part:${g.c}:rot`, g.t, v.giro * mirror(lado), g.e)
    } else if ((g.c === 'cabeza_y' || g.c === 'cadera_y') && typeof v === 'object' && 'alto' in v) {
      const id = g.c === 'cabeza_y' ? 'cabeza' : 'cadera'
      if (has(id)) push(`part:${id}:y`, g.t, v.alto * armLength, g.e)
    } else if (g.c === 'mirada' && typeof v === 'object' && 'mirada' in v) {
      push('face:gazeX', g.t, v.mirada * mirror(lado), g.e)
    } else if (g.c === 'mirada_y' && typeof v === 'number') {
      push('face:gazeY', g.t, v, g.e)
    } else if ((g.c === 'boca' || g.c === 'cejas') && typeof v === 'string') {
      push(g.c === 'boca' ? 'face:mouth' : 'face:brows', g.t, v)
    }
  }
  return { claves: out, canales: [...new Set(out.map((c) => c.canal))], fin: t0 + gesto.duracion / speed }
}
