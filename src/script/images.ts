// Fondos generados con IA (fal.ai) en el estilo del personaje, añadidos como capas.

import type { BgLayer, Escena, Project } from '../model/types'
import { saveImage } from '../audio/storage'
import { activeCharacter, useStore } from '../store'
import { backgroundKeys, estimateDuration } from './scenes'

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
 * Fondos para las escenas: una imagen por cada fondo distinto (si una escena no describe fondo,
 * sigue el anterior). Devuelve las escenas con su capa asignada; si el guion ya está animado,
 * coloca también las capas en la línea de tiempo.
 */
export async function generateSceneBackgrounds(escenas: Escena[], onProgress: (m: string) => void): Promise<Escena[]> {
  if (!escenas.length) throw new Error('Primero prepara las escenas.')
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
  for (let g = 0; g < grupos.length; g++) {
    onProgress(`Generando fondo ${g + 1} de ${grupos.length}: ${grupos[g].desc}`)
    const layer = await generateBackground(grupos[g].desc, useStore.getState().project)
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
    fondos: [...capas, ...(st.project.fondos ?? []).filter((l) => !viejas.has(l.id))],
    guion: animado ? { ...st.project.guion!, escenas: out } : st.project.guion,
    instances: [{ ...inst, tracks }, ...rest],
  })
  return out
}
