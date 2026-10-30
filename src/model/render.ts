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
  for (const pl of placed) {
    const asset = character.assets[pl.assetId]
    if (!asset) continue
    const img = getImage(asset.src)
    if (!img.complete || !img.naturalWidth) continue
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
