// Gesticulación ligada a lo que se dice: cabeceos en las palabras importantes, cejas que suben al
// remarcar o preguntar, parpadeos en las pausas y la cabeza baja cuando la escena es triste.
// Se calcula con el tiempo real de cada palabra de la voz (alineación de ElevenLabs).

import { evalTrack } from '../model/anim'
import type { Character, Ease, Escena, Keyframe, Tracks } from '../model/types'

export interface Palabra {
  t: number // inicio (s de vídeo)
  fin: number
  texto: string
  /** Signo de puntuación que la sigue (',', '.', '?', '!') o '' */
  punt: string
  pregunta: boolean // está dentro de ¿…?
}

const k = (t: number, v: number | string, ease: Ease = 'suave'): Keyframe => ({ t: Math.max(0, Math.round(t * 1000) / 1000), v, ease })

function pon(tracks: Tracks, canal: string, keys: Keyframe[]) {
  const otras = (tracks[canal] ?? []).filter((x) => !keys.some((y) => Math.abs(y.t - x.t) < 0.03))
  tracks[canal] = [...otras, ...keys].sort((a, b) => a.t - b.t)
}

export function gesticular(tracks: Tracks, palabras: Palabra[], ch: Character, escenas: (Escena & { inicio: number })[]): Tracks {
  const out: Tracks = { ...tracks }
  if (!palabras.length) return out
  const cabeza = ch.parts.find((p) => p.id === 'cabeza')
  const hasBrows = ch.parts.some((p) => p.role === 'brows' && p.variants['sorprendido'])
  const R = cabeza ? Math.max(40, cabeza.anchor.y) : 200 // tamaño de la cabeza en px del dibujo
  const escenaDe = (t: number) => escenas.find((e) => t >= e.inicio && t < e.inicio + e.duracion)

  // 1) Palabras importantes: la más larga de cada frase (entre signos) y la última antes de punto
  const enfasis: Palabra[] = []
  let frase: Palabra[] = []
  for (const w of palabras) {
    frase.push(w)
    if (w.punt) {
      const larga = frase.reduce((a, b) => (b.texto.length > a.texto.length ? b : a))
      if (larga.texto.length >= 5) enfasis.push(larga)
      if (/[.!]/.test(w.punt) && w !== larga && w.texto.length >= 4) enfasis.push(w)
      frase = []
    }
  }
  enfasis.sort((a, b) => a.t - b.t)
  let ultimo = -9
  for (const w of enfasis) {
    if (w.t - ultimo < 1.1) continue
    ultimo = w.t
    const e = escenaDe(w.t)
    const triste = e && /triste/i.test(e.expresion)
    // Cabeceo: baja un poco con la sílaba fuerte y vuelve
    if (cabeza && !triste) {
      const base = Number(evalTrack(out['part:cabeza:y'], w.t - 0.1, 0)) || 0
      pon(out, 'part:cabeza:y', [k(w.t - 0.1, base), k(w.t + 0.08, base + R * 0.05), k(w.t + 0.42, base)])
    }
    // Cejas arriba un momento al remarcar (si la escena no es triste/enfadada)
    if (hasBrows && !w.pregunta) {
      const actual = String(evalTrack(out['face:brows'], w.t, 'neutral'))
      if (actual === 'neutral') pon(out, 'face:brows', [k(w.t - 0.06, 'sorprendido', 'salto'), k(w.t + 0.5, 'neutral', 'salto')])
    }
  }

  // 2) Preguntas: cejas arriba y cabeza ladeada en las últimas palabras
  for (let i = 0; i < palabras.length; i++) {
    const w = palabras[i]
    if (!w.pregunta || w.punt !== '?') continue
    let j = i
    while (j > 0 && palabras[j - 1].pregunta && w.t - palabras[j - 1].t < 0.9) j--
    const desde = palabras[j].t - 0.08
    if (hasBrows) {
      const antes = String(evalTrack(out['face:brows'], desde - 0.01, 'neutral'))
      pon(out, 'face:brows', [k(desde, 'sorprendido', 'salto'), k(w.fin + 0.35, antes, 'salto')])
    }
    if (cabeza) {
      const rot = Number(evalTrack(out['part:cabeza:rot'], desde, 0)) || 0
      pon(out, 'part:cabeza:rot', [k(desde, rot), k(desde + 0.3, rot + 6), k(w.fin + 0.5, rot + 6), k(w.fin + 0.9, rot)])
    }
  }

  // 3) Parpadeo en las pausas (entre frases), como al pensar
  const blinks: Keyframe[] = []
  for (let i = 0; i + 1 < palabras.length; i++) {
    const hueco = palabras[i + 1].t - palabras[i].fin
    if (hueco > 0.22 && palabras[i].punt) {
      const t = palabras[i].fin + 0.04
      blinks.push(k(t, 0, 'lineal'), k(t + 0.06, 1, 'lineal'), k(t + 0.14, 0, 'lineal'))
    }
  }
  if (blinks.length) pon(out, 'face:blink', [k(0, 0, 'lineal'), ...blinks])

  // 4) Escenas tristes: cabeza algo baja y ladeada todo el rato
  if (cabeza) {
    for (const e of escenas) {
      if (!/triste/i.test(e.expresion)) continue
      pon(out, 'part:cabeza:y', [k(e.inicio, R * 0.06), k(e.inicio + e.duracion - 0.05, R * 0.06), k(e.inicio + e.duracion, 0, 'salto')])
      pon(out, 'part:cabeza:rot', [k(e.inicio + 0.1, -4), k(e.inicio + e.duracion - 0.05, -4), k(e.inicio + e.duracion, 0, 'salto')])
    }
  }
  return out
}
