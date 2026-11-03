import { useRef } from 'react'
import { ENTRE, KEY_EPS, poseAt } from '../model/anim'
import type { Tracks } from '../model/types'
import { activeCharacter, useStore } from '../store'
import { Copilot } from './Copilot'
import { NOMBRES_POSES } from '../model/characters/chicoRosaPoses'
import { NOMBRES_EXPRESIVO } from '../model/characters/chicoRosaExpresivo'
import { applyCopilot } from '../copilot/context'
import { GESTOS } from '../model/gestures'
import { useState } from 'react'
import { decodeAudio, saveAudio, saveImage } from '../audio/storage'
import { evalTrack, setKey } from '../model/anim'
import { layout } from '../model/render'
import { addLayer, generateBackground } from '../script/images'
import { mouthKeys } from '../audio/lipsync'
import { KEY_EPS as EPS } from '../model/anim'

function hasKeyAt(tracks: Tracks, channel: string, t: number) {
  return (tracks[channel] ?? []).some((k) => Math.abs(k.t - t) < KEY_EPS)
}

const VARIANT_NAMES: Record<string, string> = {
  ...NOMBRES_POSES,
  ...NOMBRES_EXPRESIVO,
  natural: 'Natural',
  abierta: 'Abierta',
  palma_arriba: 'Palma arriba',
  puno: 'Puño',
  indice: 'Señalar',
  dorso: 'Dorso',
  pulgar: 'Pulgar',
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
      <Copilot />
      <Voice />
      <Backgrounds />
      <Gestures />
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
            <Slider label="Giro" channel={`part:${part.id}:rot`} value={pp.rot - (ch.idle?.[part.id] ?? 0)} min={-180} max={180} unit="°" />
            <Slider label="Mover ↔" channel={`part:${part.id}:x`} value={pp.x} min={-300} max={300} />
            <Slider label="Mover ↕" channel={`part:${part.id}:y`} value={pp.y} min={-300} max={300} />
            <Slider label="Tamaño" channel={`part:${part.id}:scale`} value={pp.scale} min={0.3} max={2} step={0.01} />
            {Object.keys(part.variants).length > 1 && !part.role && (
              <>
                <div className="sublabel">
                  <KeyDot on={hasKeyAt(inst.tracks, `part:${part.id}:v`, time)} /> Dibujo
                </div>
                <div className="chips">
                  {Object.keys(part.variants).filter((v) => !v.startsWith(ENTRE) && !v.includes('~')).map((v) => (
                    <button
                      key={v}
                      className={'chip' + ((pose.variants[part.id] ?? part.defaultVariant).split('~')[0] === v ? ' active' : '')}
                      onClick={() => key(`part:${part.id}:v`, v)}
                    >
                      {VARIANT_NAMES[v] ?? v}
                    </button>
                  ))}
                </div>
              </>
            )}
            <button className="btn small" onClick={() => resetPart(part.id)}>
              Volver a la postura inicial
            </button>
          </>
        )}
      </section>

      <Shoulders />
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
          <span title="Respiración, balanceo y parpadeos automáticos">Vida automática</span>
          <input type="checkbox" checked={project.vida !== false} onChange={(e) => setProjectProps({ vida: e.target.checked })} />
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

function Gestures() {
  const [lado, setLado] = useState<'der' | 'izq'>('der')
  const time = useStore((s) => s.time)
  const add = (id: string) => {
    const st = useStore.getState()
    const ch = activeCharacter(st.project)
    const { tracks, duration } = applyCopilot(
      { mensaje: '', duracion: 0, borrar: [], claves: [], gestos: [{ nombre: id, t: st.time, lado, velocidad: 1 }] },
      st.project,
      ch,
    )
    const start = st.time
    st.replaceTracks(tracks, duration)
    st.setTime(Math.max(0, start - 0.3))
    st.setPlaying(true)
  }
  return (
    <section>
      <h3>Gestos</h3>
      <div className="gesture-side">
        <span className="muted small">Brazo:</span>
        <div className="segmented small-seg">
          <button className={lado === 'izq' ? 'active' : ''} onClick={() => setLado('izq')}>
            izquierdo
          </button>
          <button className={lado === 'der' ? 'active' : ''} onClick={() => setLado('der')}>
            derecho
          </button>
        </div>
      </div>
      <div className="chips">
        {GESTOS.map((g) => (
          <button key={g.id} className="chip" title={g.descripcion} onClick={() => add(g.id)}>
            {g.nombre}
          </button>
        ))}
      </div>
      <p className="muted small">Se añade en el instante actual ({time.toFixed(1).replace('.', ',')} s). Ctrl+Z para quitarlo.</p>
    </section>
  )
}

/** Subir los hombros (los dos o uno): mueve los brazos desde el hombro y la camiseta los acompaña. */
function Shoulders() {
  const project = useStore((s) => s.project)
  const time = useStore((s) => s.time)
  const keyMany = useStore((s) => s.keyMany)
  const ch = activeCharacter(project)
  const inst = project.instances[0]
  const sides = (['izq', 'der'] as const).filter((s) => ch.parts.some((p) => p.id === `brazo_${s}`))
  if (!sides.length) return null
  const fore = ch.parts.find((p) => p.id.startsWith('antebrazo_'))
  const top = 0.12 * (fore ? Math.hypot(fore.offset.x, fore.offset.y) : 200)
  const pose = poseAt(ch, inst.tracks, time)
  const level = (s: string) => Math.max(0, Math.min(1, -(pose.parts[`brazo_${s}`]?.y ?? 0) / top))
  const set = (which: readonly string[], v: number) =>
    keyMany(Object.fromEntries(which.map((s) => [`part:brazo_${s}:y`, Math.round(-v * top)])), `hombros:${which.join()}`)
  return (
    <section>
      <h3>Hombros</h3>
      <label className="slider">
        <span className="slider-label">Los dos</span>
        <input type="range" min={0} max={1} step={0.01} value={Math.max(...sides.map(level))} onChange={(e) => set(sides, Number(e.target.value))} />
        <span className="slider-value">{Math.round(Math.max(...sides.map(level)) * 100)}%</span>
      </label>
      {sides.map((s) => (
        <label className="slider" key={s}>
          <span className="slider-label">{s === 'izq' ? 'Izquierdo' : 'Derecho'}</span>
          <input type="range" min={0} max={1} step={0.01} value={level(s)} onChange={(e) => set([s], Number(e.target.value))} />
          <span className="slider-value">{Math.round(level(s) * 100)}%</span>
        </label>
      ))}
    </section>
  )
}

function Voice() {
  const project = useStore((s) => s.project)
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const audio = project.audio

  const onFile = async (file: File) => {
    try {
      setMsg('Cargando audio…')
      const id = `${Date.now()}-${file.name}`
      await saveAudio(id, file)
      const buf = await decodeAudio(id)
      if (!buf) throw new Error('no se pudo leer')
      const st = useStore.getState()
      const start = Math.round(st.time * st.project.fps) / st.project.fps
      const duration = Math.max(st.project.duration, Math.ceil((start + buf.duration + 0.5) * 2) / 2)
      st.setProjectProps({ audio: { id, name: file.name, start, duration: buf.duration } })
      if (duration !== st.project.duration) useStore.getState().setProjectProps({ duration })
      setMsg('Audio añadido. Pulsa «Mover la boca con la voz».')
    } catch {
      setMsg('No se ha podido leer ese archivo de audio (prueba con MP3 o WAV).')
    }
  }

  const sync = async () => {
    const st = useStore.getState()
    if (!st.project.audio) return
    const buf = await decodeAudio(st.project.audio.id)
    if (!buf) {
      setMsg('Este navegador no tiene guardado el audio: vuelve a añadirlo.')
      return
    }
    const ch = activeCharacter(st.project)
    const mouths = Object.keys(ch.parts.find((p) => p.role === 'mouth')?.variants ?? {})
    const a = st.project.audio
    const keys = mouthKeys(buf, a.start, st.project.fps, mouths)
    const tracks = { ...st.project.instances[0].tracks }
    const kept = (tracks['face:mouth'] ?? []).filter((k) => k.t < a.start - EPS || k.t > a.start + a.duration + EPS)
    tracks['face:mouth'] = [...kept, ...keys].sort((x, y) => x.t - y.t)
    st.replaceTracks(tracks, st.project.duration)
    setMsg(`Boca sincronizada: ${keys.length} cambios.`)
  }

  return (
    <section>
      <h3>Voz</h3>
      {audio ? (
        <>
          <div className="voice-name" title={audio.name}>🔊 {audio.name}</div>
          <label className="field">
            <span>Empieza en (s)</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={audio.start}
              onChange={(e) => {
                const v = Math.max(0, Number(e.target.value) || 0)
                useStore.getState().setProjectProps({ audio: { ...audio, start: v } })
              }}
            />
          </label>
          <button className="btn primary full" onClick={sync}>
            Mover la boca con la voz
          </button>
          <div className="voice-row">
            <button className="btn small" onClick={() => fileRef.current?.click()}>
              Cambiar audio
            </button>
            <button className="btn small danger" onClick={() => useStore.getState().setProjectProps({ audio: undefined })}>
              Quitar
            </button>
          </div>
        </>
      ) : (
        <button className="btn full" onClick={() => fileRef.current?.click()}>
          Añadir audio de voz…
        </button>
      )}
      {msg && <p className="muted small">{msg}</p>}
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
    </section>
  )
}

function Backgrounds() {
  const project = useStore((s) => s.project)
  const time = useStore((s) => s.time)
  const key = useStore((s) => s.key)
  const fileRef = useRef<HTMLInputElement>(null)
  const sel = useStore((s) => s.selectedLayer)
  const setSel = useStore((s) => s.selectLayer)
  const [msg, setMsg] = useState<string | null>(null)
  const layers = project.fondos ?? []
  const tracks = project.instances[0].tracks
  const val = (ch: string, d: number) => {
    const v = evalTrack(tracks[ch], time, d)
    return typeof v === 'number' ? v : Number(v) || d
  }
  const layer = layers.find((l) => l.id === sel) ?? null
  const [desc, setDesc] = useState('')
  const [genBusy, setGenBusy] = useState(false)
  const generar = async () => {
    if (!desc.trim() || genBusy) return
    setGenBusy(true)
    setMsg('Generando fondo… (unos 10-20 s)')
    try {
      const l = await generateBackground(desc.trim(), useStore.getState().project)
      addLayer(l)
      setSel(l.id)
      setMsg('Fondo añadido.')
      setDesc('')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setGenBusy(false)
    }
  }

  const onFile = async (file: File) => {
    try {
      const bmp = await createImageBitmap(file)
      const id = `fondo-${Date.now()}`
      await saveImage(id, file)
      const st = useStore.getState()
      const next = [...(st.project.fondos ?? []), { id, name: file.name.replace(/\.[^.]+$/, ''), imageId: id, w: bmp.width, h: bmp.height }]
      st.setProjectProps({ fondos: next })
      setSel(id)
      setMsg(null)
    } catch {
      setMsg('No se ha podido leer esa imagen (usa JPG, PNG o WEBP).')
    }
  }

  const update = (patch: Partial<NonNullable<typeof layer>>) => {
    if (!layer) return
    useStore.getState().setProjectProps({ fondos: layers.map((l) => (l.id === layer.id ? { ...l, ...patch } : l)) })
  }

  /** Movimiento de un tramo: pone claves al principio y al final desde el instante actual. */
  const preset = (pairs: [string, number, number][], dur: number) => {
    const st = useStore.getState()
    const fps = st.project.fps
    const t0 = Math.round(st.time * fps) / fps
    const t1 = Math.min(st.project.duration, t0 + dur)
    const tr = pairs.reduce((acc, [ch, a, b]) => setKey(setKey(acc, ch, t0, a, 'suave'), ch, t1, b, 'suave'), { ...st.project.instances[0].tracks })
    st.replaceTracks(tr, st.project.duration)
  }
  const rest = Math.max(1, project.duration - time)

  const slider = (label: string, ch: string, d: number, min: number, max: number, step = 1, unit = '') => {
    const v = val(ch, d)
    return (
      <label className="slider" key={ch}>
        <span className="slider-label">
          <span className={'keydot' + ((tracks[ch] ?? []).some((k) => Math.abs(k.t - time) < 1 / 120) ? ' on' : '')} />
          {label}
        </span>
        <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => key(ch, Number(e.target.value))} />
        <span className="slider-value">
          {step < 1 ? v.toFixed(2) : Math.round(v)}
          {unit}
        </span>
      </label>
    )
  }

  return (
    <section>
      <h3>Fondos y cámara</h3>
      <div className="chips">
        {layers.map((l) => (
          <button key={l.id} className={'chip' + (l.id === sel ? ' active' : '')} onClick={() => setSel(l.id === sel ? null : l.id)} title={l.delante ? 'Delante del personaje' : 'Detrás del personaje'}>
            {l.delante ? '▲ ' : ''}
            {l.name}
          </button>
        ))}
        <button className="chip" onClick={() => fileRef.current?.click()}>
          + Añadir imagen
        </button>
      </div>
      <div className="gen-row">
        <input
          className="copilot-pass"
          placeholder="Describe un fondo: consulta de psicólogo de noche…"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && generar()}
          disabled={genBusy}
        />
        <button className="btn small primary" onClick={generar} disabled={genBusy || !desc.trim()} title="Genera el fondo con IA en el estilo del personaje">
          {genBusy ? '…' : '✨ Generar'}
        </button>
      </div>
      {msg && <p className="muted small">{msg}</p>}
      {layer && (
        <div className="layer-box">
          {slider('Mover ↔', `bg:${layer.id}:x`, 0, -project.width, project.width)}
          {slider('Mover ↕', `bg:${layer.id}:y`, 0, -project.height, project.height)}
          {slider('Tamaño', `bg:${layer.id}:scale`, 1, 0.1, 3, 0.01)}
          {slider('Giro', `bg:${layer.id}:rot`, 0, -180, 180, 1, '°')}
          {slider('Opacidad', `bg:${layer.id}:opacity`, 1, 0, 1, 0.01)}
          <div className="chips">
            <button className="chip" title="Acerca la imagen poco a poco hasta el final" onClick={() => preset([[`bg:${layer.id}:scale`, val(`bg:${layer.id}:scale`, 1), val(`bg:${layer.id}:scale`, 1) * 1.15]], rest)}>
              Acercar despacio
            </button>
            <button className="chip" title="Desplaza la imagen de un lado a otro hasta el final" onClick={() => preset([[`bg:${layer.id}:x`, val(`bg:${layer.id}:x`, 0) + 60, val(`bg:${layer.id}:x`, 0) - 60], [`bg:${layer.id}:scale`, Math.max(1.1, val(`bg:${layer.id}:scale`, 1)), Math.max(1.1, val(`bg:${layer.id}:scale`, 1))]], rest)}>
              Desplazar
            </button>
            <button className="chip" onClick={() => preset([[`bg:${layer.id}:opacity`, 0, 1]], 0.6)}>
              Aparecer
            </button>
            <button className="chip" onClick={() => preset([[`bg:${layer.id}:opacity`, 1, 0]], 0.6)}>
              Desaparecer
            </button>
          </div>
          <div className="voice-row">
            <button className="btn small" onClick={() => update({ delante: !layer.delante })}>
              {layer.delante ? 'Poner detrás del personaje' : 'Poner delante del personaje'}
            </button>
            <button
              className="btn small danger"
              onClick={() => {
                const st = useStore.getState()
                const tr = Object.fromEntries(Object.entries(st.project.instances[0].tracks).filter(([c]) => !c.startsWith(`bg:${layer.id}:`)))
                st.setProjectProps({ fondos: layers.filter((l) => l.id !== layer.id) })
                useStore.getState().replaceTracks(tr, st.project.duration)
                setSel(null)
              }}
            >
              Quitar
            </button>
          </div>
        </div>
      )}
      <div className="sublabel">Cámara</div>
      {slider('Zoom', 'cam:zoom', 1, 0.5, 3, 0.01)}
      {slider('Mover ↔', 'cam:x', 0, -project.width / 2, project.width / 2)}
      {slider('Mover ↕', 'cam:y', 0, -project.height / 2, project.height / 2)}
      <div className="chips">
        <button className="chip" title="Acerca la cámara a la cara en 1 segundo" onClick={() => {
          const st = useStore.getState()
          const ch = activeCharacter(st.project)
          const inst = st.project.instances[0]
          // Centro de la cabeza en la escena (vale para cualquier personaje con pieza «cabeza»)
          const pl = layout(ch, inst, poseAt(ch, inst.tracks, st.time)).find((p) => p.part.id === 'cabeza')
          const a = pl && ch.assets[pl.assetId]
          const c = pl && a ? pl.matrix.transformPoint(new DOMPoint(a.w / 2 - pl.part.anchor.x, a.h / 2 - pl.part.anchor.y)) : { x: inst.x, y: inst.y - 600 }
          const hy = c.y + 0.15 * project.height / 1.8
          preset([['cam:zoom', val('cam:zoom', 1), 1.8], ['cam:y', val('cam:y', 0), hy - project.height / 2], ['cam:x', val('cam:x', 0), c.x - project.width / 2]], 1)
        }}>
          Primer plano
        </button>
        <button className="chip" onClick={() => preset([['cam:zoom', val('cam:zoom', 1), 1], ['cam:x', val('cam:x', 0), 0], ['cam:y', val('cam:y', 0), 0]], 1)}>
          Plano general
        </button>
        <button className="chip" title="Acerca la cámara muy poco a poco hasta el final" onClick={() => preset([['cam:zoom', val('cam:zoom', 1), val('cam:zoom', 1) * 1.12]], rest)}>
          Zoom lento
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
    </section>
  )
}
