// Gestos a medida: cuando el guion pide un gesto que no está en el repertorio (cocinar, mirar el
// móvil, tirarse del pelo…), se dibuja con IA a partir de la imagen base del personaje (/api/postura),
// se le quita el fondo blanco, se alinea con las demás posturas por la cabeza y se guarda en el
// navegador (IndexedDB). El proyecto guarda la lista en `posturasExtra` y la postura se añade al cuerpo.

import { ensureMedia, mediaUrl, replaceImage, saveImage } from '../audio/storage'
import type { Character, Project } from '../model/types'
import { activeCharacter, useStore } from '../store'

const cargar = async (src: string) => createImageBitmap(await (await fetch(src)).blob())

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

// --- Revisión de un gesto a medida frente a la imagen base (la que edita la IA) ---
// 0 fondo, 1 color de la cabeza, 2 trazo oscuro
type Ref = { clases: Uint8Array; W: number; H: number; color: [number, number, number] }
let refCache: { ch: string; ref: Promise<Ref> } | null = null

function clasificar(d: ImageData, color: [number, number, number]) {
  const out = new Uint8Array(d.width * d.height)
  for (let p = 0, i = 0; p < out.length; p++, i += 4) {
    if (d.data[i + 3] < 128) continue
    const r = d.data[i], g = d.data[i + 1], b = d.data[i + 2]
    if (Math.abs(r - color[0]) + Math.abs(g - color[1]) + Math.abs(b - color[2]) < 90) out[p] = 1
    else if (r + g + b < 200) out[p] = 2
  }
  return out
}

async function referencia(ch: Character): Promise<Ref> {
  if (refCache?.ch === ch.id) return refCache.ref
  const ref = (async () => {
    const ex = ch.expresivo!
    const [OW, OH] = ex.original!
    const [lx, ly, lw, lh] = ex.lienzo!
    const c = new OffscreenCanvas(lw, lh)
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.drawImage(await cargar(ex.base!), -lx, -ly, OW, OH)
    const d = g.getImageData(0, 0, lw, lh)
    // Color de la cabeza: el de la frente
    const fx = Math.round(ex.cabeza.x), fy = Math.round(ex.cabeza.y - (ex.radio ?? 300) * 0.55)
    const i = (fy * lw + fx) * 4
    const color: [number, number, number] = [d.data[i], d.data[i + 1], d.data[i + 2]]
    return { clases: clasificar(d, color), W: lw, H: lh, color }
  })()
  refCache = { ch: ch.id, ref }
  return ref
}

/**
 * Compara un gesto a medida (ya recortado al lienzo) con la base: dónde ha quedado la cabeza (la IA a
 * veces la mueve unos píxeles) y si una mano tapa los ojos o la boca (entonces esa capa no se pone,
 * porque quedaría pegada por delante de la mano).
 */
async function revisar(ch: Character, img: CanvasImageSource) {
  const ex = ch.expresivo!
  const ref = await referencia(ch)
  const { W, H } = ref
  const c = new OffscreenCanvas(W, H)
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(img, 0, 0, W, H)
  const cl = clasificar(g.getImageData(0, 0, W, H), ref.color)
  const r = ex.radio ?? 300
  const x0 = Math.max(70, Math.round(ex.cabeza.x - 1.1 * r)), x1 = Math.min(W - 70, Math.round(ex.cabeza.x + 1.1 * r))
  const y0 = Math.max(70, Math.round(ex.cabeza.y - 1.1 * r)), y1 = Math.min(H - 70, Math.round(ex.cabeza.y + 1.1 * r))
  // Desplazamiento que mejor encaja la cabeza (color de la cabeza) con la de la base
  const encaje = (dx: number, dy: number, paso: number) => {
    let ambos = 0, alguno = 0
    for (let y = y0; y < y1; y += paso)
      for (let x = x0; x < x1; x += paso) {
        const a = ref.clases[y * W + x] === 1, b = cl[(y + dy) * W + x + dx] === 1
        if (a && b) ambos++
        if (a || b) alguno++
      }
    return ambos / (alguno || 1)
  }
  let mejor = { s: -1, dx: 0, dy: 0 }
  for (let dy = -64; dy <= 64; dy += 4)
    for (let dx = -64; dx <= 64; dx += 4) {
      const s = encaje(dx, dy, 4)
      if (s > mejor.s) mejor = { s, dx, dy }
    }
  const grueso = mejor
  mejor = { s: -1, dx: 0, dy: 0 }
  for (let dy = grueso.dy - 3; dy <= grueso.dy + 3; dy++)
    for (let dx = grueso.dx - 3; dx <= grueso.dx + 3; dx++) {
      const s = encaje(dx, dy, 2)
      if (s > mejor.s) mejor = { s, dx, dy }
    }
  // Qué parte de cada caja de la cara ha cambiado (ya alineado)
  const cambio = (caja?: number[]) => {
    if (!caja) return 0
    const [bx, by, bw, bh] = caja.map(Math.round)
    let dist = 0, n = 0
    for (let y = by; y < by + bh; y += 2)
      for (let x = bx; x < bx + bw; x += 2) {
        const yy = y + mejor.dy, xx = x + mejor.dx
        if (yy < 0 || yy >= H || xx < 0 || xx >= W) continue
        n++
        if (ref.clases[y * W + x] !== cl[yy * W + xx]) dist++
      }
    return dist / (n || 1)
  }
  const ojos = cambio(ex.cajas?.ojos), boca = cambio(ex.cajas?.boca)
  // Medido con gestos reales: mano en la frente ≈ 0,26 en los ojos; sin nada delante, ≤ 0,09
  return { dx: mejor.dx, dy: mejor.dy, ojos, boca, sinOjos: ojos > 0.15, sinBoca: boca > 0.1 }
}

/** Mueve el dibujo para que la cabeza quede donde la de las demás posturas. */
async function alinear(img: CanvasImageSource, W: number, H: number, dx: number, dy: number) {
  const out = new OffscreenCanvas(W, H)
  out.getContext('2d')!.drawImage(img, -dx, -dy, W, H)
  return out.convertToBlob({ type: 'image/png' })
}

export type PosturaDibujada = { imageId: string; sinOjos: boolean; sinBoca: boolean }

/** Dibuja un gesto nuevo y lo guarda (alineado con las demás posturas por la cabeza). */
export async function dibujarPostura(ch: Character, descripcion: string): Promise<PosturaDibujada> {
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
  const recorte = await recortarDibujo(ch, d.url)
  const [, , lw, lh] = ex.lienzo
  const rev = await revisar(ch, recorte)
  const blob = await alinear(recorte, lw, lh, rev.dx, rev.dy)
  const imageId = `postura-${Date.now()}-${Math.round(Math.random() * 1e6)}`
  await saveImage(imageId, blob)
  return { imageId, sinOjos: rev.sinOjos, sinBoca: rev.sinBoca }
}

/** El dibujo de la IA a tamaño del original, sin fondo blanco y recortado al lienzo común. */
async function recortarDibujo(ch: Character, url: string) {
  const [OW, OH] = ch.expresivo!.original!
  const [lx, ly, lw, lh] = ch.expresivo!.lienzo!
  const c = new OffscreenCanvas(OW, OH)
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(await cargar(url), 0, 0, OW, OH)
  const full = g.getImageData(0, 0, OW, OH)
  quitarFondo(full)
  g.putImageData(full, 0, 0)
  const recorte = new OffscreenCanvas(lw, lh)
  recorte.getContext('2d')!.drawImage(c, lx, ly, lw, lh, 0, 0, lw, lh)
  return recorte
}

/** Para pruebas: revisa un dibujo ya hecho por la IA (URL) sin gastar. */
export async function revisarDibujo(ch: Character, url: string) {
  return revisar(ch, await recortarDibujo(ch, url))
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
  const sinOjos = new Set(ch.expresivo.sinOjos ?? [])
  const sinBoca = new Set(ch.expresivo.sinBoca ?? [])
  for (const e of extras) {
    if (e.sinOjos && !sinOjos.has(e.nombre)) (sinOjos.add(e.nombre), (cambio = true))
    if (e.sinBoca && !sinBoca.has(e.nombre)) (sinBoca.add(e.nombre), (cambio = true))
    const url = mediaUrl(e.imageId)
    const aid = `extra-${e.nombre}`
    if (!url || (variants[e.nombre] && assets[aid]?.src === url)) continue
    assets[aid] = { id: aid, src: url, w: base.w, h: base.h }
    variants[e.nombre] = aid
    cambio = true
  }
  if (!cambio) return p
  const parts = ch.parts.map((x) => (x === raiz ? { ...x, variants } : x))
  const expresivo = { ...ch.expresivo, sinOjos: [...sinOjos], sinBoca: [...sinBoca] }
  return { ...p, characters: { ...p.characters, [ch.id]: { ...ch, assets, parts, expresivo } } }
}

/** Carga las imágenes de las posturas a medida y las pone en el personaje (sin paso de deshacer). */
export async function cargarExtras() {
  const p = useStore.getState().project
  if (!p.posturasExtra?.length) return
  await ensureMedia(p.posturasExtra.map((e) => e.imageId))
  // Las hechas antes de la revisión (cabeza movida, mano delante de la cara): se arreglan una vez
  const ch = activeCharacter(p)
  const pendientes = p.posturasExtra.filter((e) => !e.revisada && mediaUrl(e.imageId))
  if (pendientes.length && ch.expresivo?.base && ch.expresivo.lienzo) {
    const [, , lw, lh] = ch.expresivo.lienzo
    const hechas: Record<string, { sinOjos: boolean; sinBoca: boolean }> = {}
    for (const e of pendientes) {
      try {
        const img = await cargar(mediaUrl(e.imageId)!)
        const rev = await revisar(ch, img)
        if (rev.dx || rev.dy) await replaceImage(e.imageId, await alinear(img, lw, lh, rev.dx, rev.dy))
        hechas[e.imageId] = { sinOjos: rev.sinOjos, sinBoca: rev.sinBoca }
      } catch {
        // si falla, se queda como estaba
      }
    }
    useStore.setState((s) => ({
      project: {
        ...s.project,
        posturasExtra: s.project.posturasExtra?.map((e) => (hechas[e.imageId] ? { ...e, ...hechas[e.imageId], revisada: 1 } : e)),
      },
    }))
  }
  useStore.setState((s) => ({ project: conExtras(s.project) }))
}
