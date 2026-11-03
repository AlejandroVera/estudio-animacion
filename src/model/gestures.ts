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
 *  mano / mano2              dibujo de la mano (natural, abierta, palma_arriba, puno, indice, dorso, pulgar)
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
  /**
   * Para personajes por poses: secuencia de dibujos del cuerpo (en lugar de girar brazos).
   * `izq` es el dibujo a usar si el gesto se pide hacia el lado izquierdo de la pantalla.
   */
  poses?: { t: number; pose: string; izq?: string }[]
}

const k = (t: number, c: string, v: V, e?: Ease): GK => ({ t, c, v, e })
const both = (t: number, c: 'brazo' | 'antebrazo' | 'mano', v: V, e?: Ease): GK[] => [k(t, c, v, e), k(t, `${c}2`, v, e)]

export const GESTOS: Gesto[] = [
  {
    id: 'saludar',
    nombre: 'Saludar',
    descripcion: 'Sube la mano por delante del cuerpo hasta la altura de la cabeza y la agita; sonríe.',
    lados: 'uno',
    duracion: 2.75,
    poses: [{ t: 0, pose: 'saludar_a' }, { t: 0.32, pose: 'saludar_b' }, { t: 0.62, pose: 'saludar_a' }, { t: 0.92, pose: 'saludar_b' }, { t: 1.22, pose: 'saludar_a' }, { t: 2.1, pose: 'reposo' }],
    claves: [
      // Primero sube la mano por delante del pecho (antebrazo acortado = viene hacia la cámara),
      // luego el codo se abre y la mano queda junto a la cabeza. Al bajar, la mano baja por delante.
      k(0, 'brazo', { reposo: 0 }), k(0.15, 'brazo', { reposo: 5 }), k(0.5, 'brazo', { dir: 70 }), k(0.74, 'brazo', { dir: -12 }), k(2.0, 'brazo', { dir: -12 }),
      k(2.3, 'brazo', { dir: 60 }), k(2.6, 'brazo', { reposo: 0 }),
      k(0, 'antebrazo', { reposo: 0 }), k(0.3, 'antebrazo', { dir: 185 }), k(0.5, 'antebrazo', { dir: 228 }), k(0.74, 'antebrazo', { dir: -96 }), k(0.86, 'antebrazo', { dir: -86 }),
      k(1.06, 'antebrazo', { dir: -112 }), k(1.28, 'antebrazo', { dir: -70 }), k(1.5, 'antebrazo', { dir: -112 }), k(1.72, 'antebrazo', { dir: -72 }),
      k(1.9, 'antebrazo', { dir: -92 }), k(2.0, 'antebrazo', { dir: -92 }), k(2.3, 'antebrazo', { dir: 200 }), k(2.65, 'antebrazo', { reposo: 0 }),
      k(0, 'antebrazo', { escala: 1 }), k(0.3, 'antebrazo', { escala: 0.45 }), k(0.5, 'antebrazo', { escala: 0.75 }), k(0.74, 'antebrazo', { escala: 1 }),
      k(2.0, 'antebrazo', { escala: 1 }), k(2.3, 'antebrazo', { escala: 0.5 }), k(2.65, 'antebrazo', { escala: 1 }),
      k(0, 'torso', { giro: 0 }), k(0.7, 'torso', { giro: -2 }), k(2.0, 'torso', { giro: -2 }), k(2.6, 'torso', { giro: 0 }),
      k(0, 'cabeza', { giro: 0 }), k(0.75, 'cabeza', { giro: 5 }), k(2.0, 'cabeza', { giro: 5 }), k(2.7, 'cabeza', { giro: 0 }),
      k(0.3, 'boca', 'sonrisa'), k(0.35, 'mano', 'abierta'), k(2.45, 'mano', 'natural'),
    ],
  },
  {
    id: 'encogerse',
    nombre: 'Encogerse de hombros',
    descripcion: 'Sube los hombros, codos junto al cuerpo y antebrazos hacia fuera; cabeza ladeada y cara de duda.',
    lados: 'ninguno',
    duracion: 1.9,
    poses: [{ t: 0.05, pose: 'encogerse' }, { t: 1.45, pose: 'reposo' }],
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
      ...both(0.3, 'mano', 'palma_arriba'), ...both(1.3, 'mano', 'natural'),
    ],
  },
  {
    id: 'senalar',
    nombre: 'Señalar',
    descripcion: 'Estira el brazo hacia un lado a la altura del pecho y mira hacia donde señala.',
    lados: 'uno',
    duracion: 2.2,
    poses: [{ t: 0.1, pose: 'senalar_der', izq: 'senalar_izq' }, { t: 1.85, pose: 'reposo' }],
    claves: [
      k(0, 'brazo', { reposo: 0 }), k(0.15, 'brazo', { reposo: 5 }), k(0.45, 'brazo', { dir: -6 }), k(0.6, 'brazo', { dir: 0 }), k(1.7, 'brazo', { dir: 0 }), k(2.15, 'brazo', { reposo: 0 }),
      k(0, 'antebrazo', { reposo: 0 }), k(0.2, 'antebrazo', { reposo: -10 }), k(0.5, 'antebrazo', { dir: -10 }), k(0.65, 'antebrazo', { dir: 0 }), k(1.7, 'antebrazo', { dir: 0 }), k(2.2, 'antebrazo', { reposo: 0 }),
      k(0, 'torso', { giro: 0 }), k(0.45, 'torso', { giro: -2 }), k(1.7, 'torso', { giro: -2 }), k(2.2, 'torso', { giro: 0 }),
      k(0, 'cabeza', { giro: 0 }), k(0.5, 'cabeza', { giro: 4 }), k(1.7, 'cabeza', { giro: 4 }), k(2.2, 'cabeza', { giro: 0 }),
      k(0, 'mirada', { mirada: 0 }), k(0.35, 'mirada', { mirada: 0.85 }), k(1.75, 'mirada', { mirada: 0.85 }), k(2.05, 'mirada', { mirada: 0 }),
      k(0.35, 'mano', 'indice'), k(1.85, 'mano', 'natural'),
    ],
  },
  {
    id: 'pensar',
    nombre: 'Pensar',
    descripcion: 'Se rasca la cabeza con cara de duda, mirando hacia arriba.',
    lados: 'uno',
    duracion: 3.0,
    poses: [{ t: 0.1, pose: 'cruzado' }, { t: 2.6, pose: 'reposo' }],
    claves: [
      k(0, 'brazo', { reposo: 0 }), k(0.15, 'brazo', { reposo: 5 }), k(0.55, 'brazo', { dir: -38 }), k(2.4, 'brazo', { dir: -38 }), k(2.9, 'brazo', { reposo: 0 }),
      k(0, 'antebrazo', { reposo: 0 }), k(0.3, 'antebrazo', { reposo: -20 }), k(0.65, 'antebrazo', { dir: -150 }),
      k(0.9, 'antebrazo', { dir: -158 }), k(1.1, 'antebrazo', { dir: -146 }), k(1.3, 'antebrazo', { dir: -158 }), k(1.5, 'antebrazo', { dir: -146 }),
      k(1.7, 'antebrazo', { dir: -152 }), k(2.4, 'antebrazo', { dir: -152 }), k(2.95, 'antebrazo', { reposo: 0 }),
      k(0.4, 'mano', 'dorso'), k(2.6, 'mano', 'natural'),
      k(0, 'cabeza', { giro: 0 }), k(0.6, 'cabeza', { giro: -7 }), k(2.4, 'cabeza', { giro: -7 }), k(2.9, 'cabeza', { giro: 0 }),
      k(0, 'torso', { giro: 0 }), k(0.6, 'torso', { giro: -2 }), k(2.4, 'torso', { giro: -2 }), k(2.9, 'torso', { giro: 0 }),
      k(0, 'mirada', { mirada: 0 }), k(0.5, 'mirada', { mirada: -0.5 }), k(2.4, 'mirada', { mirada: -0.5 }), k(2.8, 'mirada', { mirada: 0 }),
      k(0, 'mirada_y', 0), k(0.5, 'mirada_y', -0.7), k(2.4, 'mirada_y', -0.7), k(2.8, 'mirada_y', 0),
      k(0.4, 'boca', 'MBP'), k(0.4, 'cejas', 'triste'), k(2.8, 'boca', 'cerrada'), k(2.8, 'cejas', 'neutral'),
    ],
  },
  {
    id: 'jarras',
    nombre: 'Brazos en jarra',
    descripcion: 'Manos en la cintura con los codos hacia fuera; postura firme o desafiante.',
    lados: 'ninguno',
    duracion: 2.6,
    poses: [{ t: 0.1, pose: 'jarras' }, { t: 2.2, pose: 'reposo' }],
    claves: [
      ...both(0, 'brazo', { reposo: 0 }), ...both(0.4, 'brazo', { dir: 36 }), ...both(0.52, 'brazo', { dir: 40 }), ...both(2.1, 'brazo', { dir: 40 }), ...both(2.6, 'brazo', { reposo: 0 }),
      ...both(0, 'antebrazo', { reposo: 0 }), ...both(0.45, 'antebrazo', { dir: 150 }), ...both(0.55, 'antebrazo', { dir: 145 }), ...both(2.1, 'antebrazo', { dir: 145 }), ...both(2.6, 'antebrazo', { reposo: 0 }),
      k(0, 'cadera_y', { alto: 0 }), k(0.4, 'cadera_y', { alto: -0.015 }), k(0.6, 'cadera_y', { alto: 0 }),
      k(0, 'cabeza', { giro: 0 }), k(0.5, 'cabeza', { giro: -3 }), k(2.1, 'cabeza', { giro: -3 }), k(2.6, 'cabeza', { giro: 0 }),
      ...both(0.4, 'mano', 'puno'), ...both(2.2, 'mano', 'natural'),
    ],
  },
  {
    id: 'explicar',
    nombre: 'Explicar',
    descripcion: 'Codos junto al cuerpo y manos delante de la tripa, palmas arriba, moviéndolas a golpes y alternando, como quien explica algo.',
    lados: 'ninguno',
    duracion: 2.7,
    poses: [{ t: 0.05, pose: 'hablar_b' }, { t: 1.0, pose: 'explicar' }, { t: 2.2, pose: 'reposo' }],
    claves: [
      // Antebrazos muy acortados (apuntan hacia la cámara): las manos quedan delante de la tripa,
      // separadas. Movimiento a golpes: llega, se queda, otro golpe; cada mano a su ritmo.
      ...both(0, 'brazo', { reposo: 0 }), ...both(0.28, 'brazo', { dir: 84 }), ...both(2.25, 'brazo', { dir: 84 }), ...both(2.6, 'brazo', { reposo: 0 }),
      k(0, 'antebrazo', { reposo: 0 }), k(0.3, 'antebrazo', { dir: 205 }), k(0.42, 'antebrazo', { dir: 200 }), k(0.85, 'antebrazo', { dir: 218 }), k(0.95, 'antebrazo', { dir: 212 }),
      k(1.45, 'antebrazo', { dir: 196 }), k(1.55, 'antebrazo', { dir: 202 }), k(2.25, 'antebrazo', { dir: 204 }), k(2.62, 'antebrazo', { reposo: 0 }),
      k(0, 'antebrazo2', { reposo: 0 }), k(0.38, 'antebrazo2', { dir: 198 }), k(0.5, 'antebrazo2', { dir: 203 }), k(1.15, 'antebrazo2', { dir: 220 }), k(1.25, 'antebrazo2', { dir: 214 }),
      k(1.8, 'antebrazo2', { dir: 194 }), k(1.9, 'antebrazo2', { dir: 199 }), k(2.3, 'antebrazo2', { dir: 200 }), k(2.68, 'antebrazo2', { reposo: 0 }),
      ...both(0, 'antebrazo', { escala: 1 }), ...both(0.32, 'antebrazo', { escala: 0.4 }), ...both(2.28, 'antebrazo', { escala: 0.4 }), ...both(2.65, 'antebrazo', { escala: 1 }),
      k(0, 'cabeza', { giro: 0 }), k(0.85, 'cabeza', { giro: 3 }), k(1.45, 'cabeza', { giro: -2 }), k(2.0, 'cabeza', { giro: 1 }), k(2.6, 'cabeza', { giro: 0 }),
      k(0, 'cabeza_y', { alto: 0 }), k(0.85, 'cabeza_y', { alto: 0.012 }), k(1.0, 'cabeza_y', { alto: 0 }), k(1.45, 'cabeza_y', { alto: 0.012 }), k(1.6, 'cabeza_y', { alto: 0 }),
      ...both(0.25, 'mano', 'palma_arriba'), ...both(2.45, 'mano', 'natural'),
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
    poses: [{ t: 0.1, pose: 'celebrar' }, { t: 1.5, pose: 'reposo' }],
    claves: [
      ...both(0, 'brazo', { reposo: 0 }), ...both(0.12, 'brazo', { reposo: 6 }), ...both(0.35, 'brazo', { dir: -60 }), ...both(0.45, 'brazo', { dir: -55 }), ...both(1.35, 'brazo', { dir: -55 }), ...both(1.85, 'brazo', { reposo: 0 }),
      ...both(0, 'antebrazo', { reposo: 0 }), ...both(0.4, 'antebrazo', { dir: -85 }), ...both(0.5, 'antebrazo', { dir: -78 }), ...both(1.35, 'antebrazo', { dir: -78 }), ...both(1.9, 'antebrazo', { reposo: 0 }),
      k(0, 'cadera_y', { alto: 0 }), k(0.12, 'cadera_y', { alto: 0.03 }), k(0.35, 'cadera_y', { alto: -0.07 }), k(0.55, 'cadera_y', { alto: 0 }),
      k(0.75, 'cadera_y', { alto: -0.04 }), k(0.95, 'cadera_y', { alto: 0 }),
      k(0.25, 'boca', 'abierta'), k(0.25, 'cejas', 'sorprendido'), k(1.4, 'boca', 'sonrisa'), k(1.4, 'cejas', 'neutral'),
      ...both(0.3, 'mano', 'puno'), ...both(1.5, 'mano', 'natural'),
    ],
  },
  {
    id: 'sorpresa',
    nombre: 'Sorpresa',
    descripcion: 'Respingo: da un pequeño salto, abre los brazos y pone cara de asombro.',
    lados: 'ninguno',
    duracion: 1.3,
    poses: [{ t: 0.03, pose: 'sorpresa' }, { t: 1.1, pose: 'reposo' }],
    claves: [
      k(0, 'cadera_y', { alto: 0 }), k(0.08, 'cadera_y', { alto: -0.04 }), k(0.3, 'cadera_y', { alto: 0 }),
      ...both(0, 'brazo', { reposo: 0 }), ...both(0.12, 'brazo', { reposo: -10 }), ...both(1.0, 'brazo', { reposo: -8 }), ...both(1.3, 'brazo', { reposo: 0 }),
      ...both(0, 'antebrazo', { reposo: 0 }), ...both(0.15, 'antebrazo', { reposo: -18 }), ...both(1.0, 'antebrazo', { reposo: -14 }), ...both(1.3, 'antebrazo', { reposo: 0 }),
      k(0, 'cabeza_y', { alto: 0 }), k(0.1, 'cabeza_y', { alto: -0.02 }), k(0.4, 'cabeza_y', { alto: 0 }),
      k(0.05, 'cejas', 'sorprendido'), k(0.05, 'boca', 'O'), k(1.15, 'cejas', 'neutral'), k(1.15, 'boca', 'cerrada'),
      ...both(0.08, 'mano', 'abierta'), ...both(1.2, 'mano', 'natural'),
    ],
  },
  {
    id: 'hablar',
    nombre: 'Hablar (manos)',
    descripcion: 'Acompaña lo que dice con una mano delante de la tripa que marca el ritmo, sin un gesto concreto. Para rellenar mientras habla.',
    lados: 'uno',
    duracion: 2.4,
    poses: [{ t: 0.05, pose: 'hablar_a', izq: 'hablar_c' }, { t: 2.1, pose: 'reposo' }],
    claves: [
      // Una mano sube delante de la tripa (antebrazo hacia la cámara) y marca el ritmo a golpes;
      // la otra apenas se mueve.
      k(0, 'brazo', { reposo: 0 }), k(0.25, 'brazo', { dir: 84 }), k(1.95, 'brazo', { dir: 84 }), k(2.4, 'brazo', { reposo: 0 }),
      k(0, 'antebrazo', { reposo: 0 }), k(0.28, 'antebrazo', { dir: 200 }), k(0.4, 'antebrazo', { dir: 195 }), k(0.85, 'antebrazo', { dir: 214 }), k(0.95, 'antebrazo', { dir: 208 }),
      k(1.45, 'antebrazo', { dir: 190 }), k(1.55, 'antebrazo', { dir: 196 }), k(1.95, 'antebrazo', { dir: 198 }), k(2.4, 'antebrazo', { reposo: 0 }),
      k(0, 'antebrazo', { escala: 1 }), k(0.28, 'antebrazo', { escala: 0.55 }), k(1.95, 'antebrazo', { escala: 0.55 }), k(2.4, 'antebrazo', { escala: 1 }),
      k(0.22, 'mano', 'abierta'), k(2.2, 'mano', 'natural'),
      k(0, 'antebrazo2', { reposo: 0 }), k(0.6, 'antebrazo2', { reposo: 10 }), k(1.6, 'antebrazo2', { reposo: 6 }), k(2.4, 'antebrazo2', { reposo: 0 }),
      k(0, 'cabeza', { giro: 0 }), k(0.85, 'cabeza', { giro: 3 }), k(1.45, 'cabeza', { giro: -1 }), k(2.4, 'cabeza', { giro: 0 }),
      k(0, 'cabeza_y', { alto: 0 }), k(0.85, 'cabeza_y', { alto: 0.015 }), k(1.0, 'cabeza_y', { alto: 0 }), k(1.45, 'cabeza_y', { alto: 0.015 }), k(1.6, 'cabeza_y', { alto: 0 }),
    ],
  },
  {
    id: 'pulgar',
    nombre: 'Pulgar arriba',
    descripcion: 'Lleva la mano delante del pecho con el pulgar hacia arriba y sonríe.',
    lados: 'uno',
    duracion: 2.0,
    poses: [{ t: 0.1, pose: 'pulgar' }, { t: 1.7, pose: 'reposo' }],
    claves: [
      k(0, 'brazo', { reposo: 0 }), k(0.15, 'brazo', { reposo: 4 }), k(0.45, 'brazo', { dir: 78 }), k(1.5, 'brazo', { dir: 78 }), k(1.95, 'brazo', { reposo: 0 }),
      k(0, 'antebrazo', { reposo: 0 }), k(0.5, 'antebrazo', { dir: -160 }), k(0.6, 'antebrazo', { dir: -170 }), k(1.5, 'antebrazo', { dir: -170 }), k(2.0, 'antebrazo', { reposo: 0 }),
      k(0.35, 'mano', 'pulgar'), k(1.65, 'mano', 'natural'),
      k(0, 'cabeza', { giro: 0 }), k(0.5, 'cabeza', { giro: 4 }), k(1.5, 'cabeza', { giro: 4 }), k(2.0, 'cabeza', { giro: 0 }),
      k(0.3, 'boca', 'sonrisa'), k(0.3, 'cejas', 'neutral'),
    ],
  },
]

GESTOS.push(
  {
    id: 'cruzar_brazos',
    nombre: 'Brazos cruzados',
    descripcion: 'Se cruza de brazos: escéptico, firme o esperando.',
    lados: 'ninguno',
    duracion: 2.4,
    poses: [{ t: 0.1, pose: 'cruzado' }, { t: 2.3, pose: 'reposo' }],
    claves: [k(0, 'cabeza', { giro: 0 }), k(0.5, 'cabeza', { giro: -3 }), k(2.0, 'cabeza', { giro: -3 }), k(2.4, 'cabeza', { giro: 0 })],
  },
  {
    id: 'comenta_abajo',
    nombre: 'Señalar abajo (comenta)',
    descripcion: 'Señala hacia abajo con las dos manos, como invitando a comentar o a mirar la descripción.',
    lados: 'ninguno',
    duracion: 2.0,
    poses: [{ t: 0.1, pose: 'senalar_abajo' }, { t: 1.9, pose: 'reposo' }],
    claves: [k(0, 'mirada_y', 0), k(0.3, 'mirada_y', 0.5), k(1.6, 'mirada_y', 0.5), k(1.9, 'mirada_y', 0), k(0.2, 'boca', 'sonrisa'), k(1.9, 'boca', 'cerrada')],
  },
  {
    id: 'manos_juntas',
    nombre: 'Manos juntas',
    descripcion: 'Junta las manos delante del cuerpo: escucha, reflexiona o habla con calma.',
    lados: 'ninguno',
    duracion: 2.2,
    poses: [{ t: 0.1, pose: 'manos_juntas' }, { t: 2.1, pose: 'reposo' }],
    claves: [],
  },
)

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
  const placed = layout(character, { ...inst, x: 0, y: 0, scale: 1 }, poseAt(character, {}, 0), false)
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
  const raiz = character.parts.find((p) => !p.parent && Object.keys(p.variants).length > 1)
  if (raiz) return expandPoseGesture(gesto, lado, t0, velocidad, character, raiz.id)
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
  // El otro brazo nunca va clavado al primero: arranca un poco después
  const DESFASE = 0.08
  const push = (canal: string, t: number, valor: number | string, e?: Ease) =>
    out.push({
      canal,
      t: t0 + (t > 0 && /_(izq|der):/.test(canal) && canal.includes(`_${lado === 'der' ? 'izq' : 'der'}:`) && /brazo|mano/.test(canal) ? t + DESFASE : t) / speed,
      valor: typeof valor === 'number' ? String(Math.round(valor * 100) / 100) : valor,
      transicion: e ?? (typeof valor === 'string' ? 'salto' : 'suave'),
    })
  const dirOf = (d: number, s: Lado) => (s === 'der' ? d : 180 - d)

  const ultimo = new Map<string, number>()
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
        // La mano cuelga del antebrazo y encogería con él: se compensa para que no cambie de tamaño
        const mano = `mano_${s}`
        if (!isArm && has(mano)) push(`part:${mano}:scale`, g.t, Math.round((1 / Math.max(0.2, v.escala)) * 1000) / 1000, g.e)
        continue
      }
      let rot: number
      if ('dir' in v) {
        const target = dirOf(v.dir, s)
        rot = isArm ? norm(target - angles[id]) : norm(target - angles[id] - armRotAt(s, g.t))
        const prev = ultimo.get(id)
        if (prev !== undefined) {
          while (rot - prev > 180) rot -= 360
          while (rot - prev < -180) rot += 360
        }
      } else if ('reposo' in v) {
        rot = v.reposo * mirror(s)
      } else continue
      ultimo.set(id, rot)
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
    } else if ((g.c === 'mano' || g.c === 'mano2') && typeof v === 'string') {
      const id = `mano_${sideOf(g.c)}`
      const part = character.parts.find((p) => p.id === id)
      if (part?.variants[v]) push(`part:${id}:v`, g.t, v)
    } else if ((g.c === 'boca' || g.c === 'cejas') && typeof v === 'string') {
      push(g.c === 'boca' ? 'face:mouth' : 'face:brows', g.t, v)
    }
  }
  // Un dibujo de mano se mantiene hacia atrás hasta el inicio de la pista: la mano empieza el gesto
  // con su dibujo natural y solo cambia en su clave.
  for (const canal of new Set(out.filter((c) => c.canal.endsWith(':v')).map((c) => c.canal))) {
    const first = Math.min(...out.filter((c) => c.canal === canal).map((c) => c.t))
    const part = character.parts.find((p) => p.id === canal.split(':')[1])
    if (part && first > t0 + 1e-3) out.push({ canal, t: t0, valor: part.defaultVariant, transicion: 'salto' })
  }
  return { claves: out, canales: [...new Set(out.map((c) => c.canal))], fin: t0 + gesto.duracion / speed }
}

// ---------- Personajes por poses ----------

/** Canales de cabeza y cara que se aplican tal cual a un personaje por poses. */
const CARA = new Set(['cabeza', 'cabeza_y', 'mirada', 'mirada_y', 'boca', 'cejas'])

function expandPoseGesture(gesto: Gesto, lado: Lado, t0: number, velocidad: number, character: Character, raiz: string) {
  const speed = velocidad > 0 ? velocidad : 1
  const root = character.parts.find((p) => p.id === raiz)!
  const head = character.parts.find((p) => p.id === 'cabeza')
  const out: ClaveSalida[] = []
  for (const p of gesto.poses ?? []) {
    const pose = lado === 'izq' && p.izq ? p.izq : p.pose
    if (!root.variants[pose]) continue
    out.push({ canal: `part:${raiz}:v`, t: t0 + p.t / speed, valor: pose, transicion: 'salto' })
  }
  // Movimientos de cabeza en píxeles de la cabeza (los gestos los dan en fracciones del brazo)
  const unidad = head ? head.anchor.y * 0.6 : 240
  const mirror = lado === 'der' ? 1 : -1
  for (const g of gesto.claves) {
    if (!CARA.has(g.c)) continue
    const v = g.v
    const t = t0 + g.t / speed
    if (g.c === 'cabeza' && typeof v === 'object' && 'giro' in v) out.push({ canal: 'part:cabeza:rot', t, valor: String(v.giro * mirror), transicion: g.e ?? 'suave' })
    else if (g.c === 'cabeza_y' && typeof v === 'object' && 'alto' in v) out.push({ canal: 'part:cabeza:y', t, valor: String(Math.round(v.alto * unidad)), transicion: g.e ?? 'suave' })
    else if (g.c === 'mirada' && typeof v === 'object' && 'mirada' in v) out.push({ canal: 'face:gazeX', t, valor: String(v.mirada * mirror), transicion: g.e ?? 'suave' })
    else if (g.c === 'mirada_y' && typeof v === 'number') out.push({ canal: 'face:gazeY', t, valor: String(v), transicion: g.e ?? 'suave' })
    else if ((g.c === 'boca' || g.c === 'cejas') && typeof v === 'string') out.push({ canal: g.c === 'boca' ? 'face:mouth' : 'face:brows', t, valor: v, transicion: 'salto' })
  }
  return { claves: out, canales: [...new Set(out.map((c) => c.canal))], fin: t0 + gesto.duracion / speed }
}
