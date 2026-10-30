import { useEffect, useRef, useState } from 'react'
import { poseAt } from '../model/anim'
import { drawCharacter, ensureImages, hitTest, pivotOf, type Placed } from '../model/render'
import type { Vec } from '../model/types'
import { activeCharacter, useStore } from '../store'

type Drag =
  | { kind: 'rotate'; partId: string; pivot: Vec; startAngle: number; startRot: number }
  | { kind: 'move'; partId: string; last: Vec; inv: DOMMatrix; base: Vec; acc: Vec }
  | { kind: 'pivot'; partId: string; last: Vec }

export function Stage() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef({ scale: 1, ox: 0, oy: 0, dpr: 1 })
  const placedRef = useRef<Placed[]>([])
  const dragRef = useRef<Drag | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [loaded, setLoaded] = useState(0)
  const [hover, setHover] = useState(false)

  const project = useStore((s) => s.project)
  const time = useStore((s) => s.time)
  const mode = useStore((s) => s.mode)
  const selectedPart = useStore((s) => s.selectedPart)

  useEffect(() => {
    const el = wrapRef.current!
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    ensureImages(project).then(() => setLoaded((n) => n + 1))
  }, [project.characters])

  // Dibujo
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !size.w) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(size.w * dpr)
    canvas.height = Math.round(size.h * dpr)
    const pad = 24
    const scale = Math.min((size.w - pad * 2) / project.width, (size.h - pad * 2) / project.height)
    const ox = (size.w - project.width * scale) / 2
    const oy = (size.h - project.height * scale) / 2
    viewRef.current = { scale, ox, oy, dpr }

    const g = canvas.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, size.w, size.h)
    g.translate(ox, oy)
    g.scale(scale, scale)

    // Lienzo del vídeo
    g.save()
    g.shadowColor = 'rgba(0,0,0,.35)'
    g.shadowBlur = 30 / scale
    g.fillStyle = project.background
    g.fillRect(0, 0, project.width, project.height)
    g.restore()
    g.save()
    g.beginPath()
    g.rect(0, 0, project.width, project.height)
    g.clip()

    const inst = project.instances[0]
    const ch = activeCharacter(project)
    const rest = mode === 'articulaciones'
    placedRef.current = drawCharacter(g, ch, inst, time, rest)
    g.restore()

    // Ayudas visuales (no salen en el vídeo)
    const px = 1 / scale
    for (const pl of placedRef.current) {
      const sel = pl.part.id === selectedPart
      if (!rest && !sel) continue
      const asset = ch.assets[pl.assetId]
      const p = pivotOf(pl)
      if (sel && asset) {
        g.save()
        g.setTransform(g.getTransform().multiply(pl.matrix))
        g.strokeStyle = '#3B82F6'
        g.lineWidth = 2 * px / Math.hypot(pl.matrix.a, pl.matrix.b)
        g.setLineDash([6 * px, 4 * px].map((v) => v / Math.hypot(pl.matrix.a, pl.matrix.b)))
        g.strokeRect(-pl.part.anchor.x, -pl.part.anchor.y, asset.w, asset.h)
        g.restore()
      }
      g.beginPath()
      g.arc(p.x, p.y, (sel ? 9 : 6) * px, 0, Math.PI * 2)
      g.fillStyle = sel ? '#3B82F6' : 'rgba(59,130,246,.55)'
      g.fill()
      g.lineWidth = 2 * px
      g.strokeStyle = '#fff'
      g.stroke()
    }
  }, [project, time, mode, selectedPart, size, loaded])

  const toStage = (e: React.PointerEvent): Vec => {
    const r = canvasRef.current!.getBoundingClientRect()
    const v = viewRef.current
    return { x: (e.clientX - r.left - v.ox) / v.scale, y: (e.clientY - r.top - v.oy) / v.scale }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const st = useStore.getState()
    const pt = toStage(e)
    const ch = activeCharacter(st.project)
    const inst = st.project.instances[0]
    const hit = hitTest(ch, placedRef.current, pt)
    st.setPlaying(false)

    if (st.mode === 'articulaciones') {
      // Arrastrar mueve la articulación de la pieza seleccionada (o de la que se pulse).
      const id = hit?.id ?? st.selectedPart
      if (!id) return
      if (hit) st.selectPart(hit.id)
      ;(e.target as Element).setPointerCapture(e.pointerId)
      dragRef.current = { kind: 'pivot', partId: id, last: pt }
      return
    }

    st.selectPart(hit?.id ?? null)
    if (!hit) return
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const pl = placedRef.current.find((p) => p.part.id === hit.id)!
    const pose = poseAt(ch, inst.tracks, st.time)
    const pp = pose.parts[hit.id]

    if (e.shiftKey || !hit.parent) {
      const parentPl = hit.parent ? placedRef.current.find((p) => p.part.id === hit.parent) : undefined
      const parentM = parentPl ? parentPl.matrix : new DOMMatrix().scale(inst.scale)
      dragRef.current = { kind: 'move', partId: hit.id, last: pt, inv: parentM.inverse(), base: { x: pp.x, y: pp.y }, acc: { x: 0, y: 0 } }
    } else {
      const pivot = pivotOf(pl)
      dragRef.current = {
        kind: 'rotate',
        partId: hit.id,
        pivot,
        startAngle: Math.atan2(pt.y - pivot.y, pt.x - pivot.x),
        startRot: pp.rot,
      }
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const pt = toStage(e)
    const d = dragRef.current
    const st = useStore.getState()
    if (!d) {
      const ch = activeCharacter(st.project)
      setHover(!!hitTest(ch, placedRef.current, pt))
      return
    }
    if (d.kind === 'rotate') {
      let delta = (Math.atan2(pt.y - d.pivot.y, pt.x - d.pivot.x) - d.startAngle) * (180 / Math.PI)
      if (delta > 180) delta -= 360
      if (delta < -180) delta += 360
      let rot = d.startRot + delta
      if (e.altKey) rot = Math.round(rot / 15) * 15
      st.key(`part:${d.partId}:rot`, Math.round(rot * 10) / 10, `drag:${d.partId}:rot`)
    } else if (d.kind === 'move') {
      const dx = pt.x - d.last.x
      const dy = pt.y - d.last.y
      d.last = pt
      d.acc.x += d.inv.a * dx + d.inv.c * dy
      d.acc.y += d.inv.b * dx + d.inv.d * dy
      st.keyMany(
        {
          [`part:${d.partId}:x`]: Math.round(d.base.x + d.acc.x),
          [`part:${d.partId}:y`]: Math.round(d.base.y + d.acc.y),
        },
        `drag:${d.partId}:xy`,
      )
    } else {
      const inst = st.project.instances[0]
      const dx = (pt.x - d.last.x) / inst.scale
      const dy = (pt.y - d.last.y) / inst.scale
      d.last = pt
      st.movePivot(d.partId, { x: dx, y: dy })
    }
  }

  const onPointerUp = () => {
    dragRef.current = null
  }

  return (
    <div ref={wrapRef} className="stage">
      <canvas
        ref={canvasRef}
        style={{ width: size.w, height: size.h, cursor: hover ? (mode === 'articulaciones' ? 'crosshair' : 'grab') : 'default' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div className="stage-hint">
        {mode === 'animar'
          ? 'Arrastra una pieza para girarla · Mayús + arrastrar para moverla · Alt para girar de 15 en 15°'
          : 'Modo articulaciones: arrastra para recolocar el punto de giro de la pieza'}
      </div>
    </div>
  )
}
