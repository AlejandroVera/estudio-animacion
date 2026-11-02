import { useEffect, useRef, useState } from 'react'
import { applyCopilot, buildContext, type CopilotResult } from '../copilot/context'
import { useClaudeLink } from '../copilot/link'
import { activeCharacter, useStore } from '../store'

const PASS_KEY = 'estudio-animacion:clave'

function readPass(): string {
  try {
    return localStorage.getItem(PASS_KEY) ?? ''
  } catch {
    return ''
  }
}

// Reconocimiento de voz del navegador (Chrome/Edge). No está en los tipos de TypeScript.
type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}
const SpeechRec = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition })
  .SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition

const EJEMPLOS = ['Que salude con la mano derecha y sonría', 'Que diga «hola» y parpadee', 'Que se encoja de hombros con cara de duda', 'Que mire a la izquierda sorprendido']

export function Copilot() {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [reply, setReply] = useState<{ ok: boolean; text: string } | null>(null)
  const [needPass, setNeedPass] = useState(false)
  const [pass, setPass] = useState(readPass)
  const [listening, setListening] = useState(false)
  const [linked, setLinked] = useState(false)
  const [copied, setCopied] = useState(false)
  const recRef = useRef<Recognition | null>(null)
  useClaudeLink(linked, pass, (msg, ok) => {
    setReply({ ok, text: msg })
    if (!ok) {
      setLinked(false)
      if (msg.includes('contraseña')) setNeedPass(true)
    }
  })
  const connectorUrl = `${window.location.origin}/api/mcp?clave=${encodeURIComponent(pass)}`
  const baseText = useRef('')

  useEffect(() => () => recRef.current?.stop(), [])

  const toggleMic = () => {
    if (!SpeechRec) {
      setReply({ ok: false, text: 'Tu navegador no permite dictar. Usa Google Chrome o Edge.' })
      return
    }
    if (listening) {
      recRef.current?.stop()
      return
    }
    const rec = new SpeechRec()
    rec.lang = 'es-ES'
    rec.interimResults = true
    rec.continuous = true
    baseText.current = text ? text.trimEnd() + ' ' : ''
    rec.onresult = (e) => {
      let said = ''
      for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript
      setText(baseText.current + said)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    rec.start()
    setListening(true)
  }

  const send = async () => {
    const instruccion = text.trim()
    if (!instruccion || busy) return
    recRef.current?.stop()
    const st = useStore.getState()
    st.setPlaying(false)
    const character = activeCharacter(st.project)
    setBusy(true)
    setReply(null)
    try {
      const res = await fetch('/api/copiloto', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-clave-estudio': pass },
        body: JSON.stringify({ instruccion, contexto: buildContext(st.project, character, st.time, st.selectedPart) }),
      })
      const data = await res.json().catch(() => ({ error: 'El servidor no respondió bien.' }))
      if (res.status === 401) {
        setNeedPass(true)
        setReply({ ok: false, text: pass ? 'Esa contraseña no es correcta.' : 'Escribe la contraseña del estudio para usar el copiloto.' })
        return
      }
      if (!res.ok) {
        setReply({ ok: false, text: data.error ?? `Error ${res.status}` })
        return
      }
      const result = data as CopilotResult
      const now = useStore.getState()
      const { tracks, duration, added } = applyCopilot(result, now.project, activeCharacter(now.project))
      now.replaceTracks(tracks, duration)
      setReply({ ok: true, text: `${result.mensaje}${added ? '' : ' (no se ha añadido ninguna clave)'}` })
      setText('')
      now.setTime(0)
      now.setPlaying(true)
    } catch {
      setReply({ ok: false, text: 'No hay conexión con el copiloto.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="copilot">
      <h3>Copiloto IA</h3>
      <div className="copilot-input">
        <textarea
          rows={3}
          placeholder="Dime qué quieres que haga… (o pulsa el micrófono y díselo)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send()
          }}
          disabled={busy}
        />
        <button className={'btn icon mic' + (listening ? ' on' : '')} onClick={toggleMic} title="Dictar con la voz" disabled={busy}>
          {listening ? '■' : '🎤'}
        </button>
      </div>
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
              // sin almacenamiento: se pedirá otra vez la próxima vez
            }
          }}
        />
      )}
      <button className="btn primary full" onClick={send} disabled={busy || !text.trim()}>
        {busy ? 'Pensando la animación…' : 'Animar ✨'}
      </button>
      {reply && <p className={'copilot-reply' + (reply.ok ? '' : ' error')}>{reply.text}</p>}
      {!reply && !busy && (
        <div className="chips copilot-examples">
          {EJEMPLOS.map((e) => (
            <button key={e} className="chip" onClick={() => setText(e)}>
              {e}
            </button>
          ))}
        </div>
      )}
      <p className="muted small">Se añade a la animación actual. Si no te gusta, Ctrl+Z lo deshace entero.</p>

      <div className="claude-link">
        <button
          className={'btn full' + (linked ? ' linked' : '')}
          onClick={() => {
            if (!pass) {
              setNeedPass(true)
              setReply({ ok: false, text: 'Escribe primero la contraseña del estudio.' })
              return
            }
            setLinked(!linked)
            if (!linked) setReply({ ok: true, text: 'Conectado. Ya puedes pedirle animaciones a Claude desde su app.' })
          }}
          title="Deja que Claude (con tu suscripción, mediante el conector) vea y anime este proyecto"
        >
          {linked ? '● Conectado con Claude (pulsa para desconectar)' : 'Conectar con Claude (sin coste de API)'}
        </button>
        {linked && (
          <div className="connector-url">
            <span className="muted small">Dirección del conector para Claude:</span>
            <div>
              <code>{connectorUrl.replace(/clave=[^&]*/, 'clave=••••')}</code>
              <button
                className="btn small"
                onClick={() => {
                  navigator.clipboard?.writeText(connectorUrl).then(() => {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  })
                }}
              >
                {copied ? 'Copiada' : 'Copiar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
