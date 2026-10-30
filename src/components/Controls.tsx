import { useRef } from 'react'
import { KEY_EPS, poseAt } from '../model/anim'
import type { Tracks } from '../model/types'
import { activeCharacter, useStore } from '../store'

function hasKeyAt(tracks: Tracks, channel: string, t: number) {
  return (tracks[channel] ?? []).some((k) => Math.abs(k.t - t) < KEY_EPS)
}

function KeyDot({ on, title }: { on: boolean; title?: string }) {
  return <span className={'keydot' + (on ? ' on' : '')} title={title ?? (on ? 'Hay clave en este instante' : 'Sin clave en este instante')} />
}

interface SliderProps {
  label: string
  channel: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
}

function Slider({ label, channel, value, min, max, step = 1, unit = '' }: SliderProps) {
  const tracks = useStore((s) => s.project.instances[0].tracks)
  const time = useStore((s) => s.time)
  const key = useStore((s) => s.key)
  return (
    <label className="slider">
      <span className="slider-label">
        <KeyDot on={hasKeyAt(tracks, channel, time)} />
        {label}
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => key(channel, Number(e.target.value))} />
      <span className="slider-value">
        {Number.isInteger(step) ? Math.round(value) : value.toFixed(2)}
        {unit}
      </span>
    </label>
  )
}

function GazePad({ x, y }: { x: number; y: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const keyMany = useStore((s) => s.keyMany)
  const apply = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    const gx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1))
    const gy = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1))
    keyMany({ 'face:gazeX': Math.round(gx * 100) / 100, 'face:gazeY': Math.round(gy * 100) / 100 }, 'gaze')
  }
  return (
    <div
      ref={ref}
      className="gazepad"
      onPointerDown={(e) => {
        ;(e.target as Element).setPointerCapture(e.pointerId)
        apply(e)
      }}
      onPointerMove={(e) => e.buttons && apply(e)}
      title="Arrastra para mover la mirada"
    >
      <div className="gazepad-cross" />
      <div className="gazepad-dot" style={{ left: `${(x + 1) * 50}%`, top: `${(y + 1) * 50}%` }} />
    </div>
  )
}

export function Controls() {
  const project = useStore((s) => s.project)
  const time = useStore((s) => s.time)
  const selectedPart = useStore((s) => s.selectedPart)
  const selectPart = useStore((s) => s.selectPart)
  const key = useStore((s) => s.key)
  const keyMany = useStore((s) => s.keyMany)
  const insertBlink = useStore((s) => s.insertBlink)
  const resetPart = useStore((s) => s.resetPart)
  const setInstance = useStore((s) => s.setInstance)
  const setProjectProps = useStore((s) => s.setProjectProps)

  const ch = activeCharacter(project)
  const inst = project.instances[0]
  const pose = poseAt(ch, inst.tracks, time)
  const part = ch.parts.find((p) => p.id === selectedPart)
  const pp = part ? pose.parts[part.id] : null
  const mouthPart = ch.parts.find((p) => p.role === 'mouth')
  const browsPart = ch.parts.find((p) => p.role === 'brows')

  return (
    <aside className="panel controls">
      <section>
        <h3>Pieza</h3>
        <select value={selectedPart ?? ''} onChange={(e) => selectPart(e.target.value || null)}>
          <option value="">— Elige una pieza o púlsala en el dibujo —</option>
          {ch.parts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {part && pp && (
          <>
            <Slider label="Giro" channel={`part:${part.id}:rot`} value={pp.rot} min={-180} max={180} unit="°" />
            <Slider label="Mover ↔" channel={`part:${part.id}:x`} value={pp.x} min={-300} max={300} />
            <Slider label="Mover ↕" channel={`part:${part.id}:y`} value={pp.y} min={-300} max={300} />
            <Slider label="Tamaño" channel={`part:${part.id}:scale`} value={pp.scale} min={0.3} max={2} step={0.01} />
            <button className="btn small" onClick={() => resetPart(part.id)}>
              Volver a la postura inicial
            </button>
          </>
        )}
      </section>

      <section>
        <h3>Cara</h3>
        <div className="face-row">
          <div>
            <div className="sublabel">
              <KeyDot on={hasKeyAt(inst.tracks, 'face:gazeX', time)} /> Mirada
            </div>
            <GazePad x={pose.gazeX} y={pose.gazeY} />
            <button className="btn small" onClick={() => keyMany({ 'face:gazeX': 0, 'face:gazeY': 0 }, 'gaze-center')}>
              Al frente
            </button>
          </div>
          <div className="face-col">
            <Slider label="Párpados" channel="face:blink" value={pose.blink} min={0} max={1} step={0.01} />
            <button className="btn small" onClick={insertBlink} title="Añade un parpadeo de 0,2 s en el instante actual">
              Parpadeo aquí
            </button>
          </div>
        </div>

        <div className="sublabel">Expresiones</div>
        <div className="chips">
          {Object.entries(ch.expressions).map(([name, ex]) => (
            <button
              key={name}
              className={'chip' + (pose.brows === ex.brows && pose.mouth === ex.mouth ? ' active' : '')}
              onClick={() => keyMany({ 'face:brows': ex.brows, 'face:mouth': ex.mouth }, 'expr')}
            >
              {name}
            </button>
          ))}
        </div>

        {mouthPart && (
          <>
            <div className="sublabel">
              <KeyDot on={hasKeyAt(inst.tracks, 'face:mouth', time)} /> Boca
            </div>
            <div className="chips">
              {Object.keys(mouthPart.variants).map((v) => (
                <button key={v} className={'chip' + (pose.mouth === v ? ' active' : '')} onClick={() => key('face:mouth', v)}>
                  {v}
                </button>
              ))}
            </div>
          </>
        )}
        {browsPart && (
          <>
            <div className="sublabel">
              <KeyDot on={hasKeyAt(inst.tracks, 'face:brows', time)} /> Cejas
            </div>
            <div className="chips">
              {Object.keys(browsPart.variants).map((v) => (
                <button key={v} className={'chip' + (pose.brows === v ? ' active' : '')} onClick={() => key('face:brows', v)}>
                  {v}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <section>
        <h3>Escena</h3>
        <label className="slider">
          <span className="slider-label">Posición ↔</span>
          <input type="range" min={0} max={project.width} value={inst.x} onChange={(e) => setInstance({ x: Number(e.target.value) }, 'inst-x')} />
          <span className="slider-value">{Math.round(inst.x)}</span>
        </label>
        <label className="slider">
          <span className="slider-label">Posición ↕</span>
          <input type="range" min={0} max={project.height} value={inst.y} onChange={(e) => setInstance({ y: Number(e.target.value) }, 'inst-y')} />
          <span className="slider-value">{Math.round(inst.y)}</span>
        </label>
        <label className="slider">
          <span className="slider-label">Tamaño</span>
          <input type="range" min={0.2} max={4} step={0.05} value={inst.scale} onChange={(e) => setInstance({ scale: Number(e.target.value) }, 'inst-scale')} />
          <span className="slider-value">{inst.scale.toFixed(2)}</span>
        </label>
        <label className="field">
          <span>Fondo</span>
          <input type="color" value={project.background} onChange={(e) => setProjectProps({ background: e.target.value })} />
        </label>
        <label className="field">
          <span>Duración (s)</span>
          <input
            type="number"
            min={1}
            max={120}
            step={0.5}
            value={project.duration}
            onChange={(e) => {
              const d = Number(e.target.value)
              if (d >= 1 && d <= 120) setProjectProps({ duration: d })
            }}
          />
        </label>
      </section>
    </aside>
  )
}
