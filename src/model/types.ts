// Modelo de datos del estudio.
//
// Un personaje es una "marioneta" de piezas (imágenes) colgadas unas de otras.
// Cada pieza gira alrededor de su articulación (pivote). Las piezas de la cara
// (párpados, boca, cejas) cambian de dibujo según el canal de cara que las controla.

export type Vec = { x: number; y: number }

export interface Asset {
  id: string
  /** URL de la imagen (data URL de SVG o PNG). */
  src: string
  w: number
  h: number
}

/** Qué control de la cara mueve esta pieza. */
export type FaceRole = 'pupil' | 'lids' | 'mouth' | 'brows'

export interface Part {
  id: string
  name: string
  parent: string | null
  /** Dibujos posibles de la pieza: nombre de variante -> id de asset. */
  variants: Record<string, string>
  defaultVariant: string
  /** Posición de la articulación dentro de la imagen de la pieza (px). */
  anchor: Vec
  /** Posición de la articulación respecto a la articulación del padre (px, en reposo). */
  offset: Vec
  /** Orden de dibujo: mayor = más delante. */
  z: number
  role?: FaceRole
  /** Para pupilas: cuánto pueden desplazarse con la mirada (px). */
  gazeRange?: Vec
  /**
   * Deformación por malla junto a las articulaciones (en vez de girar como pieza rígida).
   * Distancias en px medidas a lo largo del eje de la pieza (de su articulación hacia su hija).
   *  - parent [desde, hasta]: antes de "desde" la pieza sigue al padre, después de "hasta" a sí
   *    misma; en medio mezcla. Hace que hombros, caderas o codos se doblen suavemente.
   *  - child: igual respecto a la articulación de una pieza hija (medido desde esa articulación).
   */
  skin?: { parent?: [number, number]; child?: { id: string; range: [number, number] } }
}

export interface Character {
  id: string
  name: string
  parts: Part[]
  assets: Record<string, Asset>
  /** Expresiones predefinidas: valores de los canales de cara. */
  expressions: Record<string, { brows: string; mouth: string }>
}

export type Ease = 'suave' | 'lineal' | 'salto'

export interface Keyframe {
  t: number
  v: number | string
  ease: Ease
}

/**
 * Canales animables:
 *  - `part:<id>:rot` | `:x` | `:y` | `:scale`
 *  - `face:gazeX` | `face:gazeY` (−1..1) | `face:blink` (0..1) | `face:mouth` | `face:brows`
 */
export type Tracks = Record<string, Keyframe[]>

export interface CharacterInstance {
  characterId: string
  /** Posición en el escenario de la articulación raíz. */
  x: number
  y: number
  scale: number
  tracks: Tracks
}

export interface Project {
  version: 1
  name: string
  width: number
  height: number
  fps: number
  duration: number
  background: string
  characters: Record<string, Character>
  instances: CharacterInstance[]
}

/** Valores ya calculados de todos los canales en un instante. */
export interface Pose {
  parts: Record<string, { rot: number; x: number; y: number; scale: number }>
  gazeX: number
  gazeY: number
  blink: number
  mouth: string
  brows: string
}
