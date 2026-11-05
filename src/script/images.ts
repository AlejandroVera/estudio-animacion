// Fondos generados con IA (fal.ai) en el estilo del personaje, añadidos como capas.

import type { BgLayer, Escena, Project } from '../model/types'
import { saveImage } from '../audio/storage'
import { activeCharacter, useStore } from '../store'
import { backgroundKeys, estimateDuration } from './scenes'
import { setKey } from '../model/anim'

const readPass = () => {
  try {
    return localStorage.getItem('estudio-animacion:clave') ?? ''
  } catch {
    return ''
  }
}

/** Proporción que se pide a la IA según la forma del vídeo. */
export function formatoDe(p: Project) {
  const r = p.width / p.height
  const op: [string, number][] = [['9:16', 9 / 16], ['4:5', 4 / 5], ['1:1', 1], ['16:9', 16 / 9]]
  return op.reduce((a, b) => (Math.abs(b[1] - r) < Math.abs(a[1] - r) ? b : a))[0]
}

/** Genera un fondo y lo guarda; devuelve la capa (sin añadirla al proyecto). */
export async function generateBackground(descripcion: string, project: Project, hueco?: 'izq' | 'der', variante?: number): Promise<BgLayer> {
  const ch = activeCharacter(project)
  // Fondo blanco liso: no hace falta IA
  if (/^blanco\b/i.test(descripcion.trim())) {
    const c = new OffscreenCanvas(project.width, project.height)
    const g = c.getContext('2d')!
    g.fillStyle = '#FFFFFF'
    g.fillRect(0, 0, c.width, c.height)
    const blob = await c.convertToBlob({ type: 'image/png' })
    const id = `fondo-blanco-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    await saveImage(id, blob)
    return { id, name: 'Blanco', imageId: id, w: c.width, h: c.height }
  }
  const res = await fetch('/api/imagen', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-clave-estudio': readPass() },
    body: JSON.stringify({
      descripcion,
      referencia: ch.referencia ? location.origin + ch.referencia : undefined,
      formato: formatoDe(project),
      ...(hueco ? { hueco } : {}),
      ...(variante !== undefined ? { variante } : {}),
    }),
  })
  const d = await res.json().catch(() => ({}))
  if (res.status === 401) throw new Error('Escribe la contraseña del estudio en el copiloto y vuelve a intentarlo.')
  if (!res.ok) throw new Error(d.error ?? `Error ${res.status}`)
  const img = await fetch(d.url)
  if (!img.ok) throw new Error('No se pudo descargar la imagen generada.')
  const bmp0 = await createImageBitmap(await img.blob())
  // La IA a veces deja un marco blanco alrededor: se recorta para que el dibujo llegue a los bordes
  const { blob, bmp } = await sinMarco(bmp0)
  const id = `fondo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  await saveImage(id, blob)
  const name = descripcion.length > 28 ? descripcion.slice(0, 26) + '…' : descripcion
  return { id, name, imageId: id, w: bmp.width, h: bmp.height }
}

/** Recorta las bandas casi blancas de los bordes (marco que deja a veces la IA). */
export async function sinMarco(bmp: ImageBitmap): Promise<{ blob: Blob; bmp: ImageBitmap }> {
  const W = bmp.width, H = bmp.height
  const c = new OffscreenCanvas(W, H)
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(bmp, 0, 0)
  const d = g.getImageData(0, 0, W, H).data
  // Fracción de píxeles casi blancos de una fila o columna
  const blancaFila = (y: number) => {
    let n = 0
    for (let x = 0; x < W; x += 4) if (Math.min(d[(y * W + x) * 4], d[(y * W + x) * 4 + 1], d[(y * W + x) * 4 + 2]) > 235) n++
    return n / Math.ceil(W / 4) > 0.97
  }
  const blancaCol = (x: number) => {
    let n = 0
    for (let y = 0; y < H; y += 4) if (Math.min(d[(y * W + x) * 4], d[(y * W + x) * 4 + 1], d[(y * W + x) * 4 + 2]) > 235) n++
    return n / Math.ceil(H / 4) > 0.97
  }
  let y0 = 0, y1 = H - 1, x0 = 0, x1 = W - 1
  while (y0 < H * 0.2 && blancaFila(y0)) y0++
  while (y1 > H * 0.8 && blancaFila(y1)) y1--
  while (x0 < W * 0.2 && blancaCol(x0)) x0++
  while (x1 > W * 0.8 && blancaCol(x1)) x1--
  // Un poco más hacia dentro para quitar también la línea del borde del marco
  if (y0 > 0) y0 += 6
  if (y1 < H - 1) y1 -= 6
  if (x0 > 0) x0 += 6
  if (x1 < W - 1) x1 -= 6
  if (x0 === 0 && y0 === 0 && x1 === W - 1 && y1 === H - 1) {
    return { blob: await c.convertToBlob({ type: 'image/jpeg', quality: 0.92 }), bmp }
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1
  const out = new OffscreenCanvas(w, h)
  out.getContext('2d')!.drawImage(c, x0, y0, w, h, 0, 0, w, h)
  const blob = await out.convertToBlob({ type: 'image/jpeg', quality: 0.92 })
  return { blob, bmp: await createImageBitmap(blob) }
}

/** Añade una capa al fondo (detrás de las demás capas de fondo). */
export function addLayer(layer: BgLayer) {
  const st = useStore.getState()
  st.setProjectProps({ fondos: [layer, ...(st.project.fondos ?? [])] })
}

/**
 * Fondos para las escenas: una imagen por cada fondo distinto (si una escena no describe fondo,
 * sigue el anterior). Devuelve las escenas con su capa asignada; si el guion ya está animado,
 * coloca también las capas en la línea de tiempo.
 */
export async function generateSceneBackgrounds(escenas: Escena[], onProgress: (m: string) => void): Promise<Escena[]> {
  if (!escenas.length) throw new Error('Primero prepara las escenas.')
  // Si ninguna escena describe su fondo (p. ej. «Dividir sin IA»), un único fondo sencillo que encaje
  // con lo que cuenta el guion
  if (!escenas.some((e) => e.fondo.trim())) {
    const tema = escenas.map((e) => e.dialogo).join(' ').slice(0, 400)
    escenas = escenas.map((e, i) => (i === 0 ? { ...e, fondo: `un lugar cotidiano y sencillo que encaje con lo que cuenta este texto: «${tema}»` } : e))
  }
  const grupos: { desc: string; idx: number[] }[] = []
  let actual = ''
  escenas.forEach((e, i) => {
    const desc = e.fondo.trim() || actual
    if (!desc) return
    if (desc !== actual || !grupos.length) grupos.push({ desc, idx: [i] })
    else grupos[grupos.length - 1].idx.push(i)
    actual = desc
  })
  if (!grupos.length) throw new Error('Las escenas no describen ningún fondo. Escribe uno en alguna escena o pide las escenas con IA.')

  const out = escenas.map((e) => ({ ...e }))
  const capas: BgLayer[] = []
  const fallos: string[] = []
  for (let g = 0; g < grupos.length; g++) {
    // Si ya hay un fondo con esa misma descripción, se reutiliza (no se paga otra vez)
    // Se reutiliza el fondo con la misma descripción, pero solo si tiene la misma forma que el vídeo
    const pr = useStore.getState().project
    const previa = pr.fondos?.find((l) => l.descripcion === grupos[g].desc && Math.abs(l.w / l.h - pr.width / pr.height) < 0.15)
    onProgress(previa ? `Reutilizando fondo: ${grupos[g].desc}` : `Generando fondo ${g + 1} de ${grupos.length}: ${grupos[g].desc}`)
    let layer: BgLayer
    try {
      layer = previa ?? { ...(await generateBackground(grupos[g].desc, useStore.getState().project)), descripcion: grupos[g].desc }
    } catch (e) {
      // Si un fondo falla, los demás se generan igual
      fallos.push(`«${grupos[g].desc}»: ${e instanceof Error ? e.message : e}`)
      continue
    }
    capas.push(layer)
    for (const i of grupos[g].idx) out[i].capa = layer.id
  }

  const st = useStore.getState()
  const fps = st.project.fps
  // Quita las capas de fondo de escenas anteriores que ya no se usen
  const viejas = new Set((st.project.guion?.escenas ?? []).map((e) => e.capa).filter(Boolean) as string[])
  let tracks = Object.fromEntries(
    Object.entries(st.project.instances[0].tracks).filter(([c]) => !(c.startsWith('bg:') && viejas.has(c.split(':')[1]))),
  )
  const animado = !!st.project.guion?.escenas.length
  if (animado) {
    let t = 0
    const placed = out.map((e) => {
      const p = { ...e, inicio: t }
      t += e.duracion || estimateDuration(e.dialogo)
      return p
    })
    tracks = { ...tracks, ...backgroundKeys(placed, st.project.duration, fps) }
  }
  const [inst, ...rest] = st.project.instances
  st.commit({
    ...st.project,
    fondos: [...capas, ...(st.project.fondos ?? []).filter((l) => !viejas.has(l.id) && !capas.some((c) => c.id === l.id))],
    guion: animado ? { ...st.project.guion!, escenas: out } : st.project.guion,
    instances: [{ ...inst, tracks }, ...rest],
  })
  if (fallos.length) throw new Error(`no salió ${fallos.length === 1 ? 'un fondo' : fallos.length + ' fondos'} (${fallos.join('; ')})`)
  return out
}

/**
 * Fondos del montaje por viñetas: un dibujo por lugar distinto (los ya hechos con la misma descripción y
 * forma se reutilizan) y cada uno visible solo en sus viñetas, con corte seco.
 */
export async function fondosPorVinetas(vinetas: { t: number; fondo: string; lado?: 'izq' | 'centro' | 'der' }[], onProgress: (m: string) => void) {
  const unicos = [...new Set(vinetas.map((v) => v.fondo))]
  const capaDe = new Map<string, BgLayer>()
  const fallos: string[] = []
  let n = 0
  for (const d of unicos) {
    const pr = useStore.getState().project
    const previa = pr.fondos?.find((l) => l.descripcion === d && Math.abs(l.w / l.h - pr.width / pr.height) < 0.15)
    n++
    onProgress(previa ? `Reutilizando fondo: ${d}` : `Generando fondo ${n} de ${unicos.length}: ${d}`)
    try {
      // El lado libre (contrario al personaje) se pide casi vacío, para el contenido
      const lado = vinetas.find((v) => v.fondo === d && v.lado && v.lado !== 'centro')?.lado
      const hueco = lado === 'izq' ? 'der' : lado === 'der' ? 'izq' : undefined
      // Cada lugar del vídeo con su paleta y su encuadre (antes todos eran «pared gris de frente»)
      capaDe.set(d, previa ?? { ...(await generateBackground(d, pr, hueco, unicos.filter((u) => !/^blanco\b/i.test(u)).indexOf(d))), descripcion: d })
    } catch (e) {
      fallos.push(`«${d}»: ${e instanceof Error ? e.message : e}`)
    }
  }
  const st = useStore.getState()
  const total = st.project.duration
  const fps = st.project.fps
  const r = (x: number) => Math.round(x * fps) / fps
  // Fuera las pistas de los fondos automáticos anteriores (los que tienen descripción)
  const auto = new Set((st.project.fondos ?? []).filter((l) => l.descripcion).map((l) => l.id))
  let tracks = Object.fromEntries(Object.entries(st.project.instances[0].tracks).filter(([c]) => !(c.startsWith('bg:') && auto.has(c.split(':')[1]))))
  // Tramos de cada capa (juntando viñetas seguidas con el mismo fondo)
  const tramos: { id: string; desde: number; hasta: number }[] = []
  vinetas.forEach((v, i) => {
    const capa = capaDe.get(v.fondo)
    const hasta = vinetas[i + 1]?.t ?? total
    const last = tramos[tramos.length - 1]
    if (!capa) return
    if (last && last.id === capa.id && Math.abs(last.hasta - v.t) < 1e-3) last.hasta = hasta
    else tramos.push({ id: capa.id, desde: v.t, hasta })
  })
  for (const t of tramos) {
    const op = `bg:${t.id}:opacity`
    if (!tracks[op]) tracks = setKey(tracks, op, 0, t.desde > 1e-3 ? 0 : 1, 'salto')
    tracks = setKey(tracks, op, r(t.desde), 1, 'salto')
    if (t.hasta < total - 1e-3) tracks = setKey(tracks, op, r(t.hasta), 0, 'salto')
    tracks = setKey(tracks, `bg:${t.id}:scale`, r(t.desde), 1, 'salto')
  }
  const usadas = [...new Map([...capaDe.values()].map((c) => [c.id, c])).values()]
  const [inst, ...rest] = st.project.instances
  st.commit({
    ...st.project,
    // Las capas automáticas que ya no se usan se quitan; las que puso el usuario a mano se quedan
    fondos: [...usadas, ...(st.project.fondos ?? []).filter((l) => !l.descripcion)],
    instances: [{ ...inst, tracks }, ...rest],
  })
  if (fallos.length) throw new Error(`no salió ${fallos.length === 1 ? 'un fondo' : fallos.length + ' fondos'} (${fallos.join('; ')})`)
}
