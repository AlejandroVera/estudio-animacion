// Gestos a medida: cuando el guion pide un gesto que no está en el repertorio (cocinar, mirar el
// móvil, tirarse del pelo…), se dibuja con IA a partir de la imagen base del personaje (/api/postura),
// se le quita el fondo blanco, se alinea con las demás posturas por la cabeza y se guarda en el
// navegador (IndexedDB). El proyecto guarda la lista en `posturasExtra` y la postura se añade al cuerpo.

import { ensureMedia, mediaUrl, saveImage } from '../audio/storage'
import type { Character, Project } from '../model/types'
import { activeCharacter, useStore } from '../store'

const cargar = async (src: string) => createImageBitmap(await (await fetch(src)).blob())

/** Caja de la cabeza (píxeles del color de la cabeza en la parte de arriba). */
function cajaCabeza(d: ImageData, color: [number, number, number]) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1
  const lim = Math.floor(d.height * 0.4)
  for (let y = 0; y < lim; y++)
    for (let x = 0; x < d.width; x++) {
      const i = (y * d.width + x) * 4
      if (d.data[i + 3] < 128) continue
      if (Math.abs(d.data[i] - color[0]) + Math.abs(d.data[i + 1] - color[1]) + Math.abs(d.data[i + 2] - color[2]) < 90) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  return x1 < 0 ? null : { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0 }
}

/** Quita el fondo blanco unido a los bordes (los blancos de dentro, como ojos o zapatillas, se quedan). */
function quitarFondo(d: ImageData) {
  const { width: W, height: H, data } = d
  const visto = new Uint8Array(W * H)
  const pila: number[] = []
  const blanco = (p: number) => data[p * 4] > 225 && data[p * 4 + 1] > 225 && data[p * 4 + 2] > 225
  for (let x = 0; x < W; x++) pila.push(x, (H - 1) * W + x)
  for (let y = 0; y < H; y++) pila.push(y * W, y * W + W - 1)
  while (pila.length) {
    const p = pila.pop()!
    if (visto[p] || !blanco(p)) continue
    visto[p] = 1
    data[p * 4 + 3] = 0
    const x = p % W
    if (x > 0) pila.push(p - 1)
    if (x < W - 1) pila.push(p + 1)
    if (p >= W) pila.push(p - W)
    if (p < W * (H - 1)) pila.push(p + W)
  }
}

/** Dibuja un gesto nuevo y lo guarda; devuelve el id de la imagen. */
export async function dibujarPostura(ch: Character, descripcion: string): Promise<string> {
  const ex = ch.expresivo
  const raiz = ch.parts.find((p) => !p.parent)
  if (!ex?.base || !ex.original || !ex.lienzo || !raiz) throw new Error('Este personaje no admite gestos a medida.')
  const res = await fetch('/api/postura', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ descripcion, base: location.origin + ex.base }),
  })
  const d = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(d.error ?? `Error ${res.status}`)
  const [OW, OH] = ex.original
  const [lx, ly, lw, lh] = ex.lienzo
  // A tamaño del dibujo original, sin fondo y recortado al lienzo común
  const c = new OffscreenCanvas(OW, OH)
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(await cargar(d.url), 0, 0, OW, OH)
  const full = g.getImageData(0, 0, OW, OH)
  quitarFondo(full)
  g.putImageData(full, 0, 0)
  const recorte = new OffscreenCanvas(lw, lh)
  const gr = recorte.getContext('2d', { willReadFrequently: true })!
  gr.drawImage(c, lx, ly, lw, lh, 0, 0, lw, lh)
  // Alineado por la cabeza con la postura de reposo (por si la IA lo ha movido un poco)
  const ref = await cargar(ch.assets[raiz.variants[raiz.defaultVariant]].src)
  const cr = new OffscreenCanvas(lw, lh)
  const gref = cr.getContext('2d', { willReadFrequently: true })!
  gref.drawImage(ref, 0, 0, lw, lh)
  const dref = gref.getImageData(0, 0, lw, lh)
  const cab = cajaCabeza(dref, colorCabeza(dref))
  const nueva = gr.getImageData(0, 0, lw, lh)
  const cab2 = cab && cajaCabeza(nueva, colorCabeza(dref))
  const out = new OffscreenCanvas(lw, lh)
  const go = out.getContext('2d')!
  if (cab && cab2) {
    const k = Math.abs(cab2.w / cab.w - 1) > 0.03 ? cab.w / cab2.w : 1
    go.translate(cab.cx, cab.cy)
    go.scale(k, k)
    go.translate(-cab2.cx, -cab2.cy)
  }
  go.drawImage(recorte, 0, 0)
  const blob = await out.convertToBlob({ type: 'image/png' })
  const id = `postura-${Date.now()}-${Math.round(Math.random() * 1e6)}`
  await saveImage(id, blob)
  return id
}

/** Color de la cabeza: el del centro de la parte de arriba del dibujo de reposo. */
function colorCabeza(d: ImageData): [number, number, number] {
  for (let y = 0; y < d.height * 0.3; y++) {
    const i = (y * d.width + Math.floor(d.width / 2)) * 4
    if (d.data[i + 3] > 200 && d.data[i] + d.data[i + 1] + d.data[i + 2] > 150) {
      const j = ((y + 60) * d.width + Math.floor(d.width / 2)) * 4
      return [d.data[j], d.data[j + 1], d.data[j + 2]]
    }
  }
  return [220, 60, 200]
}

/** Añade al cuerpo del personaje las posturas a medida del proyecto (si sus imágenes ya están cargadas). */
export function conExtras(p: Project): Project {
  const extras = p.posturasExtra ?? []
  if (!extras.length) return p
  const ch = activeCharacter(p)
  const raiz = ch.parts.find((x) => !x.parent)
  if (!raiz || !ch.expresivo) return p
  const base = ch.assets[raiz.variants[raiz.defaultVariant]]
  const assets = { ...ch.assets }
  const variants = { ...raiz.variants }
  let cambio = false
  for (const e of extras) {
    const url = mediaUrl(e.imageId)
    if (!url || variants[e.nombre]) continue
    const aid = `extra-${e.nombre}`
    assets[aid] = { id: aid, src: url, w: base.w, h: base.h }
    variants[e.nombre] = aid
    cambio = true
  }
  if (!cambio) return p
  const parts = ch.parts.map((x) => (x === raiz ? { ...x, variants } : x))
  return { ...p, characters: { ...p.characters, [ch.id]: { ...ch, assets, parts } } }
}

/** Carga las imágenes de las posturas a medida y las pone en el personaje (sin paso de deshacer). */
export async function cargarExtras() {
  const p = useStore.getState().project
  if (!p.posturasExtra?.length) return
  await ensureMedia(p.posturasExtra.map((e) => e.imageId))
  useStore.setState((s) => ({ project: conExtras(s.project) }))
}
