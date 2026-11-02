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
}

export function svgSrc(box: Box, body: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${box.w}" height="${box.h}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}">${body}</svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
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
    }
  })
  return { parts, assets }
}
