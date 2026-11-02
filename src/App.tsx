import { useEffect, useState } from 'react'
import { ScriptPanel } from './components/ScriptPanel'
import { loadAudio } from './audio/storage'
import { Controls } from './components/Controls'
import { PartsTree } from './components/PartsTree'
import { Stage } from './components/Stage'
import { Timeline } from './components/Timeline'
import { Toolbar } from './components/Toolbar'
import { useStore } from './store'

function usePlayback() {
  const playing = useStore((s) => s.playing)
  const audioInfo = useStore((s) => s.project.audio)
  useEffect(() => {
    if (!playing) return
    let el: HTMLAudioElement | null = null
    let url = ''
    let cancelled = false
    if (audioInfo) {
      loadAudio(audioInfo.id).then((blob) => {
        if (!blob || cancelled) return
        url = URL.createObjectURL(blob)
        el = new Audio(url)
        const offset = useStore.getState().time - audioInfo.start
        if (offset < audioInfo.duration) {
          if (offset >= 0) el.currentTime = offset
          const delay = Math.max(0, -offset)
          setTimeout(() => !cancelled && el?.play().catch(() => undefined), delay * 1000)
        }
      })
    }
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const { time, project, setTime } = useStore.getState()
      const dt = (now - last) / 1000
      last = now
      let t = time + dt
      if (t >= project.duration) {
        // Al volver al principio se reinicia también el audio
        useStore.getState().setPlaying(false)
        setTime(0)
        setTimeout(() => useStore.getState().setPlaying(true), 0)
        return
      }
      setTime(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      el?.pause()
      if (url) URL.revokeObjectURL(url)
    }
  }, [playing, audioInfo])
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, select, textarea') && !(el instanceof HTMLInputElement && el.type === 'range')) return
      const st = useStore.getState()
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? st.redo() : st.undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        st.redo()
      } else if (e.key === ' ') {
        e.preventDefault()
        st.setPlaying(!st.playing)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && st.selectedKey) {
        e.preventDefault()
        st.deleteKey(st.selectedKey)
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (el instanceof HTMLInputElement) return
        e.preventDefault()
        const f = (e.shiftKey ? 10 : 1) / st.project.fps
        st.setPlaying(false)
        st.setTime(Math.round((st.time + (e.key === 'ArrowRight' ? f : -f)) * st.project.fps) / st.project.fps)
      } else if (e.key === 'Escape') {
        st.selectPart(null)
        st.selectKey(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export default function App() {
  usePlayback()
  useShortcuts()
  const [guion, setGuion] = useState(false)
  return (
    <div className="app">
      <Toolbar onGuion={() => setGuion(!guion)} />
      {guion && <ScriptPanel onClose={() => setGuion(false)} />}
      <PartsTree />
      <Stage />
      <Controls />
      <Timeline />
    </div>
  )
}
