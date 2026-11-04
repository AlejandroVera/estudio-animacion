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
  t_reposo: 'Tranquilo',
  t_explica: 'Explica (mano)',
  t_indice: 'Índice (tranquilo)',
  t_presenta: 'Presenta (tranquilo)',
  t_pecho: 'Mano en el pecho',
  t_encoge: 'Medio encogido',
  t_cuenta: 'Cuenta con los dedos',
  t_barbilla: 'Mano en la barbilla',
  t_cadera: 'Mano en la cadera',
  t_triste: 'Apenado',
  t_saluda: 'Saluda (tranquilo)',
  t_duda: 'Rascarse la cabeza',
  t_abajo: 'Señala abajo (tranquilo)',
  reposo: 'De frente',
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

export interface ManifestExpresivo {
  lienzo: number[]
  pies: number[]
  cabeza: number[]
  poses: string[]
  bocas: string[]
  parpadeo?: string[]
}

/**
 * Construye un personaje expresivo a partir de su carpeta de imágenes y su manifest
 * (lo que escribe herramientas/preparar_expresivo.py). Sirve para cualquier personaje.
 */
export function personajeExpresivo(cfg: {
  id: string
  name: string
  ruta: string
  manifest: ManifestExpresivo
  referencia?: string
  abiertas: string[]
}): Character {
  const { manifest, ruta } = cfg
  const [lx, ly, lw, lh] = manifest.lienzo
  const variants: Record<string, string> = {}
  for (const p of manifest.poses) variants[p] = `${ruta}/${p}.webp`
  for (const p of manifest.bocas) variants[p + '~b'] = `${ruta}/${p}~b.webp`
  for (const p of manifest.parpadeo ?? []) variants[p + '~c'] = `${ruta}/${p}~c.webp`
  const defs: PartDef[] = [
    {
      id: 'cuerpo',
      name: 'Cuerpo (postura)',
      parent: null,
      z: 10,
      box: { x: lx, y: ly, w: lw, h: lh },
      pivot: { x: manifest.pies[0], y: manifest.pies[1] },
      image: true,
      defaultVariant: variants.t_reposo ? 't_reposo' : 'reposo',
      variants,
    },
  ]
  return {
    id: cfg.id,
    name: cfg.name,
    referencia: cfg.referencia,
    ...buildParts(defs),
    expresivo: {
      abiertas: cfg.abiertas,
      cabeza: { x: manifest.cabeza[0] - lx, y: manifest.cabeza[1] - ly },
      gestos: {
        saludar: 't_saluda', encogerse: 't_encoge', senalar: 't_presenta', pensar: 't_barbilla', jarras: 't_cadera',
        explicar: 't_explica', asentir: 't_pecho', negar: 'stop', celebrar: 'celebrar', sorpresa: 'mejillas',
        hablar: 't_explica', pulgar: 'guino', cruzar_brazos: 'cruzado', comenta_abajo: 't_abajo', manos_juntas: 't_pecho',
      },
      // Lo normal al hablar: la familia tranquila de tres cuartos (mismo cuerpo, solo cambia un brazo)
      calma: ['t_explica', 't_reposo', 't_indice', 't_presenta', 't_cadera', 't_pecho', 't_explica', 't_reposo'],
      pregunta: ['t_encoge', 't_duda', 't_barbilla'],
      numero: ['t_cuenta', 't_indice'],
      comentario: 't_abajo',
      saludo: 't_saluda',
      // Gag: postura exagerada (de frente) solo al empezar una escena con esa emoción o en una exclamación
      gag: { Sorprendido: 'mejillas', Enfadado: 'enfado', Gritando: 'enfado' },
      // Postura tranquila que encaja con cada emoción, para el resto de la escena
      emociones: {
        Neutral: [],
        Contento: ['t_cadera', 't_presenta', 't_saluda'],
        Triste: ['t_triste', 't_pecho', 't_barbilla'],
        Enfadado: ['t_encoge', 't_cadera'],
        Sorprendido: ['t_duda', 't_encoge'],
        Gritando: ['t_encoge'],
      },
    },
    expressions: EXPRESIONES,
  }
}

const EXPRESIONES: Character['expressions'] = {
  Neutral: { brows: 'neutral', mouth: 'cerrada' },
  Contento: { brows: 'neutral', mouth: 'cerrada' },
  Triste: { brows: 'neutral', mouth: 'cerrada' },
  Enfadado: { brows: 'neutral', mouth: 'cerrada' },
  Sorprendido: { brows: 'neutral', mouth: 'cerrada' },
  Gritando: { brows: 'neutral', mouth: 'abierta' },
}

export function chicoRosaExpresivoCharacter(): Character {
  return personajeExpresivo({
    id: 'chico-rosa-detallado',
    name: 'Chico rosa (detallado)',
    ruta: RUTA,
    manifest,
    referencia: '/personajes/chico-rosa/poses/referencia.jpg',
    abiertas: ['enfado', 'celebrar', 'senalar', 'tres'],
  })
}
