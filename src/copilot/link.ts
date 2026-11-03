// Enlace con el conector MCP: mientras está activo, la web publica el estado del proyecto
// para que Claude lo vea, y cada pocos segundos recoge y aplica las órdenes que Claude deja.

import { useEffect, useRef } from 'react'
import { activeCharacter, useStore } from '../store'
import { applyCopilot, buildContext, type CopilotResult } from './context'
import { applyScript } from '../components/ScriptPanel'
import type { Escena } from '../model/types'

const POLL_MS = 4000
const HEARTBEAT_MS = 60_000

type Op = {
  seq: number
  op: { tipo: 'animar'; resultado: CopilotResult } | { tipo: 'guion' | 'proponer'; resultado: { titulo?: string; mensaje?: string; escenas: Omit<Escena, 'id'>[] } } | { tipo: 'deshacer' }
}

export function useClaudeLink(enabled: boolean, pass: string, onMessage: (text: string, ok: boolean) => void) {
  const msgRef = useRef(onMessage)
  msgRef.current = onMessage

  useEffect(() => {
    if (!enabled) return
    let stopped = false
    let lastSeq: number | null = null
    let lastPushed = ''
    let lastPushAt = 0
    let pushTimer: ReturnType<typeof setTimeout> | undefined
    const headers = { 'content-type': 'application/json', 'x-clave-estudio': pass }

    const fail = async (res: Response) => {
      const data = await res.json().catch(() => ({}))
      msgRef.current(res.status === 401 ? 'La contraseña del estudio no es correcta.' : data.error ?? `Error ${res.status}`, false)
      stopped = true
    }

    const push = async (force = false) => {
      const st = useStore.getState()
      if (st.playing && !force) return
      const contexto = buildContext(st.project, activeCharacter(st.project), st.time, st.selectedPart)
      const body = JSON.stringify({ contexto })
      if (!force && body === lastPushed) return
      lastPushed = body
      lastPushAt = Date.now()
      const res = await fetch('/api/estado', { method: 'POST', headers, body }).catch(() => null)
      if (res && !res.ok) await fail(res)
    }
    const schedulePush = (force = false) => {
      clearTimeout(pushTimer)
      pushTimer = setTimeout(() => push(force), 1500)
    }

    const poll = async () => {
      if (stopped) return
      const res = await fetch(`/api/estado?desde=${lastSeq ?? 0}`, { headers, cache: 'no-store' }).catch(() => null)
      if (!res) return
      if (!res.ok) return fail(res)
      const data = (await res.json()) as { ultimo: number; ops: Op[] }
      if (lastSeq === null) {
        // Al conectar no se repiten órdenes antiguas.
        lastSeq = data.ultimo
        return
      }
      for (const { seq, op } of data.ops.sort((a, b) => a.seq - b.seq)) {
        if (seq <= lastSeq) continue
        lastSeq = seq
        const st = useStore.getState()
        if (op.tipo === 'guion' || op.tipo === 'proponer') {
          const escenas = op.resultado.escenas.map((e) => ({ ...e, id: Math.random().toString(36).slice(2, 9) }))
          const texto = escenas.map((e) => e.dialogo).filter(Boolean).join('\n\n')
          if (op.tipo === 'proponer') {
            st.proponerGuion(texto, escenas, op.resultado.mensaje)
            msgRef.current(`Claude te ha propuesto un guion${op.resultado.titulo ? ` («${op.resultado.titulo}»)` : ''}: revísalo en el panel Guion.`, true)
            await push(true)
            continue
          }
          applyScript(escenas, texto)
          useStore.getState().proponerGuion(texto, escenas, op.resultado.mensaje)
          msgRef.current(`Claude ha montado el guion${op.resultado.titulo ? ` «${op.resultado.titulo}»` : ''}: ${escenas.length} escenas.`, true)
          await push(true)
          continue
        }
        if (op.tipo === 'deshacer') {
          st.undo()
          msgRef.current('Claude ha deshecho el último cambio.', true)
        } else if (op.tipo === 'animar') {
          const { tracks, duration, added } = applyCopilot(op.resultado, st.project, activeCharacter(st.project))
          st.replaceTracks(tracks, duration)
          msgRef.current(`Claude: ${op.resultado.mensaje ?? 'animación aplicada'}${added ? '' : ' (sin claves nuevas)'}`, true)
          st.setTime(0)
          st.setPlaying(true)
        }
        await push(true)
      }
      if (Date.now() - lastPushAt > HEARTBEAT_MS) await push(true)
    }

    push(true)
    poll()
    const iv = setInterval(poll, POLL_MS)
    const unsub = useStore.subscribe((s, prev) => {
      if (s.project !== prev.project) schedulePush(true)
      else if (s.selectedPart !== prev.selectedPart || (!s.playing && s.time !== prev.time)) schedulePush()
    })
    return () => {
      stopped = true
      clearInterval(iv)
      clearTimeout(pushTimer)
      unsub()
    }
  }, [enabled, pass])
}
