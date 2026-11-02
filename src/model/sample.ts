// Personaje de ejemplo dibujado en SVG, ya despiezado y con su rig.
// Se dibuja en un único sistema de coordenadas (el "lienzo" del personaje, ~400×760 px)
// y cada pieza recorta su caja. Así el formato es el mismo que tendrán los personajes
// que la herramienta genere con IA: una imagen por pieza + articulación + padre.

import { buildParts as build, type PartDef } from './build'
import { LIBRARY } from './library'
import type { Character, Project } from './types'

const INK = '#2B2B2B'
const SKIN = '#F2C9A0'
const SHIRT = '#E8A33D'
const PANTS = '#3D5A80'
const HAIR = '#4A3020'
const MOUTH = '#7A2430'
const TONGUE = '#E86A7A'
const BROW = '#3A2618'
const S = `stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`

const W = 400 // ancho del lienzo del personaje, para hacer el lado derecho en espejo

function mirror(def: PartDef, id: string, name: string, parent: string | null): PartDef {
  const variants: Record<string, string> = {}
  for (const [k, body] of Object.entries(def.variants)) {
    variants[k] = `<g transform="translate(${W},0) scale(-1,1)">${body}</g>`
  }
  return {
    ...def,
    id,
    name,
    parent,
    box: { ...def.box, x: W - (def.box.x + def.box.w) },
    pivot: { x: W - def.pivot.x, y: def.pivot.y },
    variants,
  }
}

function eyeHalf(cx: number) {
  return `<path d="M${cx - 22} 165 A22 26 0 0 1 ${cx + 22} 165 Z" fill="${SKIN}" ${S}/>`
}
function eyeClosed(cx: number) {
  return `<ellipse cx="${cx}" cy="165" rx="23" ry="27" fill="${SKIN}"/><path d="M${cx - 20} 166 Q${cx} 180 ${cx + 20} 166" fill="none" ${S}/>`
}

export function sampleCharacter(): Character {
  const upperArm: PartDef = {
    id: 'brazo_izq', name: 'Brazo izq.', parent: 'torso', z: 30,
    box: { x: 100, y: 267, w: 56, h: 126 }, pivot: { x: 128, y: 295 },
    variants: { normal: `<rect x="108" y="275" width="40" height="110" rx="20" fill="${SHIRT}" ${S}/>` },
  }
  const foreArm: PartDef = {
    id: 'antebrazo_izq', name: 'Antebrazo izq.', parent: 'brazo_izq', z: 29,
    box: { x: 103, y: 357, w: 50, h: 116 }, pivot: { x: 128, y: 380 },
    variants: { normal: `<rect x="111" y="365" width="34" height="100" rx="17" fill="${SKIN}" ${S}/>` },
  }
  const hand: PartDef = {
    id: 'mano_izq', name: 'Mano izq.', parent: 'antebrazo_izq', z: 31,
    box: { x: 100, y: 454, w: 62, h: 56 }, pivot: { x: 128, y: 462 },
    variants: {
      normal: `<ellipse cx="146" cy="476" rx="7" ry="10" fill="${SKIN}" ${S}/><circle cx="128" cy="482" r="20" fill="${SKIN}" ${S}/>`,
    },
  }
  const thigh: PartDef = {
    id: 'muslo_izq', name: 'Muslo izq.', parent: 'cadera', z: 12,
    box: { x: 142, y: 472, w: 60, h: 141 }, pivot: { x: 172, y: 495 },
    variants: { normal: `<rect x="150" y="480" width="44" height="125" rx="22" fill="${PANTS}" ${S}/>` },
  }
  const shin: PartDef = {
    id: 'pierna_izq', name: 'Pierna izq.', parent: 'muslo_izq', z: 11,
    box: { x: 145, y: 577, w: 54, h: 141 }, pivot: { x: 172, y: 595 },
    variants: { normal: `<rect x="153" y="585" width="38" height="125" rx="19" fill="${PANTS}" ${S}/>` },
  }
  const foot: PartDef = {
    id: 'pie_izq', name: 'Pie izq.', parent: 'pierna_izq', z: 13,
    box: { x: 120, y: 697, w: 80, h: 50 }, pivot: { x: 172, y: 705 },
    variants: { normal: `<ellipse cx="162" cy="722" rx="32" ry="17" fill="${INK}" ${S}/>` },
  }
  const pupil: PartDef = {
    id: 'pupila_izq', name: 'Pupila izq.', parent: 'ojos', z: 43,
    box: { x: 152, y: 155, w: 26, h: 26 }, pivot: { x: 165, y: 168 },
    role: 'pupil', gazeRange: { x: 9, y: 8 },
    variants: { normal: `<circle cx="165" cy="168" r="11" fill="#222"/><circle cx="169" cy="163" r="3.5" fill="#fff"/>` },
  }

  const defs: PartDef[] = [
    {
      id: 'cadera', name: 'Cadera', parent: null, z: 15,
      box: { x: 132, y: 437, w: 136, h: 86 }, pivot: { x: 200, y: 470 },
      variants: { normal: `<rect x="140" y="445" width="120" height="70" rx="22" fill="${PANTS}" ${S}/>` },
    },
    {
      id: 'torso', name: 'Torso', parent: 'cadera', z: 25,
      box: { x: 118, y: 232, w: 164, h: 256 }, pivot: { x: 200, y: 470 },
      variants: {
        normal:
          `<rect x="182" y="240" width="36" height="50" rx="10" fill="${SKIN}" ${S}/>` +
          `<path d="M128 282 Q200 262 272 282 L262 470 Q200 482 138 470 Z" fill="${SHIRT}" ${S}/>` +
          `<path d="M180 274 Q200 296 220 274" fill="none" ${S}/>`,
      },
    },
    {
      id: 'cabeza', name: 'Cabeza', parent: 'torso', z: 40,
      box: { x: 80, y: 62, w: 240, h: 214 }, pivot: { x: 200, y: 268 },
      variants: {
        normal:
          `<circle cx="108" cy="182" r="22" fill="${SKIN}" ${S}/><circle cx="292" cy="182" r="22" fill="${SKIN}" ${S}/>` +
          `<ellipse cx="200" cy="168" rx="92" ry="100" fill="${SKIN}" ${S}/>` +
          `<path d="M196 190 Q207 200 196 207" fill="none" ${S}/>` +
          `<ellipse cx="146" cy="207" rx="16" ry="9" fill="#E8838A" opacity=".35"/><ellipse cx="254" cy="207" rx="16" ry="9" fill="#E8838A" opacity=".35"/>`,
      },
    },
    {
      id: 'pelo', name: 'Pelo', parent: 'cabeza', z: 49,
      box: { x: 95, y: 45, w: 212, h: 120 }, pivot: { x: 200, y: 110 },
      variants: {
        normal: `<path d="M108 150 Q100 70 170 62 Q215 50 260 70 Q305 95 292 155 Q270 110 230 112 Q200 100 170 115 Q130 115 108 150 Z" fill="${HAIR}" ${S}/>`,
      },
    },
    {
      id: 'ojos', name: 'Ojos', parent: 'cabeza', z: 42,
      box: { x: 138, y: 134, w: 124, h: 62 }, pivot: { x: 200, y: 165 },
      variants: {
        normal: `<ellipse cx="165" cy="165" rx="22" ry="26" fill="#fff" ${S}/><ellipse cx="235" cy="165" rx="22" ry="26" fill="#fff" ${S}/>`,
      },
    },
    pupil,
    mirror(pupil, 'pupila_der', 'Pupila der.', 'ojos'),
    {
      id: 'parpados', name: 'Párpados', parent: 'ojos', z: 44, role: 'lids',
      box: { x: 136, y: 132, w: 128, h: 66 }, pivot: { x: 200, y: 165 },
      defaultVariant: 'abierto',
      variants: {
        abierto: '<g/>',
        medio: eyeHalf(165) + eyeHalf(235),
        cerrado: eyeClosed(165) + eyeClosed(235),
      },
    },
    {
      id: 'cejas', name: 'Cejas', parent: 'cabeza', z: 45, role: 'brows',
      box: { x: 135, y: 92, w: 130, h: 52 }, pivot: { x: 200, y: 125 },
      defaultVariant: 'neutral',
      variants: Object.fromEntries(
        Object.entries({
          neutral: ['M145 127 Q165 117 185 125', 'M215 125 Q235 117 255 127'],
          enfadado: ['M145 117 L185 132', 'M215 132 L255 117'],
          triste: ['M145 132 L185 118', 'M215 118 L255 132'],
          sorprendido: ['M145 115 Q165 100 185 113', 'M215 113 Q235 100 255 115'],
        }).map(([k, ds]) => [
          k,
          ds.map((d) => `<path d="${d}" fill="none" stroke="${BROW}" stroke-width="9" stroke-linecap="round"/>`).join(''),
        ]),
      ),
    },
    {
      id: 'boca', name: 'Boca', parent: 'cabeza', z: 46, role: 'mouth',
      box: { x: 160, y: 200, w: 80, h: 76 }, pivot: { x: 200, y: 230 },
      defaultVariant: 'cerrada',
      variants: {
        cerrada: `<path d="M178 228 Q200 240 222 228" fill="none" ${S}/>`,
        sonrisa: `<path d="M170 222 Q200 258 230 222 Q200 230 170 222 Z" fill="${MOUTH}" ${S}/>`,
        abierta: `<ellipse cx="200" cy="234" rx="20" ry="17" fill="${MOUTH}" ${S}/><ellipse cx="200" cy="243" rx="11" ry="5" fill="${TONGUE}"/>`,
        O: `<ellipse cx="200" cy="234" rx="11" ry="14" fill="${MOUTH}" ${S}/>`,
        E: `<path d="M174 224 Q200 220 226 224 Q222 246 200 246 Q178 246 174 224 Z" fill="${MOUTH}" ${S}/><path d="M180 226 L220 226 L218 232 L182 232 Z" fill="#fff"/>`,
        MBP: `<path d="M180 231 L220 231" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`,
        triste: `<path d="M178 238 Q200 222 222 238" fill="none" ${S}/>`,
        grito: `<ellipse cx="200" cy="240" rx="26" ry="28" fill="${MOUTH}" ${S}/><ellipse cx="200" cy="255" rx="15" ry="7" fill="${TONGUE}"/>`,
      },
    },
    upperArm,
    foreArm,
    hand,
    mirror(upperArm, 'brazo_der', 'Brazo der.', 'torso'),
    mirror(foreArm, 'antebrazo_der', 'Antebrazo der.', 'brazo_der'),
    mirror(hand, 'mano_der', 'Mano der.', 'antebrazo_der'),
    thigh,
    shin,
    foot,
    mirror(thigh, 'muslo_der', 'Muslo der.', 'cadera'),
    mirror(shin, 'pierna_der', 'Pierna der.', 'muslo_der'),
    mirror(foot, 'pie_der', 'Pie der.', 'pierna_der'),
  ]

  return {
    id: 'pepe',
    name: 'Pepe (ejemplo)',
    ...build(defs),
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

const k = (t: number, v: number | string, ease: 'suave' | 'lineal' | 'salto' = typeof v === 'string' ? 'salto' : 'suave') => ({ t, v, ease })

export function sampleProject(): Project {
  const entry = LIBRARY[0]
  const character = entry.make()
  return {
    version: 1,
    name: 'Proyecto de ejemplo',
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 6,
    background: entry.background,
    characters: { [character.id]: character },
    instances: [
      {
        characterId: character.id,
        ...entry.place,
        tracks: {
          'part:brazo_der:rot': [k(0, 0), k(0.6, -110), k(1.9, -110), k(2.5, 0)],
          'part:antebrazo_der:rot': [k(0.6, 0), k(0.9, -35), k(1.2, 15), k(1.5, -35), k(1.8, 0)],
          'part:cabeza:rot': [k(0, 0), k(1.2, 7), k(2.5, 0), k(4, -4), k(5, 0)],
          'part:torso:rot': [k(0, 0), k(1.2, -3), k(2.5, 0)],
          'face:mouth': [k(0, 'cerrada'), k(0.4, 'sonrisa'), k(4, 'O'), k(5, 'sonrisa')],
          'face:brows': [k(0, 'neutral'), k(4, 'sorprendido'), k(5, 'neutral')],
          'face:blink': [k(0.9, 0), k(1.0, 1), k(1.1, 0), k(3.4, 0), k(3.5, 1), k(3.6, 0)],
          'face:gazeX': [k(0, 0), k(2.8, 0), k(3.1, 0.9), k(4.4, 0.9), k(4.8, 0)],
        },
      },
    ],
  }
}
