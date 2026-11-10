// Definición de los personajes articulados (medidas en píxeles de su dibujo original).

import type { RigDef } from './rig'

const R = '/rig/'

export const CHICO: RigDef = {
  id: 'chico',
  k: 1,
  cabeza: { src: { reposo: R + 'chico_cabeza.png' }, w: 764, h: 747, cx: 382.6, cy: 365.9, r: 362 },
  // Cajas de las capas en la imagen de la cabeza (la cabeza se recortó desde x=301, y=0 del lienzo)
  ojos: {
    caja: [364 - 301, 166, 663, 309],
    src: Object.fromEntries(['frente', 'arriba', 'esceptico', 'triste', 'duda', 'recelo', 'platos', 'felices', 'cerrados'].map((n) => [n, `${R}chico_ojos_${n}.webp`])),
  },
  boca: { caja: [527 - 301, 461, 371, 187], src: { abierta: R + 'chico_boca_abierta.webp', o: R + 'chico_boca_o.webp', dientes: R + 'chico_boca_dientes.webp' } },
  cuello: { y: -590, ancho: 62, color: '#DC3CBE' },
  hombros: { y: -560, dx: 162 },
  cadera: { y: 0, dx: 95 },
  brazo: { l1: 300, l2: 300, ancho: 44, color: '#DC3CBE', manga: 0.42, colorManga: '#A8A8A8', anchoManga: 94 },
  pierna: { l1: 330, l2: 330, ancho: 78, color: '#5B7FA8', rodilla: '#DC3CBE' },
  mano: { r: 46, color: '#DC3CBE' },
  zapa: { src: R + 'chico_zapa_der.png', w: 280, h: 246, ax: 95, ay: 40 },
  tronco: 'camiseta',
  colorTronco: '#A8A8A8',
  trazo: 12,
}

// La hermana está dibujada a la mitad de tamaño: k = 1,83 la deja un poco más baja que él
export const HERMANA: RigDef = {
  id: 'hermana',
  k: 1.83,
  cabeza: {
    src: Object.fromEntries(['reposo', 'habla', 'risa', 'cruzado', 'senala', 'movil', 'jarras'].map((n) => [n, `${R}hermana_cabeza_${n}.png`])),
    w: 440, h: 350, cx: 238, cy: 190, r: 150,
  },
  cuello: { y: -372, ancho: 40, color: '#F2C79D' },
  hombros: { y: -355, dx: 92 },
  cadera: { y: 0, dx: 46 },
  brazo: { l1: 165, l2: 160, ancho: 56, color: '#E3A846', manga: 0, colorManga: '#E3A846', anchoManga: 56, puno: '#D0963A' },
  pierna: { l1: 170, l2: 165, ancho: 50, color: '#222222' },
  mano: { r: 27, color: '#F2C79D' },
  zapa: { src: R + 'hermana_zapa_der.png', w: 118, h: 72, ax: 32, ay: 14 },
  tronco: 'sudadera',
  colorTronco: '#E3A846',
  trazo: 7,
}
