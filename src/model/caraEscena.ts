// ESCENAS DIBUJADAS CON EL PROTAGONISTA DENTRO (método de Estoy Tiesa: cada plano es un dibujo nuevo con
// el personaje en la situación, quieto en su postura, y solo se le mueve la boca). La cabeza magenta del
// chico rosa es un color que no tiene nada más en el dibujo: con ella se encuentra su cara en cualquier
// escena que dibuje la IA, se borra la boca dibujada y luego se pinta encima una boca que habla con la voz
// y unos parpadeos.

export interface CaraEscena {
  /** Cabeza (centro y radio) en píxeles de la imagen */
  cx: number
  cy: number
  r: number
  /** Centro de la boca */
  mx: number
  my: number
  /** Ojos (cajas de lo blanco) */
  ojos: { x: number; y: number; w: number; h: number }[]
  /** Color de la cabeza */
  color: [number, number, number]
}

const esMagenta = (r: number, g: number, b: number) => r > 165 && g < 125 && b > 125 && r - g > 85

/** Busca la cabeza magenta más grande, borra la boca dibujada y devuelve la imagen limpia y la cara. */
export async function analizarCara(bmp: ImageBitmap): Promise<{ blob: Blob; cara: CaraEscena } | null> {
  const W = bmp.width, H = bmp.height
  const c = new OffscreenCanvas(W, H)
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(bmp, 0, 0)
  const img = g.getImageData(0, 0, W, H)
  const d = img.data
  const mag = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) if (esMagenta(d[i * 4], d[i * 4 + 1], d[i * 4 + 2])) mag[i] = 1
  // Mancha magenta más grande (a saltos de 2 px para ir rápido)
  const vista = new Uint8Array(W * H)
  let mejor: { n: number; x0: number; x1: number; y0: number; y1: number } | null = null
  for (let y = 0; y < H; y += 2)
    for (let x = 0; x < W; x += 2) {
      const p0 = y * W + x
      if (!mag[p0] || vista[p0]) continue
      const pila = [p0]
      vista[p0] = 1
      let n = 0, x0 = x, x1 = x, y0 = y, y1 = y
      while (pila.length) {
        const p = pila.pop()!
        n++
        const px = p % W, py = (p - px) / W
        if (px < x0) x0 = px
        if (px > x1) x1 = px
        if (py < y0) y0 = py
        if (py > y1) y1 = py
        for (const q of [px > 0 ? p - 1 : -1, px < W - 1 ? p + 1 : -1, p - W, p + W])
          if (q >= 0 && q < W * H && mag[q] && !vista[q]) {
            vista[q] = 1
            pila.push(q)
          }
      }
      if (!mejor || n > mejor.n) mejor = { n, x0, x1, y0, y1 }
    }
  if (!mejor || mejor.n < 1500) return null
  // La cabeza es lo redondo de ARRIBA de la mancha (a veces el cuello y los brazos magenta van pegados):
  // se baja fila a fila desde arriba; la cabeza acaba donde, pasado lo más ancho, se estrecha (el cuello)
  const anchoFila = (y: number) => {
    let a = -1, b = -1
    for (let x = mejor!.x0; x <= mejor!.x1; x++) if (mag[y * W + x]) (a < 0 && (a = x), (b = x))
    return a < 0 ? { w: 0, a: 0, b: 0 } : { w: b - a + 1, a, b }
  }
  let maxW = 0, maxY = mejor.y0, fondo = mejor.y1, ma = 0, mb = 0
  for (let y = mejor.y0; y <= mejor.y1; y++) {
    const f = anchoFila(y)
    if (f.w > maxW) {
      maxW = f.w; maxY = y; ma = f.a; mb = f.b
    } else if (maxW > 40 && y > maxY + maxW * 0.25 && f.w < maxW * 0.45) {
      fondo = y
      break
    }
  }
  const r = Math.max(maxW / 2, (fondo - mejor.y0) / 2.05)
  const cx = (ma + mb) / 2, cy = mejor.y0 + r
  if (r < 20) return null
  // Color de la cabeza (media de lo magenta de dentro)
  let sr = 0, sg = 0, sb = 0, sn = 0
  for (let y = Math.round(cy - r * 0.8); y < cy + r * 0.8; y += 3)
    for (let x = Math.round(cx - r * 0.8); x < cx + r * 0.8; x += 3) {
      const p = y * W + x
      if (x < 0 || y < 0 || x >= W || y >= H || !mag[p]) continue
      sr += d[p * 4]; sg += d[p * 4 + 1]; sb += d[p * 4 + 2]; sn++
    }
  const color: [number, number, number] = sn ? [Math.round(sr / sn), Math.round(sg / sn), Math.round(sb / sn)] : [218, 59, 185]
  const dentro = (x: number, y: number, k: number) => Math.hypot(x - cx, y - cy) < r * k
  // Aro de la nariz (dorado): la boca empieza por debajo
  let aro = -1
  for (let y = Math.round(cy - r * 0.2); y < cy + r * 0.5; y++)
    for (let x = Math.round(cx - r * 0.35); x < cx + r * 0.35; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue
      const p = (y * W + x) * 4
      if (d[p] > 185 && d[p + 1] > 135 && d[p + 2] < 115) aro = Math.max(aro, y)
    }
  const desde = Math.max(aro >= 0 ? aro + 4 : cy + r * 0.12, cy + r * 0.02)
  // Ojos: lo blanco dentro de la cabeza por encima de la boca
  const blanco = (p: number) => Math.min(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]) > 212
  const vistoB = new Uint8Array(W * H)
  const ojos: CaraEscena['ojos'] = []
  for (let y = Math.round(cy - r * 0.8); y < desde; y += 2)
    for (let x = Math.round(cx - r * 0.9); x < cx + r * 0.9; x += 2) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue
      const p0 = y * W + x
      if (!blanco(p0) || vistoB[p0] || !dentro(x, y, 0.95)) continue
      const pila = [p0]
      vistoB[p0] = 1
      let n = 0, x0 = x, x1 = x, y0 = y, y1 = y
      while (pila.length) {
        const p = pila.pop()!
        n++
        const px = p % W, py = (p - px) / W
        if (px < x0) x0 = px
        if (px > x1) x1 = px
        if (py < y0) y0 = py
        if (py > y1) y1 = py
        for (const q of [p - 1, p + 1, p - W, p + W]) if (q >= 0 && q < W * H && !vistoB[q] && blanco(q) && dentro(q % W, Math.floor(q / W), 1.05)) {
          vistoB[q] = 1
          pila.push(q)
        }
      }
      if (n > r * r * 0.02 && n < r * r * 0.8) ojos.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 })
    }
  ojos.sort((a, b) => b.w * b.h - a.w * a.h)
  // Boca dibujada: lo que no es magenta en la parte de abajo de la cara → color de la cabeza
  let bx = 0, by = 0, bn = 0
  for (let y = Math.round(desde); y < cy + r * 0.85; y++)
    for (let x = Math.round(cx - r * 0.62); x < cx + r * 0.62; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H || !dentro(x, y, 0.86)) continue
      const p = y * W + x
      if (mag[p]) continue
      d[p * 4] = color[0]; d[p * 4 + 1] = color[1]; d[p * 4 + 2] = color[2]
      bx += x; by += y; bn++
    }
  g.putImageData(img, 0, 0)
  const mx = bn > 40 ? bx / bn : cx
  const my = bn > 40 ? by / bn : desde + r * 0.25
  return { blob: await c.convertToBlob({ type: 'image/jpeg', quality: 0.92 }), cara: { cx, cy, r, mx, my: Math.min(my, cy + r * 0.62), ojos: ojos.slice(0, 2), color } }
}

/**
 * Pinta la boca (según la boca de la voz en ese instante) y el parpadeo sobre la escena. Se llama con el
 * contexto ya en las coordenadas de la imagen centrada (como la dibuja la capa).
 */
export function dibujarCara(g: CanvasRenderingContext2D, cara: CaraEscena, w: number, h: number, boca: string, parpadea: boolean) {
  const { r, mx, my, color } = cara
  const ox = -w / 2, oy = -h / 2
  const tinta = '#151015'
  const grosor = Math.max(2, r * 0.05)
  g.save()
  g.translate(ox, oy)
  g.lineCap = 'round'
  g.lineJoin = 'round'
  if (parpadea)
    for (const o of cara.ojos) {
      g.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`
      g.beginPath()
      g.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w * 0.62, o.h * 0.62, 0, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = tinta
      g.lineWidth = grosor
      g.beginPath()
      g.moveTo(o.x - o.w * 0.05, o.y + o.h * 0.55)
      g.quadraticCurveTo(o.x + o.w / 2, o.y + o.h * 0.8, o.x + o.w * 1.05, o.y + o.h * 0.55)
      g.stroke()
    }
  // Boca cerrada: se ve la que dibujó la IA (la imagen original), aquí no se pinta nada
  if (boca === 'nada') {
    g.restore()
    return
  }
  g.strokeStyle = tinta
  g.lineWidth = grosor
  const abierta = boca === 'abierta' || boca === 'A' || boca === 'dientes'
  if (!abierta && boca !== 'O' && boca !== 'o' && boca !== 'E') {
    // Cerrada: una sonrisa leve hecha a mano
    g.beginPath()
    g.moveTo(mx - r * 0.22, my - r * 0.02)
    g.quadraticCurveTo(mx, my + r * 0.09, mx + r * 0.22, my - r * 0.03)
    g.stroke()
  } else {
    const [ww, hh] = boca === 'O' || boca === 'o' ? [0.11, 0.13] : boca === 'E' ? [0.23, 0.09] : [0.21, 0.16]
    g.fillStyle = '#5a1928'
    g.beginPath()
    g.ellipse(mx, my + hh * r * 0.35, ww * r, hh * r, 0, 0, Math.PI * 2)
    g.fill()
    if (abierta) {
      g.save()
      g.clip()
      g.fillStyle = '#e15f6e'
      g.beginPath()
      g.ellipse(mx, my + hh * r * 1.15, ww * r * 0.7, hh * r * 0.55, 0, 0, Math.PI * 2)
      g.fill()
      g.restore()
    }
    g.beginPath()
    g.ellipse(mx, my + hh * r * 0.35, ww * r, hh * r, 0, 0, Math.PI * 2)
    g.stroke()
  }
  g.restore()
}
