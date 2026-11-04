import { useEffect, useState } from 'react'
import { buildContext } from '../copilot/context'
import { GESTOS } from '../model/gestures'
import type { Escena, Plano } from '../model/types'
import { animateScenes, estimateDuration, scenesFromText } from '../script/scenes'
import { activeCharacter, useStore } from '../store'
import { ScriptStyles } from './ScriptStyles'
import { listVoices, voiceScript, type Modelo, type Voz } from '../script/voices'
import { generateSceneBackgrounds } from '../script/images'

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
  // Un guion que llega de Claude (propuesto o ya montado) se carga en el panel
  const borrador = useStore((s) => s.borradorGuion)
  useEffect(() => {
    if (!borrador) return
    setTexto(borrador.texto)
    setEscenas(borrador.escenas)
    setMsg({ ok: true, text: borrador.mensaje ? `Claude: ${borrador.mensaje}` : 'Claude te ha propuesto este guion. Revísalo y pulsa «Animar escenas».' })
  }, [borrador])
  const montado = useStore((s) => s.project.guion)
  useEffect(() => {
    if (montado?.escenas.length && !borrador) {
      setTexto(montado.texto)
      setEscenas(montado.escenas)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montado])
  // Voz de ElevenLabs
  const VOZ_KEY = 'estudio-animacion:voz'
  const [voces, setVoces] = useState<Voz[] | null>(null)
  const [voz, setVoz] = useState<Voz | null>(() => {
    try {
      return project.guion?.voz ?? JSON.parse(localStorage.getItem(VOZ_KEY) ?? 'null')
    } catch {
      return null
    }
  })
  const [vozManual, setVozManual] = useState('')
  const MODELO_KEY = 'estudio-animacion:modelo-voz'
  const [modelo, setModeloState] = useState<Modelo>(() => {
    try {
      return (localStorage.getItem(MODELO_KEY) as Modelo) || 'eleven_multilingual_v2'
    } catch {
      return 'eleven_multilingual_v2'
    }
  })
  const setModelo = (m: Modelo) => {
    setModeloState(m)
    try {
      localStorage.setItem(MODELO_KEY, m)
    } catch {
      // sin almacenamiento
    }
  }
  const elegirVoz = (v: Voz | null) => {
    setVoz(v)
    try {
      localStorage.setItem(VOZ_KEY, JSON.stringify(v))
    } catch {
      // sin almacenamiento
    }
  }
  const cargarVoces = async () => {
    try {
      setVoces(await listVoices(pass))
    } catch (e) {
      setVoces([])
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) })
    }
  }
  const conVoz = async () => {
    if (!voz || busy || !escenas.length) return
    const hay = Object.keys(useStore.getState().project.instances[0].tracks).length > 0
    if (hay && !confirm('Esto sustituye la animación actual por la de las escenas, con voz. Se puede deshacer con Ctrl+Z. ¿Seguir?')) return
    setBusy(true)
    try {
      const r = await voiceScript(escenas, texto, voz, pass, (t) => setMsg({ ok: true, text: t }), modelo)
      setEscenas(r.escenas)
      setMsg({ ok: true, text: `Listo: ${r.duracion.toFixed(1).replace('.', ',')} s con la voz de ${voz.nombre}. Las voces quedan guardadas: si cambias solo gestos o planos no se vuelven a pagar.` })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }
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
      <ScriptStyles />
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
            <button
              className="btn small"
              style={{ marginLeft: 8 }}
              onClick={() => setEscenas((es) => es.map((e) => ({ ...e, plano: 'general' as Plano })))}
              title="Pone todas las escenas en plano general: cuerpo entero, sin zooms"
            >
              Todo en plano general
            </button>
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
          <div className="voice-pick">
            <div className="sublabel">Voz (ElevenLabs)</div>
            {voces === null ? (
              <button className="btn small" onClick={cargarVoces}>
                {voz ? `Voz: ${voz.nombre} · cambiar` : 'Elegir voz…'}
              </button>
            ) : (
              <select
                value={voz?.id ?? ''}
                onChange={(ev) => elegirVoz(voces.find((v) => v.id === ev.target.value) ?? null)}
              >
                <option value="">— Elige una voz —</option>
                {voz && !voces.some((v) => v.id === voz.id) && <option value={voz.id}>{voz.nombre}</option>}
                {voces.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                    {v.tipo === 'cloned' ? ' (clonada)' : v.tipo === 'generated' ? ' (diseñada)' : ''}
                  </option>
                ))}
              </select>
            )}
            {voces !== null && voces.length === 0 && (
              <div className="voice-row">
                <input className="copilot-pass" placeholder="O pega el ID de una voz" value={vozManual} onChange={(e) => setVozManual(e.target.value.trim())} />
                <button className="btn small" disabled={vozManual.length < 10} onClick={() => elegirVoz({ id: vozManual, nombre: 'Voz ' + vozManual.slice(0, 6) })}>
                  Usar
                </button>
              </div>
            )}
            <select value={modelo} onChange={(e) => setModelo(e.target.value as Modelo)} title="Modelo de ElevenLabs">
              <option value="eleven_multilingual_v2">Estable (Multilingual v2)</option>
              <option value="eleven_v3">Expresiva (ElevenLabs v3)</option>
            </select>
            <button className="btn primary full" disabled={!voz || busy} onClick={conVoz}>
              {busy ? 'Trabajando…' : '🎙 Generar voces y animar'}
            </button>
          </div>
          <button
            className="btn full"
            onClick={() => {
              const hay = Object.keys(useStore.getState().project.instances[0].tracks).length > 0
              if (hay && !confirm('Esto sustituye la animación actual por la de las escenas. Se puede deshacer con Ctrl+Z. ¿Seguir?')) return
              applyScript(escenas, texto)
              setMsg({ ok: true, text: 'Animación creada. Se está reproduciendo; retócala con los controles o el copiloto.' })
            }}
          >
            ▶ Animar escenas (sin voz)
          </button>
          <button
            className="btn full"
            disabled={busy || !escenas.length}
            title="Genera con IA el fondo que pide cada escena y lo cambia en cada corte"
            onClick={async () => {
              setBusy(true)
              try {
                const nuevas = await generateSceneBackgrounds(escenas, (t) => setMsg({ ok: true, text: t }))
                setEscenas(nuevas)
                const n = new Set(nuevas.map((e) => e.capa).filter(Boolean)).size
                setMsg({ ok: true, text: `${n} fondos generados. Quedan unidos a sus escenas: aunque generes voces o vuelvas a animar, se recolocan solos.` })
              } catch (e) {
                setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) })
              } finally {
                setBusy(false)
              }
            }}
          >
            🖼 Generar fondos de las escenas
          </button>
        </>
      )}
    </div>
  )
}
