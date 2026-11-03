// Postura de reposo natural: los personajes se despiezan en pose de montaje (brazos abiertos en
// «A»), pero en el vídeo deben estar relajados, con los brazos caídos junto al cuerpo. Se calcula
// sola a partir del esqueleto y todas las pistas de giro se miden desde ella.

import { layout } from './render'
import type { Character } from './types'

// Dirección en pantalla (0 derecha, 90 abajo) de brazo y antebrazo del lado derecho de la pantalla;
// el izquierdo es el espejo.
// Asimétrico a propósito: el brazo izquierdo de la pantalla cae algo más abierto y con el codo más
// doblado que el derecho. Una postura simétrica parece un maniquí.
const POSTURA = { der: { brazo: 84, antebrazo: 97 }, izq: { brazo: 88, antebrazo: 104 } }

export function withIdle(character: Character): Character {
  const sinIdle = { ...character, idle: {} }
  const inst = { characterId: character.id, x: 0, y: 0, scale: 1, tracks: {} }
  const placed = layout(sinIdle, inst, { parts: {}, gazeX: 0, gazeY: 0, blink: 0, mouth: '', brows: '', variants: {} }, true)
  const at = (id: string) => placed.find((p) => p.part.id === id)?.matrix
  const ang = (from: string, to: string) => {
    const a = at(from)
    const b = at(to)
    return a && b ? (Math.atan2(b.f - a.f, b.e - a.e) * 180) / Math.PI : null
  }
  const norm = (x: number) => ((((x + 180) % 360) + 360) % 360) - 180
  const idle: Record<string, number> = {}
  for (const lado of ['der', 'izq'] as const) {
    const b = ang(`brazo_${lado}`, `antebrazo_${lado}`)
    const mano = character.parts.find((p) => p.parent === `antebrazo_${lado}` && !p.role)
    const f = mano ? ang(`antebrazo_${lado}`, mano.id) : null
    if (b === null) continue
    const tb = lado === 'der' ? POSTURA.der.brazo : 180 - POSTURA.izq.brazo
    const rb = norm(tb - b)
    idle[`brazo_${lado}`] = rb
    if (f !== null) {
      const tf = lado === 'der' ? POSTURA.der.antebrazo : 180 - POSTURA.izq.antebrazo
      idle[`antebrazo_${lado}`] = norm(tf - f - rb)
    }
  }
  return { ...character, idle }
}
