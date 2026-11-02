import { useEffect, useRef } from 'react'
import { decodeAudio } from '../audio/storage'
import { channelLabel, KEY_EPS } from '../model/anim'
import type { Ease } from '../model/types'
import { activeCharacter, useStore } from '../store'

const LABEL_W = 170

function fmt(t: number) {
  return t.toFixed(2).replace('.', ',') + ' s'
}

export function Timeline() {
  const project = useStore((s) => s.project)
  const time = useStore((s) => s.time)
  const playing = useStore((s) => s.playing)
  const selectedPart = useStore((s) => s.selectedPart)
  const selectedKey = useStore((s) => s.selectedKey)
  const { setTime, setPlaying, selectKey, moveKeyTo, deleteKey, setKeyEase, selectPart } = useStore.getState()
  const areaRef = useRef<HTMLDivElement>(null)
  const dragKey = useRef<{ channel: string; t: number; moved: boolean } | null>(null)

  const ch = activeCharacter(project)
  const tracks = project.instances[0].tracks
  const order = (c: string) => {
    if (c.startsWith('face:')) return -1
    const id = c.split(':')[1]
    return ch.parts.findIndex((p) => p.id === id)
  }
  const channels = Object.keys(tracks)
    .filter((c) => tracks[c].length)
    .sort((a, b) => order(a) - order(b) || a.localeCompare(b))

  const timeAt = (clientX: number) => {
    const r = areaRef.current!.getBoundingClientRect()
    return ((clientX - r.left) / r.width) * project.duration
  }
  const snapT = (t: number) => Math.max(0, Math.min(project.duration, Math.round(t * project.fps) / project.fps))
  const pct = (t: number) => `${(t / project.duration) * 100}%`

  const ticks: number[] = []
  const step = project.duration > 30 ? 5 : project.duration > 10 ? 1 : 0.5
  for (let t = 0; t <= project.duration + 1e-6; t += step) ticks.push(t)

  const selKeyData = selectedKey
    ? (tracks[selectedKey.channel] ?? []).find((k) => Math.abs(k.t - selectedKey.t) < KEY_EPS)
    : undefined

  const onScrubDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    setPlaying(false)
    setTime(snapT(timeAt(e.clientX)))
  }
  const onScrubMove = (e: React.PointerEvent) => {
    if (e.buttons) setTime(snapT(timeAt(e.clientX)))
  }

  return (
    <div className="timeline">
      <div className="timeline-bar">
        <button className="btn icon" onClick={() => { setPlaying(false); setTime(0) }} title="Al inicio">
          ⏮
        </button>
        <button className="btn icon primary" onClick={() => setPlaying(!playing)} title="Reproducir / pausar (barra espaciadora)">
          {playing ? '❚❚' : '▶'}
        </button>
        <span className="time">
          {fmt(time)} <span className="muted">/ {fmt(project.duration)} · fotograma {Math.round(time * project.fps)}</span>
        </span>
        <div className="spacer" />
        {selectedKey && selKeyData ? (
          <div className="keybar">
            <span className="muted">
              Clave: <b>{channelLabel(ch, selectedKey.channel)}</b> en {fmt(selectedKey.t)} · Transición:
            </span>
            {(['suave', 'lineal', 'salto'] as Ease[]).map((e) => (
              <button key={e} className={'chip' + (selKeyData.ease === e ? ' active' : '')} onClick={() => setKeyEase(selectedKey, e)}>
                {e}
              </button>
            ))}
            <button className="btn small danger" onClick={() => deleteKey(selectedKey)} title="Borrar clave (Supr)">
              Borrar
            </button>
          </div>
        ) : (
          <span className="muted small">Pulsa un rombo para editar esa clave · arrástralo para cambiarla de momento</span>
        )}
      </div>

      <div className="timeline-body">
        <div className="tl-row tl-ruler">
          <div className="tl-label" style={{ width: LABEL_W }} />
          <div className="tl-track" ref={areaRef} onPointerDown={onScrubDown} onPointerMove={onScrubMove}>
            {ticks.map((t) => (
              <div key={t} className="tick" style={{ left: pct(t) }}>
                <span>{Number.isInteger(t) ? `${t}s` : ''}</span>
              </div>
            ))}
            <div className="playhead" style={{ left: pct(time) }}>
              <div className="playhead-handle" />
            </div>
          </div>
        </div>
        <div className="tl-rows">
          {project.audio && (
            <div className="tl-row">
              <div className="tl-label" style={{ width: LABEL_W }} title={project.audio.name}>
                🔊 Voz
              </div>
              <div className="tl-track" onPointerDown={onScrubDown} onPointerMove={onScrubMove}>
                <div className="row-playhead" style={{ left: pct(time) }} />
                <div
                  className="tl-wave"
                  style={{ left: pct(project.audio.start), width: pct(Math.min(project.audio.duration, project.duration - project.audio.start)) }}
                >
                  <Waveform id={project.audio.id} />
                </div>
              </div>
            </div>
          )}
          {channels.length === 0 && (
            <div className="tl-empty">Aún no hay animación. Mueve una pieza o cambia la cara y se creará una clave en el instante actual.</div>
          )}
          {channels.map((c) => {
            const partId = c.startsWith('part:') ? c.split(':')[1] : null
            return (
              <div key={c} className={'tl-row' + (partId && partId === selectedPart ? ' highlight' : '')}>
                <div className="tl-label" style={{ width: LABEL_W }} title={channelLabel(ch, c)} onClick={() => partId && selectPart(partId)}>
                  {channelLabel(ch, c)}
                </div>
                <div className="tl-track" onPointerDown={onScrubDown} onPointerMove={onScrubMove}>
                  <div className="row-playhead" style={{ left: pct(time) }} />
                  {tracks[c].map((k) => {
                    const sel = selectedKey && selectedKey.channel === c && Math.abs(selectedKey.t - k.t) < KEY_EPS
                    return (
                      <div
                        key={k.t}
                        className={'diamond' + (sel ? ' selected' : '') + (k.ease === 'salto' ? ' step' : '')}
                        style={{ left: pct(k.t) }}
                        title={`${fmt(k.t)} · ${typeof k.v === 'number' ? Math.round(k.v * 100) / 100 : k.v}`}
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          ;(e.target as Element).setPointerCapture(e.pointerId)
                          setPlaying(false)
                          selectKey({ channel: c, t: k.t })
                          if (partId) selectPart(partId)
                          dragKey.current = { channel: c, t: k.t, moved: false }
                        }}
                        onPointerMove={(e) => {
                          const d = dragKey.current
                          if (!d || !e.buttons) return
                          const to = snapT(timeAt(e.clientX))
                          if (Math.abs(to - d.t) < KEY_EPS) return
                          moveKeyTo({ channel: d.channel, t: d.t }, to)
                          d.t = to
                          d.moved = true
                        }}
                        onPointerUp={() => {
                          const d = dragKey.current
                          dragKey.current = null
                          if (d && !d.moved) setTime(d.t)
                        }}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Waveform({ id }: { id: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let alive = true
    decodeAudio(id).then((buf) => {
      const c = ref.current
      if (!buf || !c || !alive) return
      const w = (c.width = 800)
      const h = (c.height = 40)
      const g = c.getContext('2d')!
      const data = buf.getChannelData(0)
      const step = Math.floor(data.length / w)
      g.fillStyle = 'rgba(147, 197, 253, 0.9)'
      for (let x = 0; x < w; x++) {
        let m = 0
        for (let i = 0; i < step; i += 8) m = Math.max(m, Math.abs(data[x * step + i]))
        const bh = Math.max(1, m * h)
        g.fillRect(x, (h - bh) / 2, 1, bh)
      }
    })
    return () => {
      alive = false
    }
  }, [id])
  return <canvas ref={ref} />
}
