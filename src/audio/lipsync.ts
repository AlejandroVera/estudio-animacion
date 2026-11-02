// Sincronización de labios a partir del audio: por cada fotograma mide la energía de la voz y lo
// «brillante» que suena (cruces por cero) y elige una boca: cerrada en silencio, MBP en sonidos
// suaves, O en sonidos oscuros, E en sonidos claros y abierta en los fuertes.

import type { Keyframe } from '../model/types'

export function mouthKeys(buf: AudioBuffer, start: number, fps: number, mouths: string[]): Keyframe[] {
  const data = buf.getChannelData(0)
  const sr = buf.sampleRate
  const win = Math.round(sr / fps)
  const frames = Math.floor(data.length / win)
  const rms: number[] = []
  const zcr: number[] = []
  for (let f = 0; f < frames; f++) {
    let e = 0
    let z = 0
    const o = f * win
    for (let i = 0; i < win; i++) {
      const v = data[o + i]
      e += v * v
      if (i && (v >= 0) !== (data[o + i - 1] >= 0)) z++
    }
    rms.push(Math.sqrt(e / win))
    zcr.push(z / win)
  }
  // Umbrales relativos a la voz de este audio
  const sorted = [...rms].sort((a, b) => a - b)
  const peak = sorted[Math.floor(sorted.length * 0.95)] || 1e-6
  const silence = Math.max(peak * 0.08, sorted[Math.floor(sorted.length * 0.1)] * 1.5)
  const has = (m: string) => mouths.includes(m)
  const pick = (f: number): string => {
    const r = rms[f]
    if (r < silence) return 'cerrada'
    const lvl = r / peak
    if (lvl < 0.25) return has('MBP') ? 'MBP' : 'cerrada'
    const bright = zcr[f] > 0.09
    if (lvl > 0.7) return has('abierta') ? 'abierta' : 'O'
    if (bright) return has('E') ? 'E' : 'abierta'
    return has('O') ? 'O' : 'abierta'
  }
  const keys: Keyframe[] = []
  let last = ''
  let held = 0
  for (let f = 0; f < frames; f++) {
    let m = pick(f)
    // Cada boca dura al menos 2 fotogramas para que no tiemble
    if (m !== last && held < 2 && last) m = last
    if (m !== last) {
      keys.push({ t: Math.round((start + f / fps) * fps) / fps, v: m, ease: 'salto' })
      last = m
      held = 0
    }
    held++
  }
  if (last !== 'cerrada') keys.push({ t: Math.round((start + frames / fps) * fps) / fps, v: 'cerrada', ease: 'salto' })
  return keys
}
