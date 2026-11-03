// Voces del guion con ElevenLabs: una voz por escena con diálogo. Cada audio se guarda en el
// navegador por voz + texto, así repetir el montaje no gasta caracteres de nuevo. Las escenas se
// alargan o acortan a lo que dura su frase, los audios se unen en una sola pista y la boca se
// sincroniza con ella.

import { mouthKeys } from '../audio/lipsync'
import { decodeAudio, loadAudio, saveAudio } from '../audio/storage'
import type { Escena } from '../model/types'
import { activeCharacter, useStore } from '../store'
import { animateScenes } from './scenes'

export interface Voz {
  id: string
  nombre: string
  tipo?: string
  idioma?: string
}

const headers = (pass: string) => ({ 'content-type': 'application/json', 'x-clave-estudio': pass })

export async function listVoices(pass: string): Promise<Voz[]> {
  const res = await fetch('/api/voz', { headers: headers(pass) })
  const d = await res.json().catch(() => ({}))
  if (res.status === 401) throw new Error('La contraseña del estudio no es correcta.')
  if (!res.ok) throw new Error(d.error ?? `Error ${res.status}`)
  return d.voces
}

function hash(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}

async function clip(texto: string, voz: string, pass: string): Promise<AudioBuffer> {
  const id = `tts-${voz}-${hash(texto)}`
  if (!(await loadAudio(id))) {
    const res = await fetch('/api/voz', { method: 'POST', headers: headers(pass), body: JSON.stringify({ texto, voz }) })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error(res.status === 401 ? 'La contraseña del estudio no es correcta.' : d.error ?? `Error ${res.status}`)
    }
    await saveAudio(id, await res.blob())
  }
  const buf = await decodeAudio(id)
  if (!buf) throw new Error('No se pudo leer el audio generado.')
  return buf
}

function wav(buf: AudioBuffer): Blob {
  const data = buf.getChannelData(0)
  const sr = buf.sampleRate
  const out = new DataView(new ArrayBuffer(44 + data.length * 2))
  const w = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF')
  out.setUint32(4, 36 + data.length * 2, true)
  w(8, 'WAVEfmt ')
  out.setUint32(16, 16, true)
  out.setUint16(20, 1, true)
  out.setUint16(22, 1, true)
  out.setUint32(24, sr, true)
  out.setUint32(28, sr * 2, true)
  out.setUint16(32, 2, true)
  out.setUint16(34, 16, true)
  w(36, 'data')
  out.setUint32(40, data.length * 2, true)
  for (let i = 0; i < data.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 0x7fff, true)
  return new Blob([out], { type: 'audio/wav' })
}

const LEAD = 0.15 // la frase empieza un poco después del corte de cámara
const TAIL = 0.45 // respiro al final de cada frase

/** Genera las voces, ajusta las escenas y monta animación + audio + boca en un solo paso de deshacer. */
export async function voiceScript(escenas: Escena[], texto: string, voz: Voz, pass: string, onProgress: (msg: string) => void) {
  const clips: (AudioBuffer | null)[] = []
  let n = 0
  const conTexto = escenas.filter((e) => e.dialogo.trim()).length
  for (const e of escenas) {
    if (!e.dialogo.trim()) {
      clips.push(null)
      continue
    }
    onProgress(`Generando voz ${++n} de ${conTexto}…`)
    clips.push(await clip(e.dialogo.trim(), voz.id, pass))
  }
  const ajustadas = escenas.map((e, i) => (clips[i] ? { ...e, duracion: Math.round((clips[i]!.duration + LEAD + TAIL) * 100) / 100 } : e))

  onProgress('Montando la animación…')
  const st = useStore.getState()
  const ch = activeCharacter(st.project)
  const m = animateScenes(ajustadas, st.project, ch)

  // Una sola pista con cada frase en su escena
  const sr = 44100
  const ctx = new OfflineAudioContext(1, Math.ceil((m.duration + 0.5) * sr), sr)
  m.escenas.forEach((e, i) => {
    const c = clips[i]
    if (!c) return
    const node = ctx.createBufferSource()
    node.buffer = c
    node.connect(ctx.destination)
    node.start(e.inicio + LEAD)
  })
  const mezcla = await ctx.startRendering()
  const audioId = `voces-${Date.now()}`
  await saveAudio(audioId, wav(mezcla))

  // Boca sincronizada con la voz real (sustituye la que seguía el texto)
  const mouths = Object.keys(ch.parts.find((p) => p.role === 'mouth')?.variants ?? {})
  const tracks = { ...m.tracks, 'face:mouth': mouthKeys(mezcla, 0, st.project.fps, mouths) }

  const [inst, ...rest] = st.project.instances
  st.commit({
    ...st.project,
    duration: m.duration,
    audio: { id: audioId, name: `Voces (${voz.nombre})`, start: 0, duration: mezcla.duration },
    guion: { texto, escenas: m.escenas.map(({ inicio: _i, ...e }) => e), voz },
    instances: [{ ...inst, tracks }, ...rest],
  })
  st.setTime(0)
  st.setPlaying(true)
  return { escenas: ajustadas, duracion: m.duration }
}
