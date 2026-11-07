// REPARTO: personajes secundarios que pueden salir en escena junto al protagonista (animados, con sus
// posturas y caminando), como en un capítulo de dibujos. Solo el protagonista tiene cabeza magenta: los
// demás son personas normales con el mismo trazo. El director los usa cuando la historia los nombra.

import { hermanaCharacter } from './characters/hermana'
import type { Character } from './types'

export interface Secundario {
  id: string
  /** Cómo lo nombra el guion (para el director) */
  quien: string
  make: () => Character
  /** Altura respecto al protagonista */
  altura: number
  /** Qué expresa cada postura (catálogo para el director) */
  posturas: Record<string, string>
}

export const REPARTO: Secundario[] = [
  {
    id: 'hermana',
    quien: 'su hermana (mandona y burlona, moño y sudadera mostaza)',
    make: hermanaCharacter,
    altura: 0.92,
    posturas: {
      reposo: 'de pie tranquila, mano en el bolsillo',
      habla: 'le habla o le explica algo, palma abierta',
      movil: 'mira el móvil y teclea (instalando algo, cotilleando)',
      foto: 'le hace una foto con el móvil (apunta hacia él)',
      quita: 'le quita algo de las manos, alarga el brazo hacia él',
      cruzado: 'brazos cruzados: mandona, poco impresionada, «así no»',
      risa: 'se ríe a carcajadas de él',
      senala: 'le señala dándole órdenes, «ponte ahí»',
      jarras: 'manos en la cintura, satisfecha con lo que ha hecho',
      ilusion: 'ilusionada, manos juntas bajo la barbilla',
    },
  },
]
