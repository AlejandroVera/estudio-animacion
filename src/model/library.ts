// Biblioteca de personajes disponibles en el estudio.

import { chicoRosaCharacter } from './characters/chicoRosa'
import { sampleCharacter } from './sample'
import type { Character, Project } from './types'

export interface LibraryEntry {
  id: string
  name: string
  make: () => Character
  /** Colocación por defecto en un vídeo vertical 1080×1920. */
  place: { x: number; y: number; scale: number }
  background: string
}

export const LIBRARY: LibraryEntry[] = [
  { id: 'chico-rosa', name: 'Chico rosa', make: chicoRosaCharacter, place: { x: 540, y: 1230, scale: 0.6 }, background: '#CE544E' },
  { id: 'pepe', name: 'Pepe (dibujo simple)', make: sampleCharacter, place: { x: 540, y: 1250, scale: 1.6 }, background: '#F4EFE6' },
]

/** Personajes que se han sustituido por una versión nueva: id antiguo -> id nuevo. */
const REPLACED: Record<string, string> = { rosa: 'chico-rosa' }

/**
 * Pone al día un proyecto guardado: los personajes de la biblioteca se vuelven a construir
 * con su versión actual (un proyecto guardado lleva dentro una copia del personaje) y los
 * personajes sustituidos se cambian por su versión nueva, conservando la animación.
 */
export function refreshCharacters(p: Project): Project {
  const characters = { ...p.characters }
  const instances = p.instances.map((inst) => {
    const newId = REPLACED[inst.characterId]
    const entry = LIBRARY.find((e) => e.id === (newId ?? inst.characterId))
    if (!entry) return inst
    characters[entry.id] = entry.make()
    return newId ? { ...inst, characterId: entry.id, ...entry.place } : inst
  })
  for (const old of Object.keys(REPLACED)) {
    if (!instances.some((i) => i.characterId === old)) delete characters[old]
  }
  const replacedBg = p.instances.some((i) => REPLACED[i.characterId])
  const bg = replacedBg ? LIBRARY.find((e) => e.id === instances[0].characterId)?.background ?? p.background : p.background
  return { ...p, background: bg, characters, instances }
}
