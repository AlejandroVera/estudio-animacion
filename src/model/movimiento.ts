// Movimiento de las cosas que aparecen en la escena (como el coche que pasa por delante en Estoy Tiesa):
// cruza, entra desde un lado, cae con bote, tiembla. Devuelve el desplazamiento respecto a su sitio.

import type { Objeto } from './types'

const easeOut = (u: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, u)), 3)

/** Tamaño (lado mayor) según «tam», en píxeles del vídeo */
export function ladoObjeto(o: Objeto, W: number, H: number, base: number) {
  const m = Math.min(W, H)
  return o.tam === 'grande' ? m * 0.55 : o.tam === 'pequeno' ? m * 0.2 : o.mov && o.mov !== 'aparece' ? m * 0.34 : base
}

/** Posición en el instante t (x, y del centro) y escala extra, a partir de su sitio de reposo (x0, y0). */
export function posicionObjeto(o: Objeto, t: number, x0: number, y0: number, W: number, _H: number, lado: number) {
  const dt = t - o.t
  const dur = Math.max(0.6, o.fin - o.t)
  const sale = (o.hacia ?? 'der') === 'der' ? 1 : -1
  switch (o.mov) {
    case 'cruza': {
      // De un borde al otro, con un pequeño bote (como algo que pasa rodando o corriendo)
      const u = Math.min(1, dt / dur)
      const desde = sale > 0 ? -lado : W + lado
      const hasta = sale > 0 ? W + lado : -lado
      return { x: desde + (hasta - desde) * u, y: y0 + Math.sin(dt * 22) * lado * 0.015, k: 1 }
    }
    case 'entra': {
      const desde = sale > 0 ? -lado : W + lado
      return { x: desde + (x0 - desde) * easeOut(dt / 0.4), y: y0, k: 1 }
    }
    case 'cae': {
      // Cae en 0,35 s y rebota un poco
      if (dt < 0.35) {
        const u = dt / 0.35
        return { x: x0, y: -lado + (y0 + lado) * u * u, k: 1 }
      }
      const b = dt - 0.35
      return { x: x0, y: y0 - Math.abs(Math.sin(b * 12)) * lado * 0.12 * Math.exp(-b * 6), k: 1 + 0.08 * Math.exp(-b * 10) }
    }
    case 'tiembla': {
      const a = lado * 0.025 * (dt < 1 ? 1 : 0.35)
      return { x: x0 + Math.sin(dt * 70) * a, y: y0 + Math.cos(dt * 55) * a * 0.5, k: 1 }
    }
    default:
      return { x: x0, y: y0, k: 1 }
  }
}
