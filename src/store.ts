import { create } from 'zustand'
import { KEY_EPS, moveKey, removeKey, setKey } from './model/anim'
import { sampleProject } from './model/sample'
import type { Character, CharacterInstance, Ease, Project, Tracks, Vec } from './model/types'

const STORAGE_KEY = 'estudio-animacion:proyecto'
const HISTORY_LIMIT = 100

export type Mode = 'animar' | 'articulaciones'

export interface SelectedKey {
  channel: string
  t: number
}

interface State {
  project: Project
  time: number
  playing: boolean
  mode: Mode
  selectedPart: string | null
  selectedKey: SelectedKey | null
  past: Project[]
  future: Project[]
  lastTag: string
  lastCommit: number

  commit: (next: Project, tag?: string) => void
  undo: () => void
  redo: () => void
  loadProject: (p: Project) => void
  newSampleProject: () => void

  setTime: (t: number) => void
  setPlaying: (on: boolean) => void
  setMode: (m: Mode) => void
  selectPart: (id: string | null) => void
  selectKey: (k: SelectedKey | null) => void

  /** Pone una clave en el instante actual (auto-clave). */
  key: (channel: string, value: number | string, tag?: string) => void
  keyMany: (values: Record<string, number | string>, tag?: string) => void
  deleteKey: (k: SelectedKey) => void
  moveKeyTo: (k: SelectedKey, t: number) => void
  setKeyEase: (k: SelectedKey, ease: Ease) => void
  insertBlink: () => void
  resetPart: (id: string) => void
  movePivot: (partId: string, delta: Vec) => void
  setInstance: (patch: Partial<Pick<CharacterInstance, 'x' | 'y' | 'scale'>>, tag?: string) => void
  setProjectProps: (patch: Partial<Pick<Project, 'duration' | 'background' | 'name'>>) => void
}

function loadSaved(): Project | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Project
    return p.version === 1 ? p : null
  } catch {
    return null
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
function save(p: Project) {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
    } catch {
      // sin almacenamiento disponible: el proyecto sigue en memoria
    }
  }, 400)
}

const snap = (t: number, fps: number) => Math.round(t * fps) / fps

/** Utilidades para cambiar el primer personaje del proyecto (fase 1: uno por escena). */
function withTracks(p: Project, fn: (t: Tracks) => Tracks): Project {
  const [inst, ...rest] = p.instances
  return { ...p, instances: [{ ...inst, tracks: fn(inst.tracks) }, ...rest] }
}

export function activeCharacter(p: Project): Character {
  return p.characters[p.instances[0].characterId]
}

export const useStore = create<State>((set, get) => ({
  project: loadSaved() ?? sampleProject(),
  time: 0,
  playing: false,
  mode: 'animar',
  selectedPart: null,
  selectedKey: null,
  past: [],
  future: [],
  lastTag: '',
  lastCommit: 0,

  commit: (next, tag = '') => {
    const { project, past, lastTag, lastCommit } = get()
    const now = Date.now()
    // Cambios seguidos del mismo control (arrastrar un deslizador) cuentan como un solo paso de deshacer.
    const merge = tag !== '' && tag === lastTag && now - lastCommit < 800
    set({
      project: next,
      past: merge ? past : [...past, project].slice(-HISTORY_LIMIT),
      future: [],
      lastTag: tag,
      lastCommit: now,
    })
    save(next)
  },

  undo: () => {
    const { past, project, future } = get()
    if (!past.length) return
    const prev = past[past.length - 1]
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future], lastTag: '', selectedKey: null })
    save(prev)
  },

  redo: () => {
    const { past, project, future } = get()
    if (!future.length) return
    const next = future[0]
    set({ project: next, past: [...past, project], future: future.slice(1), lastTag: '', selectedKey: null })
    save(next)
  },

  loadProject: (p) => {
    get().commit(p)
    set({ time: 0, selectedPart: null, selectedKey: null, playing: false })
  },

  newSampleProject: () => get().loadProject(sampleProject()),

  setTime: (t) => {
    const { project } = get()
    set({ time: Math.max(0, Math.min(project.duration, t)) })
  },
  setPlaying: (on) => set({ playing: on }),
  setMode: (m) => set({ mode: m, playing: false }),
  selectPart: (id) => set({ selectedPart: id }),
  selectKey: (k) => set({ selectedKey: k }),

  key: (channel, value, tag) => {
    const { project, time } = get()
    const t = snap(time, project.fps)
    get().commit(withTracks(project, (tr) => setKey(tr, channel, t, value)), tag ?? channel)
  },

  keyMany: (values, tag) => {
    const { project, time } = get()
    const t = snap(time, project.fps)
    get().commit(
      withTracks(project, (tr) => Object.entries(values).reduce((acc, [ch, v]) => setKey(acc, ch, t, v), tr)),
      tag ?? Object.keys(values).join(','),
    )
  },

  deleteKey: (k) => {
    get().commit(withTracks(get().project, (tr) => removeKey(tr, k.channel, k.t)))
    set({ selectedKey: null })
  },

  moveKeyTo: (k, t) => {
    const { project } = get()
    const to = Math.max(0, Math.min(project.duration, snap(t, project.fps)))
    if (Math.abs(to - k.t) < KEY_EPS) return
    get().commit(withTracks(project, (tr) => moveKey(tr, k.channel, k.t, to)), `move:${k.channel}`)
    set({ selectedKey: { channel: k.channel, t: to } })
  },

  setKeyEase: (k, ease) => {
    get().commit(
      withTracks(get().project, (tr) => ({
        ...tr,
        [k.channel]: (tr[k.channel] ?? []).map((x) => (Math.abs(x.t - k.t) < KEY_EPS ? { ...x, ease } : x)),
      })),
    )
  },

  insertBlink: () => {
    const { project, time } = get()
    const t = snap(time, project.fps)
    const f = 1 / project.fps
    get().commit(
      withTracks(project, (tr) => {
        let next = setKey(tr, 'face:blink', t, 0, 'lineal')
        next = setKey(next, 'face:blink', t + 3 * f, 1, 'lineal')
        next = setKey(next, 'face:blink', t + 6 * f, 0, 'lineal')
        return next
      }),
    )
  },

  resetPart: (id) => {
    get().keyMany({ [`part:${id}:rot`]: 0, [`part:${id}:x`]: 0, [`part:${id}:y`]: 0, [`part:${id}:scale`]: 1 }, `reset:${id}`)
  },

  movePivot: (partId, delta) => {
    const { project } = get()
    const ch = activeCharacter(project)
    const parts = ch.parts.map((p) => {
      if (p.id === partId) {
        return {
          ...p,
          anchor: { x: p.anchor.x + delta.x, y: p.anchor.y + delta.y },
          offset: p.parent ? { x: p.offset.x + delta.x, y: p.offset.y + delta.y } : p.offset,
        }
      }
      if (p.parent === partId) return { ...p, offset: { x: p.offset.x - delta.x, y: p.offset.y - delta.y } }
      return p
    })
    let next: Project = { ...project, characters: { ...project.characters, [ch.id]: { ...ch, parts } } }
    // La raíz no tiene padre: movemos el personaje para que el dibujo no se desplace.
    const part = ch.parts.find((p) => p.id === partId)
    if (part && !part.parent) {
      const inst = next.instances[0]
      next = {
        ...next,
        instances: [{ ...inst, x: inst.x + delta.x * inst.scale, y: inst.y + delta.y * inst.scale }, ...next.instances.slice(1)],
      }
    }
    get().commit(next, `pivot:${partId}`)
  },

  setInstance: (patch, tag = 'instance') => {
    const { project } = get()
    const [inst, ...rest] = project.instances
    get().commit({ ...project, instances: [{ ...inst, ...patch }, ...rest] }, tag)
  },

  setProjectProps: (patch) => {
    const { project, time } = get()
    const next = { ...project, ...patch }
    get().commit(next, 'props:' + Object.keys(patch).join(','))
    if (time > next.duration) set({ time: next.duration })
  },
}))
