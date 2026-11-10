// VARIANTES ESTABLES DE UN PLANO (animación dentro de una escena dibujada, como Estoy Tiesa): se pide a la IA
// el mismo dibujo con un cambio (la boca abierta, otra pose) y de su respuesta se copia SOLO lo que cambia
// sobre el dibujo anterior. Así el fondo y lo demás quedan idénticos al píxel y nada «salta»: solo se mueve
// lo que tiene que moverse.

import { formatoDe } from './images'
import { analizarCara, type CaraEscena } from '../model/caraEscena'
import type { Project } from '../model/types'

/** Un dibujo en su tamaño original: la respuesta de fal (para compararla con sus ediciones) y el compuesto estable. */
export interface Crudo {
  url: string
  fal: ImageBitmap
  comp: OffscreenCanvas
  cara?: CaraEscena | null
  /** La boca abierta de este dibujo (máscara y de dónde se copia), para reutilizarla si la cabeza no cambia */
  boca?: { mascara: OffscreenCanvas; de: ImageBitmap }
}

export async function crudoDeUrl(url: string): Promise<Crudo> {
  const r = await fetch(url)
  if (!r.ok) throw new Error('No se pudo descargar el dibujo.')
  const fal = await createImageBitmap(await r.blob())
  const comp = new OffscreenCanvas(fal.width, fal.height)
  comp.getContext('2d')!.drawImage(fal, 0, 0)
  return { url, fal, comp }
}

/** Pide a fal una edición del dibujo. */
export async function editar(url: string, cambio: string, project: Project): Promise<{ url: string; bmp: ImageBitmap }> {
  const ref = project.characters[project.instances[0]?.characterId]?.referencia
  const res = await fetch('/api/imagen', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tipo: 'libre',
      formato: formatoDe(project),
      referencia: url,
      // Su dibujo de referencia, para que al redibujarle la cara no se le deforme (aro, ojos, cabeza redonda)
      ...(ref ? { referencias: [location.origin + ref] } : {}),
      descripcion: `Edit the first image. Keep EVERYTHING else identical, pixel for pixel: same framing, same background, same characters in the same places and sizes, same style, colors and clean line work. Change ONLY this: ${cambio}. ${ref ? 'The magenta boy must stay exactly on model, like in the second image: perfectly round flat magenta head of the same size and position, the same simple round eyes with black outline, the small golden septum ring, clean black outlines, no smudges, NO wrinkles, eye bags, shading or extra lines on his face whatever the emotion (only eyes, two thin eyebrows, ring and mouth). Add nothing that is not asked (no new objects, symbols or icons). ' : ''}No text.`,
    }),
  })
  const d = await res.json().catch(() => ({}))
  if (!res.ok || !d.url) throw new Error(d.error ?? `Error ${res.status}`)
  const r = await fetch(d.url)
  if (!r.ok) throw new Error('No se pudo descargar el dibujo.')
  return { url: d.url, bmp: await createImageBitmap(await r.blob()) }
}

type Circulo = { x: number; y: number; r: number }

/**
 * Máscara (canal alfa, bordes suaves) de lo que cambia entre dos dibujos del mismo tamaño. Por bloques de
 * 8 px: cambia si la diferencia media pasa de un umbral; se quitan los bloques sueltos (ruido de la IA) y
 * se ensancha un poco. `dentro` limita a un círculo (la cara); `fuera` lo excluye.
 */
export function mascaraDeCambio(a: CanvasImageSource, b: CanvasImageSource, W: number, H: number, opc: { dentro?: Circulo; fuera?: Circulo; desdeY?: number; semilla?: { x: number; y: number } } = {}) {
  const B = 8
  const w = Math.ceil(W / B), h = Math.ceil(H / B)
  const leer = (im: CanvasImageSource) => {
    const c = new OffscreenCanvas(W, H)
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.drawImage(im, 0, 0, W, H)
    return g.getImageData(0, 0, W, H).data
  }
  const da = leer(a), db = leer(b)
  const dif = new Float32Array(w * h)
  for (let by = 0; by < h; by++)
    for (let bx = 0; bx < w; bx++) {
      let s = 0, n = 0
      for (let y = by * B; y < Math.min(H, by * B + B); y += 2)
        for (let x = bx * B; x < Math.min(W, bx * B + B); x += 2) {
          const i = (y * W + x) * 4
          s += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])
          n++
        }
      dif[by * w + bx] = s / (n * 3)
    }
  let m = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const cx = ((i % w) + 0.5) * B, cy = (Math.floor(i / w) + 0.5) * B
    if (opc.desdeY !== undefined && cy - B / 2 < opc.desdeY) continue
    if (opc.dentro && Math.hypot(cx - opc.dentro.x, cy - opc.dentro.y) > opc.dentro.r) continue
    if (opc.fuera && Math.hypot(cx - opc.fuera.x, cy - opc.fuera.y) < opc.fuera.r) continue
    if (dif[i] > 20) m[i] = 1
  }
  // Fuera los bloques sueltos; luego se ensancha dos veces
  const vecinos = (src: Uint8Array, i: number) => {
    const x = i % w, y = Math.floor(i / w)
    let n = 0
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue
        const xx = x + dx, yy = y + dy
        if (xx >= 0 && yy >= 0 && xx < w && yy < h && src[yy * w + xx]) n++
      }
    return n
  }
  m = m.map((v, i) => (v && vecinos(m, i) >= 2 ? 1 : 0))
  for (let k = 0; k < 2; k++) m = m.map((v, i) => (v || vecinos(m, i) >= 1 ? 1 : 0))
  // Solo la mancha de cambio más cercana a un punto (la boca): lo demás que haya cambiado (ojos, cejas) queda
  // fuera aunque la geometría de la cara esté mal medida
  if (opc.semilla) {
    const sx = opc.semilla.x / B, sy = opc.semilla.y / B
    let mejor = -1, dm = Infinity
    for (let i = 0; i < w * h; i++) {
      if (!m[i]) continue
      const d = Math.hypot((i % w) + 0.5 - sx, Math.floor(i / w) + 0.5 - sy)
      if (d < dm) { dm = d; mejor = i }
    }
    const comp = new Uint8Array(w * h)
    if (mejor >= 0) {
      const pila = [mejor]
      comp[mejor] = 1
      while (pila.length) {
        const i = pila.pop()!
        const x = i % w, y = Math.floor(i / w)
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx, yy = y + dy, j = yy * w + xx
          if (xx >= 0 && yy >= 0 && xx < w && yy < h && m[j] && !comp[j]) { comp[j] = 1; pila.push(j) }
        }
      }
    }
    m = comp
  }
  let cuenta = 0
  const peq = new OffscreenCanvas(w, h)
  const gp = peq.getContext('2d')!
  const id = gp.createImageData(w, h)
  for (let i = 0; i < w * h; i++) {
    if (m[i]) cuenta++
    id.data[i * 4 + 3] = m[i] ? 255 : 0
  }
  gp.putImageData(id, 0, 0)
  const mascara = new OffscreenCanvas(W, H)
  const gm = mascara.getContext('2d')!
  gm.imageSmoothingEnabled = true
  gm.imageSmoothingQuality = 'high'
  gm.drawImage(peq, 0, 0, W, H)
  return { mascara, fraccion: cuenta / (w * h), bloques: m, w, h, B }
}

/** Copia sobre `base` lo de `nuevo` que cae dentro de la máscara. */
export function componer(base: CanvasImageSource, nuevo: CanvasImageSource, mascara: OffscreenCanvas, W: number, H: number) {
  const parche = new OffscreenCanvas(W, H)
  const gp = parche.getContext('2d')!
  gp.drawImage(nuevo, 0, 0, W, H)
  gp.globalCompositeOperation = 'destination-in'
  gp.drawImage(mascara, 0, 0)
  const out = new OffscreenCanvas(W, H)
  const g = out.getContext('2d')!
  g.drawImage(base, 0, 0, W, H)
  g.drawImage(parche, 0, 0)
  return out
}

const BOCA =
  "the mouth of the magenta round-headed boy: now OPEN as if he is talking mid-word (a simple open cartoon mouth, dark inside with a bit of tongue, drawn in the same line style), keeping exactly the same eyes, eyebrows and emotion"

/** El mismo dibujo con la boca del protagonista abierta (solo cambia la boca). null si él no sale. */
export async function conBocaAbierta(c: Crudo, project: Project): Promise<OffscreenCanvas | null> {
  const W = c.fal.width, H = c.fal.height
  if (c.cara === undefined) c.cara = (await analizarCara(c.fal).catch(() => null))?.cara ?? null
  if (!c.cara) return null
  const ed = await editar(c.url, BOCA, project)
  // Zona justa alrededor de la boca que tenía dibujada (no media cara)
  const zona = { x: c.cara.mx, y: c.cara.my, r: c.cara.r * 0.55 }
  // Solo la boca: por debajo de los ojos (la IA al abrirle la boca le cambiaba también los ojos y, al hablar,
  // parpadeaban entre dos miradas en cada sílaba)
  const ojos = c.cara.ojos
  // … y por debajo del aro de la nariz (también cambiaba de un dibujo a otro y «temblaba» al hablar)
  const desdeY = Math.max(c.cara.bocaY ?? 0, ojos.length ? Math.max(...ojos.map((o) => o.y + o.h)) + c.cara.r * 0.05 : c.cara.cy + c.cara.r * 0.12)
  const m = mascaraDeCambio(c.fal, ed.bmp, W, H, { dentro: zona, desdeY, semilla: { x: c.cara.mx, y: c.cara.my } })
  if (m.fraccion <= 0) return null
  // Corte limpio por arriba: el borde suave de la máscara no mezcla (emborrona) lo que hay encima de la boca
  m.mascara.getContext('2d')!.clearRect(0, 0, W, Math.floor(desdeY))
  c.boca = { mascara: m.mascara, de: ed.bmp }
  return componer(c.comp, ed.bmp, m.mascara, W, H)
}

/**
 * Un cambio de pose del mismo plano: devuelve el dibujo nuevo (estable: solo cambia lo que cambia) y, si la
 * cabeza del protagonista no se ha tocado, su versión con la boca abierta reutilizando la del anterior.
 */
export async function conCambio(prev: Crudo, cambio: string, project: Project): Promise<{ crudo: Crudo; abierta: OffscreenCanvas | null }> {
  const W = prev.fal.width, H = prev.fal.height
  const ed = await editar(prev.url, `${cambio}. Same camera; nobody moves to another spot or turns around: each person stays where they are, facing the same way, and only their arms, pose and face change. The magenta round-headed boy keeps a small closed mouth (a short simple line) and magenta skin`, project)
  const m = mascaraDeCambio(prev.fal, ed.bmp, W, H)
  // Si la IA lo ha redibujado casi todo, no hay nada «estable» que conservar: se usa su dibujo tal cual
  const todo = m.fraccion > 0.6
  const comp = todo ? (() => { const o = new OffscreenCanvas(W, H); o.getContext('2d')!.drawImage(ed.bmp, 0, 0, W, H); return o })() : componer(prev.comp, ed.bmp, m.mascara, W, H)
  const fal = ed.bmp.width === W && ed.bmp.height === H ? ed.bmp : await createImageBitmap(comp)
  const crudo: Crudo = { url: ed.url, fal, comp }
  // ¿Ha cambiado su cabeza? (bloques cambiados dentro del círculo de la cara)
  if (prev.cara === undefined) prev.cara = (await analizarCara(prev.fal).catch(() => null))?.cara ?? null
  let abierta: OffscreenCanvas | null = null
  if (prev.cara && prev.boca && !todo) {
    let dentro = 0, total = 0
    for (let i = 0; i < m.w * m.h; i++) {
      const cx = ((i % m.w) + 0.5) * m.B, cy = (Math.floor(i / m.w) + 0.5) * m.B
      if (Math.hypot(cx - prev.cara.cx, cy - prev.cara.cy) > prev.cara.r) continue
      total++
      if (m.bloques[i]) dentro++
    }
    if (total && dentro / total < 0.06) {
      crudo.cara = prev.cara
      crudo.boca = prev.boca
      abierta = componer(comp, prev.boca.de, prev.boca.mascara, W, H)
    }
  }
  if (!abierta) abierta = await conBocaAbierta(crudo, project).catch(() => null)
  return { crudo, abierta }
}

/** El mismo dibujo con la boca de la OTRA persona abierta (para cuando se cuenta lo que dice). */
export async function conBocaDelOtro(c: Crudo, project: Project): Promise<OffscreenCanvas | null> {
  const W = c.fal.width, H = c.fal.height
  if (c.cara === undefined) c.cara = (await analizarCara(c.fal).catch(() => null))?.cara ?? null
  const ed = await editar(c.url, 'the mouth of the OTHER person (not the magenta boy): now open as if she or he is talking, same eyes and expression. The magenta boy stays exactly the same', project)
  const m = mascaraDeCambio(c.fal, ed.bmp, W, H, c.cara ? { fuera: { x: c.cara.cx, y: c.cara.cy, r: c.cara.r * 1.1 } } : {})
  if (m.fraccion <= 0 || m.fraccion > 0.25) return null
  return componer(c.comp, ed.bmp, m.mascara, W, H)
}

/**
 * El mismo dibujo con la OTRA persona un instante después (otro gesto de lo que está haciendo): alternado con
 * el normal, hace que no se quede congelada. Devuelve también la versión con la boca de él abierta.
 */
export async function conGestoDelOtro(c: Crudo, project: Project): Promise<{ gesto: OffscreenCanvas; abierta: OffscreenCanvas | null } | null> {
  const W = c.fal.width, H = c.fal.height
  if (c.cara === undefined) c.cara = (await analizarCara(c.fal).catch(() => null))?.cara ?? null
  const ed = await editar(
    c.url,
    'the OTHER person (not the magenta boy) a moment later, like the next drawing of an animation of what she or he is doing: same place, same action, standing or sitting in exactly the same spot and FACING THE SAME WAY (never turned around, never from behind), but the arms and hands clearly moved (a different hand gesture), the head slightly tilted the other way and the facial expression a bit changed (eyebrows, mouth). The magenta boy and everything else stay exactly the same',
    project,
  )
  const m = mascaraDeCambio(c.fal, ed.bmp, W, H, c.cara ? { fuera: { x: c.cara.cx, y: c.cara.cy, r: c.cara.r * 1.1 } } : {})
  if (m.fraccion < 0.004 || m.fraccion > 0.4) return null
  const gesto = componer(c.comp, ed.bmp, m.mascara, W, H)
  return { gesto, abierta: c.boca ? componer(gesto, c.boca.de, c.boca.mascara, W, H) : null }
}

/** REVISOR: ¿tiene el dibujo fallos de composición (cara tapada o cortada, alguien delante de él, franjas…)? */
export async function revisarDibujo(url: string, descripcion: string): Promise<{ ok: boolean; fallos: string[] }> {
  try {
    const res = await fetch('/api/revisar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, descripcion }) })
    const d = await res.json()
    return res.ok && d && d.ok === false && Array.isArray(d.fallos) ? { ok: false, fallos: d.fallos } : { ok: true, fallos: [] }
  } catch {
    return { ok: true, fallos: [] }
  }
}
