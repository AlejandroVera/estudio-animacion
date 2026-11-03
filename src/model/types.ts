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
   * Segundos de fundido al cambiar de dibujo (personajes por poses): el dibujo anterior se desvanece
   * encima del nuevo y el cuerpo hace un pequeño rebote.
   */
  fade?: number
  /**
   * Deformación por malla junto a las articulaciones (en vez de girar como pieza rígida).
   * Distancias en px medidas a lo largo del eje de la pieza (de su articulación hacia su hija).
   *  - parent [desde, hasta]: antes de "desde" la pieza sigue al padre, después de "hasta" a sí
   *    misma; en medio mezcla. Hace que hombros, caderas o codos se doblen suavemente.
   *  - child: igual respecto a la articulación de una pieza hija (medido desde esa articulación).
   */
  skin?: {
    parent?: [number, number]
    child?: { id: string; range: [number, number] }
    /** La zona alrededor de la articulación de una hija acompaña su desplazamiento (hombros que suben). */
    lift?: { id: string; r: [number, number] }[]
  }
}

export interface Character {
  id: string
  name: string
  /** Ilustración del personaje (ruta de esta web) usada como referencia de estilo al generar imágenes. */
  referencia?: string
  parts: Part[]
  assets: Record<string, Asset>
  /** Giro de reposo natural de cada pieza (grados); las pistas de giro se suman a él. */
  idle?: Record<string, number>
  /**
   * Personaje EXPRESIVO (estilo «Estoy Tiesa»): la pieza raíz tiene un dibujo completo por postura,
   * con la cara y la emoción incluidas, y cada uno su versión «<pose>~b» con la boca al revés
   * (abierta/cerrada) para hablar. `abiertas`: posturas cuyo dibujo ya tiene la boca abierta.
   * `cabeza`: centro de la cabeza en el dibujo (para los planos de cámara). `gestos`: postura para
   * cada gesto de la biblioteca. `emociones`: posturas que encajan con cada expresión de escena.
   */
  expresivo?: {
    abiertas: string[]
    cabeza: { x: number; y: number }
    gestos: Record<string, string>
    emociones: Record<string, string[]>
  }
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
 *  - `part:<id>:v` (dibujo de la pieza, p. ej. la postura de una mano)
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

/**
 * Capa de imagen. Se anima con los canales bg:<id>:x|y (px), :scale (1 = cubre el vídeo), :rot (°)
 * y :opacity (0..1). La cámara usa cam:x|y (px) y cam:zoom (1 = normal).
 */
export interface BgLayer {
  id: string
  name: string
  imageId: string
  w: number
  h: number
  /** true = se dibuja delante del personaje */
  delante?: boolean
}

export type Plano = 'general' | 'medio' | 'primer'

/** Escena del guion: una frase (o silencio) con su acción, plano y expresión. */
export interface Escena {
  id: string
  dialogo: string
  accion: string
  plano: Plano
  expresion: string
  /** Segundos que dura la escena (si está vacía, se calcula por el texto). */
  duracion: number
  gestos: { nombre: string; t: number; lado: 'der' | 'izq'; velocidad: number }[]
  /** Descripción del fondo deseado (para generarlo cuando haya IA de imágenes). */
  fondo: string
  /** Capa de fondo generada para esta escena (se ve mientras dura la escena). */
  capa?: string
}

export interface Project {
  version: 1
  name: string
  width: number
  height: number
  fps: number
  duration: number
  background: string
  /** Vida automática (respiración, balanceo, parpadeos). Si falta, está activada. */
  vida?: boolean
  /** Guion del vídeo dividido en escenas (se animan una detrás de otra). */
  guion?: { texto: string; escenas: Escena[]; voz?: { id: string; nombre: string } }
  /** Capas de imagen (fondos o elementos delante del personaje); sus imágenes se guardan aparte. */
  fondos?: BgLayer[]
  /** Audio (voz) del vídeo; el archivo se guarda aparte, en el navegador (IndexedDB). */
  audio?: { id: string; name: string; start: number; duration: number }
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
  /** Dibujo elegido para las piezas con varios (canal part:<id>:v). */
  variants: Record<string, string>
  /** Cambios de dibujo en curso (piezas con `fade`): dibujo anterior y avance 0..1 del fundido. */
  fades?: Record<string, { prev: string; u: number }>
}
