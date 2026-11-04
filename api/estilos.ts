// Estilos de guion guardados en el almacén compartido.
//   GET  -> { estilos, activo }
//   POST { estilos, activo } -> guarda

import { claveOk } from './_clave.js'
import { almacenListo, guardarEstilos, leerEstilos } from './_almacen.js'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

function comprobar(request: Request): Response | null {
  if (!claveOk(request)) return json({ error: 'clave' }, 401)
  if (!almacenListo()) return json({ error: 'Falta conectar el almacén (Upstash Redis) en Vercel.' }, 503)
  return null
}

export async function GET(request: Request): Promise<Response> {
  return comprobar(request) ?? json(await leerEstilos())
}

export async function POST(request: Request): Promise<Response> {
  const fallo = comprobar(request)
  if (fallo) return fallo
  let body: { estilos?: { id: string; nombre: string; texto: string }[]; activo?: string | null }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Petición no válida.' }, 400)
  }
  const estilos = (body.estilos ?? [])
    .filter((e) => e && typeof e.id === 'string')
    .slice(0, 30)
    .map((e) => ({ id: e.id, nombre: String(e.nombre ?? '').slice(0, 80), texto: String(e.texto ?? '').slice(0, 20000) }))
  await guardarEstilos({ estilos, activo: body.activo ?? null })
  return json({ ok: true })
}
