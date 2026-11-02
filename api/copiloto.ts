// Función del servidor (Vercel): recibe una orden en español y el estado de la animación,
// y devuelve las claves de animación que la cumplen. La clave de Anthropic solo vive aquí.
//
// Variables de entorno en Vercel:
//   ANTHROPIC_API_KEY  clave de la API de Anthropic
//   CLAVE_ESTUDIO      contraseña que pide la web antes de usar el copiloto
//   COPILOTO_MODELO    (opcional) modelo de Claude; por defecto claude-haiku-5-5, el más barato

import Anthropic from '@anthropic-ai/sdk'
import { GUIA, SCHEMA } from './_guia.js'

const MODELOS = ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5']
// Reintento automático con otro modelo si este rechaza la petición (no existe para Haiku).
const CON_RESPALDO = new Set(['claude-sonnet-5-5', 'claude-opus-5-5'])

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export async function POST(request: Request): Promise<Response> {
  const clave = process.env.CLAVE_ESTUDIO
  if (!process.env.ANTHROPIC_API_KEY || !clave) {
    return json({ error: 'El copiloto aún no está configurado: faltan las claves en Vercel.' }, 503)
  }
  if (request.headers.get('x-clave-estudio') !== clave) {
    return json({ error: 'clave' }, 401)
  }

  let body: { instruccion?: string; contexto?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Petición no válida.' }, 400)
  }
  const instruccion = (body.instruccion ?? '').trim()
  if (!instruccion || instruccion.length > 2000) return json({ error: 'Escribe qué quieres que haga.' }, 400)

  const model = MODELOS.includes(process.env.COPILOTO_MODELO ?? '') ? process.env.COPILOTO_MODELO! : 'claude-haiku-5-5'
  const client = new Anthropic()
  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      ...(CON_RESPALDO.has(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      system: [{ type: 'text', text: GUIA, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: `Estado actual (JSON):\n${JSON.stringify(body.contexto)}\n\nLo que quiero: ${instruccion}`,
        },
      ],
    })

    if (response.stop_reason === 'refusal') {
      return json({ error: 'El copiloto no ha podido hacer esa petición. Prueba a decirlo de otra forma.' }, 422)
    }
    if (response.stop_reason === 'max_tokens') {
      return json({ error: 'La petición era demasiado larga. Pide la animación por partes.' }, 422)
    }
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    return json(JSON.parse(text))
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'La clave de Anthropic no es válida.' }, 502)
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Demasiadas peticiones seguidas. Espera un momento.' }, 429)
    if (e instanceof Anthropic.APIError) return json({ error: `Error del servicio de IA (${e.status}).` }, 502)
    if (e instanceof SyntaxError) return json({ error: 'La respuesta de la IA no se pudo leer. Inténtalo de nuevo.' }, 502)
    throw e
  }
}
