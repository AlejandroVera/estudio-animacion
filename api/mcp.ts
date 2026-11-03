// Conector MCP para Claude (claude.ai, app de escritorio o Claude Code).
// URL del conector: https://<tu-web>/api/mcp?clave=<CLAVE_ESTUDIO>
// Claude lee el estado que publica la web y deja órdenes en la cola; la web abierta y
// «conectada» las aplica en segundos (y se pueden deshacer con Ctrl+Z).
// Implementa el transporte HTTP de MCP sin sesiones, respondiendo siempre JSON.

import { almacenListo, encolar, leerContexto } from './_almacen.js'
import { GUIA, GUIA_GUION, SCHEMA, SCHEMA_GUION } from './_guia.js'

const INSTRUCCIONES = `Estás conectado al Estudio de Animación de Alejandro (una web donde anima personajes
de dibujo animado por piezas). Antes de animar, llama a ver_estudio para conocer el personaje, sus piezas
y la animación actual. Después usa animar con las claves. Tras animar puedes volver a llamar a
ver_estudio para comprobar que se aplicó. La web tiene que estar abierta con «Conectar con Claude» activado.

Guiones: ver_estudio devuelve en "guion" las escenas montadas ahora (para corregir o continuar un
guion, reenvíalo completo con los cambios). Usa proponer_guion para dejar el guion en el panel de la
web y que el usuario lo revise antes de animar (por defecto si pide «escríbeme un guion»), y guion
para montarlo y animarlo directamente (si pide que lo monte, lo anime o haga el vídeo).
Para vídeos completos a partir de un guion o una idea:
${GUIA_GUION}

Para retoques sobre la animación existente usa animar:
${GUIA.replace('El usuario,\nque no es animador, te pide', 'El usuario te pide').replace(
  'Recibes la descripción del personaje y la animación actual en JSON.',
  'La descripción del personaje y la animación actual te las da ver_estudio.',
)}`

const TOOLS = [
  {
    name: 'ver_estudio',
    description:
      'Devuelve el personaje (piezas, a qué pieza cuelga cada una, ángulo de reposo, bocas, cejas, expresiones), la duración, el instante actual y todas las claves de animación del proyecto abierto en la web.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'animar',
    description:
      'Añade claves de animación al proyecto abierto en la web (y opcionalmente borra claves de un tramo o cambia la duración). Sigue la guía de animación de las instrucciones del servidor. El usuario puede deshacerlo en la web con Ctrl+Z.',
    inputSchema: SCHEMA,
  },
  {
    name: 'guion',
    description:
      'Monta un vídeo completo a partir de escenas: cada escena con su diálogo, plano de cámara, expresión, duración y gestos de la biblioteca. Sustituye la animación del proyecto (se puede deshacer). Sigue la guía de guion de las instrucciones del servidor.',
    inputSchema: SCHEMA_GUION,
  },
  {
    name: 'proponer_guion',
    description:
      'Deja un guion (escenas) en el panel Guion de la web para que el usuario lo revise y edite antes de animarlo. No cambia la animación. Úsalo cuando el usuario quiera ver o retocar el guion antes, o cuando no esté claro que quiera montarlo ya.',
    inputSchema: SCHEMA_GUION,
  },
  {
    name: 'deshacer',
    description: 'Deshace el último cambio del proyecto en la web (como Ctrl+Z).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
]

type RpcRequest = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Record<string, unknown> }

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const texto = (t: string, isError = false) => ({ content: [{ type: 'text', text: t }], isError })

async function estadoWeb() {
  const guardado = await leerContexto()
  const conectada = guardado ? Date.now() - guardado.at < 2 * 60_000 : false
  return { guardado, conectada }
}

async function llamarHerramienta(name: string, args: Record<string, unknown>) {
  if (!almacenListo()) return texto('El estudio no tiene el almacén configurado en Vercel (Upstash Redis).', true)
  if (name === 'ver_estudio') {
    const { guardado, conectada } = await estadoWeb()
    if (!guardado) return texto('La web todavía no ha publicado ningún proyecto. Pide al usuario que abra la web y active «Conectar con Claude».', true)
    const aviso = conectada ? '' : 'AVISO: la web no ha dado señales en los últimos minutos; puede estar cerrada o desconectada.\n'
    return texto(aviso + JSON.stringify(guardado.contexto))
  }
  if (name === 'animar') {
    if (!Array.isArray(args.claves)) return texto('Faltan las claves.', true)
    const seq = await encolar({ tipo: 'animar', resultado: args })
    const { conectada } = await estadoWeb()
    return texto(
      `Enviado a la web (orden ${seq}).` +
        (conectada ? ' Se aplicará en unos segundos.' : ' Ojo: la web no parece conectada; se aplicará cuando el usuario la abra y active «Conectar con Claude» si no han pasado muchas órdenes.'),
    )
  }
  if (name === 'guion') {
    if (!Array.isArray(args.escenas) || !args.escenas.length) return texto('Faltan las escenas.', true)
    const seq = await encolar({ tipo: 'guion', resultado: args })
    return texto(`Guion enviado a la web (orden ${seq}): ${args.escenas.length} escenas.`)
  }
  if (name === 'proponer_guion') {
    if (!Array.isArray(args.escenas) || !args.escenas.length) return texto('Faltan las escenas.', true)
    const seq = await encolar({ tipo: 'proponer', resultado: args })
    return texto(`Guion propuesto en la web (orden ${seq}): ${args.escenas.length} escenas. El usuario lo revisará y pulsará «Animar escenas».`)
  }
  if (name === 'deshacer') {
    const seq = await encolar({ tipo: 'deshacer' })
    return texto(`Orden de deshacer enviada (orden ${seq}).`)
  }
  return texto(`Herramienta desconocida: ${name}`, true)
}

async function responder(req: RpcRequest): Promise<unknown | null> {
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id: req.id, result })
  const err = (code: number, message: string) => ({ jsonrpc: '2.0', id: req.id ?? null, error: { code, message } })
  if (req.id === undefined) return null // notificación: no lleva respuesta
  switch (req.method) {
    case 'initialize':
      return ok({
        protocolVersion: (req.params?.protocolVersion as string) ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'estudio-animacion', version: '1.0.0' },
        instructions: INSTRUCCIONES,
      })
    case 'ping':
      return ok({})
    case 'tools/list':
      return ok({ tools: TOOLS })
    case 'tools/call': {
      const name = String(req.params?.name ?? '')
      const args = (req.params?.arguments as Record<string, unknown>) ?? {}
      try {
        return ok(await llamarHerramienta(name, args))
      } catch (e) {
        return ok(texto(`Error: ${e instanceof Error ? e.message : String(e)}`, true))
      }
    }
    default:
      return err(-32601, `Método no soportado: ${req.method}`)
  }
}

function autorizado(request: Request) {
  const clave = process.env.CLAVE_ESTUDIO
  if (!clave) return false
  const url = new URL(request.url)
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return url.searchParams.get('clave') === clave || bearer === clave
}

export async function POST(request: Request): Promise<Response> {
  if (!autorizado(request)) return json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Clave del estudio incorrecta' } }, 401)
  let body: RpcRequest | RpcRequest[]
  try {
    body = await request.json()
  } catch {
    return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON no válido' } }, 400)
  }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(responder))).filter((r) => r !== null)
    return out.length ? json(out) : new Response(null, { status: 202 })
  }
  const out = await responder(body)
  return out === null ? new Response(null, { status: 202 }) : json(out)
}

export function GET(): Response {
  return new Response('Este conector solo acepta POST (MCP sin streaming).', { status: 405, headers: { allow: 'POST' } })
}
