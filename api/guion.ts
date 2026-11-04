// Función del servidor: convierte un guion (o una idea) en escenas listas para animar.
// Usa las mismas variables que el copiloto (ANTHROPIC_API_KEY, CLAVE_ESTUDIO, COPILOTO_MODELO).

import { claveOk } from './_clave.js'
import Anthropic from '@anthropic-ai/sdk'
import { almacenListo, estiloActivo } from './_almacen.js'
import { GUIA_GUION, SCHEMA_GUION } from './_guia.js'

const MODELOS = ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5']
const CON_RESPALDO = new Set(['claude-sonnet-5-5', 'claude-opus-5-5'])

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Falta configurar las claves en Vercel.' }, 503)
  if (!claveOk(request)) return json({ error: 'clave' }, 401)

  let body: { texto?: string; contexto?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Petición no válida.' }, 400)
  }
  const texto = (body.texto ?? '').trim()
  if (!texto || texto.length > 12000) return json({ error: 'Escribe el guion o la idea del vídeo.' }, 400)

  const model = MODELOS.includes(process.env.COPILOTO_MODELO ?? '') ? process.env.COPILOTO_MODELO! : 'claude-haiku-5-5'
  const estilo = almacenListo() ? await estiloActivo().catch(() => null) : null
  const client = new Anthropic()
  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      ...(CON_RESPALDO.has(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA_GUION } },
      system: [
        { type: 'text', text: GUIA_GUION, cache_control: { type: 'ephemeral' } },
        ...(estilo
          ? [{ type: 'text' as const, text: `ESTILO Y ESTRUCTURA DEL USUARIO («${estilo.nombre}») — síguelo por encima de las pautas generales de tono y estructura:\n${estilo.texto}` }]
          : []),
      ],
      messages: [{ role: 'user', content: `Estudio (JSON):\n${JSON.stringify(body.contexto)}\n\nGuion o idea:\n${texto}` }],
    })
    if (response.stop_reason === 'refusal') return json({ error: 'La IA no ha podido con ese texto. Prueba a reformularlo.' }, 422)
    if (response.stop_reason === 'max_tokens') return json({ error: 'El guion es demasiado largo. Divídelo en partes.' }, 422)
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
