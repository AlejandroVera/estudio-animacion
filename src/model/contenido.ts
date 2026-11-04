// Contenido de cada viñeta al estilo «Estoy Tiesa»: con el personaje a un lado, el otro lado se va
// llenando palabra a palabra (palabras grandes, notas subrayadas en color, cartelitos con cifras,
// dibujos, bocadillos de pensamiento y flechas a mano) y se borra de golpe al cortar. Si no hay
// viñetas con lado (vídeo vertical, proyectos antiguos), se usan los sitios fijos de siempre.

import { mediaUrl } from '../audio/storage'
import type { Objeto, Project, Rotulo } from './types'
import { aSuManera, avanceEscritura, COLORES_MANO, escribirMano, medirMano, subrayarMano } from './letra'

const COLORES: Record<string, string> = { negro: '#141414', rojo: '#EE1B24', verde: '#1FC73A', azul: '#1E5BFF' }

type Imagenes = (src: string) => HTMLImageElement

/** Número fijo a partir de un texto (para que cada elemento tenga su «torcido» a mano siempre igual). */
function semilla(id: string) {
  let s = 0
  for (const ch of id) s = (s * 31 + ch.charCodeAt(0)) % 9973
  return s
}

/** Escala de la entrada: aparece de golpe con un pequeño rebote (0,15 s). */
function pop(dt: number) {
  return dt < 0.07 ? 0.7 + (1.12 - 0.7) * (dt / 0.07) : dt < 0.15 ? 1.12 - 0.12 * ((dt - 0.07) / 0.08) : 1
}

type Elemento =
  | { tipo: 'rotulo'; r: Rotulo; t: number; alto: number }
  | { tipo: 'objeto'; o: Objeto; t: number; alto: number }

/** Dibuja el contenido (fuera de la cámara). Devuelve true si ha usado la composición por viñetas. */
export function drawContenido(g: CanvasRenderingContext2D, project: Project, t: number, img: Imagenes) {
  const W = project.width
  const H = project.height
  const k = (project.vinetas ?? []).findIndex((v) => t >= v.t && t < v.fin)
  const v = k >= 0 ? project.vinetas![k] : undefined
  if (!v || v.lado === 'centro' || W <= H * 1.1) return false

  // Lado libre: el contrario al personaje
  const x0 = v.lado === 'izq' ? W * 0.47 : W * 0.04
  const x1 = v.lado === 'izq' ? W * 0.96 : W * 0.53
  const y0 = H * 0.07
  const y1 = H * 0.93
  const cabeza = { x: v.lado === 'izq' ? W * 0.27 : W * 0.73, y: H * 0.24 }

  // Todo lo de esta viñeta (también lo que aún no ha salido: así nada se mueve al ir apareciendo)
  const els: Elemento[] = []
  for (const r of project.rotulos ?? []) {
    if (r.vin !== k) continue
    const alto = r.estilo === 'grande' ? H * 0.17 : r.estilo === 'cartel' ? H * 0.13 : H * 0.13
    els.push({ tipo: 'rotulo', r, t: r.t, alto })
  }
  for (const o of project.objetos ?? []) {
    if (o.vin !== k) continue
    els.push({ tipo: 'objeto', o, t: o.t, alto: o.pos === 'pensamiento' ? H * 0.34 : H * 0.26 })
  }
  if (!els.length) return true
  els.sort((a, b) => a.t - b.t)
  // Los bocadillos van arriba del todo (junto a la cabeza)
  els.sort((a, b) => Number(b.tipo === 'objeto' && b.o.pos === 'pensamiento') - Number(a.tipo === 'objeto' && a.o.pos === 'pensamiento'))
  const hueco = H * 0.025
  const total = els.reduce((s, e) => s + e.alto, 0) + hueco * (els.length - 1)
  // Con pocos elementos se agrandan (una nota sola no puede quedar diminuta en un lado vacío)
  const f = Math.min(1.7, (y1 - y0) / total)
  let y = y0 + Math.max(0, (y1 - y0 - total * f) / 2)
  const sitios: { e: Elemento; x: number; y: number; w: number; h: number }[] = []
  for (const e of els) {
    const h = e.alto * f
    const sem = semilla(e.tipo === 'rotulo' ? e.r.id : e.o.id)
    // Un poco torcidos a izquierda o derecha, como colocados a mano
    const ancho = x1 - x0
    const w = ancho * 0.86
    const cx = Math.max(x0 + w / 2, Math.min(x1 - w / 2, x0 + ancho / 2 + (((sem % 7) - 3) / 3) * ancho * 0.06))
    sitios.push({ e, x: cx, y: y + h / 2, w, h })
    y += h + hueco * f
  }

  sitios.forEach((s, i) => {
    if (t < s.e.t) return
    const dt = t - s.e.t
    const flecha = s.e.tipo === 'rotulo' ? s.e.r.flecha : s.e.o.flecha
    if (flecha) {
      // Desde lo anterior (o desde el personaje si es lo primero) hasta este elemento, dibujándose
      const prev = sitios[i - 1]
      const desde = prev ? { x: prev.x + (v.lado === 'izq' ? -1 : 1) * prev.w * 0.25, y: prev.y + prev.h * 0.4 } : { x: cabeza.x + (v.lado === 'izq' ? 1 : -1) * W * 0.08, y: s.y }
      const hasta = { x: s.x + (v.lado === 'izq' ? -1 : 1) * s.w * 0.3, y: s.y }
      dibujarFlecha(g, desde, hasta, Math.min(1, dt / 0.25), H, semilla(s.e.tipo === 'rotulo' ? s.e.r.id : s.e.o.id))
    }
    if (s.e.tipo === 'rotulo') dibujarRotulo(g, s.e.r, s.x, s.y, s.w, s.h, dt)
    else dibujarObjeto(g, s.e.o, s.x, s.y, s.w, s.h, pop(dt), img, s.e.o.pos === 'pensamiento' ? cabeza : null)
  })
  return true
}

function dibujarRotulo(g: CanvasRenderingContext2D, r: Rotulo, x: number, y: number, maxW: number, h: number, dt: number) {
  const estilo = r.estilo ?? 'nota'
  const color = estilo === 'grande' ? COLORES_MANO.negro : COLORES_MANO[r.color] ?? COLORES_MANO.negro
  const texto = aSuManera(r.texto)
  const sem = semilla(r.id)
  const base = Math.round(h * (estilo === 'grande' ? 0.8 : estilo === 'cartel' ? 0.5 : 0.62))
  const maxTexto = estilo === 'cartel' ? maxW * 0.8 : maxW
  // Tamaño que cabe en una línea y en dos (partiendo por la mitad de las palabras): gana el más grande
  const cabe = (lineas: string[], tope: number) => {
    let t = tope
    while (Math.max(...lineas.map((l) => medirMano(g, l, t))) > maxTexto && t > 20) t -= 3
    return t
  }
  const palabras = texto.split(/\s+/)
  let lineas = [texto]
  let tam = cabe(lineas, base)
  if (palabras.length > 1) {
    const mitad = Math.ceil(palabras.length / 2)
    const dos = [palabras.slice(0, mitad).join(' '), palabras.slice(mitad).join(' ')]
    const tam2 = cabe(dos, Math.round(base * 0.62))
    if (tam2 > tam * 1.15) {
      lineas = dos
      tam = tam2
    }
  }
  const ancho = Math.max(...lineas.map((l) => medirMano(g, l, tam)))
  const alto = tam * 1.15 * lineas.length
  const avance = avanceEscritura(texto, dt)
  g.save()
  g.translate(x, y)
  g.rotate((((sem % 7) - 3) * Math.PI) / 180)
  if (estilo === 'cartel') {
    // Cartelito con borde a mano (aparece de golpe y luego se escribe dentro)
    const k = pop(dt)
    g.save()
    g.scale(k, k)
    const pw = ancho + tam * 0.9, ph = alto + tam * 0.45
    g.fillStyle = r.color === 'verde' ? '#FFD84A' : '#FFF3C4'
    g.strokeStyle = '#141414'
    g.lineWidth = Math.max(3, tam * 0.06)
    g.lineJoin = 'round'
    trazoTorcido(g, -pw / 2, -ph / 2, pw, ph, sem)
    g.fill()
    g.stroke()
    g.restore()
  }
  // Cada línea se escribe después de la anterior
  lineas.forEach((l, i) => {
    const parte = Math.max(0, Math.min(1, avance * lineas.length - i))
    const ly = (i - (lineas.length - 1) / 2) * tam * 1.15
    escribirMano(g, l, 0, ly, tam, estilo === 'cartel' ? COLORES_MANO.negro : color, parte, sem + i * 17)
  })
  if (estilo === 'nota') subrayarMano(g, -ancho / 2, ancho / 2, alto / 2 + tam * 0.08, Math.max(3, tam * 0.07), color, (dt - 0.4) / 0.15, sem)
  g.restore()
}

/** Rectángulo con los lados un poco torcidos (dibujado a mano). */
function trazoTorcido(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sem: number) {
  const j = (n: number) => (((sem * (n + 3)) % 7) - 3) * Math.min(w, h) * 0.012
  g.beginPath()
  g.moveTo(x + j(1), y + j(2))
  g.lineTo(x + w + j(3), y + j(4))
  g.lineTo(x + w + j(5), y + h + j(6))
  g.lineTo(x + j(7), y + h + j(8))
  g.closePath()
}

function dibujarObjeto(
  g: CanvasRenderingContext2D,
  o: Objeto,
  x: number,
  y: number,
  maxW: number,
  h: number,
  escala: number,
  img: Imagenes,
  cabeza: { x: number; y: number } | null,
) {
  const url = mediaUrl(o.imageId)
  const im = url ? img(url) : null
  g.save()
  g.translate(x, y)
  g.scale(escala, escala)
  if (cabeza) {
    // Bocadillo de pensamiento: nube blanca con borde y bolitas hacia la cabeza
    const bw = Math.min(maxW * 0.75, h * 1.5), bh = h
    g.fillStyle = '#FFFFFF'
    g.strokeStyle = '#262020'
    g.lineWidth = Math.max(3, h * 0.018)
    nube(g, bw, bh, semilla(o.id))
    g.fill()
    g.stroke()
    const hacia = { x: (cabeza.x - x) / escala, y: (cabeza.y - y) / escala }
    for (const [f, r] of [[0.62, bh * 0.07], [0.76, bh * 0.05], [0.88, bh * 0.035]] as const) {
      g.beginPath()
      g.ellipse(hacia.x * f, Math.max(bh * 0.45, hacia.y * f + bh * 0.3), r * 1.2, r, 0, 0, Math.PI * 2)
      g.fill()
      g.stroke()
    }
    if (im?.complete && im.naturalWidth) {
      const kk = Math.min((bw * 0.62) / o.w, (bh * 0.62) / o.h)
      g.drawImage(im, (-o.w / 2) * kk, (-o.h / 2) * kk, o.w * kk, o.h * kk)
    }
  } else if (im?.complete && im.naturalWidth) {
    const kk = Math.min(maxW / o.w, h / o.h)
    g.rotate((((semilla(o.id) % 9) - 4) * Math.PI) / 180)
    g.drawImage(im, (-o.w / 2) * kk, (-o.h / 2) * kk, o.w * kk, o.h * kk)
  }
  g.restore()
}

/** Contorno de nube (bocadillo de pensamiento), centrado en 0,0. */
function nube(g: CanvasRenderingContext2D, w: number, h: number, sem: number) {
  const n = 11
  g.beginPath()
  for (let i = 0; i <= n; i++) {
    const a0 = (i / n) * Math.PI * 2
    const a1 = ((i + 1) / n) * Math.PI * 2
    const p0 = { x: Math.cos(a0) * w * 0.5, y: Math.sin(a0) * h * 0.5 }
    const p1 = { x: Math.cos(a1) * w * 0.5, y: Math.sin(a1) * h * 0.5 }
    const am = (a0 + a1) / 2
    const bulto = 1.22 + (((sem * (i + 1)) % 5) - 2) * 0.03
    const c = { x: Math.cos(am) * w * 0.5 * bulto, y: Math.sin(am) * h * 0.5 * bulto }
    if (i === 0) g.moveTo(p0.x, p0.y)
    if (i < n) g.quadraticCurveTo(c.x, c.y, p1.x, p1.y)
  }
  g.closePath()
}

/** Flecha roja a mano, que se dibuja de golpe en 0,25 s (avance 0..1). */
function dibujarFlecha(g: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, avance: number, H: number, sem: number) {
  const c = { x: (a.x + b.x) / 2 + (((sem % 5) - 2) * H) / 60, y: Math.min(a.y, b.y) - H * 0.05 }
  const punto = (u: number) => ({
    x: (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * c.x + u * u * b.x,
    y: (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * c.y + u * u * b.y,
  })
  g.save()
  g.strokeStyle = COLORES.rojo
  g.lineWidth = H * 0.007
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.beginPath()
  const pasos = 24
  for (let i = 0; i <= pasos * avance; i++) {
    const p = punto(i / pasos)
    if (i === 0) g.moveTo(p.x, p.y)
    else g.lineTo(p.x, p.y)
  }
  g.stroke()
  if (avance >= 1) {
    const p = punto(1), q = punto(0.9)
    const ang = Math.atan2(p.y - q.y, p.x - q.x)
    const L = H * 0.03
    g.beginPath()
    g.moveTo(p.x - Math.cos(ang - 0.5) * L, p.y - Math.sin(ang - 0.5) * L)
    g.lineTo(p.x, p.y)
    g.lineTo(p.x - Math.cos(ang + 0.5) * L, p.y - Math.sin(ang + 0.5) * L)
    g.stroke()
  }
  g.restore()
}
