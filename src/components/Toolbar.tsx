import { useRef, useState } from 'react'
import { download, exportMp4 } from '../export/exportMp4'
import type { Project } from '../model/types'
import { useStore } from '../store'

export function Toolbar({ onGuion }: { onGuion: () => void }) {
  const project = useStore((s) => s.project)
  const mode = useStore((s) => s.mode)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const { undo, redo, setMode, setProjectProps, loadProject, newSampleProject, setPlaying } = useStore.getState()
  const fileRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fileName = (project.name || 'proyecto').trim().replace(/[^\p{L}\p{N}_-]+/gu, '-')

  const onExport = async () => {
    setPlaying(false)
    setError(null)
    setProgress(0)
    try {
      const blob = await exportMp4(project, setProgress)
      download(blob, `${fileName}.mp4`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setProgress(null)
    }
  }

  const onOpen = async (file: File) => {
    try {
      const p = JSON.parse(await file.text()) as Project
      if (p.version !== 1 || !p.instances?.length) throw new Error('El archivo no es un proyecto válido.')
      loadProject(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <header className="toolbar">
      <div className="brand">
        <span className="logo">◆</span> Estudio de Animación
      </div>
      <input className="project-name" value={project.name} onChange={(e) => setProjectProps({ name: e.target.value })} aria-label="Nombre del proyecto" />

      <div className="group">
        <button className="btn icon" onClick={undo} disabled={!canUndo} title="Deshacer (Ctrl+Z)">↶</button>
        <button className="btn icon" onClick={redo} disabled={!canRedo} title="Rehacer (Ctrl+Mayús+Z)">↷</button>
      </div>

      <div className="segmented" role="tablist">
        <button className={mode === 'animar' ? 'active' : ''} onClick={() => setMode('animar')}>Animar</button>
        <button className={mode === 'colocar' ? 'active' : ''} onClick={() => setMode('colocar')} title="Arrastra el personaje para colocarlo; rueda del ratón para su tamaño">Colocar</button>
        <button className={mode === 'articulaciones' ? 'active' : ''} onClick={() => setMode('articulaciones')}>Articulaciones</button>
      </div>

      <button className="btn" onClick={onGuion} title="Escribe el guion y conviértelo en escenas animadas">
        📝 Guion
      </button>

      <div className="spacer" />

      <div className="group">
        <button className="btn" onClick={() => fileRef.current?.click()}>Abrir…</button>
        <button
          className="btn"
          onClick={() => download(new Blob([JSON.stringify(project)], { type: 'application/json' }), `${fileName}.estudio.json`)}
          title="Descarga una copia del proyecto en tu ordenador"
        >
          Guardar copia
        </button>
        <button
          className="btn"
          onClick={() => {
            if (confirm('¿Empezar de nuevo con el proyecto de ejemplo? Lo actual se pierde salvo que hayas guardado una copia (puedes deshacer con Ctrl+Z).')) newSampleProject()
          }}
        >
          Ejemplo
        </button>
        <button className="btn primary" onClick={onExport} disabled={progress !== null}>
          {progress === null ? 'Exportar MP4' : `Exportando ${Math.round(progress * 100)} %`}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onOpen(f)
          e.target.value = ''
        }}
      />
      {error && (
        <div className="toast" onClick={() => setError(null)}>
          {error} <span className="muted">(pulsa para cerrar)</span>
        </div>
      )}
    </header>
  )
}
