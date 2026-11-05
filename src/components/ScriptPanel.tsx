import { useEffect, useRef, useState } from 'react'
import { buildContext } from '../copilot/context'
import { GESTOS } from '../model/gestures'
import type { Escena, Plano } from '../model/types'
import { animateScenes, estimateDuration, scenesFromText } from '../script/scenes'
import { activeCharacter, useStore } from '../store'
import { ScriptStyles } from './ScriptStyles'
import { listVoices, verPlan, voiceScript, type Modelo, type PlanDirector, type Voz } from '../script/voices'
import { PlanVista } from './PlanVista'
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

// Borrador del panel (guion, escenas y anotaciones): se guarda solo mientras se escribe, para que no se
// pierda al cerrar el panel o recargar la página antes de «Generar voces y animar»
const BORRADOR_KEY = 'estudio-animacion:borrador-guion'
type Borrador = { texto: string; escenas: Escena[]; indicaciones: string }
function leerBorrador(): Borrador | null {
  try {
    const b = JSON.parse(localStorage.getItem(BORRADOR_KEY) ?? 'null') as Borrador | null
    return b && (b.texto?.trim() || b.escenas?.length) ? b : null
  } catch {
    return null
  }
}

export function ScriptPanel({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project)
  const [guardado] = useState(leerBorrador)
  const [texto, setTexto] = useState(guardado?.texto ?? project.guion?.texto ?? '')
  const [escenas, setEscenas] = useState<Escena[]>(guardado?.escenas ?? project.guion?.escenas ?? [])
  const planosPrevios = useRef<Plano[] | null>(null)
  const [indicaciones, setIndicaciones] = useState(guardado?.indicaciones ?? project.guion?.indicaciones ?? '')
  useEffect(() => {
    try {
      localStorage.setItem(BORRADOR_KEY, JSON.stringify({ texto, escenas, indicaciones }))
    } catch {
      // sin almacenamiento: no pasa nada
    }
  }, [texto, escenas, indicaciones])
  const todoGeneral = escenas.length > 0 && escenas.every((e) => e.plano === 'general')
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
  const primeraVez = useRef(true)
  useEffect(() => {
    // Al abrir el panel manda el borrador guardado; luego, lo que se monte al animar
    if (primeraVez.current) {
      primeraVez.current = false
      if (guardado) return
    }
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
      setVoces(null)
      const t = e instanceof Error ? e.message : String(e)
      if (/contraseña|clave|401/i.test(t)) setNeedPass(true)
      setMsg({ ok: false, text: /contraseña|clave|401/i.test(t) ? 'Escribe la contraseña del estudio (arriba, debajo del cuadro del guion) y vuelve a pulsar «Elegir voz…».' : t })
    }
  }
  const [deNuevo, setDeNuevo] = useState(false)
  const [planVisto, setPlanVisto] = useState<{ plan: PlanDirector; palabras: string[][] } | null>(null)
  // Si se ha marcado «Dibujar todo de nuevo», se limpia ya, para que el plan cuente con ello
  const limpiarSiDeNuevo = () => {
    if (!deNuevo) return
    const st = useStore.getState()
    st.commit({ ...st.project, posturasExtra: [], objetos: [], fondos: (st.project.fondos ?? []).filter((l) => !l.descripcion) })
  }
  const pedirPlan = async () => {
    if (busy || !escenas.length) return
    setBusy(true)
    setMsg({ ok: true, text: 'Preparando el plan (sin dibujar nada)…' })
    try {
      limpiarSiDeNuevo()
      setPlanVisto(await verPlan(escenas, pass, indicaciones))
      setMsg({ ok: true, text: 'Este es el plan. Léelo antes de generar.' })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'No se pudo preparar el plan.' })
    } finally {
      setBusy(false)
    }
  }
  const conVoz = async () => {
    if (!voz || busy || !escenas.length) return
    const hay = Object.keys(useStore.getState().project.instances[0].tracks).length > 0
    if (hay && !confirm('Esto sustituye la animación actual por la de las escenas, con voz. Se puede deshacer con Ctrl+Z. ¿Seguir?')) return
    setBusy(true)
    try {
      // «Dibujar todo de nuevo»: sin gestos, fondos automáticos ni dibujos guardados, se hacen de cero
      limpiarSiDeNuevo()
      const r = await voiceScript(escenas, texto, voz, pass, (t) => setMsg({ ok: true, text: t }), modelo, indicaciones)
      setEscenas(r.escenas)
      setMsg({ ok: !r.aviso, text: `Listo: ${r.duracion.toFixed(1).replace('.', ',')} s con la voz de ${voz.nombre}. ${r.aviso || 'Gestos dirigidos por la IA según el guion.'}` })
    } catch (e) {
      const t = e instanceof Error ? e.message : String(e)
      if (/contraseña|clave|401/i.test(t)) setNeedPass(true)
      setMsg({ ok: false, text: t })
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

  // La IA propone lo que pasa en cada escena (como un animador de «Estoy Tiesa»); el usuario lo retoca
  const proponer = async () => {
    if (busy || !escenas.length) return
    setBusy(true)
    setMsg({ ok: true, text: 'Pensando lo que pasa en cada escena…' })
    try {
      const pr = useStore.getState().project
      const res = await fetch('/api/indicaciones', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-clave-estudio': pass },
        body: JSON.stringify({
          escenas: escenas.map((e) => ({ dialogo: e.dialogo, indicaciones: e.indicaciones ?? '' })),
          indicaciones,
          formato: pr.width < pr.height ? 'vertical' : 'horizontal',
        }),
      })
      const data = await res.json().catch(() => ({ error: 'El servidor no respondió bien.' }))
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? `Error ${res.status}` })
        return
      }
      const porEscena = new Map<number, string>((data.escenas ?? []).map((x: { escena: number; indicacion: string }) => [x.escena, x.indicacion]))
      setEscenas((es) => es.map((e, i) => (porEscena.get(i) ? { ...e, indicaciones: porEscena.get(i) } : e)))
      if (data.generales && !indicaciones.trim()) setIndicaciones(data.generales)
      setMsg({ ok: true, text: 'Indicaciones propuestas. Léelas, cambia lo que quieras y pulsa «🎙 Generar voces y animar».' })
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
      {planVisto && <PlanVista plan={planVisto.plan} palabras={planVisto.palabras} project={useStore.getState().project} escenas={escenas} />}

      {escenas.length > 0 && (
        <>
          <div className="script-sum muted small">
            {escenas.length} escenas · {total.toFixed(1).replace('.', ',')} s
            <button
              className={'btn small' + (todoGeneral ? ' toggle-on' : '')}
              style={{ marginLeft: 8 }}
              onClick={() => {
                if (!todoGeneral) {
                  planosPrevios.current = escenas.map((e) => e.plano)
                  setEscenas((es) => es.map((e) => ({ ...e, plano: 'general' as Plano })))
                } else {
                  const prev = planosPrevios.current
                  const ciclo: Plano[] = ['general', 'medio', 'primer', 'medio']
                  setEscenas((es) => es.map((e, i) => ({ ...e, plano: prev?.[i] && prev[i] !== 'general' ? prev[i] : ciclo[i % ciclo.length] })))
                }
              }}
              title="Encendido: todas las escenas en plano general (cuerpo entero, sin zooms). Apagado: alterna planos."
            >
              {todoGeneral ? '🎥 Plano fijo sin zooms: SÍ' : '🎥 Plano fijo sin zooms: NO'}
            </button>
            <button
              className="btn small primary"
              style={{ marginLeft: 8 }}
              onClick={proponer}
              disabled={busy}
              title="La IA rellena «Lo que quieres que haga» de cada escena al estilo de Estoy Tiesa (lo que ya hayas escrito se conserva y se completa)"
            >
              ✨ Proponer indicaciones
            </button>
            <button
              className="btn small"
              style={{ marginLeft: 8 }}
              onClick={pedirPlan}
              disabled={busy}
              title="Te enseña en texto lo que va a pasar en cada viñeta, sin dibujar nada ni gastar en fal. Al generar se usa este mismo plan."
            >
              🔎 Ver el plan (sin dibujar)
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
                <textarea
                  className="indicaciones"
                  rows={2}
                  value={e.indicaciones ?? ''}
                  onChange={(ev) => edit(i, { indicaciones: ev.target.value })}
                  placeholder="🎬 Lo que quieres que haga aquí: gesto, cara, fondo, rótulos… (p. ej. «cara de agotado sujetando una sartén, fondo de cocina, rótulo AGOTADOS en rojo»)"
                />
                <div className="scene-fields">
                  <label title="Tamaño del personaje en esta escena (también puedes escribirlo en las indicaciones: «pequeño», «primer plano»…)">
                    Tamaño
                    <select value={e.plano} onChange={(ev) => edit(i, { plano: ev.target.value as Plano })}>
                      <option value="lejos">Pequeño (lejos)</option>
                      <option value="general">Normal (cuerpo entero)</option>
                      <option value="medio">Grande (de cintura arriba)</option>
                      <option value="primer">Muy grande (la cara)</option>
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
          <label className="sublabel">🎬 Indicaciones para todo el vídeo (la IA las cumple)</label>
          <textarea
            className="indicaciones"
            rows={2}
            value={indicaciones}
            onChange={(ev) => setIndicaciones(ev.target.value)}
            placeholder="p. ej. «tono irónico, que exagere en los remates, fondos de casa, rótulos en las cifras»"
          />
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
            <label className="check-row" title="Olvida los gestos a medida, los fondos y los dibujos guardados de este proyecto y los hace de cero con la versión actual (se pagan otra vez). La voz guardada sí se reutiliza.">
              <input type="checkbox" checked={deNuevo} onChange={(e) => setDeNuevo(e.target.checked)} /> 🧹 Dibujar todo de nuevo (gestos, fondos y dibujos)
            </label>
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
