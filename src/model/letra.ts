// Letra a mano como la de «Estoy Tiesa»: rotulador de trazo uniforme y puntas redondas, mayúsculas
// irregulares (cada letra un poco torcida y a su altura), la «i» siempre minúscula, colores puros y
// sin borde blanco. Se va escribiendo letra a letra (≈ 0,04 s por letra).

export const LETRA_MANO = "'Coming Soon', 'Comic Sans MS', cursive"
export const COLORES_MANO: Record<string, string> = { negro: '#141414', rojo: '#EE1B24', verde: '#1FC73A', azul: '#1E5BFF' }

/** Mayúsculas con la «i» minúscula, como escribe ella («DEPRECiACiÓN», «TODOiNCLUiDO»). */
export function aSuManera(texto: string) {
  return texto.toUpperCase().replace(/I/g, 'i').replace(/Í/g, 'í')
}

function azar(sem: number, n: number) {
  const x = Math.sin(sem * 12.9898 + n * 78.233) * 43758.5453
  return x - Math.floor(x) // 0..1
}

/** Ancho que ocupa el texto a ese tamaño (con las letras un poco estiradas a lo alto). */
export function medirMano(g: CanvasRenderingContext2D, texto: string, tam: number) {
  g.save()
  g.font = `400 ${tam}px ${LETRA_MANO}`
  const w = [...texto].reduce((a, l) => a + g.measureText(l).width + tam * 0.05, 0) + tam * 0.1
  g.restore()
  return w
}

/**
 * Escribe el texto centrado en (x, y). «avance» 0..1 = qué parte del texto ya está escrita.
 * Devuelve el ancho total.
 */
export function escribirMano(g: CanvasRenderingContext2D, texto: string, x: number, y: number, tam: number, color: string, avance: number, sem: number) {
  const letras = [...texto]
  g.save()
  g.font = `400 ${tam}px ${LETRA_MANO}`
  g.textBaseline = 'middle'
  g.textAlign = 'left'
  g.fillStyle = color
  g.strokeStyle = color
  g.lineWidth = tam * 0.06
  g.lineJoin = 'round'
  g.lineCap = 'round'
  // Un halo blanco muy suave para que se lea encima de un fondo dibujado (en blanco no se nota)
  g.shadowColor = 'rgba(255,255,255,0.85)'
  g.shadowBlur = tam * 0.12
  const anchos = letras.map((l) => g.measureText(l).width + tam * 0.05)
  const total = anchos.reduce((a, b) => a + b, 0)
  const visibles = Math.ceil(letras.length * Math.max(0, Math.min(1, avance)))
  let cx = x - total / 2
  for (let i = 0; i < letras.length; i++) {
    const l = letras[i]
    if (i < visibles && l.trim()) {
      g.save()
      g.translate(cx + anchos[i] / 2, y + (azar(sem, i) - 0.5) * tam * 0.1)
      g.rotate((azar(sem, i + 50) - 0.5) * 0.16)
      const k = 0.94 + azar(sem, i + 99) * 0.12
      g.scale(k, k * 1.12)
      g.strokeText(l, -anchos[i] / 2, 0)
      g.fillText(l, -anchos[i] / 2, 0)
      g.restore()
    }
    cx += anchos[i]
  }
  g.restore()
  return total
}

/** Subrayado a mano (se dibuja de izquierda a derecha con «avance»). */
export function subrayarMano(g: CanvasRenderingContext2D, x0: number, x1: number, y: number, grosor: number, color: string, avance: number, sem: number) {
  if (avance <= 0) return
  g.save()
  g.strokeStyle = color
  g.lineWidth = grosor
  g.lineCap = 'round'
  g.beginPath()
  const pasos = 16
  for (let i = 0; i <= pasos * Math.min(1, avance); i++) {
    const u = i / pasos
    const px = x0 + (x1 - x0) * u
    const py = y + Math.sin(u * Math.PI) * grosor * (azar(sem, 7) - 0.5) * 3 + u * grosor * (azar(sem, 8) - 0.5) * 2
    if (i === 0) g.moveTo(px, py)
    else g.lineTo(px, py)
  }
  g.stroke()
  g.restore()
}

/** Cuánto lleva escrito un texto que empezó hace «dt» segundos (≈ 0,04 s por letra, máx. 0,5 s). */
export function avanceEscritura(texto: string, dt: number) {
  const dur = Math.min(0.5, Math.max(0.12, texto.length * 0.04))
  return Math.max(0, Math.min(1, dt / dur))
}
