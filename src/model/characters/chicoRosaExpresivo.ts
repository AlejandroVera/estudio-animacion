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
  t_tu: 'Señala a cámara («tú»)',
  t_yo: 'Manos al pecho («yo»)',
  t_abiertos: 'Brazos abiertos',
  t_dosmanos: 'Explica con las dos manos',
  t_juntas: 'Manos juntas',
  t_frente: 'Mano en la frente',
  t_rendido: 'Rendido / agotado',
  t_barriga: 'Mano en la barriga',
  t_pulgar: 'Pulgar arriba',
  t_jarras: 'En jarras',
  t_porfavor: 'Por favor',
  t_reloj: 'Señala el reloj',
  t_dinero: 'Dinero',
  t_cruzado: 'Brazos cruzados (tranquilo)',
  t_nolose: '«No sé»',
  t_masomenos: 'Más o menos',
  t_alla: 'Señala allá',
  t_espera: '«Espera»',
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

/** Qué expresa cada postura (para que la IA directora elija la que pide el texto). */
export const DESCRIPCIONES: Record<string, string> = {
  t_reposo: 'tranquilo, mano en el bolsillo, escuchando o frase neutra',
  t_explica: 'tranquilo explicando, mano abierta con la palma arriba',
  t_indice: 'índice arriba: SOLO para avisar «ojo» o dar UNA regla/dato clave; no abusar',
  t_presenta: 'tranquilo presentando algo a un lado: introducir un tema, una opción, «esto es…»',
  t_pecho: 'mano en el pecho: hablar de sí mismo, «yo», sinceridad, algo que le toca',
  t_encoge: 'medio encogido con la palma arriba: resignación, «qué le vamos a hacer», obviedad',
  t_cuenta: 'muestra tres dedos: SOLO al enumerar una lista de tres o más cosas, y poco rato',
  t_barbilla: 'mano en la barbilla: pensar, plantear una pregunta, duda',
  t_cadera: 'mano en la cadera: seguro de sí, chulería, conclusión firme',
  t_triste: 'apenado frotándose la nuca: tristeza suave, apuro, vergüenza',
  t_saluda: 'saluda con la mano: hola, adiós, presentarse',
  t_duda: 'se rasca la cabeza: confusión, «no lo entiendo», sorpresa leve',
  t_abajo: 'señala abajo: comentarios, suscríbete, enlace',
  t_tu: 'señala al espectador: «tú», «a ti te pasa», dirigirse a quien mira',
  t_yo: 'las dos manos al pecho: «yo», «a mí», confesar algo propio',
  t_abiertos: 'brazos abiertos con las palmas arriba: «todo esto», «imagínate», algo grande o absurdo',
  t_dosmanos: 'las dos manos delante con las palmas arriba: explicar con calma, razonar',
  t_juntas: 'manos juntas delante de la barriga: calma, escuchar, frase tranquila o seria',
  t_frente: 'mano en la frente: agobio, «qué desastre», cansancio, metedura de pata',
  t_rendido: 'brazos caídos y hombros hundidos: agotado, sin energía, derrota',
  t_barriga: 'mano en la barriga: comida, hambre, comer',
  t_pulgar: 'pulgar arriba: aprobar, «bien», recomendar',
  t_jarras: 'las dos manos en la cintura: decidido, mandón, «a ver», reto',
  t_porfavor: 'palmas juntas suplicando: «por favor», pedir, rogar',
  t_reloj: 'se toca la muñeca: tiempo, prisa, horarios, «no hay tiempo»',
  t_dinero: 'frota los dedos: dinero, precio, pagar, caro',
  t_cruzado: 'brazos cruzados tranquilo: esperar, «ya veremos», escepticismo suave',
  t_nolose: 'encogerse del todo con las dos palmas arriba: «no sé», «ni idea», incredulidad',
  t_masomenos: 'mano que oscila: «más o menos», «regular», matizar',
  t_alla: 'señala con el pulgar a un lado: «eso de ahí», mencionar algo o a otros',
  t_espera: 'las dos palmas delante: «espera», «un momento», frenar una idea',
  reposo: 'de frente neutro',
  mejillas: 'EXAGERADO susto con las manos en la cara: cifra escandalosa, «¿¡qué!?»',
  enfado: 'EXAGERADO enfado gritando con puños: indignación, injusticia',
  llorar: 'EXAGERADO llorando a chorros: drama cómico, desgracia',
  celebrar: 'EXAGERADO celebrando con los puños arriba: victoria, alegría grande',
  cruzado: 'EXAGERADO brazos cruzados mirando de reojo: escepticismo, «ya, claro»',
  stop: 'EXAGERADO palmas delante: «¡para!», «espera», negarse',
}

export interface ManifestExpresivo {
  lienzo: number[]
  pies: number[]
  cabeza: number[]
  poses: string[]
  bocas: string[]
  parpadeo?: string[]
  original?: number[]
  base?: string
  /** Capas de cara independientes (ojos y boca) para la familia tranquila t_*: caja y nombres. */
  capas?: Record<string, { caja: number[]; nombres: string[] }>
}

/** Qué expresa cada mirada (capa de ojos), para la IA directora. «propios» = los de la postura. */
export const MIRADAS: Record<string, string> = {
  propios: 'mirada normal al frente, a cámara (lo habitual: casi todo el rato)',
  esceptico: 'párpados a media asta, mirada de «ya, claro»: ironía, desconfianza, sarcasmo',
  recelo: 'un ojo entornado: sospecha, «a ver…»',
  arriba: 'mira hacia arriba: pensando, recordando, «a ver cómo lo digo»',
  platos: 'ojos como platos: sorpresa, cifra escandalosa, susto',
  felices: 'ojos cerrados sonriendo: alegría, ternura, algo bonito',
  triste: 'cejas tristes: pena, lástima',
  duda: 'una ceja levantada: duda, extrañeza',
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
  /** Mirada que lleva cada postura (si no está, «frente», a cámara). */
  ojosPorDefecto?: Record<string, string>
  /** Posturas con la mano delante de la cara: sin capas (su propia cara y su boca ~b). */
  sinCapas?: string[]
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
    // Capas de ojos y boca (solo se ven con la familia tranquila t_*, que comparte la misma cabeza)
    ...Object.entries(manifest.capas ?? {}).map(([tipo, c], i) => {
      const [x, y, w, h] = c.caja
      return {
        id: tipo,
        name: tipo === 'ojos' ? 'Ojos (capa)' : 'Boca (capa)',
        parent: 'cuerpo',
        z: 20 + i,
        box: { x, y, w, h },
        pivot: { x: x + w / 2, y: y + h / 2 },
        image: true,
        defaultVariant: 'nada',
        variants: { nada: `${ruta}/capas/vacio.webp`, ...Object.fromEntries(c.nombres.map((n) => [n, `${ruta}/capas/${tipo}_${n}.webp`])) },
      } as PartDef
    }),
  ]
  return {
    id: cfg.id,
    name: cfg.name,
    referencia: cfg.referencia,
    ...buildParts(defs),
    expresivo: {
      abiertas: cfg.abiertas,
      base: manifest.base ? `${ruta}/${manifest.base}` : undefined,
      original: manifest.original,
      lienzo: manifest.lienzo,
      ojosPorDefecto: cfg.ojosPorDefecto ?? {},
      sinCapas: cfg.sinCapas ?? [],
      cabeza: { x: manifest.cabeza[0] - lx, y: manifest.cabeza[1] - ly },
      radio: manifest.cabeza[2],
      cajas: Object.fromEntries(Object.entries(manifest.capas ?? {}).map(([t, c]) => [t, [c.caja[0] - lx, c.caja[1] - ly, c.caja[2], c.caja[3]]])),
      gestos: {
        saludar: 't_saluda', encogerse: 't_encoge', senalar: 't_presenta', pensar: 't_barbilla', jarras: 't_cadera',
        explicar: 't_explica', asentir: 't_pecho', negar: 'stop', celebrar: 'celebrar', sorpresa: 'mejillas',
        hablar: 't_explica', pulgar: 'guino', cruzar_brazos: 'cruzado', comenta_abajo: 't_abajo', manos_juntas: 't_pecho',
      },
      // Lo normal al hablar: la familia tranquila de tres cuartos (mismo cuerpo, solo cambia un brazo)
      calma: ['t_explica', 't_dosmanos', 't_reposo', 't_juntas', 't_presenta', 't_cadera', 't_pecho', 't_abiertos', 't_reposo'],
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
