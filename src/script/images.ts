import { analizarCara, type CaraEscena } from '../model/caraEscena'
import { conBocaAbierta, conBocaDelOtro, conCambio, crudoDeUrl, type Crudo } from './planos'
// Fondos generados con IA (fal.ai) en el estilo del personaje, añadidos como capas.

import type { BgLayer, Escena, Project } from '../model/types'
import { saveImage, ensureMedia } from '../audio/storage'
import { activeCharacter, useStore } from '../store'
import { backgroundKeys, estimateDuration } from './scenes'
import { setKey } from '../model/anim'

const readPass = () => {
  try {
    return localStorage.getItem('estudio-animacion:clave') ?? ''
  } catch {
    return ''
  }
}

/** Proporción que se pide a la IA según la forma del vídeo. */
export function formatoDe(p: Project) {
  const r = p.width / p.height
  const op: [string, number][] = [['9:16', 9 / 16], ['4:5', 4 / 5], ['1:1', 1], ['16:9', 16 / 9]]
  return op.reduce((a, b) => (Math.abs(b[1] - r) < Math.abs(a[1] - r) ? b : a))[0]
}

/** Genera un fondo y lo guarda; devuelve la capa (sin añadirla al proyecto). */
export async function generateBackground(descripcion: string, project: Project, hueco?: 'izq' | 'der', variante?: number, tipo?: 'inserto', editarDe?: string): Promise<BgLayer> {
  const ch = activeCharacter(project)
  // Fondo blanco liso: no hace falta IA
  if (/^blanco\b/i.test(descripcion.trim())) {
    const c = new OffscreenCanvas(project.width, project.height)
    const g = c.getContext('2d')!
    g.fillStyle = '#FFFFFF'
    g.fillRect(0, 0, c.width, c.height)
    const blob = await c.convertToBlob({ type: 'image/png' })
    const id = `fondo-blanco-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    await saveImage(id, blob)
    return { id, name: 'Blanco', imageId: id, w: c.width, h: c.height }
  }
  const res = await fetch('/api/imagen', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-clave-estudio': readPass() },
    body: JSON.stringify(editarDe ? {
      // Segundo dibujo del mismo plano: se edita el primero y solo cambia lo que se pide
      tipo: 'libre',
      formato: formatoDe(project),
      referencia: editarDe,
      descripcion: `Edit this image. Keep EVERYTHING identical: same framing, same background, same characters in the same places, same style, colors and line work. Change ONLY this: ${descripcion}. The magenta round-headed boy keeps a small closed mouth (a short simple line) and his magenta skin. No text.`,
    } : {
      descripcion,
      referencia: ch.referencia ? location.origin + ch.referencia : undefined,
      formato: formatoDe(project),
      ...(hueco ? { hueco } : {}),
      ...(variante !== undefined ? { variante } : {}),
      ...(tipo ? { tipo } : {}),
      // Si sale la hermana, su dibujo como segunda referencia (así sale siempre igual)
      ...(tipo === 'inserto' && /\bsister\b/i.test(descripcion) ? { referencias: [location.origin + '/personajes/hermana/referencia.jpg'] } : {}),
    }),
  })
  const d = await res.json().catch(() => ({}))
  if (res.status === 401) throw new Error('Escribe la contraseña del estudio en el copiloto y vuelve a intentarlo.')
  if (!res.ok) throw new Error(d.error ?? `Error ${res.status}`)
  const img = await fetch(d.url)
  if (!img.ok) throw new Error('No se pudo descargar la imagen generada.')
  const bmp0 = await createImageBitmap(await img.blob())
  // La IA a veces deja un marco blanco alrededor: se recorta para que el dibujo llegue a los bordes
  let marco = await sinMarco(bmp0)
  let urlFal: string = d.url
  // Escena dibujada pequeña con franjas: se pide a la IA que la amplíe (más pared arriba, más suelo abajo)
  if (tipo === 'inserto' && marco.bandas) {
    const r2 = await fetch('/api/imagen', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-clave-estudio': readPass() },
      body: JSON.stringify({
        tipo: 'libre',
        formato: formatoDe(project),
        referencia: d.url,
        descripcion:
          'Extend this drawing so the scene fills the WHOLE tall canvas edge to edge: continue the same place upward (wall, ceiling or sky) and downward (floor or ground) and to the sides, in exactly the same crude hand-drawn style and colors. Keep everything that already exists identical and in the same place, just bigger in the frame if needed. Absolutely no white margins, borders or frames. No text.',
      }),
    }).catch(() => null)
    const d2 = r2 && r2.ok ? await r2.json().catch(() => ({})) : {}
    if (d2.url) {
      const i2 = await fetch(d2.url).catch(() => null)
      if (i2?.ok) {
        const m2 = await sinMarco(await createImageBitmap(await i2.blob()))
        if (!m2.bandas) {
          marco = m2
          urlFal = d2.url
        }
      }
    }
  }
  return { ...(await capaDeMarco(marco, descripcion, tipo)), urlFal }
}

/** Guarda una imagen ya recortada como capa (con la cara del protagonista localizada si es una escena). */
async function capaDeMarco(marco: { blob: Blob; bmp: ImageBitmap }, descripcion: string, tipo?: 'inserto'): Promise<BgLayer> {
  let blob = marco.blob
  const bmp = marco.bmp
  // Escena con el protagonista dentro: se le borra la boca dibujada (respaldo si no hay boca dibujada por IA)
  let cara: CaraEscena | undefined
  const original = blob
  // Una foto suya dentro de un móvil o un cuadro no habla
  // (solo cuando el plano ES la foto o la pantalla, no cuando él mira una pantalla)
  const esFoto = /^\s*(an? |the )?((extreme )?close-?up (shot )?of )?(an? |the |his |her )?(\w+ )?(phone|smartphone|tablet|photo|picture|portrait|screen|poster|frame|polaroid)\b/i.test(descripcion)
  if (tipo === 'inserto' && !esFoto) {
    const a = await analizarCara(bmp).catch(() => null)
    if (a) {
      blob = a.blob
      cara = a.cara
    }
  }
  const id = `fondo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  await saveImage(id, blob)
  if (cara) await saveImage(id + '-orig', original)
  await ensureMedia(cara ? [id, id + '-orig'] : [id])
  const name = descripcion.length > 28 ? descripcion.slice(0, 26) + '…' : descripcion
  return { id, name, imageId: id, w: bmp.width, h: bmp.height, ...(cara ? { cara, imageIdOrig: id + '-orig' } : {}) }
}

/** Recorta las bandas casi blancas de los bordes (marco que deja a veces la IA). */
export async function sinMarco(bmp: ImageBitmap): Promise<{ blob: Blob; bmp: ImageBitmap; bandas?: boolean }> {
  const W = bmp.width, H = bmp.height
  const c = new OffscreenCanvas(W, H)
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(bmp, 0, 0)
  const d = g.getImageData(0, 0, W, H).data
  // Fracción de píxeles casi blancos de una fila o columna
  const blancaFila = (y: number) => {
    let n = 0
    for (let x = 0; x < W; x += 4) if (Math.min(d[(y * W + x) * 4], d[(y * W + x) * 4 + 1], d[(y * W + x) * 4 + 2]) > 235) n++
    return n / Math.ceil(W / 4) > 0.97
  }
  const blancaCol = (x: number) => {
    let n = 0
    for (let y = 0; y < H; y += 4) if (Math.min(d[(y * W + x) * 4], d[(y * W + x) * 4 + 1], d[(y * W + x) * 4 + 2]) > 235) n++
    return n / Math.ceil(H / 4) > 0.97
  }
  let y0 = 0, y1 = H - 1, x0 = 0, x1 = W - 1
  // Hasta un 42 % por lado: a veces la IA dibuja la escena pequeña con grandes franjas blancas
  while (y0 < H * 0.42 && blancaFila(y0)) y0++
  while (y1 > H * 0.58 && blancaFila(y1)) y1--
  while (x0 < W * 0.42 && blancaCol(x0)) x0++
  while (x1 > W * 0.58 && blancaCol(x1)) x1--
  // Un poco más hacia dentro para quitar también la línea del borde del marco
  if (y0 > 0) y0 += 6
  if (y1 < H - 1) y1 -= 6
  if (x0 > 0) x0 += 6
  if (x1 < W - 1) x1 -= 6
  if (x0 === 0 && y0 === 0 && x1 === W - 1 && y1 === H - 1) {
    return { blob: await c.convertToBlob({ type: 'image/jpeg', quality: 0.92 }), bmp }
  }
  // Contenido real (sin el marco blanco), para rellenar luego lo blanco que quede alrededor
  const cont = { x0, y0, x1, y1 }
  // Se conserva la forma del vídeo: si al quitar el blanco quedara una franja (p. ej. la escena dibujada
  // pequeña en el centro), luego al llenar la pantalla se comían los lados y el personaje salía cortado
  const forma = W / H
  let w = x1 - x0 + 1, h = y1 - y0 + 1
  if (Math.abs(w / h - forma) / forma > 0.06) {
    if (w / h > forma) {
      const nh = Math.min(H, Math.round(w / forma))
      const cy = (y0 + y1) / 2
      y0 = Math.max(0, Math.min(H - nh, Math.round(cy - nh / 2)))
      h = nh
      if (h < w / forma) {
        const nw = Math.round(h * forma)
        x0 = Math.max(0, Math.round((x0 + x1) / 2 - nw / 2))
        w = Math.min(nw, W - x0)
      }
    } else {
      const nw = Math.min(W, Math.round(h * forma))
      const cx = (x0 + x1) / 2
      x0 = Math.max(0, Math.min(W - nw, Math.round(cx - nw / 2)))
      w = nw
      if (w < h * forma) {
        const nh = Math.round(w / forma)
        y0 = Math.max(0, Math.round((y0 + y1) / 2 - nh / 2))
        h = Math.min(nh, H - y0)
      }
    }
  }
  const out = new OffscreenCanvas(w, h)
  const go = out.getContext('2d')!
  go.drawImage(c, x0, y0, w, h, 0, 0, w, h)
  // Lo que queda blanco por arriba/abajo/los lados se pinta con el color del borde del dibujo (la pared
  // arriba, el suelo abajo): así no se ven franjas blancas ni hay que recortar al personaje
  const colorDe = (yy0: number, yy1: number, xx0: number, xx1: number) => {
    let r = 0, gg = 0, b = 0, n = 0
    for (let yy = Math.max(0, yy0); yy <= Math.min(H - 1, yy1); yy += 2)
      for (let xx = Math.max(0, xx0); xx <= Math.min(W - 1, xx1); xx += 3) {
        const p = (yy * W + xx) * 4
        r += d[p]; gg += d[p + 1]; b += d[p + 2]; n++
      }
    return n ? `rgb(${Math.round(r / n)},${Math.round(gg / n)},${Math.round(b / n)})` : '#fff'
  }
  const cx0 = cont.x0 - x0, cy0 = cont.y0 - y0, cx1 = cont.x1 - x0, cy1 = cont.y1 - y0
  if (cy0 > 4) {
    go.fillStyle = colorDe(cont.y0 + 4, cont.y0 + 14, cont.x0, cont.x1)
    go.fillRect(0, 0, w, cy0)
  }
  if (cy1 < h - 4) {
    go.fillStyle = colorDe(cont.y1 - 14, cont.y1 - 4, cont.x0, cont.x1)
    go.fillRect(0, cy1, w, h - cy1)
  }
  if (cx0 > 4) {
    go.fillStyle = colorDe(cont.y0, cont.y1, cont.x0 + 4, cont.x0 + 14)
    go.fillRect(0, 0, cx0, h)
  }
  if (cx1 < w - 4) {
    go.fillStyle = colorDe(cont.y0, cont.y1, cont.x1 - 14, cont.x1 - 4)
    go.fillRect(cx1, 0, w - cx1, h)
  }
  const blob = await out.convertToBlob({ type: 'image/jpeg', quality: 0.92 })
  // ¿La escena ocupaba solo una franja? (entonces se ha rellenado y conviene ampliarla de verdad)
  const bandas = (cont.y1 - cont.y0) / H < 0.8 || (cont.x1 - cont.x0) / W < 0.8
  return { blob, bmp: await createImageBitmap(blob), bandas }
}

/** Añade una capa al fondo (detrás de las demás capas de fondo). */
export function addLayer(layer: BgLayer) {
  const st = useStore.getState()
  st.setProjectProps({ fondos: [layer, ...(st.project.fondos ?? [])] })
}

/**
 * Fondos para las escenas: una imagen por cada fondo distinto (si una escena no describe fondo,
 * sigue el anterior). Devuelve las escenas con su capa asignada; si el guion ya está animado,
 * coloca también las capas en la línea de tiempo.
 */
export async function generateSceneBackgrounds(escenas: Escena[], onProgress: (m: string) => void): Promise<Escena[]> {
  if (!escenas.length) throw new Error('Primero prepara las escenas.')
  // Si ninguna escena describe su fondo (p. ej. «Dividir sin IA»), un único fondo sencillo que encaje
  // con lo que cuenta el guion
  if (!escenas.some((e) => e.fondo.trim())) {
    const tema = escenas.map((e) => e.dialogo).join(' ').slice(0, 400)
    escenas = escenas.map((e, i) => (i === 0 ? { ...e, fondo: `un lugar cotidiano y sencillo que encaje con lo que cuenta este texto: «${tema}»` } : e))
  }
  const grupos: { desc: string; idx: number[] }[] = []
  let actual = ''
  escenas.forEach((e, i) => {
    const desc = e.fondo.trim() || actual
    if (!desc) return
    if (desc !== actual || !grupos.length) grupos.push({ desc, idx: [i] })
    else grupos[grupos.length - 1].idx.push(i)
    actual = desc
  })
  if (!grupos.length) throw new Error('Las escenas no describen ningún fondo. Escribe uno en alguna escena o pide las escenas con IA.')

  const out = escenas.map((e) => ({ ...e }))
  const capas: BgLayer[] = []
  const fallos: string[] = []
  for (let g = 0; g < grupos.length; g++) {
    // Si ya hay un fondo con esa misma descripción, se reutiliza (no se paga otra vez)
    // Se reutiliza el fondo con la misma descripción, pero solo si tiene la misma forma que el vídeo
    const pr = useStore.getState().project
    const previa = pr.fondos?.find((l) => l.descripcion === grupos[g].desc && Math.abs(l.w / l.h - pr.width / pr.height) < 0.15)
    onProgress(previa ? `Reutilizando fondo: ${grupos[g].desc}` : `Generando fondo ${g + 1} de ${grupos.length}: ${grupos[g].desc}`)
    let layer: BgLayer
    try {
      layer = previa ?? { ...(await generateBackground(grupos[g].desc, useStore.getState().project)), descripcion: grupos[g].desc }
    } catch (e) {
      // Si un fondo falla, los demás se generan igual
      fallos.push(`«${grupos[g].desc}»: ${e instanceof Error ? e.message : e}`)
      continue
    }
    capas.push(layer)
    for (const i of grupos[g].idx) out[i].capa = layer.id
  }

  const st = useStore.getState()
  const fps = st.project.fps
  // Quita las capas de fondo de escenas anteriores que ya no se usen
  const viejas = new Set((st.project.guion?.escenas ?? []).map((e) => e.capa).filter(Boolean) as string[])
  let tracks = Object.fromEntries(
    Object.entries(st.project.instances[0].tracks).filter(([c]) => !(c.startsWith('bg:') && viejas.has(c.split(':')[1]))),
  )
  const animado = !!st.project.guion?.escenas.length
  if (animado) {
    let t = 0
    const placed = out.map((e) => {
      const p = { ...e, inicio: t }
      t += e.duracion || estimateDuration(e.dialogo)
      return p
    })
    tracks = { ...tracks, ...backgroundKeys(placed, st.project.duration, fps) }
  }
  const [inst, ...rest] = st.project.instances
  st.commit({
    ...st.project,
    fondos: [...capas, ...(st.project.fondos ?? []).filter((l) => !viejas.has(l.id) && !capas.some((c) => c.id === l.id))],
    guion: animado ? { ...st.project.guion!, escenas: out } : st.project.guion,
    instances: [{ ...inst, tracks }, ...rest],
  })
  if (fallos.length) throw new Error(`no salió ${fallos.length === 1 ? 'un fondo' : fallos.length + ' fondos'} (${fallos.join('; ')})`)
  return out
}

/**
 * Fondos del montaje por viñetas: un dibujo por lugar distinto (los ya hechos con la misma descripción y
 * forma se reutilizan) y cada uno visible solo en sus viñetas, con corte seco.
 */
/** Clave de la capa de una viñeta: su lugar, o su inserto (dibujo a pantalla completa delante del narrador). */
const claveCapa = (v: { fondo: string; inserto?: string; cambio?: string }) => (v.inserto ? INSERTO + v.inserto + (v.cambio ? CAMBIO + v.cambio : '') : v.fondo)
const CAMBIO = ' ⟶ '
const INSERTO = 'inserto: '

export async function fondosPorVinetas(
  vinetasIn: { t: number; fondo: string; lado?: 'izq' | 'centro' | 'der'; inserto?: string; cambio?: string; otro?: [number, number] }[],
  onProgress: (m: string) => void,
) {
  const vinetas = vinetasIn.map((v) => ({ ...v, fondo: claveCapa(v) }))
  const unicos = [...new Set(vinetas.map((v) => v.fondo))]
  const capaDe = new Map<string, BgLayer>()
  const crudos = new Map<string, Crudo>()
  const fallos: string[] = []
  let n = 0
  const pr0 = useStore.getState().project
  const previaDe = (d: string) => pr0.fondos?.find((l) => l.descripcion === d && Math.abs(l.w / l.h - pr0.width / pr0.height) < 0.15)
  const lugares = unicos.filter((u) => !/^blanco\b/i.test(u) && !u.startsWith(INSERTO))
  /** Guarda una variante (boca abierta…) con el mismo recorte que su capa; devuelve su id si encaja. */
  const guardarVariante = async (capa: BgLayer, lienzo: OffscreenCanvas, sufijo: string) => {
    const m = await sinMarco(await createImageBitmap(lienzo))
    if (m.bmp.width !== capa.w || m.bmp.height !== capa.h) return undefined
    const id = capa.id + sufijo
    await saveImage(id, m.blob)
    await ensureMedia([id])
    return id
  }
  const crudoDe = async (clave: string) => {
    let c = crudos.get(clave)
    const url = capaDe.get(clave)?.urlFal
    if (!c && url) {
      c = await crudoDeUrl(url)
      crudos.set(clave, c)
    }
    return c
  }
  // Un plano = su dibujo y, encadenados, sus cambios de pose. Cada plano se hace entero (y varios a la vez)
  const hacer = async (d: string) => {
    const pr = useStore.getState().project
    const previa = previaDe(d)
    const esInserto = d.startsWith(INSERTO)
    n++
    onProgress(previa ? `Reutilizando: ${d.slice(0, 60)}` : esInserto ? `Dibujando el plano ${n} de ${unicos.length}…` : `Generando fondo ${n} de ${unicos.length}: ${d}`)
    try {
      if (!esInserto) {
        // El lado libre (contrario al personaje) se pide casi vacío, para el contenido
        const lado = vinetas.find((v) => v.fondo === d && v.lado && v.lado !== 'centro')?.lado
        const hueco = lado === 'izq' ? 'der' : lado === 'der' ? 'izq' : undefined
        capaDe.set(d, previa ?? { ...(await generateBackground(d, pr, hueco, lugares.indexOf(d))), descripcion: d })
        return
      }
      if (previa) {
        capaDe.set(d, previa)
        return
      }
      const partes = d.slice(INSERTO.length).split(CAMBIO)
      let capa: BgLayer
      let crudo: Crudo
      let abierta: OffscreenCanvas | null = null
      if (partes.length === 1) {
        // El dibujo del plano
        capa = { ...(await generateBackground(partes[0], pr, undefined, undefined, 'inserto')), descripcion: d, delante: true }
        crudo = await crudoDeUrl(capa.urlFal!)
        if (capa.cara) abierta = await conBocaAbierta(crudo, pr).catch(() => null)
      } else {
        // Un cambio de pose: se edita el dibujo anterior del mismo plano y se copia solo lo que cambia
        const claveAnterior = INSERTO + partes.slice(0, -1).join(CAMBIO)
        const anterior = await crudoDe(claveAnterior)
        if (!anterior) return
        const r = await conCambio(anterior, partes[partes.length - 1], pr)
        crudo = r.crudo
        abierta = r.abierta
        capa = { ...(await capaDeMarco(await sinMarco(await createImageBitmap(crudo.comp)), partes[0], 'inserto')), descripcion: d, delante: true, urlFal: crudo.url }
      }
      crudos.set(d, crudo)
      if (abierta && capa.cara) capa.imageIdOpen = await guardarVariante(capa, abierta, '-boca')
      capaDe.set(d, capa)
    } catch (e) {
      fallos.push(`«${d.slice(0, 50)}»: ${e instanceof Error ? e.message : e}`)
    }
  }
  // Cadenas: cada dibujo base con sus cambios, en orden; hasta 3 cadenas a la vez
  const cadenas = new Map<string, string[]>()
  for (const d of unicos) {
    const base = d.startsWith(INSERTO) ? INSERTO + d.slice(INSERTO.length).split(CAMBIO)[0] : d
    cadenas.set(base, [...(cadenas.get(base) ?? []), d])
  }
  const cola = [...cadenas.values()]
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      for (let c = cola.shift(); c; c = cola.shift()) for (const d of c) await hacer(d)
    }),
  )
  // La otra persona «habla» (se cuenta lo que dice): su boca abierta en el dibujo que se ve en ese momento
  for (const capa of capaDe.values()) if (capa.otroHabla) capa.otroHabla = []
  for (const v of vinetas) {
    if (!v.otro) continue
    const capa = capaDe.get(v.fondo)
    if (!capa || !v.fondo.startsWith(INSERTO)) continue
    try {
      if (!capa.imageIdOtro) {
        const crudo = await crudoDe(v.fondo)
        const lienzo = crudo ? await conBocaDelOtro(crudo, useStore.getState().project) : null
        if (lienzo) capa.imageIdOtro = await guardarVariante(capa, lienzo, '-otro')
      }
      if (capa.imageIdOtro) capa.otroHabla = [...(capa.otroHabla ?? []), v.otro]
    } catch {
      // sin boca del otro: se queda quieto
    }
  }
  const st = useStore.getState()
  const total = st.project.duration
  const fps = st.project.fps
  const r = (x: number) => Math.round(x * fps) / fps
  // Fuera las pistas de los fondos automáticos anteriores (los que tienen descripción)
  const auto = new Set((st.project.fondos ?? []).filter((l) => l.descripcion).map((l) => l.id))
  let tracks = Object.fromEntries(Object.entries(st.project.instances[0].tracks).filter(([c]) => !(c.startsWith('bg:') && auto.has(c.split(':')[1]))))
  // Tramos de cada capa (juntando viñetas seguidas con el mismo fondo)
  const tramos: { id: string; desde: number; hasta: number }[] = []
  vinetas.forEach((v, i) => {
    // Si el segundo dibujo de un plano no salió, sigue el primero
    let capa = capaDe.get(v.fondo)
    for (let partes = v.fondo.split(CAMBIO); !capa && v.inserto && partes.length > 1; ) {
      partes = partes.slice(0, -1)
      capa = capaDe.get(partes.join(CAMBIO))
    }
    const hasta = vinetas[i + 1]?.t ?? total
    const last = tramos[tramos.length - 1]
    if (!capa) return
    if (last && last.id === capa.id && Math.abs(last.hasta - v.t) < 1e-3) last.hasta = hasta
    else tramos.push({ id: capa.id, desde: v.t, hasta })
  })
  for (const t of tramos) {
    const op = `bg:${t.id}:opacity`
    if (!tracks[op]) tracks = setKey(tracks, op, 0, t.desde > 1e-3 ? 0 : 1, 'salto')
    tracks = setKey(tracks, op, r(t.desde), 1, 'salto')
    if (t.hasta < total - 1e-3) tracks = setKey(tracks, op, r(t.hasta), 0, 'salto')
    tracks = setKey(tracks, `bg:${t.id}:scale`, r(t.desde), 1, 'salto')
  }
  const usadas = [...new Map([...capaDe.values()].map((c) => [c.id, c])).values()]
  const [inst, ...rest] = st.project.instances
  st.commit({
    ...st.project,
    // Las capas automáticas que ya no se usan se quitan; las que puso el usuario a mano se quedan
    fondos: [...usadas, ...(st.project.fondos ?? []).filter((l) => !l.descripcion)],
    instances: [{ ...inst, tracks }, ...rest],
  })
  if (fallos.length) throw new Error(`no salió ${fallos.length === 1 ? 'un fondo' : fallos.length + ' fondos'} (${fallos.join('; ')})`)
}
