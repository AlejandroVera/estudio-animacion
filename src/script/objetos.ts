// Objetos en escena (como en «Estoy Tiesa»): mientras el personaje habla aparecen de golpe dibujos
// sencillos de lo que cuenta (el táper, un bocadillo de pensamiento, un cartel con el precio…).
// El director (api/actuar) decide cuáles y en qué palabra; aquí se dibujan con IA (api/imagen, tipo
// «objeto», fondo blanco), se les quita el fondo, se recortan y se guardan en el navegador.

import { ensureMedia, saveImage } from '../audio/storage'
import type { Objeto, Project } from '../model/types'
import { activeCharacter, useStore } from '../store'
import { quitarFondo } from './posturas'

export type ObjetoPedido = Pick<Objeto, 't' | 'fin' | 'pos' | 'que' | 'dibujo' | 'flecha' | 'vin'>

async function dibujar(dibujo: string, project: Project) {
  const ch = activeCharacter(project)
  const res = await fetch('/api/imagen', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      descripcion: dibujo,
      tipo: 'objeto',
      formato: '1:1',
      referencia: ch.referencia ? location.origin + ch.referencia : undefined,
    }),
  })
  const d = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(d.error ?? `Error ${res.status}`)
  const bmp = await createImageBitmap(await (await fetch(d.url)).blob())
  const c = new OffscreenCanvas(bmp.width, bmp.height)
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(bmp, 0, 0)
  const px = g.getImageData(0, 0, c.width, c.height)
  quitarFondo(px)
  // Recorte a lo dibujado (con un margen)
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (px.data[(y * c.width + x) * 4 + 3] > 20) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  if (x1 < 0) throw new Error('El dibujo ha salido vacío.')
  const m = 8
  x0 = Math.max(0, x0 - m), y0 = Math.max(0, y0 - m), x1 = Math.min(c.width - 1, x1 + m), y1 = Math.min(c.height - 1, y1 + m)
  g.putImageData(px, 0, 0)
  const w = x1 - x0 + 1, h = y1 - y0 + 1
  const out = new OffscreenCanvas(w, h)
  out.getContext('2d')!.drawImage(c, x0, y0, w, h, 0, 0, w, h)
  const imageId = `objeto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  await saveImage(imageId, await out.convertToBlob({ type: 'image/png' }))
  return { imageId, w, h }
}

/**
 * Dibuja los objetos pedidos (los que ya existan con el mismo dibujo se reutilizan: no se paga dos
 * veces) y los pone en el proyecto, sustituyendo los anteriores. Devuelve cuántos no se pudieron hacer.
 */
export async function ponerObjetos(pedidos: ObjetoPedido[], onProgress: (m: string) => void): Promise<number> {
  const previos = new Map((useStore.getState().project.objetos ?? []).map((o) => [o.dibujo, o]))
  const hechos = new Map<string, { imageId: string; w: number; h: number }>()
  for (const [k, o] of previos) hechos.set(k, o)
  const faltan = [...new Set(pedidos.map((p) => p.dibujo))].filter((d) => !hechos.has(d))
  let fallos = 0
  let n = 0
  // De 3 en 3 a la vez
  for (let i = 0; i < faltan.length; i += 3) {
    await Promise.all(
      faltan.slice(i, i + 3).map(async (dib) => {
        try {
          hechos.set(dib, await dibujar(dib, useStore.getState().project))
        } catch {
          fallos++
        }
        onProgress(`Dibujando objetos de las escenas (${++n} de ${faltan.length})…`)
      }),
    )
  }
  const objetos: Objeto[] = pedidos
    .filter((p) => hechos.has(p.dibujo))
    .map((p, i) => ({ ...p, ...hechos.get(p.dibujo)!, id: `o${i}-${Math.round(p.t * 100)}` }))
  await ensureMedia(objetos.map((o) => o.imageId))
  const st = useStore.getState()
  st.commit({ ...st.project, objetos })
  return fallos
}
