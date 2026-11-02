import { poseAt } from './anim'
import type { Character, CharacterInstance, Part, Pose, Project, Vec } from './types'

// ---------- Imágenes ----------

const images = new Map<string, HTMLImageElement>()
const alphaData = new Map<string, ImageData>()

export function getImage(src: string): HTMLImageElement {
  let img = images.get(src)
  if (!img) {
    img = new Image()
    img.decoding = 'async'
    img.src = src
    images.set(src, img)
  }
  return img
}

export async function ensureImages(project: Project): Promise<void> {
  const all: Promise<void>[] = []
  for (const c of Object.values(project.characters)) {
    for (const a of Object.values(c.assets)) {
      const img = getImage(a.src)
      if (!img.complete) all.push(img.decode().catch(() => undefined))
    }
  }
  await Promise.all(all)
}

function alphaAt(src: string, w: number, h: number, x: number, y: number): number {
  let data = alphaData.get(src)
  if (!data) {
    const img = getImage(src)
    if (!img.complete || !img.naturalWidth) return 255 // aún no cargada: aceptamos el clic
    const c = document.createElement('canvas')
    c.width = Math.ceil(w)
    c.height = Math.ceil(h)
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.drawImage(img, 0, 0, w, h)
    data = g.getImageData(0, 0, c.width, c.height)
    alphaData.set(src, data)
  }
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  if (ix < 0 || iy < 0 || ix >= data.width || iy >= data.height) return 0
  return data.data[(iy * data.width + ix) * 4 + 3]
}

// ---------- Transformaciones ----------

export function lidsVariant(blink: number): string {
  if (blink < 0.3) return 'abierto'
  if (blink < 0.75) return 'medio'
  return 'cerrado'
}

export function variantFor(part: Part, pose: Pose): string {
  let v = part.defaultVariant
  if (part.role === 'lids') v = lidsVariant(pose.blink)
  else if (part.role === 'mouth') v = pose.mouth
  else if (part.role === 'brows') v = pose.brows
  return part.variants[v] ? v : part.defaultVariant
}

export interface Placed {
  part: Part
  matrix: DOMMatrix
  assetId: string
}

/** Calcula la matriz de cada pieza del personaje (ordenadas por profundidad). */
export function layout(character: Character, inst: CharacterInstance, pose: Pose, restPose = false): Placed[] {
  const byId = new Map(character.parts.map((p) => [p.id, p]))
  const mats = new Map<string, DOMMatrix>()
  const base = new DOMMatrix().translate(inst.x, inst.y).scale(inst.scale)

  const matrixOf = (p: Part): DOMMatrix => {
    const cached = mats.get(p.id)
    if (cached) return cached
    const parent = p.parent ? byId.get(p.parent) : undefined
    const pm = parent ? matrixOf(parent) : base
    const pp = restPose ? { rot: 0, x: 0, y: 0, scale: 1 } : pose.parts[p.id] ?? { rot: 0, x: 0, y: 0, scale: 1 }
    let ox = p.offset.x + pp.x
    let oy = p.offset.y + pp.y
    if (p.role === 'pupil' && p.gazeRange && !restPose) {
      ox += pose.gazeX * p.gazeRange.x
      oy += pose.gazeY * p.gazeRange.y
    }
    const m = pm.translate(ox, oy).rotate(pp.rot).scale(pp.scale)
    mats.set(p.id, m)
    return m
  }

  const out: Placed[] = []
  for (const p of character.parts) {
    const variant = restPose ? p.defaultVariant : variantFor(p, pose)
    out.push({ part: p, matrix: matrixOf(p), assetId: p.variants[variant] })
  }
  out.sort((a, b) => a.part.z - b.part.z)
  return out
}

export function pivotOf(pl: Placed): Vec {
  return { x: pl.matrix.e, y: pl.matrix.f }
}

// ---------- Dibujo ----------

export function drawCharacter(
  g: CanvasRenderingContext2D,
  character: Character,
  inst: CharacterInstance,
  t: number,
  restPose = false,
): Placed[] {
  const pose = poseAt(character, inst.tracks, t)
  const placed = layout(character, inst, pose, restPose)
  const byId = new Map(placed.map((p) => [p.part.id, p]))
  for (const pl of placed) {
    const asset = character.assets[pl.assetId]
    if (!asset) continue
    const img = getImage(asset.src)
    if (!img.complete || !img.naturalWidth) continue
    if (pl.part.skin && !restPose && drawSkinned(g, img, asset.w, asset.h, pl, byId, character, pose)) continue
    g.save()
    g.setTransform(g.getTransform().multiply(pl.matrix))
    g.drawImage(img, -pl.part.anchor.x, -pl.part.anchor.y, asset.w, asset.h)
    g.restore()
  }
  return placed
}

/** Dibuja el fotograma completo del proyecto en el instante t (sin ayudas de edición). */
export function drawFrame(g: CanvasRenderingContext2D, project: Project, t: number) {
  g.save()
  g.fillStyle = project.background
  g.fillRect(0, 0, project.width, project.height)
  for (const inst of project.instances) {
    const c = project.characters[inst.characterId]
    if (c) drawCharacter(g, c, inst, t)
  }
  g.restore()
}

/** Pieza bajo un punto del escenario (respetando la transparencia del dibujo). */
export function hitTest(character: Character, placed: Placed[], pt: Vec): Part | null {
  for (let i = placed.length - 1; i >= 0; i--) {
    const pl = placed[i]
    const asset = character.assets[pl.assetId]
    if (!asset) continue
    const local = pl.matrix.inverse().transformPoint(new DOMPoint(pt.x, pt.y))
    const ix = local.x + pl.part.anchor.x
    const iy = local.y + pl.part.anchor.y
    if (ix < 0 || iy < 0 || ix > asset.w || iy > asset.h) continue
    if (alphaAt(asset.src, asset.w, asset.h, ix, iy) > 20) return pl.part
  }
  return null
}

// ---------- Deformación por malla ----------

const smooth = (t: number) => {
  const u = Math.max(0, Math.min(1, t))
  return u * u * (3 - 2 * u)
}

/** Eje de la pieza en su espacio local: hacia su primera hija, o hacia el centro de su dibujo. */
function partAxis(part: Part, character: Character, w: number, h: number): Vec {
  const child = character.parts.find((c) => c.parent === part.id && !c.role)
  const v = child ? child.offset : { x: w / 2 - part.anchor.x, y: h / 2 - part.anchor.y }
  const n = Math.hypot(v.x, v.y) || 1
  return { x: v.x / n, y: v.y / n }
}

const still = (p: { rot: number; x: number; y: number; scale: number } | undefined) =>
  !p || (Math.abs(p.rot) < 0.01 && Math.abs(p.x) < 0.01 && Math.abs(p.y) < 0.01 && Math.abs(p.scale - 1) < 1e-4)

/**
 * Dibuja la pieza como una malla de triángulos. Cerca de la articulación con su padre, cada vértice
 * gira solo una fracción del giro de la pieza; cerca de la articulación con su hija, gira además una
 * fracción del giro de la hija. Girar (en vez de promediar posiciones) mantiene el grosor del dibujo.
 * Devuelve false si no hace falta deformar, para dibujar la pieza rígida (más rápido).
 */
function drawSkinned(
  g: CanvasRenderingContext2D,
  img: HTMLImageElement,
  W: number,
  H: number,
  pl: Placed,
  byId: Map<string, Placed>,
  character: Character,
  pose: Pose,
): boolean {
  const part = pl.part
  const skin = part.skin!
  const own = pose.parts[part.id]
  const parentPl = skin.parent && part.parent ? byId.get(part.parent) : undefined
  const childPl = skin.child ? byId.get(skin.child.id) : undefined
  const childPose = childPl ? pose.parts[childPl.part.id] : undefined
  const bendsParent = !!parentPl && !still(own)
  const bendsChild = !!childPl && !!childPose && Math.abs(childPose.rot) > 0.01
  if (!bendsParent && !bendsChild) return false

  const axis = partAxis(part, character, W, H)
  const A = part.anchor
  const cOff = childPl?.part.offset ?? { x: 0, y: 0 }
  const childS = cOff.x * axis.x + cOff.y * axis.y
  const nx = Math.max(2, Math.ceil(W / 30))
  const ny = Math.max(2, Math.ceil(H / 30))
  // Matriz de la pieza con una fracción a (0..1) de su propio movimiento respecto al padre.
  const partial = (a: number) =>
    parentPl!.matrix
      .translate(part.offset.x + a * own.x, part.offset.y + a * own.y)
      .rotate(a * own.rot)
      .scale(1 + a * (own.scale - 1))
  const cache = new Map<number, DOMMatrix>()
  const src: Vec[] = []
  const dst: Vec[] = []
  const moved: boolean[] = []
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const u = (i / nx) * W
      const v = (j / ny) * H
      const lx = u - A.x
      const ly = v - A.y
      const s = lx * axis.x + ly * axis.y
      let m = pl.matrix
      let deformed = false
      if (bendsParent) {
        const a = Math.round(smooth((s - skin.parent![0]) / (skin.parent![1] - skin.parent![0])) * 200) / 200
        if (a < 1) {
          m = cache.get(a) ?? partial(a)
          cache.set(a, m)
          deformed = true
        }
      }
      if (bendsChild) {
        const c = smooth((s - childS - skin.child!.range[0]) / (skin.child!.range[1] - skin.child!.range[0]))
        if (c > 0) {
          m = m.translate(cOff.x, cOff.y).rotate(c * childPose!.rot).translate(-cOff.x, -cOff.y)
          deformed = true
        }
      }
      const p = m.transformPoint(new DOMPoint(lx, ly))
      src.push({ x: u, y: v })
      dst.push({ x: p.x, y: p.y })
      moved.push(deformed)
    }
  }

  // Cada triángulo se agranda ~1 px de pantalla para que no se vean costuras entre ellos.
  const m = g.getTransform()
  const grow = 0.9 / (Math.hypot(m.a, m.b) || 1)
  const tri = (a: number, b: number, c: number) => {
    const s0 = src[a], s1 = src[b], s2 = src[c]
    const d0 = dst[a], d1 = dst[b], d2 = dst[c]
    const den = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y)
    if (Math.abs(den) < 1e-9) return
    // Transformación afín que lleva el triángulo de la imagen al de destino.
    const ta = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / den
    const tb = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / den
    const tc = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / den
    const td = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / den
    const te = d0.x - ta * s0.x - tc * s0.y
    const tf = d0.y - tb * s0.x - td * s0.y
    const cx = (d0.x + d1.x + d2.x) / 3
    const cy = (d0.y + d1.y + d2.y) / 3
    g.save()
    g.beginPath()
    for (const [k, d] of [d0, d1, d2].entries()) {
      const dx = d.x - cx
      const dy = d.y - cy
      const n = Math.hypot(dx, dy) || 1
      const x = d.x + (dx / n) * grow
      const y = d.y + (dy / n) * grow
      if (k === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.closePath()
    g.clip()
    g.transform(ta, tb, tc, td, te, tf)
    const sx = Math.max(0, Math.floor(Math.min(s0.x, s1.x, s2.x)) - 2)
    const sy = Math.max(0, Math.floor(Math.min(s0.y, s1.y, s2.y)) - 2)
    const sw = Math.min(W, Math.ceil(Math.max(s0.x, s1.x, s2.x)) + 2) - sx
    const sh = Math.min(H, Math.ceil(Math.max(s0.y, s1.y, s2.y)) + 2) - sy
    const kx = img.naturalWidth / W
    const ky = img.naturalHeight / H
    if (sw > 0 && sh > 0) g.drawImage(img, sx * kx, sy * ky, sw * kx, sh * ky, sx, sy, sw, sh)
    g.restore()
  }
  // Los cuadros de la malla que no se deforman se dibujan juntos, de una vez y rígidos.
  const rigid: number[] = []
  const bent: number[] = []
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i
      const quad = [a, a + 1, a + nx + 2, a + nx + 1]
      ;(quad.some((q) => moved[q]) ? bent : rigid).push(a)
    }
  }
  if (rigid.length) {
    g.save()
    g.beginPath()
    for (const a of rigid) {
      const q = [src[a], src[a + 1], src[a + nx + 2], src[a + nx + 1]].map((p) => pl.matrix.transformPoint(new DOMPoint(p.x - A.x, p.y - A.y)))
      g.moveTo(q[0].x, q[0].y)
      for (let k = 1; k < 4; k++) g.lineTo(q[k].x, q[k].y)
      g.closePath()
    }
    g.clip()
    g.setTransform(g.getTransform().multiply(pl.matrix))
    g.drawImage(img, -A.x, -A.y, W, H)
    g.restore()
  }
  for (const a of bent) {
    tri(a, a + 1, a + nx + 1)
    tri(a + 1, a + nx + 2, a + nx + 1)
  }
  return true
}
