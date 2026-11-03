// Construcción de personajes a partir de definiciones de piezas dibujadas en un único
// lienzo (coordenadas del dibujo original). Cada pieza da su caja, su articulación y
// sus dibujos: cuerpo SVG o imagen (PNG recortado de una ilustración).

import type { Asset, Character, Part, Vec } from './types'

export type Box = { x: number; y: number; w: number; h: number }

export interface PartDef {
  id: string
  name: string
  parent: string | null
  box: Box
  pivot: Vec
  z: number
  /** Variante -> contenido SVG (en coordenadas del lienzo) o, con `image: true`, URL de imagen. */
  variants: Record<string, string>
  image?: boolean
  defaultVariant?: string
  role?: Part['role']
  gazeRange?: Vec
  skin?: Part['skin']
  fade?: number
}

export function svgSrc(box: Box, body: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${box.w}" height="${box.h}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}">${body}</svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

/**
 * Deformación automática para el esqueleto estándar (brazo_*, antebrazo_*, muslo_*, pierna_*):
 * los rangos de doblado se calculan con la longitud de cada miembro, así sirve para cualquier
 * personaje con esas piezas sin configurarlo a mano. Solo para piezas de imagen (las SVG llevan
 * remates redondos y giran bien rígidas).
 */
function autoSkin(d: PartDef, defs: PartDef[]): Part['skin'] | undefined {
  if (d.skin || !d.image) return d.skin
  if (d.id === 'torso') {
    // Cuando un brazo sube o baja desde el hombro, la camiseta del hombro lo acompaña.
    const lift = ['brazo_izq', 'brazo_der'].flatMap((id) => {
      const arm = defs.find((x) => x.id === id && x.parent === 'torso')
      const fore = defs.find((x) => x.parent === id)
      if (!arm || !fore) return []
      const L = Math.hypot(fore.pivot.x - arm.pivot.x, fore.pivot.y - arm.pivot.y)
      return [{ id, r: [0.38 * L, 0.62 * L] as [number, number] }]
    })
    return lift.length ? { lift } : undefined
  }
  const m = /^(brazo|antebrazo|muslo|pierna)_(.+)$/.exec(d.id)
  if (!m) return undefined
  const [, kind, side] = m
  const lengthTo = (from: PartDef, childId: string) => {
    const c = defs.find((x) => x.id === childId)
    return c ? Math.hypot(c.pivot.x - from.pivot.x, c.pivot.y - from.pivot.y) : 0
  }
  const parentDef = defs.find((x) => x.id === d.parent)
  if (kind === 'brazo') {
    const L = lengthTo(d, `antebrazo_${side}`)
    if (!L) return undefined
    return { parent: [-0.33 * L, 0.35 * L], child: { id: `antebrazo_${side}`, range: [-0.1 * L, 0.1 * L] } }
  }
  if (kind === 'muslo') {
    const L = lengthTo(d, `pierna_${side}`)
    if (!L) return undefined
    return { parent: [-0.15 * L, 0.2 * L], child: { id: `pierna_${side}`, range: [-0.1 * L, 0.1 * L] } }
  }
  // antebrazo / pierna: doblan junto al codo o la rodilla, en proporción al miembro de arriba
  const L = parentDef ? lengthTo(parentDef, d.id) : 0
  return L ? { parent: [-0.1 * L, 0.1 * L] } : undefined
}

export function buildParts(defs: PartDef[]): Pick<Character, 'parts' | 'assets'> {
  const assets: Record<string, Asset> = {}
  const pivots = new Map(defs.map((d) => [d.id, d.pivot]))
  const parts: Part[] = defs.map((d) => {
    const variants: Record<string, string> = {}
    for (const [k, body] of Object.entries(d.variants)) {
      const id = `${d.id}__${k}`
      assets[id] = { id, src: d.image ? body : svgSrc(d.box, body), w: d.box.w, h: d.box.h }
      variants[k] = id
    }
    const pp = d.parent ? pivots.get(d.parent)! : d.pivot
    return {
      id: d.id,
      name: d.name,
      parent: d.parent,
      variants,
      defaultVariant: d.defaultVariant ?? Object.keys(d.variants)[0],
      anchor: { x: d.pivot.x - d.box.x, y: d.pivot.y - d.box.y },
      offset: d.parent ? { x: d.pivot.x - pp.x, y: d.pivot.y - pp.y } : { x: 0, y: 0 },
      z: d.z,
      role: d.role,
      gazeRange: d.gazeRange,
      skin: autoSkin(d, defs),
      fade: d.fade,
    }
  })
  return { parts, assets }
}
