import { useState } from 'react'
import { buildContext } from '../copilot/context'
import { GESTOS } from '../model/gestures'
import type { Escena, Plano } from '../model/types'
import { animateScenes, estimateDuration, scenesFromText } from '../script/scenes'
import { activeCharacter, useStore } from '../store'

const PASS_KEY = 'estudio-animacion:clave'
const readPass = () => {
  try {
    return localStorage.getItem(PASS_KEY) ?? ''
  } catch {
    return ''
  }
}
const uid = () => Math.random().toString(36).slice(2, 9)

/** Monta las escenas como animación nueva en un solo paso de deshacer. */
export function applyScript(escenas: Escena[], texto?: string) {
  const st = useStore.getState()
  const ch = activeCharacter(st.project)
  const m = animateScenes(escenas, st.project, ch)
  const [inst, ...rest] = st.project.instances
  st.commit({
    ...st.project,
    duration: Math.max(m.duration, st.project.audio ? st.project.audio.start + st.project.audio.duration : 0),
    guion: { texto: texto ?? st.project.guion?.texto ?? '', escenas: m.escenas.map(({ inicio: _i, ...e }) => e) },
    instances: [{ ...inst, tracks: m.tracks }, ...rest],
  })
  st.setTime(0)
  st.setPlaying(true)
  return m
}

export function ScriptPanel({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project)
  const [texto, setTexto] = useState(project.guion?.texto ?? '')
  const [escenas, setEscenas] = useState<Escena[]>(project.guion?.escenas ?? [])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pass, setPass] = useState(readPass)
  const [needPass, setNeedPass] = useState(false)
  const ch = activeCharacter(project)
  const expresiones = Object.keys(ch.expressions)

  let acc = 0
  const inicios = escenas.map((e) => {
    const s = acc
    acc += e.duracion || estimateDuration(e.dialogo)
    return s
  })

  const conIA = async () => {
    if (!texto.trim() || busy) return
    setBusy(true)
    setMsg(null)
    try {
      const st = useStore.getState()
      const res = await fetch('/api/guion', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-clave-estudio': pass },
        body: JSON.stringify({ texto, contexto: buildContext(st.project, activeCharacter(st.project), 0, null) }),
      })
      const data = await res.json().catch(() => ({ error: 'El servidor no respondió bien.' }))
      if (res.status === 401) {
        setNeedPass(true)
        setMsg({ ok: false, text: pass ? 'Esa contraseña no es correcta.' : 'Escribe la contraseña del estudio.' })
        return
      }
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? `Error ${res.status}` })
        return
      }
      setEscenas((data.escenas as Omit<Escena, 'id'>[]).map((e) => ({ ...e, id: uid() })))
      setMsg({ ok: true, text: data.mensaje || 'Escenas listas. Revísalas y pulsa «Animar escenas».' })
      if (!texto.includes('\n') && data.escenas?.length) setTexto((data.escenas as Escena[]).map((e) => e.dialogo).filter(Boolean).join('\n\n'))
    } catch {
      setMsg({ ok: false, text: 'No hay conexión con la IA.' })
    } finally {
      setBusy(false)
    }
  }

  const edit = (i: number, patch: Partial<Escena>) => setEscenas((es) => es.map((e, j) => (j === i ? { ...e, ...patch } : e)))
  const total = acc

  return (
    <div className="script-panel">
      <div className="script-head">
        <h2>Guion</h2>
        <button className="btn icon" onClick={onClose} title="Cerrar">
          ✕
        </button>
      </div>
      <p className="muted small">
        Escribe el guion (un párrafo o línea por escena) o solo una idea, por ejemplo «reel de 30 segundos sobre cómo calmar la ansiedad antes de dormir», y la IA lo escribe.
      </p>
      <textarea className="script-text" rows={7} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Hola, soy... / Hoy te cuento..." />
      {needPass && (
        <input
          className="copilot-pass"
          type="password"
          placeholder="Contraseña del estudio"
          value={pass}
          onChange={(e) => {
            setPass(e.target.value)
            try {
              localStorage.setItem(PASS_KEY, e.target.value)
            } catch {
              // sin almacenamiento
            }
          }}
        />
      )}
      <div className="voice-row script-actions">
        <button className="btn primary" onClick={conIA} disabled={busy || !texto.trim()}>
          {busy ? 'Pensando escenas…' : '✨ Escenas con IA'}
        </button>
        <button className="btn" onClick={() => setEscenas(scenesFromText(texto))} disabled={!texto.trim()} title="Un párrafo o línea por escena, sin gastar IA">
          Dividir sin IA
        </button>
      </div>
      {msg && <p className={'copilot-reply' + (msg.ok ? '' : ' error')}>{msg.text}</p>}

      {escenas.length > 0 && (
        <>
          <div className="script-sum muted small">
            {escenas.length} escenas · {total.toFixed(1).replace('.', ',')} s
          </div>
          <div className="scene-list">
            {escenas.map((e, i) => (
              <div className="scene-card" key={e.id}>
                <div className="scene-top">
                  <b>{i + 1}</b>
                  <span className="muted small">{inicios[i].toFixed(1).replace('.', ',')} s</span>
                  <div className="spacer" />
                  <button className="btn small" onClick={() => useStore.getState().setTime(inicios[i])} title="Ir a esta escena">
                    Ir
                  </button>
                  <button className="btn small danger" onClick={() => setEscenas((es) => es.filter((_, j) => j !== i))}>
                    ✕
                  </button>
                </div>
                <textarea rows={2} value={e.dialogo} onChange={(ev) => edit(i, { dialogo: ev.target.value, duracion: estimateDuration(ev.target.value) })} placeholder="(sin diálogo)" />
                <div className="scene-fields">
                  <label>
                    Plano
                    <select value={e.plano} onChange={(ev) => edit(i, { plano: ev.target.value as Plano })}>
                      <option value="general">General</option>
                      <option value="medio">Medio</option>
                      <option value="primer">Primer plano</option>
                    </select>
                  </label>
                  <label>
                    Cara
                    <select value={e.expresion} onChange={(ev) => edit(i, { expresion: ev.target.value })}>
                      {expresiones.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Gesto
                    <select
                      value={e.gestos[0]?.nombre ?? ''}
                      onChange={(ev) =>
                        edit(i, { gestos: ev.target.value ? [{ nombre: ev.target.value, t: 0.3, lado: e.gestos[0]?.lado ?? 'der', velocidad: 1 }, ...e.gestos.slice(1)] : e.gestos.slice(1) })
                      }
                    >
                      <option value="">(ninguno)</option>
                      {GESTOS.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Seg.
                    <input type="number" min={1} max={30} step={0.1} value={e.duracion} onChange={(ev) => edit(i, { duracion: Math.max(1, Number(ev.target.value) || 1) })} />
                  </label>
                </div>
                {(e.accion || e.fondo) && (
                  <div className="muted small">
                    {e.accion}
                    {e.fondo ? ` · Fondo: ${e.fondo}` : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            className="btn primary full"
            onClick={() => {
              const hay = Object.keys(useStore.getState().project.instances[0].tracks).length > 0
              if (hay && !confirm('Esto sustituye la animación actual por la de las escenas. Se puede deshacer con Ctrl+Z. ¿Seguir?')) return
              applyScript(escenas, texto)
              setMsg({ ok: true, text: 'Animación creada. Se está reproduciendo; retócala con los controles o el copiloto.' })
            }}
          >
            ▶ Animar escenas
          </button>
        </>
      )}
    </div>
  )
}
