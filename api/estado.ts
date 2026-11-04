// La web y el conector de Claude se encuentran aquí:
//   GET  ?desde=N  -> órdenes de Claude pendientes (número de orden > N)
//   POST {contexto} -> la web publica el estado de su proyecto para que Claude lo vea

import { claveOk } from './_clave.js'
import { almacenListo, guardarContexto, leerCola } from './_almacen.js'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

function comprobar(request: Request): Response | null {
  if (!claveOk(request)) return json({ error: 'clave' }, 401)
  if (!almacenListo()) return json({ error: 'Falta conectar el almacén (Upstash Redis) en Vercel.' }, 503)
  return null
}

export async function GET(request: Request): Promise<Response> {
  const fallo = comprobar(request)
  if (fallo) return fallo
  const desde = Number(new URL(request.url).searchParams.get('desde') ?? '0') || 0
  const cola = await leerCola()
  const ultimo = cola.reduce((m, e) => Math.max(m, e.seq), 0)
  return json({ ultimo, ops: cola.filter((e) => e.seq > desde) })
}

export async function POST(request: Request): Promise<Response> {
  const fallo = comprobar(request)
  if (fallo) return fallo
  let body: { contexto?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Petición no válida.' }, 400)
  }
  if (!body.contexto) return json({ error: 'Falta el contexto.' }, 400)
  await guardarContexto(body.contexto)
  return json({ ok: true })
}
