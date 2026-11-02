// Chico rosa: ilustración de Alejandro redibujada en pose animable (en «A») con Magnific
// y despiezada con herramientas/despiece_chico_rosa.py. Cuerpo = PNG por pieza; la cara
// se redibuja en SVG para animar ojos, párpados, cejas y boca.
// Coordenadas = píxeles de la ilustración (1696×2528).

import { buildParts, type PartDef } from '../build'
import type { Character } from '../types'
import manifest from './chicoRosa.manifest.json'

const INK = '#1C181A'
const SKIN = '#E988A2'
const WHITE = '#EDE0CB'
const MOUTH = '#4E1F2A'
const TONGUE = '#D86A82'
const S = (w = 6) => `stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`
const line = (d: string, w = 6) => `<path d="${d}" fill="none" ${S(w)}/>`

const EYES = [
  { cx: 750, cy: 380, px: 756, py: 380 },
  { cx: 948, cy: 377, px: 955, py: 376 },
]

// Hombros, codos, caderas y rodillas se doblan con la deformación automática (autoSkin en build.ts).
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
  mano_izq: { name: 'Mano izq.', parent: 'antebrazo_izq', z: 31 },
  mano_der: { name: 'Mano der.', parent: 'antebrazo_der', z: 31 },
}

// Bocas dibujadas a la escala de la boca original (centro 853,509).
const MOUTHS: Record<string, string> = {
  cerrada: line('M786 509 Q817 501 837 505 Q853 509 868 504 Q896 501 921 508', 6.5) + line('M818 526 Q855 538 892 526', 5),
  sonrisa: line('M791 499 Q853 540 915 498', 6.5) + line('M826 535 Q855 546 885 533', 5),
  abierta: `<ellipse cx="853" cy="512" rx="29" ry="20" fill="${MOUTH}" ${S(6.5)}/><ellipse cx="853" cy="522" rx="16" ry="7" fill="${TONGUE}"/>`,
  O: `<ellipse cx="853" cy="513" rx="14" ry="17" fill="${MOUTH}" ${S(6.5)}/>`,
  E: `<path d="M810 504 Q853 496 896 504 Q889 530 853 531 Q817 530 810 504 Z" fill="${MOUTH}" ${S(6.5)}/><path d="M820 505 L886 505 L882 513 L824 513 Z" fill="#F3EDE4"/>`,
  MBP: line('M810 510 Q853 514 896 510', 8) + line('M823 526 Q856 535 890 526', 5),
  triste: line('M802 522 Q853 500 904 522', 6.5),
  grito: `<ellipse cx="853" cy="523" rx="36" ry="35" fill="${MOUTH}" ${S(6.5)}/><ellipse cx="853" cy="543" rx="20" ry="9" fill="${TONGUE}"/>`,
}

export function chicoRosaCharacter(): Character {
  const pieces = manifest.pieces as Record<string, { box: number[]; pivot: number[]; variants?: string[] }>
  const body: PartDef[] = Object.entries(BODY).map(([id, b]) => {
    const p = pieces[id]
    // Las manos tienen varios dibujos (natural, abierta, palma_arriba, puno...), uno por archivo.
    const variants = p.variants
      ? Object.fromEntries(p.variants.map((v) => [v, `/personajes/chico-rosa/${id}__${v}.png`]))
      : { normal: `/personajes/chico-rosa/${id}.png` }
    return {
      id,
      ...b,
      box: { x: p.box[0], y: p.box[1], w: p.box[2], h: p.box[3] },
      pivot: { x: p.pivot[0], y: p.pivot[1] },
      image: true,
      variants,
    }
  })

  const face: PartDef[] = [
    {
      id: 'ojos', name: 'Ojos', parent: 'cabeza', z: 42,
      box: { x: 690, y: 340, w: 320, h: 100 }, pivot: { x: 849, y: 378 },
      variants: {
        normal:
          EYES.map((e) => `<circle cx="${e.cx}" cy="${e.cy}" r="26" fill="${WHITE}" ${S()}/>`).join('') +
          line('M736 421 Q758 424 776 412', 5.5) +
          line('M928 409 Q945 418 964 416', 5.5),
      },
    },
    ...EYES.map((e, i) => ({
      id: i === 0 ? 'pupila_izq' : 'pupila_der',
      name: i === 0 ? 'Pupila izq.' : 'Pupila der.',
      parent: 'ojos', z: 43, role: 'pupil' as const, gazeRange: { x: 10, y: 9 },
      box: { x: e.px - 12, y: e.py - 12, w: 24, h: 24 }, pivot: { x: e.px, y: e.py },
      variants: { normal: `<circle cx="${e.px}" cy="${e.py}" r="9" fill="${INK}"/>` },
    })),
    {
      id: 'parpados', name: 'Párpados', parent: 'ojos', z: 44, role: 'lids',
      box: { x: 712, y: 340, w: 276, h: 80 }, pivot: { x: 849, y: 378 },
      defaultVariant: 'abierto',
      variants: {
        abierto: '<g/>',
        medio: EYES.map((e) => `<path d="M${e.cx - 29} ${e.cy} A29 29 0 0 1 ${e.cx + 29} ${e.cy} Z" fill="${SKIN}" ${S()}/>`).join(''),
        cerrado: EYES.map(
          (e) => `<circle cx="${e.cx}" cy="${e.cy}" r="32" fill="${SKIN}"/>` + line(`M${e.cx - 24} ${e.cy + 1} Q${e.cx} ${e.cy + 15} ${e.cx + 24} ${e.cy + 1}`),
        ).join(''),
      },
    },
    {
      id: 'cejas', name: 'Cejas', parent: 'cabeza', z: 45, role: 'brows',
      box: { x: 705, y: 295, w: 285, h: 75 }, pivot: { x: 849, y: 335 },
      defaultVariant: 'neutral',
      variants: {
        neutral: line('M718 349 Q750 326 785 340', 7) + line('M924 337 Q950 322 975 339', 7),
        enfadado: line('M718 343 Q752 336 785 356', 7) + line('M924 354 Q950 333 977 335', 7),
        triste: line('M718 357 Q750 342 785 328', 7) + line('M924 326 Q950 340 977 347', 7),
        sorprendido: line('M718 335 Q750 306 785 326', 7) + line('M924 323 Q950 302 975 325', 7),
      },
    },
    {
      id: 'boca', name: 'Boca', parent: 'cabeza', z: 46, role: 'mouth',
      box: { x: 762, y: 468, w: 182, h: 110 }, pivot: { x: 853, y: 509 },
      defaultVariant: 'cerrada',
      variants: MOUTHS,
    },
  ]

  return {
    id: 'chico-rosa',
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
