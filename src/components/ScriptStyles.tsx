// Estilos de guion: se guardan en el almacén compartido para que los usen la IA de la web y Claude.
import { useEffect, useState } from 'react'

const PASS_KEY = 'estudio-animacion:clave'
const readPass = () => {
  try {
    return localStorage.getItem(PASS_KEY) ?? ''
  } catch {
    return ''
  }
}

interface Estilo {
  id: string
  nombre: string
  texto: string
}

const PLANTILLA = `ESTRUCTURA
1. Gancho (primera frase, máx. 8 palabras): una pregunta o afirmación que toque un problema real.
2. Desarrollo: 3-4 frases cortas, una idea por frase, con un ejemplo cotidiano.
3. Cierre: llamada a la acción («Comenta ___ y te lo mando», «Guárdalo para luego»).

TONO
Cercano, de tú, español de España. Con algo de humor, sin tecnicismos.

DURACIÓN
Entre 20 y 35 segundos.

SIEMPRE
- (frases o muletillas mías)

NUNCA
- (cosas que no diría)

EJEMPLO DE GUION MÍO
(pega aquí un guion tuyo que te guste)`

export function ScriptStyles() {
  const [open, setOpen] = useState(false)
  const [estilos, setEstilos] = useState<Estilo[]>([])
  const [activo, setActivo] = useState<string | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [estado, setEstado] = useState<string>('')
  const pass = readPass()
  const headers = { 'content-type': 'application/json', 'x-clave-estudio': pass }

  useEffect(() => {
    if (!open) return
    setEstado('Cargando…')
    fetch('/api/estilos', { headers })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (r.status === 401) return setEstado('Escribe primero la contraseña del estudio (en el copiloto o al pedir escenas con IA).')
        if (!r.ok) return setEstado(d.error ?? `Error ${r.status}`)
        setEstilos(d.estilos ?? [])
        setActivo(d.activo ?? null)
        setSel(d.activo ?? d.estilos?.[0]?.id ?? null)
        setEstado('')
      })
      .catch(() => setEstado('Sin conexión.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const guardar = async (lista: Estilo[], act: string | null) => {
    setEstado('Guardando…')
    const r = await fetch('/api/estilos', { method: 'POST', headers, body: JSON.stringify({ estilos: lista, activo: act }) }).catch(() => null)
    setEstado(r?.ok ? 'Guardado. Lo usarán la IA de la web y Claude.' : 'No se ha podido guardar.')
  }

  const actual = estilos.find((e) => e.id === sel) ?? null
  const editar = (patch: Partial<Estilo>) => setEstilos((l) => l.map((e) => (e.id === sel ? { ...e, ...patch } : e)))

  return (
    <div className="styles-box">
      <button className="btn small" onClick={() => setOpen(!open)}>
        {open ? '▾' : '▸'} Estilo y estructura de mis guiones
        {activo && estilos.length ? ` · ${estilos.find((e) => e.id === activo)?.nombre ?? ''}` : ''}
      </button>
      {open && (
        <div className="styles-body">
          <div className="chips">
            {estilos.map((e) => (
              <button key={e.id} className={'chip' + (e.id === sel ? ' active' : '')} onClick={() => setSel(e.id)}>
                {e.id === activo ? '★ ' : ''}
                {e.nombre || '(sin nombre)'}
              </button>
            ))}
            <button
              className="chip"
              onClick={() => {
                const n = { id: Math.random().toString(36).slice(2, 9), nombre: estilos.length ? 'Nuevo estilo' : 'Mi estilo', texto: PLANTILLA }
                setEstilos((l) => [...l, n])
                setSel(n.id)
                if (!activo) setActivo(n.id)
              }}
            >
              + Nuevo estilo
            </button>
          </div>
          {actual && (
            <>
              <input className="copilot-pass" value={actual.nombre} onChange={(e) => editar({ nombre: e.target.value })} placeholder="Nombre (p. ej. Tras el Diván)" />
              <textarea className="script-text" rows={12} value={actual.texto} onChange={(e) => editar({ texto: e.target.value })} />
              <div className="voice-row">
                <button
                  className="btn small primary"
                  onClick={() => guardar(estilos, activo)}
                >
                  Guardar
                </button>
                <button
                  className="btn small"
                  disabled={actual.id === activo}
                  onClick={() => {
                    setActivo(actual.id)
                    guardar(estilos, actual.id)
                  }}
                >
                  {actual.id === activo ? '★ En uso' : 'Usar este estilo'}
                </button>
                <button
                  className="btn small danger"
                  onClick={() => {
                    const l = estilos.filter((e) => e.id !== actual.id)
                    const act = activo === actual.id ? l[0]?.id ?? null : activo
                    setEstilos(l)
                    setActivo(act)
                    setSel(l[0]?.id ?? null)
                    guardar(l, act)
                  }}
                >
                  Borrar
                </button>
              </div>
            </>
          )}
          {estado && <p className="muted small">{estado}</p>}
        </div>
      )}
    </div>
  )
}
