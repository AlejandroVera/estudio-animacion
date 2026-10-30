import { ArrayBufferTarget, Muxer } from 'mp4-muxer'
import { drawFrame, ensureImages } from '../model/render'
import type { Project } from '../model/types'

const CODECS = ['avc1.640033', 'avc1.640028', 'avc1.4d0028', 'avc1.42003e']

/** Renderiza el proyecto fotograma a fotograma y devuelve un MP4 (H.264). */
export async function exportMp4(project: Project, onProgress: (p: number) => void): Promise<Blob> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('Este navegador no puede crear vídeo. Usa Google Chrome o Edge actualizados.')
  }
  // H.264 exige dimensiones pares
  const width = project.width - (project.width % 2)
  const height = project.height - (project.height % 2)
  const { fps } = project

  let codec: string | null = null
  for (const c of CODECS) {
    const { supported } = await VideoEncoder.isConfigSupported({ codec: c, width, height, bitrate: 8_000_000, framerate: fps })
    if (supported) {
      codec = c
      break
    }
  }
  if (!codec) throw new Error('El navegador no admite H.264 a este tamaño.')

  await ensureImages(project)

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height, frameRate: fps },
    fastStart: 'in-memory',
  })
  let failure: unknown = null
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => (failure = e),
  })
  encoder.configure({ codec, width, height, bitrate: 8_000_000, framerate: fps })

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const g = canvas.getContext('2d')!

  const total = Math.max(1, Math.round(project.duration * fps))
  const frameUs = 1_000_000 / fps
  for (let i = 0; i < total; i++) {
    if (failure) throw failure
    g.setTransform(1, 0, 0, 1, 0, 0)
    drawFrame(g, project, i / fps)
    const frame = new VideoFrame(canvas, { timestamp: Math.round(i * frameUs), duration: Math.round(frameUs) })
    encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 })
    frame.close()
    while (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5))
    if (i % 5 === 0) {
      onProgress(i / total)
      await new Promise((r) => setTimeout(r, 0))
    }
  }
  await encoder.flush()
  if (failure) throw failure
  encoder.close()
  muxer.finalize()
  onProgress(1)
  return new Blob([muxer.target.buffer], { type: 'video/mp4' })
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
