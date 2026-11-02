// Biblioteca de personajes disponibles en el estudio.

import { chicoRosaCharacter } from './characters/chicoRosa'
import { sampleCharacter } from './sample'
import type { Character } from './types'

export interface LibraryEntry {
  id: string
  name: string
  make: () => Character
  /** Colocación por defecto en un vídeo vertical 1080×1920. */
  place: { x: number; y: number; scale: number }
  background: string
}

export const LIBRARY: LibraryEntry[] = [
  { id: 'chico-rosa', name: 'Chico rosa', make: chicoRosaCharacter, place: { x: 540, y: 1100, scale: 0.78 }, background: '#CE544E' },
  { id: 'pepe', name: 'Pepe (dibujo simple)', make: sampleCharacter, place: { x: 540, y: 1250, scale: 1.6 }, background: '#F4EFE6' },
]
