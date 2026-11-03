// Chico rosa EXPRESIVO (estilo «Estoy Tiesa»): cada postura es un dibujo completo con su cara y su
// emoción (susto, enfado, ojos de corazón, lágrimas…), todos hechos con IA editando el mismo dibujo
// base para que la cabeza y los pies queden en el mismo sitio. Cambia de postura de golpe en las
// palabras fuertes y entre medias solo se mueve la boca: cada postura tiene una versión «~b» con la
// boca al revés (abierta si está cerrada o cerrada si está abierta) hecha también con IA.
// Preparado con herramientas/preparar_expresivo.py.

import { buildParts, type PartDef } from '../build'
import type { Character } from '../types'
import manifest from './chicoRosaExpresivo.manifest.json'

const RUTA = '/personajes/chico-rosa/expresivo'

/** Nombre que se ve en la herramienta para cada postura. */
export const NOMBRES_EXPRESIVO: Record<string, string> = {
  reposo: 'Reposo',
  hablar: 'Hablar',
  indice: 'Índice arriba',
  presentar: 'Presentar',
  encogerse: 'Encogerse',
  pensar: 'Pensar',
  tres: 'Contar (tres)',
  stop: '¡Para!',
  cruzado: 'Brazos cruzados',
  mejillas: 'Susto (manos en la cara)',
  enfado: 'Enfado',
  llorar: 'Llorar',
  corazon: 'Enamorado',
  guino: 'Guiño',
  tapar: 'Taparse la boca',
  victoria: 'Victoria',
  celebrar: 'Celebrar',
  senalar: 'Señalar abajo',
  saludar: 'Saludar',
}

export function chicoRosaExpresivoCharacter(): Character {
  const [lx, ly, lw, lh] = manifest.lienzo
  const variants: Record<string, string> = {}
  for (const p of manifest.poses) variants[p] = `${RUTA}/${p}.webp`
  for (const p of manifest.bocas) variants[p + '~b'] = `${RUTA}/${p}~b.webp`
  const defs: PartDef[] = [
    {
      id: 'cuerpo',
      name: 'Cuerpo (postura)',
      parent: null,
      z: 10,
      box: { x: lx, y: ly, w: lw, h: lh },
      pivot: { x: manifest.pies[0], y: manifest.pies[1] },
      image: true,
      defaultVariant: 'reposo',
      variants,
    },
  ]
  return {
    id: 'chico-rosa',
    name: 'Chico rosa',
    referencia: '/personajes/chico-rosa/poses/referencia.jpg',
    ...buildParts(defs),
    expresivo: {
      abiertas: ['enfado', 'celebrar', 'senalar', 'tres'],
      cabeza: { x: manifest.cabeza[0] - lx, y: manifest.cabeza[1] - ly },
      gestos: {
        saludar: 'saludar', encogerse: 'encogerse', senalar: 'presentar', pensar: 'pensar', jarras: 'indice',
        explicar: 'presentar', asentir: 'hablar', negar: 'stop', celebrar: 'celebrar', sorpresa: 'mejillas',
        hablar: 'hablar', pulgar: 'guino', cruzar_brazos: 'cruzado', comenta_abajo: 'senalar', manos_juntas: 'hablar',
      },
      emociones: {
        Neutral: ['hablar', 'indice', 'presentar', 'encogerse', 'pensar', 'hablar', 'tres', 'reposo'],
        Contento: ['victoria', 'presentar', 'guino', 'corazon', 'celebrar', 'saludar'],
        Triste: ['llorar', 'pensar', 'tapar'],
        Enfadado: ['enfado', 'cruzado', 'stop'],
        Sorprendido: ['mejillas', 'encogerse', 'tapar'],
        Gritando: ['enfado', 'mejillas'],
      },
    },
    expressions: {
      Neutral: { brows: 'neutral', mouth: 'cerrada' },
      Contento: { brows: 'neutral', mouth: 'cerrada' },
      Triste: { brows: 'neutral', mouth: 'cerrada' },
      Enfadado: { brows: 'neutral', mouth: 'cerrada' },
      Sorprendido: { brows: 'neutral', mouth: 'cerrada' },
      Gritando: { brows: 'neutral', mouth: 'abierta' },
    },
  }
}
