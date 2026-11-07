import { poseAt } from './anim'
import { withFollowThrough, withLife } from './life'
import { ensureMedia, mediaUrl } from '../audio/storage'
import { drawContenido, type PuntosPersonaje } from './contenido'
import { aSuManera, avanceEscritura, COLORES_MANO, escribirMano, medirMano } from './letra'
import { evalTrack } from './anim'
import type { BgLayer, Character, CharacterInstance, Part, Pose, Project, Vec } from './types'

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
  await ensureMedia([...(project.fondos ?? []), ...(project.objetos ?? [])].map((l) => l.imageId))
  for (const l of [...(project.fondos ?? []), ...(project.objetos ?? [])]) {
    const url = mediaUrl(l.imageId)
    if (url) {
      const img = getImage(url)
      if (!img.complete) all.push(img.decode().catch(() => undefined))
    }
  }
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
  else if (pose.variants?.[part.id]) v = pose.variants[part.id]
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
  life = false,
): Placed[] {
  let pose = poseAt(character, inst.tracks, t)
  if (!restPose) pose = withFollowThrough(pose, character, inst.tracks, t)
  if (life && !restPose) {
    const fore = character.parts.find((p) => p.id === 'antebrazo_der' || p.id === 'antebrazo_izq')
    pose = withLife(pose, t, inst.tracks, fore ? Math.hypot(fore.offset.x, fore.offset.y) : 200, character.parts.find((p) => !p.parent)?.id)
  }
  // Expresivo: parpadeo con su dibujo de ojos cerrados
  if (!restPose && character.expresivo && pose.blink > 0.5) {
    const raiz = character.parts.find((p) => !p.parent)
    const v = raiz && (pose.variants[raiz.id] ?? raiz.defaultVariant).split('~')[0]
    const ojos = character.parts.find((p) => p.id === 'ojos')
    // Si una mano tapa la cara (sinCapas / sinOjos), nada de ojos cerrados pegados encima de la mano
    const tapada = !!v && (character.expresivo.sinCapas?.includes(v) || character.expresivo.sinOjos?.includes(v))
    if (raiz && v?.startsWith('t_') && !tapada && ojos?.variants.cerrados) pose = { ...pose, variants: { ...pose.variants, ojos: 'cerrados' } }
    else if (raiz && v && raiz.variants[v + '~c']) pose = { ...pose, variants: { ...pose.variants, [raiz.id]: v + '~c' } }
  }
  const placed = layout(character, inst, pose, restPose)
  const byId = new Map(placed.map((p) => [p.part.id, p]))
  if (!restPose) drawShadow(g, character, inst, placed)
  for (const pl of placed) {
    const asset = character.assets[pl.assetId]
    if (!asset) continue
    const img = getImage(asset.src)
    if (!img.complete || !img.naturalWidth) continue
    if (pl.part.skin && !restPose && drawSkinned(g, img, asset.w, asset.h, pl, byId, character, pose)) continue
    g.save()
    g.setTransform(g.getTransform().multiply(pl.matrix))
    g.drawImage(img, -pl.part.anchor.x, -pl.part.anchor.y, asset.w, asset.h)
    // Fundido del dibujo anterior encima del nuevo mientras cambia de pose
    const f = !restPose ? pose.fades?.[pl.part.id] : undefined
    const prevAsset = f && character.assets[pl.part.variants[f.prev]]
    if (f && prevAsset) {
      const pimg = getImage(prevAsset.src)
      if (pimg.complete && pimg.naturalWidth) {
        g.globalAlpha = 1 - f.u * f.u * (3 - 2 * f.u)
        g.drawImage(pimg, -pl.part.anchor.x, -pl.part.anchor.y, prevAsset.w, prevAsset.h)
      }
    }
    g.restore()
  }
  return placed
}

/** Dibuja el fotograma completo del proyecto en el instante t (sin ayudas de edición). */
const num = (v: number | string) => (typeof v === 'number' ? v : Number(v) || 0)

/** Transformación de la cámara en el instante t (zoom alrededor del centro del vídeo). */
export function cameraMatrix(project: Project, t: number): DOMMatrix {
  const tr = project.instances[0]?.tracks ?? {}
  const zoom = Math.max(0.1, num(evalTrack(tr['cam:zoom'], t, 1)))
  const cx = num(evalTrack(tr['cam:x'], t, 0))
  const cy = num(evalTrack(tr['cam:y'], t, 0))
  const W = project.width / 2
  const H = project.height / 2
  return new DOMMatrix().translate(W, H).scale(zoom).translate(-W - cx, -H - cy)
}

/** Matriz de una capa de imagen en el instante t (coordenadas de la imagen centradas). */
export function layerMatrix(project: Project, l: BgLayer, t: number): DOMMatrix {
  const tr = project.instances[0]?.tracks ?? {}
  const ch = (p: string, d: number) => num(evalTrack(tr[`bg:${l.id}:${p}`], t, d))
  const cover = Math.max(project.width / l.w, project.height / l.h)
  return new DOMMatrix()
    .translate(project.width / 2 + ch('x', 0), project.height / 2 + ch('y', 0))
    .rotate(ch('rot', 0))
    .scale(cover * ch('scale', 1))
}

/** Capa bajo un punto de la escena (primero las de delante). */
export function hitLayer(project: Project, t: number, pt: Vec, delante: boolean): BgLayer | null {
  const layers = (project.fondos ?? []).filter((l) => !!l.delante === delante)
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i]
    const q = layerMatrix(project, l, t).inverse().transformPoint(new DOMPoint(pt.x, pt.y))
    if (Math.abs(q.x) <= l.w / 2 && Math.abs(q.y) <= l.h / 2) return l
  }
  return null
}

/** Dibuja las capas de imagen de un lado (detrás o delante del personaje). */
export function drawLayers(g: CanvasRenderingContext2D, project: Project, t: number, delante: boolean) {
  const tr = project.instances[0]?.tracks ?? {}
  for (const l of project.fondos ?? []) {
    if (!!l.delante !== delante) continue
    const url = mediaUrl(l.imageId)
    if (!url) continue
    const img = getImage(url)
    if (!img.complete || !img.naturalWidth) continue
    const opacity = num(evalTrack(tr[`bg:${l.id}:opacity`], t, 1))
    g.save()
    g.globalAlpha = Math.max(0, Math.min(1, opacity))
    g.setTransform(g.getTransform().multiply(layerMatrix(project, l, t)))
    g.drawImage(img, -l.w / 2, -l.h / 2, l.w, l.h)
    g.restore()
  }
}


/**
 * Dibuja el personaje de la escena. En la composición a un lado, si está a la IZQUIERDA se dibuja en
 * espejo: su mano libre (la que presenta y señala) queda hacia el contenido y no hacia fuera.
 */
export function drawPersonajeEscena(
  g: CanvasRenderingContext2D,
  project: Project,
  character: Character,
  inst: CharacterInstance,
  t: number,
  cam: DOMMatrix,
  restPose = false,
): { placed: Placed[]; puntos: PuntosPersonaje } {
  const raiz = character.parts.find((p) => !p.parent)
  const v = (project.vinetas ?? []).find((x) => t >= x.t && t < x.fin)
  const espejoLado = !restPose && !!character.expresivo && !!raiz && v?.lado === 'izq' && project.width > project.height * 1.1
  // Canal `pj:espejo`: al caminar hacia la derecha (los dibujos de andar van hacia la izquierda)
  const espejoPista = !restPose && num(evalTrack(inst.tracks['pj:espejo'], t, 0)) > 0.5
  const espejo = espejoLado !== espejoPista
  const pivote = raiz ? inst.x + num(evalTrack(inst.tracks[`part:${raiz.id}:x`], t, 0)) * inst.scale : inst.x
  g.save()
  if (espejo) {
    g.translate(pivote, 0)
    g.scale(-1, 1)
    g.translate(-pivote, 0)
  }
  const placed = drawCharacter(g, character, inst, t, restPose, project.vida !== false)
  g.restore()
  const puntos: PuntosPersonaje = { mano: null, cabeza: null }
  const pl = raiz && placed.find((x) => x.part.id === raiz.id)
  const ex = character.expresivo
  if (pl && ex && ex.lienzo) {
    const aPantalla = (lx: number, ly: number) => {
      const w = pl.matrix.transformPoint(new DOMPoint(lx - pl.part.anchor.x, ly - pl.part.anchor.y))
      const x = espejo ? 2 * pivote - w.x : w.x
      const s = cam.transformPoint(new DOMPoint(x, w.y))
      return { x: s.x, y: s.y }
    }
    puntos.cabeza = aPantalla(ex.cabeza.x, ex.cabeza.y - (ex.radio ?? 300) * 0.6)
    const c = aPantalla(ex.cabeza.x, ex.cabeza.y)
    const borde = aPantalla(ex.cabeza.x, ex.cabeza.y - (ex.radio ?? 300))
    puntos.circulo = { x: c.x, y: c.y, r: Math.hypot(borde.x - c.x, borde.y - c.y) }
    const dibujo = Object.entries(raiz!.variants).find(([, a]) => a === pl.assetId)?.[0]?.split('~')[0]
    if (ex.palma && dibujo === ex.palma.postura) puntos.mano = aPantalla(ex.palma.x, ex.palma.y)
  }
  return { placed, puntos }
}

export function drawFrame(g: CanvasRenderingContext2D, project: Project, t: number) {
  g.save()
  g.fillStyle = project.background
  g.fillRect(0, 0, project.width, project.height)
  const cam = cameraMatrix(project, t)
  g.setTransform(g.getTransform().multiply(cam))
  drawLayers(g, project, t, false)
  let puntos: PuntosPersonaje | undefined
  project.instances.forEach((inst, i) => {
    const c = project.characters[inst.characterId]
    if (!c) return
    if (i === 0) puntos = drawPersonajeEscena(g, project, c, inst, t, cam).puntos
    else drawCharacter(g, c, inst, t, false, project.vida !== false)
  })
  drawLayers(g, project, t, true)
  g.restore()
  if (!drawContenido(g, project, t, getImage, puntos)) {
    drawObjetos(g, project, t, puntos)
    drawRotulos(g, project, t, puntos)
  }
}


/** Objetos que aparecen junto al personaje (fuera de la cámara, como los rótulos), con un «pop». */
type Circulo = { x: number; y: number; r: number }

/** ¿Choca la caja (centro y medio ancho/alto) con la cabeza? */
function tapaCabeza(c: Circulo | null | undefined, x: number, y: number, hw: number, hh: number) {
  if (!c) return false
  const nx = Math.max(x - hw, Math.min(c.x, x + hw)), ny = Math.max(y - hh, Math.min(c.y, y + hh))
  return Math.hypot(nx - c.x, ny - c.y) < c.r * 1.04
}

/**
 * Coloca una caja en su sitio sin salirse de la pantalla y, si tapa la cabeza, la aparta hacia fuera
 * (a su lado de la cabeza, o por encima, o por debajo). Devuelve el centro y cuánto hay que encogerla.
 */
function colocarSinTapar(W: number, H: number, c: Circulo | null | undefined, x: number, y: number, hw: number, hh: number) {
  const m = 14
  const dentro = (px: number, py: number, k: number) => ({
    x: Math.max(hw * k + m, Math.min(W - hw * k - m, px)),
    y: Math.max(hh * k + m, Math.min(H - hh * k - m, py)),
  })
  for (const k of [1, 0.85, 0.7, 0.58]) {
    const lado = c && x < c.x ? -1 : 1
    const prueba = [
      dentro(x, y, k),
      ...(c
        ? [
            dentro(c.x + lado * (c.r * 1.06 + hw * k), y, k),
            dentro(x, c.y - c.r * 1.06 - hh * k, k),
            dentro(c.x - lado * (c.r * 1.06 + hw * k), y, k),
            dentro(x, c.y + c.r * 1.06 + hh * k, k),
          ]
        : []),
    ]
    for (const p of prueba) if (!tapaCabeza(c, p.x, p.y, hw * k, hh * k)) return { ...p, k }
  }
  return { ...dentro(x, y, 0.58), k: 0.58 }
}

export function drawObjetos(g: CanvasRenderingContext2D, project: Project, t: number, puntos?: PuntosPersonaje) {
  const W = project.width
  const H = project.height
  const lado = Math.min(W, H) * (W > H ? 0.36 : 0.3)
  // Centro de cada sitio: a los lados del personaje (que ocupa el centro)
  const mx = W > H ? 0.24 : 0.17
  const sitio: Record<string, [number, number]> = {
    arriba_izq: [W * mx, H * (W > H ? 0.24 : 0.14)],
    arriba_der: [W * (1 - mx), H * (W > H ? 0.24 : 0.14)],
    izq: [W * mx, H * 0.5],
    der: [W * (1 - mx), H * 0.5],
    izq_baja: [W * mx, H * 0.74],
    der_baja: [W * (1 - mx), H * 0.74],
  }
  for (const o of project.objetos ?? []) {
    if (t < o.t || t >= o.fin) continue
    const url = mediaUrl(o.imageId)
    if (!url) continue
    const img = getImage(url)
    if (!img.complete || !img.naturalWidth) continue
    const [x0, y0] = sitio[o.pos] ?? sitio.arriba_der
    const dt = t - o.t
    const pop = dt < 0.07 ? 0.7 + (1.12 - 0.7) * (dt / 0.07) : dt < 0.15 ? 1.12 - 0.12 * ((dt - 0.07) / 0.08) : 1
    const k0 = lado / Math.max(o.w, o.h)
    // Que no tape la cara ni se salga por el borde (girado unos grados: un poco de margen)
    const sit = colocarSinTapar(W, H, puntos?.circulo, x0, y0, (o.w * k0) / 2 + 8, (o.h * k0) / 2 + 8)
    const x = sit.x, y = sit.y
    const k = k0 * sit.k * pop
    let semilla = 0
    for (const ch of o.id) semilla = (semilla * 31 + ch.charCodeAt(0)) % 997
    g.save()
    g.translate(x, y)
    g.rotate((((semilla % 9) - 4) * Math.PI) / 180)
    g.drawImage(img, (-o.w / 2) * k, (-o.h / 2) * k, o.w * k, o.h * k)
    g.restore()
  }
}

/** Rótulos a mano (fuera de la cámara: no hacen zoom). Entran con un «pop» rápido. */
export function drawRotulos(g: CanvasRenderingContext2D, project: Project, t: number, puntos?: PuntosPersonaje) {
  const W = project.width
  const H = project.height
  const sitio: Record<string, [number, number, number]> = {
    // x, y, ancho máximo
    // La cabeza ocupa el centro de arriba: los laterales van a la altura del cuerpo, que es estrecho
    arriba: [W / 2, H * 0.09, W * 0.92],
    izq: [W * 0.2, H * 0.47, W * 0.38],
    der: [W * 0.8, H * 0.47, W * 0.38],
    izq_baja: [W * 0.2, H * 0.66, W * 0.38],
    der_baja: [W * 0.8, H * 0.66, W * 0.38],
    abajo: [W / 2, H * 0.93, W * 0.92],
  }
  for (const r of project.rotulos ?? []) {
    if (t < r.t || t >= r.fin) continue
    const [x, y, maxW] = sitio[r.pos] ?? sitio.arriba
    let sem = 0
    for (const ch of r.id) sem = (sem * 31 + ch.charCodeAt(0)) % 997
    const texto = aSuManera(r.texto)
    const palabras = texto.split(/\s+/)
    // Tamaño: grande, pero que quepa en su sitio (hasta 2 líneas)
    let tam = Math.round(Math.min(W, H) * 0.13)
    let lineas: string[] = [texto]
    for (; tam > 30; tam -= 4) {
      if (medirMano(g, texto, tam) <= maxW) {
        lineas = [texto]
        break
      }
      const mitad = Math.ceil(palabras.length / 2)
      const dos = [palabras.slice(0, mitad).join(' '), palabras.slice(mitad).join(' ')]
      if (palabras.length > 1 && Math.max(...dos.map((l) => medirMano(g, l, tam))) <= maxW) {
        lineas = dos
        break
      }
    }
    const color = COLORES_MANO[r.color] ?? COLORES_MANO.negro
    const avance = avanceEscritura(texto, t - r.t)
    // Que no se escriba encima de la cabeza (en los planos cercanos sube hasta arriba)
    const hw = Math.max(...lineas.map((l) => medirMano(g, l, tam))) / 2 + 10
    const hh = (lineas.length * tam * 1.15) / 2 + 6
    const sit = colocarSinTapar(W, H, puntos?.circulo, x, y, hw, hh)
    if (sit.k < 1) tam = Math.round(tam * sit.k)
    g.save()
    g.translate(sit.x, sit.y)
    g.rotate((((sem % 11) - 5) * Math.PI) / 180)
    lineas.forEach((l, i) => {
      const parte = Math.max(0, Math.min(1, avance * lineas.length - i))
      escribirMano(g, l, 0, (i - (lineas.length - 1) / 2) * tam * 1.15, tam, color, parte, sem + i * 17)
    })
    g.restore()
  }
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
  const nrm = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180
  const ownRot = nrm(own?.rot ?? 0)
  const childRot = nrm(childPose?.rot ?? 0)
  const bendsParent = !!parentPl && !still(own) && Math.abs(ownRot) < 150
  const bendsChild = !!childPl && !!childPose && Math.abs(childRot) > 0.01 && Math.abs(childRot) < 150
  const lifts = (skin.lift ?? []).flatMap((lf) => {
    const c = character.parts.find((p) => p.id === lf.id)
    const pp = pose.parts[lf.id]
    return c && pp && (Math.abs(pp.x) > 0.01 || Math.abs(pp.y) > 0.01) ? [{ off: c.offset, dx: pp.x, dy: pp.y, r: lf.r }] : []
  })
  if (!bendsParent && !bendsChild && !lifts.length) return false

  const axis = partAxis(part, character, W, H)
  const A = part.anchor
  const cOff = childPl?.part.offset ?? { x: 0, y: 0 }
  const childS = cOff.x * axis.x + cOff.y * axis.y
  const nx = Math.max(2, Math.ceil(W / 30))
  const ny = Math.max(2, Math.ceil(H / 30))
  // Matriz de la pieza con una fracción a (0..1) de su propio movimiento respecto al padre.
  // El desplazamiento se aplica entero (la pieza sube o baja en bloque, el torso la acompaña con
  // «lift»); solo el giro y el tamaño se reparten a lo largo de la articulación.
  const partial = (a: number) =>
    parentPl!.matrix
      .translate(part.offset.x + own.x, part.offset.y + own.y)
      .rotate(a * ownRot)
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
          m = m.translate(cOff.x, cOff.y).rotate(c * childRot).translate(-cOff.x, -cOff.y)
          deformed = true
        }
      }
      let qx = lx
      let qy = ly
      for (const lf of lifts) {
        const d = Math.hypot(lx - lf.off.x, ly - lf.off.y)
        const c = 1 - smooth((d - lf.r[0]) / (lf.r[1] - lf.r[0]))
        if (c > 0) {
          qx += c * lf.dx
          qy += c * lf.dy
          deformed = true
        }
      }
      const p = m.transformPoint(new DOMPoint(qx, qy))
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

// ---------- Sombra en el suelo ----------

/** Punto más bajo (los pies) de las piezas de pierna, en coordenadas de la escena. */
function feet(character: Character, placed: Placed[]): Vec[] {
  const out: Vec[] = []
  for (const pl of placed) {
    if (!/^pierna_/.test(pl.part.id)) continue
    const a = character.assets[pl.assetId]
    if (!a) continue
    const p = pl.matrix.transformPoint(new DOMPoint(a.w / 2 - pl.part.anchor.x, a.h * 0.93 - pl.part.anchor.y))
    out.push({ x: p.x, y: p.y })
  }
  if (!out.length) {
    // Personaje por poses: la articulación del cuerpo está entre los pies; se toma un ancho de pies fijo
    const root = placed.find((p) => !p.part.parent)
    if (root) {
      const k = Math.hypot(root.matrix.a, root.matrix.b)
      out.push({ x: root.matrix.e - 230 * k, y: root.matrix.f }, { x: root.matrix.e + 230 * k, y: root.matrix.f })
    }
  }
  return out
}

const groundCache = new WeakMap<Character, number>()

/** Sombra suave bajo los pies: el suelo no se mueve si el personaje salta (la sombra se aclara). */
const pieCache = new Map<string, { y: number; x0: number; x1: number } | null>()

/** Dónde acaban de verdad los pies en un dibujo (la fila opaca más baja y su ancho), en px del dibujo. */
function pieReal(src: string, w: number, h: number) {
  if (pieCache.has(src)) return pieCache.get(src)!
  const img = getImage(src)
  if (!img.complete || !img.naturalWidth) return null
  const k = 0.25
  const cw = Math.max(1, Math.round(w * k)), chh = Math.max(1, Math.round(h * k))
  const c = document.createElement('canvas')
  c.width = cw
  c.height = chh
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(img, 0, 0, cw, chh)
  const d = g.getImageData(0, 0, cw, chh).data
  let r: { y: number; x0: number; x1: number } | null = null
  for (let y = chh - 1; y >= 0 && !r; y--) {
    let x0 = -1, x1 = -1
    for (let x = 0; x < cw; x++) if (d[(y * cw + x) * 4 + 3] > 60) (x0 < 0 && (x0 = x), (x1 = x))
    if (x0 >= 0) r = { y: (y + 1) / k, x0: x0 / k, x1: (x1 + 1) / k }
  }
  pieCache.set(src, r)
  return r
}

function drawShadow(g: CanvasRenderingContext2D, character: Character, inst: CharacterInstance, placed: Placed[]) {
  // Personaje expresivo: cada postura es un dibujo entero y los pies no siempre caen en el mismo sitio
  // (gestos a medida, caras exageradas, sentado): la sombra va bajo los pies de ESE dibujo, no flotando
  const root = character.expresivo ? placed.find((p) => !p.part.parent) : undefined
  const a = root && character.assets[root.assetId]
  const pie = root && a ? pieReal(a.src, a.w, a.h) : null
  if (root && pie) {
    const p0 = root.matrix.transformPoint(new DOMPoint(pie.x0 - root.part.anchor.x, pie.y - root.part.anchor.y))
    const p1 = root.matrix.transformPoint(new DOMPoint(pie.x1 - root.part.anchor.x, pie.y - root.part.anchor.y))
    const w = Math.abs(p1.x - p0.x) / 2 + 60 * inst.scale
    sombra(g, (p0.x + p1.x) / 2, Math.max(p0.y, p1.y) - 8 * inst.scale, w, 0.22)
    return
  }
  const now = feet(character, placed)
  if (!now.length) return
  let ground = groundCache.get(character)
  if (ground === undefined) {
    const rest = layout(character, { ...inst, x: 0, y: 0, scale: 1, tracks: {} }, poseAt(character, {}, 0))
    const f = feet(character, rest)
    ground = f.length ? Math.max(...f.map((p) => p.y)) : 0
    groundCache.set(character, ground)
  }
  const gy = inst.y + ground * inst.scale
  const xs = now.map((p) => p.x)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const lift = Math.max(0, gy - Math.max(...now.map((p) => p.y)))
  const w = (Math.max(...xs) - Math.min(...xs)) / 2 + 150 * inst.scale
  const alpha = 0.22 * Math.max(0.25, 1 - lift / (300 * inst.scale))
  sombra(g, cx, gy, w, alpha)
}

function sombra(g: CanvasRenderingContext2D, cx: number, gy: number, w: number, alpha: number) {
  g.save()
  g.translate(cx, gy)
  g.scale(1, 0.16)
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, w)
  grad.addColorStop(0, `rgba(0,0,0,${alpha})`)
  grad.addColorStop(0.6, `rgba(0,0,0,${alpha * 0.6})`)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.beginPath()
  g.arc(0, 0, w, 0, Math.PI * 2)
  g.fill()
  g.restore()
}
