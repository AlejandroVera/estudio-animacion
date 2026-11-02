// Personaje rosa: despiezado a partir de una ilustración (PNG por pieza) con la cara
// redibujada en SVG para poder animar ojos, párpados, cejas y boca.
// Coordenadas = píxeles de la ilustración original (1342×2000).

import { buildParts, type PartDef } from '../build'
import type { Character } from '../types'
import manifest from './rosa.manifest.json'

const INK = '#1C181A'
const SKIN = '#E4879F'
const WHITE = '#EFE2CC'
const MOUTH = '#4E1F2A'
const TONGUE = '#D86A82'
const S = (w = 5) => `stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`

const EYES = [
  { cx: 593, cy: 300, px: 597, py: 300 },
  { cx: 751, cy: 297, px: 755, py: 297 },
]

const BODY: Record<string, { name: string; parent: string | null; z: number }> = {
  cadera: { name: 'Cadera', parent: null, z: 15 },
  torso: { name: 'Torso', parent: 'cadera', z: 25 },
  cabeza: { name: 'Cabeza', parent: 'torso', z: 40 },
  brazo_izq: { name: 'Brazo izq.', parent: 'torso', z: 30 },
  antebrazo_izq: { name: 'Antebrazo izq.', parent: 'brazo_izq', z: 29 },
  brazo_der: { name: 'Brazo der.', parent: 'torso', z: 30 },
  antebrazo_der: { name: 'Antebrazo der.', parent: 'brazo_der', z: 29 },
  muslo_izq: { name: 'Muslo izq.', parent: 'cadera', z: 12 },
  pierna_izq: { name: 'Pierna izq.', parent: 'muslo_izq', z: 10 },
  muslo_der: { name: 'Muslo der.', parent: 'cadera', z: 12 },
  pierna_der: { name: 'Pierna der.', parent: 'muslo_der', z: 10 },
}

const line = (d: string, w = 5) => `<path d="${d}" fill="none" ${S(w)}/>`

export function rosaCharacter(): Character {
  const pieces = manifest.pieces as Record<string, { box: number[]; pivot: number[] }>
  const body: PartDef[] = Object.entries(BODY).map(([id, b]) => {
    const p = pieces[id]
    return {
      id,
      ...b,
      box: { x: p.box[0], y: p.box[1], w: p.box[2], h: p.box[3] },
      pivot: { x: p.pivot[0], y: p.pivot[1] },
      image: true,
      variants: { normal: `/personajes/rosa/${id}.png` },
    }
  })

  const face: PartDef[] = [
    {
      id: 'ojos', name: 'Ojos', parent: 'cabeza', z: 42,
      box: { x: 560, y: 265, w: 230, h: 82 }, pivot: { x: 672, y: 298 },
      variants: {
        normal:
          EYES.map((e) => `<circle cx="${e.cx}" cy="${e.cy}" r="20" fill="${WHITE}" ${S()}/>`).join('') +
          line('M582 334 Q598 331 613 325', 4) +
          line('M733 325 Q748 330 762 329', 4),
      },
    },
    ...EYES.map((e, i) => ({
      id: i === 0 ? 'pupila_izq' : 'pupila_der',
      name: i === 0 ? 'Pupila izq.' : 'Pupila der.',
      parent: 'ojos', z: 43, role: 'pupil' as const, gazeRange: { x: 8, y: 7 },
      box: { x: e.px - 10, y: e.py - 10, w: 20, h: 20 }, pivot: { x: e.px, y: e.py },
      variants: { normal: `<circle cx="${e.px}" cy="${e.py}" r="7.5" fill="${INK}"/>` },
    })),
    {
      id: 'parpados', name: 'Párpados', parent: 'ojos', z: 44, role: 'lids',
      box: { x: 562, y: 268, w: 222, h: 62 }, pivot: { x: 672, y: 298 },
      defaultVariant: 'abierto',
      variants: {
        abierto: '<g/>',
        medio: EYES.map((e) => `<path d="M${e.cx - 22} ${e.cy} A22 22 0 0 1 ${e.cx + 22} ${e.cy} Z" fill="${SKIN}" ${S()}/>`).join(''),
        cerrado: EYES.map(
          (e) => `<circle cx="${e.cx}" cy="${e.cy}" r="25" fill="${SKIN}"/>` + line(`M${e.cx - 19} ${e.cy + 1} Q${e.cx} ${e.cy + 12} ${e.cx + 19} ${e.cy + 1}`),
        ).join(''),
      },
    },
    {
      id: 'cejas', name: 'Cejas', parent: 'cabeza', z: 45, role: 'brows',
      box: { x: 555, y: 238, w: 230, h: 56 }, pivot: { x: 672, y: 268 },
      defaultVariant: 'neutral',
      variants: {
        neutral: line('M570 276 Q592 262 620 270') + line('M730 265 Q752 259 770 268'),
        enfadado: line('M568 266 Q594 268 620 281') + line('M728 281 Q750 268 774 265'),
        triste: line('M568 280 Q592 272 618 259') + line('M730 259 Q752 272 774 280'),
        sorprendido: line('M570 264 Q592 248 620 257') + line('M730 254 Q752 247 770 256'),
      },
    },
    {
      id: 'boca', name: 'Boca', parent: 'cabeza', z: 46, role: 'mouth',
      box: { x: 605, y: 372, w: 140, h: 80 }, pivot: { x: 673, y: 402 },
      defaultVariant: 'cerrada',
      variants: {
        cerrada: line('M622 401 Q646 395 661 398 Q673 401 685 397 Q706 395 726 400') + line('M647 414 Q676 423 705 414', 4),
        sonrisa: line('M626 394 Q674 424 722 393') + line('M652 421 Q675 429 698 420', 4),
        abierta: `<ellipse cx="673" cy="404" rx="22" ry="15" fill="${MOUTH}" ${S()}/><ellipse cx="673" cy="412" rx="12" ry="5" fill="${TONGUE}"/>`,
        O: `<ellipse cx="673" cy="405" rx="11" ry="13" fill="${MOUTH}" ${S()}/>`,
        E: `<path d="M640 398 Q673 392 706 398 Q700 418 673 419 Q646 418 640 398 Z" fill="${MOUTH}" ${S()}/><path d="M648 399 L698 399 L695 405 L651 405 Z" fill="#F3EDE4"/>`,
        MBP: line('M640 402 Q673 405 706 402', 6) + line('M650 414 Q676 421 702 414', 4),
        triste: line('M634 410 Q673 393 712 410'),
        grito: `<ellipse cx="673" cy="412" rx="28" ry="27" fill="${MOUTH}" ${S()}/><ellipse cx="673" cy="428" rx="15" ry="7" fill="${TONGUE}"/>`,
      },
    },
  ]

  return {
    id: 'rosa',
    name: 'Chico rosa',
    ...buildParts([...body, ...face]),
    expressions: {
      Neutral: { brows: 'neutral', mouth: 'cerrada' },
      Contento: { brows: 'neutral', mouth: 'sonrisa' },
      Triste: { brows: 'triste', mouth: 'triste' },
      Enfadado: { brows: 'enfadado', mouth: 'MBP' },
      Sorprendido: { brows: 'sorprendido', mouth: 'O' },
      Gritando: { brows: 'enfadado', mouth: 'grito' },
    },
  }
}
