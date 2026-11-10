// PERSONAJE ARTICULADO (animación de verdad, estilo «rubber hose»): la cabeza y las zapatillas son las del
// dibujo original; el tronco se dibuja por código y los brazos y las piernas son «mangueras» que se doblan
// con suavidad (curvas con contorno). Así cualquier postura y cualquier movimiento intermedio existe sin
// tener que dibujarlo: camina, se sienta, coge cosas, señala… Las medidas van en píxeles del dibujo
// original de cada personaje, con el origen en el suelo, entre los pies.

export interface RigDef {
  id: string
  /** Escala para que todos los personajes compartan unidades (1 = píxeles del chico rosa) */
  k: number
  cabeza: { src: Record<string, string>; w: number; h: number; cx: number; cy: number; r: number }
  /** Capas de cara (solo el chico): caja en coordenadas de la imagen de la cabeza */
  ojos?: { caja: [number, number, number, number]; src: Record<string, string> }
  boca?: { caja: [number, number, number, number]; src: Record<string, string> }
  cuello: { y: number; ancho: number; color: string }
  hombros: { y: number; dx: number }
  cadera: { y: number; dx: number }
  brazo: { l1: number; l2: number; ancho: number; color: string; manga: number; colorManga: string; anchoManga: number; puno?: string }
  pierna: { l1: number; l2: number; ancho: number; color: string; rodilla?: string }
  mano: { r: number; color: string }
  zapa: { src: string; w: number; h: number; ax: number; ay: number }
  tronco: 'camiseta' | 'sudadera'
  colorTronco: string
  trazo: number
}

export interface Brazo {
  /** Ángulo del brazo en el hombro (0 = colgando; positivo = hacia delante, hacia donde mira) y del codo */
  a1: number
  a2: number
  mano?: 'normal' | 'indice' | 'abierta'
}
export interface Pierna {
  a1: number
  a2: number
}

export interface RigPose {
  x: number
  y: number
  mira: 1 | -1
  escala: number
  /** Altura de la cadera sobre el suelo respecto a de pie (negativo = agachado/sentado) */
  cadera: number
  inclina: number
  cabezaRot: number
  cabezaDy: number
  /** Brazo de delante (el del lado hacia el que mira) y de detrás */
  brazoD: Brazo
  brazoT: Brazo
  piernaD: Pierna
  piernaT: Pierna
  ojos: string
  boca: string
  cara: string
  /** Estirar/aplastar (1 = normal) */
  estira: number
  /** Objeto en la mano de delante o en la de detrás (se dibuja en el sistema de la mano) */
  objD?: (g: CanvasRenderingContext2D, giro: number) => void
  objT?: (g: CanvasRenderingContext2D, giro: number) => void
  /** El brazo de detrás pasa por delante del tronco (p. ej. sujeta algo con las dos manos) */
  brazoTDelante?: boolean
}

export const POSE0: RigPose = {
  x: 0, y: 0, mira: 1, escala: 1, cadera: 0, inclina: 0, cabezaRot: 0, cabezaDy: 0,
  brazoD: { a1: 4, a2: 6 }, brazoT: { a1: -4, a2: 6 }, piernaD: { a1: 0, a2: 0 }, piernaT: { a1: 0, a2: 0 },
  ojos: 'nada', boca: 'nada', cara: 'reposo', estira: 1,
}

const imgs = new Map<string, HTMLImageElement>()
export function imagen(src: string) {
  let i = imgs.get(src)
  if (!i) {
    i = new Image()
    i.src = src
    imgs.set(src, i)
  }
  return i
}
export async function cargar(def: RigDef) {
  const todas = [...Object.values(def.cabeza.src), ...Object.values(def.ojos?.src ?? {}), ...Object.values(def.boca?.src ?? {}), def.zapa.src]
  await Promise.all(todas.map((s) => imagen(s).decode().catch(() => undefined)))
}

const rad = (d: number) => (d * Math.PI) / 180
const TINTA = '#151015'

/** Manguera con contorno que pasa por los tres puntos (hombro, codo, mano) con el codo redondeado. */
function manguera(g: CanvasRenderingContext2D, p: { x: number; y: number }[], ancho: number, color: string, trazo: number) {
  const camino = () => {
    g.beginPath()
    g.moveTo(p[0].x, p[0].y)
    // Curva suave: el codo es el punto de control de dos cuadráticas a medio camino
    const m1 = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }
    const m2 = { x: (p[1].x + p[2].x) / 2, y: (p[1].y + p[2].y) / 2 }
    g.lineTo(m1.x, m1.y)
    g.quadraticCurveTo(p[1].x, p[1].y, m2.x, m2.y)
    g.lineTo(p[2].x, p[2].y)
  }
  g.lineCap = 'round'
  g.lineJoin = 'round'
  camino()
  g.strokeStyle = TINTA
  g.lineWidth = ancho + trazo * 2
  g.stroke()
  camino()
  g.strokeStyle = color
  g.lineWidth = ancho
  g.stroke()
}

function puntos(o: { x: number; y: number }, l1: number, l2: number, a1: number, a2: number) {
  // 0° = hacia abajo; positivo = hacia delante (x+)
  const e = { x: o.x + Math.sin(rad(a1)) * l1, y: o.y + Math.cos(rad(a1)) * l1 }
  const h = { x: e.x + Math.sin(rad(a1 + a2)) * l2, y: e.y + Math.cos(rad(a1 + a2)) * l2 }
  return [o, e, h]
}

function mano(g: CanvasRenderingContext2D, def: RigDef, p: { x: number; y: number }, ang: number, tipo: Brazo['mano']) {
  const r = def.mano.r
  g.save()
  g.translate(p.x, p.y)
  g.rotate(-rad(ang))
  g.lineWidth = def.trazo
  g.strokeStyle = TINTA
  g.fillStyle = def.mano.color
  g.lineJoin = 'round'
  g.lineCap = 'round'
  const dedo = (dx: number, largo: number, w: number) => {
    g.beginPath()
    g.moveTo(dx, r * 0.4)
    g.lineTo(dx, r * 0.4 + largo)
    g.strokeStyle = TINTA
    g.lineWidth = w + def.trazo * 2
    g.stroke()
    g.strokeStyle = def.mano.color
    g.lineWidth = w
    g.stroke()
  }
  if (tipo === 'indice') dedo(r * 0.2, r * 1.5, r * 0.55)
  if (tipo === 'abierta') for (const dx of [-0.6, -0.2, 0.2, 0.6]) dedo(dx * r, r * 1.05, r * 0.42)
  // Pulgar
  g.beginPath()
  g.ellipse(r * 0.85, r * 0.05, r * 0.42, r * 0.3, 0.6, 0, Math.PI * 2)
  g.lineWidth = def.trazo
  g.strokeStyle = TINTA
  g.fill()
  g.stroke()
  g.beginPath()
  g.ellipse(0, r * 0.25, r * 0.95, r * 1.05, 0, 0, Math.PI * 2)
  g.fill()
  g.stroke()
  g.restore()
}

function brazo(g: CanvasRenderingContext2D, def: RigDef, hombro: { x: number; y: number }, b: Brazo, pose: RigPose, lado: 'D' | 'T') {
  const B = def.brazo
  const p = puntos(hombro, B.l1, B.l2, b.a1, b.a2)
  manguera(g, p, B.ancho, B.color, def.trazo)
  // Manga: el primer tramo, más ancha
  if (B.manga > 0) {
    const f = B.manga
    const fin = { x: p[0].x + (p[1].x - p[0].x) * f, y: p[0].y + (p[1].y - p[0].y) * f }
    manguera(g, [p[0], { x: (p[0].x + fin.x) / 2, y: (p[0].y + fin.y) / 2 }, fin], B.anchoManga, B.colorManga, def.trazo)
  }
  if (B.puno) {
    // Puño de la sudadera
    const d = { x: p[2].x - p[1].x, y: p[2].y - p[1].y }
    const n = Math.hypot(d.x, d.y) || 1
    const a = { x: p[2].x - (d.x / n) * B.ancho * 0.5, y: p[2].y - (d.y / n) * B.ancho * 0.5 }
    manguera(g, [a, { x: (a.x + p[2].x) / 2, y: (a.y + p[2].y) / 2 }, p[2]], B.ancho * 1.08, B.puno, def.trazo)
  }
  const angMano = b.a1 + b.a2
  const obj = lado === 'D' ? pose.objD : pose.objT
  if (obj) {
    g.save()
    g.translate(p[2].x, p[2].y)
    g.rotate(-rad(angMano))
    g.scale(1 / def.k, 1 / def.k) // los objetos, en unidades comunes a todos los personajes
    obj(g, rad(angMano)) // «giro» permite al objeto quedarse derecho (un cuenco) aunque gire la mano
    g.restore()
  }
  mano(g, def, p[2], angMano, b.mano ?? 'normal')
  return p[2]
}

function pierna(g: CanvasRenderingContext2D, def: RigDef, cadera: { x: number; y: number }, b: Pierna, delante: boolean) {
  const P = def.pierna
  const p = puntos(cadera, P.l1, P.l2, b.a1, b.a2)
  manguera(g, p, P.ancho, P.color, def.trazo)
  if (P.rodilla) {
    // Roto de la rodilla
    g.save()
    g.translate(p[1].x, p[1].y)
    g.fillStyle = P.rodilla
    g.strokeStyle = TINTA
    g.lineWidth = def.trazo * 0.6
    g.beginPath()
    const w = P.ancho * 0.42
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2
      const rr = w * (i % 2 ? 0.55 : 1)
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 1.2)
    }
    g.closePath()
    g.fill()
    g.stroke()
    g.restore()
  }
  // Zapatilla: apoyada plana si la pierna baja recta; gira con la espinilla si el pie está en el aire
  const z = def.zapa
  const im = imagen(z.src)
  const espinilla = b.a1 + b.a2
  g.save()
  g.translate(p[2].x, p[2].y)
  g.rotate(-rad(espinilla * 0.6))
  if (!delante) g.scale(1, 1)
  if (im.complete && im.naturalWidth) g.drawImage(im, -z.ax, -z.ay, z.w, z.h)
  g.restore()
  return p[2]
}

function tronco(g: CanvasRenderingContext2D, def: RigDef) {
  const hy = def.hombros.y, cy = def.cadera.y, hx = def.hombros.dx, cxw = def.cadera.dx
  g.lineJoin = 'round'
  g.lineWidth = def.trazo
  g.strokeStyle = TINTA
  // Pelvis (pantalón) detrás del tronco
  g.fillStyle = def.pierna.color
  g.beginPath()
  g.roundRect(-cxw - def.pierna.ancho * 0.55, cy - 70, (cxw + def.pierna.ancho * 0.55) * 2, 120, 30)
  g.fill()
  g.stroke()
  g.fillStyle = def.colorTronco
  if (def.tronco === 'camiseta') {
    const bajo = cy - 30
    g.beginPath()
    g.moveTo(-hx * 0.45, hy - 20)
    g.quadraticCurveTo(0, hy + 30, hx * 0.45, hy - 20) // cuello
    g.lineTo(hx + 10, hy + 20)
    g.quadraticCurveTo(hx + 26, (hy + bajo) / 2, hx + 4, bajo)
    g.quadraticCurveTo(0, bajo + 26, -hx - 4, bajo)
    g.quadraticCurveTo(-hx - 26, (hy + bajo) / 2, -hx - 10, hy + 20)
    g.closePath()
    g.fill()
    g.stroke()
    // La montaña
    const my = hy + (bajo - hy) * 0.5
    g.lineWidth = def.trazo * 0.7
    g.beginPath()
    g.moveTo(-95, my + 55)
    g.lineTo(-30, my - 60)
    g.lineTo(-5, my - 15)
    g.lineTo(30, my - 45)
    g.lineTo(100, my + 55)
    g.closePath()
    g.stroke()
    g.beginPath()
    g.moveTo(-50, my - 22)
    g.lineTo(-32, my - 2)
    g.lineTo(-18, my - 20)
    g.lineTo(-6, my - 2)
    g.moveTo(14, my - 16)
    g.lineTo(30, my - 2)
    g.lineTo(44, my - 14)
    g.stroke()
  } else {
    // Sudadera: cuerpo ancho, capucha detrás del cuello, bolsillo y bajo acanalado
    const bajo = cy + 10
    g.beginPath()
    g.ellipse(0, hy - 6, hx * 0.85, 46, 0, 0, Math.PI * 2) // capucha
    g.fill()
    g.stroke()
    g.beginPath()
    g.moveTo(-hx - 6, hy + 10)
    g.quadraticCurveTo(0, hy - 34, hx + 6, hy + 10)
    g.quadraticCurveTo(hx + 44, (hy + bajo) / 2, hx + 22, bajo)
    g.lineTo(-hx - 22, bajo)
    g.quadraticCurveTo(-hx - 44, (hy + bajo) / 2, -hx - 6, hy + 10)
    g.closePath()
    g.fill()
    g.stroke()
    g.lineWidth = def.trazo * 0.7
    // Bajo acanalado
    g.beginPath()
    g.moveTo(-hx - 26, bajo - 34)
    g.lineTo(hx + 26, bajo - 34)
    for (let x = -hx - 10; x <= hx + 10; x += 22) {
      g.moveTo(x, bajo - 30)
      g.lineTo(x, bajo - 4)
    }
    // Bolsillo y cordones
    g.moveTo(-hx * 0.55, bajo - 50)
    g.lineTo(-hx * 0.4, bajo - 130)
    g.lineTo(hx * 0.4, bajo - 130)
    g.lineTo(hx * 0.55, bajo - 50)
    g.moveTo(-16, hy + 4)
    g.lineTo(-20, hy + 70)
    g.moveTo(16, hy + 4)
    g.lineTo(20, hy + 70)
    g.stroke()
  }
}

/** Altura de la cadera sobre el suelo, de pie */
export const altoCadera = (def: RigDef) => def.pierna.l1 + def.pierna.l2 + (def.zapa.h - def.zapa.ay) * 0.55

/** Ángulos (a1, a2) de una extremidad de dos tramos para que su extremo llegue a (dx, dy) desde su origen. */
export function ik(l1: number, l2: number, dx: number, dy: number, codo: 1 | -1 = 1): { a1: number; a2: number } {
  const d = Math.min(l1 + l2 - 1, Math.max(Math.abs(l1 - l2) + 1, Math.hypot(dx, dy)))
  const base = Math.atan2(dx, dy) // 0 = abajo
  const c1 = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))))
  const c2 = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2))))
  const a1 = base + codo * c1
  const a2 = -codo * (Math.PI - c2)
  return { a1: (a1 * 180) / Math.PI, a2: (a2 * 180) / Math.PI }
}

export interface Dibujado {
  manoD: { x: number; y: number }
  manoT: { x: number; y: number }
  cabeza: { x: number; y: number; r: number }
}

/** Dibuja el personaje en su pose. Devuelve dónde quedan sus manos y su cabeza (en coordenadas del lienzo). */
export function dibujarRig(g: CanvasRenderingContext2D, def: RigDef, pose: RigPose): Dibujado {
  const s = pose.escala * def.k
  g.save()
  g.translate(pose.x, pose.y)
  g.scale(s * pose.mira, s)
  // Estirar/aplastar desde el suelo
  g.scale(1 / Math.sqrt(pose.estira), pose.estira)
  const hip = { x: 0, y: -(altoCadera(def) + pose.cadera) }
  // Piernas (no giran con el tronco)
  pierna(g, def, { x: hip.x - def.cadera.dx, y: hip.y }, pose.piernaT, false)
  pierna(g, def, { x: hip.x + def.cadera.dx, y: hip.y }, pose.piernaD, true)
  // Tronco, girando en la cadera
  g.translate(hip.x, hip.y)
  g.rotate(rad(pose.inclina))
  const mundo = (x: number, y: number) => {
    const p = g.getTransform().transformPoint(new DOMPoint(x, y))
    return { x: p.x, y: p.y }
  }
  const hT = { x: -def.hombros.dx, y: def.hombros.y + 30 }
  const hD = { x: def.hombros.dx, y: def.hombros.y + 30 }
  let manoT = { x: 0, y: 0 }
  if (!pose.brazoTDelante) manoT = brazo(g, def, hT, pose.brazoT, pose, 'T')
  // Cuello
  manguera(g, [{ x: 0, y: def.hombros.y + 10 }, { x: 0, y: (def.hombros.y + def.cuello.y) / 2 }, { x: 0, y: def.cuello.y - 20 }], def.cuello.ancho, def.cuello.color, def.trazo)
  tronco(g, def)
  // Cabeza: gira alrededor de lo alto del cuello
  const C = def.cabeza
  g.save()
  g.translate(0, def.cuello.y + pose.cabezaDy)
  g.rotate(rad(pose.cabezaRot))
  const im = imagen(C.src[pose.cara] ?? C.src.reposo)
  const ox = -C.cx, oy = -(C.cy + C.r * 0.96)
  if (im.complete && im.naturalWidth) g.drawImage(im, ox, oy, C.w, C.h)
  for (const [capa, v] of [[def.ojos, pose.ojos], [def.boca, pose.boca]] as const) {
    const src = capa?.src[v]
    if (!capa || !src) continue
    const ci = imagen(src)
    if (ci.complete && ci.naturalWidth) g.drawImage(ci, ox + capa.caja[0], oy + capa.caja[1], capa.caja[2], capa.caja[3])
  }
  const cc = mundo(ox + C.cx, oy + C.cy)
  g.restore()
  if (pose.brazoTDelante) manoT = brazo(g, def, hT, pose.brazoT, pose, 'T')
  const manoD = brazo(g, def, hD, pose.brazoD, pose, 'D')
  const mD = mundo(manoD.x, manoD.y), mT = mundo(manoT.x, manoT.y)
  g.restore()
  return { manoD: mD, manoT: mT, cabeza: { ...cc, r: C.r * s } }
}
