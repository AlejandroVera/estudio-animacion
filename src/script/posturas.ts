// Gestos a medida: cuando el guion pide un gesto que no está en el repertorio (cocinar, mirar el
// móvil, tirarse del pelo…), se dibuja con IA a partir de la imagen base del personaje (/api/postura),
// se le quita el fondo blanco, se alinea con las demás posturas por la cabeza y se guarda en el
// navegador (IndexedDB). El proyecto guarda la lista en `posturasExtra` y la postura se añade al cuerpo.

import { ensureMedia, mediaUrl, replaceImage, saveImage } from '../audio/storage'
import type { Character, Project } from '../model/types'
import { activeCharacter, useStore } from '../store'

const cargar = async (src: string) => createImageBitmap(await (await fetch(src)).blob())

/** Quita el fondo blanco unido a los bordes (los blancos de dentro, como ojos o zapatillas, se quedan). */
export function quitarFondo(d: ImageData) {
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
  // Desplazamiento y tamaño que mejor encajan la cabeza (color de la cabeza) con la de la base.
  // Un punto p de la base corresponde en el dibujo nuevo a c + (p - c)·k + d (c = centro de la cabeza)
  const hx = ex.cabeza.x, hy = ex.cabeza.y
  const encaje = (dx: number, dy: number, k: number, paso: number) => {
    let ambos = 0, alguno = 0
    for (let y = y0; y < y1; y += paso)
      for (let x = x0; x < x1; x += paso) {
        const nx = Math.round(hx + (x - hx) * k + dx), ny = Math.round(hy + (y - hy) * k + dy)
        const a = ref.clases[y * W + x] === 1
        const b = nx >= 0 && ny >= 0 && nx < W && ny < H && cl[ny * W + nx] === 1
        if (a && b) ambos++
        if (a || b) alguno++
      }
    return ambos / (alguno || 1)
  }
  let mejor = { s: -1, dx: 0, dy: 0, k: 1 }
  for (const k of [0.88, 0.94, 1, 1.06, 1.12])
    for (let dy = -96; dy <= 96; dy += 8)
      for (let dx = -96; dx <= 96; dx += 8) {
        const sc = encaje(dx, dy, k, 8)
        if (sc > mejor.s) mejor = { s: sc, dx, dy, k }
      }
  for (const paso of [4, 2]) {
    const g0 = mejor
    for (const k of [g0.k - 0.03, g0.k - 0.015, g0.k, g0.k + 0.015, g0.k + 0.03])
      for (let dy = g0.dy - paso * 2; dy <= g0.dy + paso * 2; dy += paso / 2)
        for (let dx = g0.dx - paso * 2; dx <= g0.dx + paso * 2; dx += paso / 2) {
          const sc = encaje(dx, dy, k, paso)
          if (sc > mejor.s) mejor = { s: sc, dx, dy, k }
        }
  }
  // ¿Una mano tapa la cara? Una mano (o un objeto) es un trazo que ENTRA desde fuera de la cabeza:
  // sus líneas cruzan el contorno. Los ojos y la boca redibujados por la IA no tocan el contorno.
  // Se buscan los trazos oscuros unidos al contorno de la cabeza y se mira cuánto llegan a cada caja.
  const cx = hx + mejor.dx, cy = hy + mejor.dy
  const rr = r * mejor.k
  const unido = new Uint8Array(W * H)
  const pila: number[] = []
  for (let y = Math.max(0, Math.round(cy - 1.15 * rr)); y < Math.min(H, cy + 1.15 * rr); y++)
    for (let x = Math.max(0, Math.round(cx - 1.15 * rr)); x < Math.min(W, cx + 1.15 * rr); x++) {
      const d = Math.hypot(x - cx, y - cy)
      if (d > 0.98 * rr && d < 1.1 * rr && cl[y * W + x] === 2) pila.push(y * W + x)
    }
  while (pila.length) {
    const q = pila.pop()!
    if (unido[q]) continue
    unido[q] = 1
    const x = q % W, y = (q - x) / W
    if (Math.hypot(x - cx, y - cy) > 1.15 * rr) continue
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const n = ny * W + nx
        if (!unido[n] && cl[n] === 2) pila.push(n)
      }
  }
  const intrusion = (caja?: number[]) => {
    if (!caja) return 0
    const [bx, by, bw, bh] = caja.map(Math.round)
    let n = 0
    const k = mejor.k
    const X0 = Math.round(hx + (bx - hx) * k + mejor.dx), X1 = Math.round(hx + (bx + bw - hx) * k + mejor.dx)
    const Y0 = Math.round(hy + (by - hy) * k + mejor.dy), Y1 = Math.round(hy + (by + bh - hy) * k + mejor.dy)
    for (let y = Y0; y < Y1; y++)
      for (let x = X0; x < X1; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue
        if (unido[y * W + x] && Math.hypot(x - cx, y - cy) < 0.9 * rr) n++
      }
    return n
  }
  const ojos = intrusion(ex.cajas?.ojos), boca = intrusion(ex.cajas?.boca)
  // Píxeles de trazo de una mano dentro de la caja (una mano son miles; nada delante, casi 0)
  return { dx: mejor.dx, dy: mejor.dy, k: mejor.k, cx: hx, cy: hy, ojos, boca, sinOjos: ojos > 200, sinBoca: boca > 200 }
}

/** Mueve el dibujo para que la cabeza quede donde la de las demás posturas. */
async function alinear(img: CanvasImageSource, W: number, H: number, rev: { dx: number; dy: number; k: number; cx: number; cy: number }) {
  const out = new OffscreenCanvas(W, H)
  const g = out.getContext('2d')!
  // p = c + (q - c - d) / k
  g.translate(rev.cx, rev.cy)
  g.scale(1 / rev.k, 1 / rev.k)
  g.translate(-rev.cx - rev.dx, -rev.cy - rev.dy)
  g.drawImage(img, 0, 0, W, H)
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
  const blob = await alinear(recorte, lw, lh, rev)
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
        if (rev.dx || rev.dy || rev.k !== 1) await replaceImage(e.imageId, await alinear(img, lw, lh, rev))
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
