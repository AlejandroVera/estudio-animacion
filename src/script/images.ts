// Fondos generados con IA (fal.ai) en el estilo del personaje, añadidos como capas.

import { setKey } from '../model/anim'
import type { BgLayer, Escena, Project } from '../model/types'
import { saveImage } from '../audio/storage'
import { activeCharacter, useStore } from '../store'
import { estimateDuration } from './scenes'

const readPass = () => {
  try {
    return localStorage.getItem('estudio-animacion:clave') ?? ''
  } catch {
    return ''
  }
}

/** Genera un fondo y lo guarda; devuelve la capa (sin añadirla al proyecto). */
export async function generateBackground(descripcion: string, project: Project): Promise<BgLayer> {
  const ch = activeCharacter(project)
  const res = await fetch('/api/imagen', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-clave-estudio': readPass() },
    body: JSON.stringify({
      descripcion,
      referencia: ch.referencia ? location.origin + ch.referencia : undefined,
      formato: project.width >= project.height ? '16:9' : '9:16',
    }),
  })
  const d = await res.json().catch(() => ({}))
  if (res.status === 401) throw new Error('Escribe la contraseña del estudio en el copiloto y vuelve a intentarlo.')
  if (!res.ok) throw new Error(d.error ?? `Error ${res.status}`)
  const img = await fetch(d.url)
  if (!img.ok) throw new Error('No se pudo descargar la imagen generada.')
  const blob = await img.blob()
  const bmp = await createImageBitmap(blob)
  const id = `fondo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  await saveImage(id, blob)
  const name = descripcion.length > 28 ? descripcion.slice(0, 26) + '…' : descripcion
  return { id, name, imageId: id, w: bmp.width, h: bmp.height }
}

/** Añade una capa al fondo (detrás de las demás capas de fondo). */
export function addLayer(layer: BgLayer) {
  const st = useStore.getState()
  st.setProjectProps({ fondos: [layer, ...(st.project.fondos ?? [])] })
}

/**
 * Fondos para las escenas del guion: una imagen por cada fondo distinto (si una escena no describe
 * fondo, sigue el anterior). Cada capa se ve solo en sus escenas y se acerca un poco mientras dura.
 */
export async function generateSceneBackgrounds(onProgress: (m: string) => void): Promise<number> {
  const st0 = useStore.getState()
  const escenas: Escena[] = st0.project.guion?.escenas ?? []
  if (!escenas.length) throw new Error('Primero anima las escenas del guion.')
  // Tramos: escenas seguidas con el mismo fondo
  const tramos: { desc: string; desde: number; hasta: number }[] = []
  let t = 0
  let actual = ''
  for (const e of escenas) {
    const dur = e.duracion || estimateDuration(e.dialogo)
    const desc = e.fondo.trim() || actual
    if (desc && (desc !== actual || !tramos.length)) tramos.push({ desc, desde: t, hasta: t + dur })
    else if (tramos.length) tramos[tramos.length - 1].hasta = t + dur
    actual = desc
    t += dur
  }
  if (!tramos.length) throw new Error('Las escenas no describen ningún fondo. Escribe uno en alguna escena o pide las escenas con IA.')

  const capas: { layer: BgLayer; desde: number; hasta: number }[] = []
  for (let i = 0; i < tramos.length; i++) {
    onProgress(`Generando fondo ${i + 1} de ${tramos.length}: ${tramos[i].desc}`)
    capas.push({ layer: await generateBackground(tramos[i].desc, useStore.getState().project), ...tramos[i] })
  }

  const st = useStore.getState()
  const fps = st.project.fps
  const r = (x: number) => Math.round(x * fps) / fps
  let tracks = { ...st.project.instances[0].tracks }
  for (const c of capas) {
    const id = c.layer.id
    if (c.desde > 0) tracks = setKey(tracks, `bg:${id}:opacity`, 0, 0, 'salto')
    tracks = setKey(tracks, `bg:${id}:opacity`, r(c.desde), 1, 'salto')
    if (c.hasta < st.project.duration - 1e-3) tracks = setKey(tracks, `bg:${id}:opacity`, r(c.hasta), 0, 'salto')
    tracks = setKey(tracks, `bg:${id}:scale`, r(c.desde), 1, 'lineal')
    tracks = setKey(tracks, `bg:${id}:scale`, r(c.hasta), 1.06, 'lineal')
  }
  const [inst, ...rest] = st.project.instances
  st.commit({
    ...st.project,
    fondos: [...capas.map((c) => c.layer), ...(st.project.fondos ?? [])],
    instances: [{ ...inst, tracks }, ...rest],
  })
  return capas.length
}
