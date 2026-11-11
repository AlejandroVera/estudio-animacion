// «Descargar imágenes»: todos los dibujos del proyecto (escenas, cambios, fondos, objetos y gestos a medida) en
// un ZIP, en el orden en que salen en el vídeo y con un nombre que dice qué son.

import { loadAudio as cargar } from '../audio/storage'
import type { Project } from '../model/types'
import { crearZip } from './zip'

const limpio = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^inserto:\s*/i, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'imagen'

const ext = (b: Blob) => (b.type.includes('png') ? 'png' : b.type.includes('webp') ? 'webp' : 'jpg')

export async function zipDeImagenes(project: Project): Promise<{ blob: Blob; n: number }> {
  const tr = project.instances[0]?.tracks ?? {}
  // Cuándo se ve cada capa por primera vez (para ordenarlas como en el vídeo)
  const cuando = (id: string) => {
    const ks = tr[`bg:${id}:opacity`]
    if (!ks?.length) return 0
    const k = ks.find((x) => Number(x.v) > 0.5)
    return k ? k.t : 1e9
  }
  const lista: { orden: number; nombre: string; id: string }[] = []
  for (const l of project.fondos ?? []) {
    const base = limpio(l.descripcion ?? l.name ?? l.id)
    // El dibujo tal cual lo hizo la IA (con su boca); si no hay, el que se usa
    lista.push({ orden: cuando(l.id), nombre: base, id: l.imageIdOrig ?? l.imageId })
    if (l.imageIdOtro) lista.push({ orden: cuando(l.id) + 0.001, nombre: `${base}_otro`, id: l.imageIdOtro })
  }
  for (const o of project.objetos ?? []) lista.push({ orden: o.t ?? 1e9, nombre: `objeto_${limpio(o.que ?? o.id)}`, id: o.imageId })
  for (const p of project.posturasExtra ?? []) lista.push({ orden: 2e9, nombre: `gesto_${limpio(p.nombre)}`, id: p.imageId })
  lista.sort((a, b) => a.orden - b.orden)
  const archivos: { nombre: string; blob: Blob }[] = []
  const vistos = new Set<string>()
  for (const x of lista) {
    if (!x.id || vistos.has(x.id)) continue
    vistos.add(x.id)
    const blob = await cargar(x.id).catch(() => null)
    if (!blob) continue
    archivos.push({ nombre: `${String(archivos.length + 1).padStart(2, '0')}_${x.nombre}.${ext(blob)}`, blob })
  }
  return { blob: await crearZip(archivos), n: archivos.length }
}
