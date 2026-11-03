// Voces del guion con ElevenLabs: una voz por escena con diálogo. Cada audio se guarda en el
// navegador por voz + texto, así repetir el montaje no gasta caracteres de nuevo. Las escenas se
// alargan o acortan a lo que dura su frase, los audios se unen en una sola pista y la boca se
// sincroniza con ella.

import { gesticular, type Palabra } from './emocion'
import { decodeAudio, loadAudio, saveAudio } from '../audio/storage'
import type { Escena, Tracks } from '../model/types'
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

export type Modelo = 'eleven_v3' | 'eleven_multilingual_v2'
interface Alineacion {
  characters: string[]
  character_start_times_seconds: number[]
  character_end_times_seconds: number[]
}

/** Lee el guion entero de una vez (entonación continua) y devuelve el audio y el tiempo de cada letra. */
async function lectura(texto: string, voz: string, modelo: Modelo, pass: string): Promise<{ buf: AudioBuffer; al: Alineacion }> {
  const id = `ttsfull-${voz}-${modelo}-${hash(texto)}`
  let alBlob = await loadAudio(id + '-al')
  if (!(await loadAudio(id)) || !alBlob) {
    const res = await fetch('/api/voz', { method: 'POST', headers: headers(pass), body: JSON.stringify({ texto, voz, modelo, tiempos: true }) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(res.status === 401 ? 'La contraseña del estudio no es correcta.' : d.error ?? `Error ${res.status}`)
    const bytes = Uint8Array.from(atob(d.audio), (c) => c.charCodeAt(0))
    await saveAudio(id, new Blob([bytes], { type: 'audio/mpeg' }))
    alBlob = new Blob([JSON.stringify(d.alineacion)], { type: 'application/json' })
    await saveAudio(id + '-al', alBlob)
  }
  const buf = await decodeAudio(id)
  if (!buf) throw new Error('No se pudo leer el audio generado.')
  return { buf, al: JSON.parse(await alBlob.text()) }
}

/** Boca por letras: cada vocal abre la boca en su instante; m/b/p la cierran; en las pausas, cerrada. */
function visemas(al: Alineacion, desplaza: (t: number) => number | null, fps: number, mouths: string[]) {
  const has = (m: string) => mouths.includes(m)
  const forma = (c: string): string | null => {
    const l = c.toLowerCase()
    if ('aá'.includes(l)) return has('abierta') ? 'abierta' : 'O'
    if ('eéií'.includes(l)) return has('E') ? 'E' : 'abierta'
    if ('oóuúü'.includes(l)) return has('O') ? 'O' : 'abierta'
    if ('mbpv'.includes(l)) return has('MBP') ? 'MBP' : 'cerrada'
    if ('fdtsnlrzcj'.includes(l)) return has('E') ? 'E' : null // dientes y lengua: boca entreabierta
    if ('gkqxyhñ'.includes(l)) return null // mantiene la forma anterior
    return 'pausa'
  }
  // Cada letra propone una forma en su fotograma; si caen varias en el mismo, gana la más visible
  // (pausa > vocal/labios > consonante).
  const porFotograma = new Map<number, { v: string; p: number }>()
  const put = (t: number, v: string, p: number) => {
    const f = Math.round(t * fps)
    const prev = porFotograma.get(f)
    if (!prev || p >= prev.p) porFotograma.set(f, { v, p })
  }
  const n = al.characters.length
  for (let i = 0; i < n; i++) {
    const t = desplaza(al.character_start_times_seconds[i])
    if (t === null) continue
    const c = al.characters[i]
    const f = forma(c)
    if (f === 'pausa') {
      const sig = i + 1 < n ? al.character_start_times_seconds[i + 1] - al.character_end_times_seconds[i] : 1
      const dur = al.character_end_times_seconds[i] - al.character_start_times_seconds[i]
      if (sig > 0.12 || dur > 0.12 || /[.,;:!?…\n]/.test(c)) put(t, 'cerrada', 3)
    } else if (f) put(t, f, /[aeiouáéíóúü]/i.test(c) || f === 'MBP' ? 2 : 1)
  }
  const fin = desplaza(al.character_end_times_seconds[n - 1] ?? 0)
  if (fin !== null) put(fin, 'cerrada', 3)
  const keys: { t: number; v: string }[] = []
  for (const f of [...porFotograma.keys()].sort((x, y) => x - y)) {
    const v = porFotograma.get(f)!.v
    if (keys.length && keys[keys.length - 1].v === v) continue
    keys.push({ t: f / fps, v })
  }
  return keys.map((k) => ({ t: k.t, v: k.v, ease: 'salto' as const }))
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
const TAIL = 0.6 // respiro al final del vídeo

/**
 * Voz del guion: se lee entero de una vez con ElevenLabs, el audio se reparte entre las escenas según
 * cuándo empieza cada frase, las escenas duran lo que su frase y la boca sigue las letras.
 */
export async function voiceScript(escenas: Escena[], texto: string, voz: Voz, pass: string, onProgress: (msg: string) => void, modelo: Modelo = 'eleven_multilingual_v2') {
  const conTexto = escenas.map((e, i) => ({ i, d: e.dialogo.trim() })).filter((x) => x.d)
  if (!conTexto.length) throw new Error('Ninguna escena tiene diálogo.')
  // Texto completo y dónde empieza cada frase dentro de él
  let completo = ''
  const rangos = new Map<number, [number, number]>()
  for (const { i, d } of conTexto) {
    if (completo) completo += '\n\n'
    rangos.set(i, [completo.length, completo.length + d.length])
    completo += d
  }
  onProgress(`Generando la voz (${voz.nombre})…`)
  const { buf, al } = await lectura(completo, voz.id, modelo, pass)
  const ini = al.character_start_times_seconds
  const finT = al.character_end_times_seconds
  // Tramo de audio de cada escena: desde un poco antes de su primera letra hasta antes de la siguiente frase
  const tramoAudio = new Map<number, [number, number]>()
  conTexto.forEach(({ i }, k) => {
    const [a, b] = rangos.get(i)!
    const desde = Math.max(0, ini[a] - 0.06)
    const sig = conTexto[k + 1] ? rangos.get(conTexto[k + 1].i)![0] : null
    const hasta = sig !== null ? Math.max(finT[b - 1], ini[sig] - 0.06) : Math.min(buf.duration, finT[b - 1] + 0.25)
    tramoAudio.set(i, [desde, hasta])
  })
  const ajustadas = escenas.map((e, i) => {
    const tr = tramoAudio.get(i)
    return tr ? { ...e, duracion: Math.round((tr[1] - tr[0] + LEAD + (i === escenas.length - 1 ? TAIL : 0.05)) * 100) / 100 } : e
  })

  onProgress('Montando la animación…')
  const st = useStore.getState()
  const ch = activeCharacter(st.project)
  const m = animateScenes(ajustadas, st.project, ch)

  const sr = 44100
  const ctx = new OfflineAudioContext(1, Math.ceil((m.duration + 0.5) * sr), sr)
  const sitio = new Map<number, number>() // desplazamiento: tiempo del audio -> tiempo del vídeo
  m.escenas.forEach((e, i) => {
    const tr = tramoAudio.get(i)
    if (!tr) return
    const node = ctx.createBufferSource()
    node.buffer = buf
    node.connect(ctx.destination)
    node.start(e.inicio + LEAD, tr[0], tr[1] - tr[0])
    sitio.set(i, e.inicio + LEAD - tr[0])
  })
  const mezcla = await ctx.startRendering()
  const audioId = `voces-${Date.now()}`
  await saveAudio(audioId, wav(mezcla))

  // Cada letra se lleva al momento del vídeo en que suena (según el tramo de su escena)
  const desplaza = (t: number) => {
    for (const [i, [a, b]] of tramoAudio) if (t >= a - 1e-3 && t < b) return t + sitio.get(i)!
    return null
  }
  const mouths = ch.expresivo ? ['cerrada', 'abierta', 'O', 'MBP'] : Object.keys(ch.parts.find((p) => p.role === 'mouth')?.variants ?? {})
  const tracks: Tracks = { ...m.tracks, 'face:mouth': visemas(al, desplaza, st.project.fps, mouths) }

  // Personaje por poses: los cambios de pose sueltos caen al empezar una palabra, como al gesticular
  const raiz = ch.parts.find((p) => !p.parent && Object.keys(p.variants).length > 1)
  const canal = raiz ? `part:${raiz.id}:v` : ''
  if (raiz && tracks[canal]?.length) {
    const palabras: number[] = []
    for (let i = 0; i < al.characters.length; i++) {
      const c = al.characters[i]
      const antes = i > 0 ? al.characters[i - 1] : ' '
      if (/[\p{L}\p{N}]/u.test(c) && !/[\p{L}\p{N}]/u.test(antes)) {
        const tv = desplaza(al.character_start_times_seconds[i])
        if (tv !== null) palabras.push(tv)
      }
    }
    const ks = [...tracks[canal]].sort((a, b) => a.t - b.t)
    const fps = st.project.fps
    for (let i = 0; i < ks.length; i++) {
      const antes = i > 0 ? ks[i].t - ks[i - 1].t : Infinity
      const despues = i + 1 < ks.length ? ks[i + 1].t - ks[i].t : Infinity
      if (antes < 0.6 || despues < 0.6 || !palabras.length) continue // secuencias rápidas (saludar) no se tocan
      const cerca = palabras.reduce((b, w) => (Math.abs(w - 0.06 - ks[i].t) < Math.abs(b - 0.06 - ks[i].t) ? w : b))
      const nuevo = Math.round((cerca - 0.06) * fps) / fps
      if (Math.abs(nuevo - ks[i].t) <= 0.35 && (i === 0 || nuevo - ks[i - 1].t > 0.3) && (i + 1 >= ks.length || ks[i + 1].t - nuevo > 0.3)) ks[i] = { ...ks[i], t: nuevo }
    }
    tracks[canal] = ks
  }

  // Gesticulación según lo que dice: cabeceos, cejas, parpadeos en pausas y emoción de la escena
  const palabras: Palabra[] = []
  let enPregunta = false
  for (let i = 0; i < al.characters.length; i++) {
    const c = al.characters[i]
    if (c === '¿') enPregunta = true
    const antes = i > 0 ? al.characters[i - 1] : ' '
    if (/[\p{L}\p{N}]/u.test(c) && !/[\p{L}\p{N}]/u.test(antes)) {
      let j = i
      while (j + 1 < al.characters.length && /[\p{L}\p{N}]/u.test(al.characters[j + 1])) j++
      const t0 = desplaza(al.character_start_times_seconds[i])
      const t1 = desplaza(al.character_end_times_seconds[j])
      const sigue = al.characters.slice(j + 1, j + 4).join('')
      const punt = (sigue.match(/^\s*([,.;:?!…])/) ?? [])[1] ?? ''
      if (t0 !== null && t1 !== null) palabras.push({ t: t0, fin: t1, texto: al.characters.slice(i, j + 1).join(''), punt, pregunta: enPregunta })
      if (punt === '?') enPregunta = false
    }
  }
  const conGestos = gesticular(tracks, palabras, ch, m.escenas)

  const [inst, ...rest] = st.project.instances
  st.commit({
    ...st.project,
    duration: m.duration,
    audio: { id: audioId, name: `Voces (${voz.nombre})`, start: 0, duration: mezcla.duration },
    guion: { texto, escenas: m.escenas.map(({ inicio: _i, ...e }) => e), voz },
    instances: [{ ...inst, tracks: conGestos }, ...rest],
  })
  st.setTime(0)
  st.setPlaying(true)
  return { escenas: ajustadas, duracion: m.duration }
}
