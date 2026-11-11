import { useRef, useState } from 'react'
import { download, exportMp4 } from '../export/exportMp4'
import { zipDeImagenes } from '../export/imagenes'
import type { Project } from '../model/types'
import { useStore } from '../store'

const FORMATOS_VIDEO = [
  { v: '1080x1920', n: 'Vertical 9:16' },
  { v: '1920x1080', n: 'Horizontal 16:9' },
  { v: '1080x1080', n: 'Cuadrado 1:1' },
  { v: '1080x1350', n: 'Vertical 4:5' },
]

export function Toolbar({ onGuion }: { onGuion: () => void }) {
  const project = useStore((s) => s.project)
  const mode = useStore((s) => s.mode)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const { undo, redo, setMode, setProjectProps, loadProject, newSampleProject, setPlaying } = useStore.getState()
  const fileRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [zipando, setZipando] = useState(false)

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
        <span className="logo">◆</span><span className="brand-text"> Estudio de Animación</span>
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

      <label className="tb-field" title="Forma del vídeo. Al cambiarla, el personaje se recoloca solo y los fondos nuevos salen con esta forma">
        <span>Formato</span>
        <select
          value={`${project.width}x${project.height}`}
          onChange={(e) => {
            const [w, h] = e.target.value.split('x').map(Number)
            useStore.getState().setFormato(w, h)
          }}
        >
          {!FORMATOS_VIDEO.some((f) => f.v === `${project.width}x${project.height}`) && (
            <option value={`${project.width}x${project.height}`}>
              {project.width}×{project.height}
            </option>
          )}
          {FORMATOS_VIDEO.map((f) => (
            <option key={f.v} value={f.v}>
              {f.n}
            </option>
          ))}
        </select>
      </label>
      <label className="tb-field" title="Duración total del vídeo (al generar voces se ajusta sola)">
        <span>Duración</span>
        <input
          type="number"
          min={1}
          max={600}
          step={0.5}
          value={project.duration}
          onChange={(e) => {
            const d = Number(e.target.value)
            if (d >= 1 && d <= 600) setProjectProps({ duration: d })
          }}
        />
        <span>s</span>
      </label>
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
          disabled={zipando}
          onClick={async () => {
            setZipando(true)
            try {
              const { blob, n } = await zipDeImagenes(project)
              if (!n) alert('Este proyecto todavía no tiene imágenes generadas.')
              else download(blob, `${fileName}-imagenes.zip`)
            } catch (e) {
              alert(`No se pudieron reunir las imágenes: ${e instanceof Error ? e.message : e}`)
            } finally {
              setZipando(false)
            }
          }}
          title="Descarga en un ZIP todos los dibujos de este proyecto (escenas, cambios de gesto, fondos, objetos y gestos a medida), en el orden en que salen"
        >
          {zipando ? 'Reuniendo…' : '🖼 Descargar imágenes'}
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
