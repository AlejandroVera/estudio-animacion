import { LIBRARY } from '../model/library'
import type { Part } from '../model/types'
import { activeCharacter, useStore } from '../store'

export function PartsTree() {
  const project = useStore((s) => s.project)
  const selectedPart = useStore((s) => s.selectedPart)
  const selectPart = useStore((s) => s.selectPart)
  const setCharacter = useStore((s) => s.setCharacter)
  const ch = activeCharacter(project)
  const tracks = project.instances[0].tracks

  const children = (id: string | null) => ch.parts.filter((p) => p.parent === id)
  const animated = (p: Part) => Object.keys(tracks).some((c) => c.startsWith(`part:${p.id}:`))

  const render = (p: Part, depth: number): React.ReactNode => (
    <div key={p.id}>
      <button
        className={'tree-item' + (p.id === selectedPart ? ' active' : '')}
        style={{ paddingLeft: 10 + depth * 14 }}
        onClick={() => selectPart(p.id)}
      >
        {p.name}
        {animated(p) && <span className="dot" title="Esta pieza tiene animación" />}
      </button>
      {children(p.id).map((c) => render(c, depth + 1))}
    </div>
  )

  return (
    <aside className="panel parts">
      <h3>Personaje</h3>
      <select className="char-select" value={LIBRARY.some((e) => e.id === ch.id) ? ch.id : ''} onChange={(e) => setCharacter(e.target.value)}>
        {!LIBRARY.some((e) => e.id === ch.id) && <option value="">{ch.name}</option>}
        {LIBRARY.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <h3>Piezas</h3>
      <div className="tree">{children(null).map((p) => render(p, 0))}</div>
    </aside>
  )
}
