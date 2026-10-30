import { useEffect } from 'react'
import { Controls } from './components/Controls'
import { PartsTree } from './components/PartsTree'
import { Stage } from './components/Stage'
import { Timeline } from './components/Timeline'
import { Toolbar } from './components/Toolbar'
import { useStore } from './store'

function usePlayback() {
  const playing = useStore((s) => s.playing)
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const { time, project, setTime } = useStore.getState()
      const dt = (now - last) / 1000
      last = now
      let t = time + dt
      if (t >= project.duration) t = 0
      setTime(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])
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
  return (
    <div className="app">
      <Toolbar />
      <PartsTree />
      <Stage />
      <Controls />
      <Timeline />
    </div>
  )
}
