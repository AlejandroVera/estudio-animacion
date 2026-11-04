// Función del servidor: «director de actor». Lee el guion palabra a palabra y decide en qué palabra
// cambia de postura el personaje y a cuál, según lo que dice (no al azar), al estilo de los vídeos
// de «Estoy Tiesa». Usa ANTHROPIC_API_KEY, CLAVE_ESTUDIO y COPILOTO_MODELO como el copiloto.

import { claveOk } from './_clave.js'
import Anthropic from '@anthropic-ai/sdk'

const MODELOS = ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5']
const CON_RESPALDO = new Set(['claude-sonnet-5-5', 'claude-opus-5-5'])

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const GUIA = `Eres director de animación de vídeos de YouTube de dibujos al estilo del canal «Estoy Tiesa»: un
narrador dibujado que habla a cámara y cambia de POSTURA COMPLETA (cuerpo y cara) de golpe. Recibes el
guion ya dividido en escenas y palabras numeradas, la emoción de cada escena y el catálogo de posturas
del personaje con lo que expresa cada una. Decide en qué palabra cambia de postura y a cuál.

Cómo actúa un buen narrador (síguelo):
- El gesto ILUSTRA lo que dice en ese momento: contar con los dedos al enumerar o decir una cifra de
  varias cosas, índice arriba al dar el dato clave, mano en el pecho al hablar de sí mismo o ser sincero,
  encogerse/rascarse la cabeza con la duda o la resignación, barbilla al plantear o pensar, presentar al
  introducir algo nuevo, señalar abajo con «comentarios/suscríbete», saludar al saludar, apenado en lo
  triste, cadera cuando está seguro o chulo.
- Reparto: ~45 % del tiempo posturas tranquilas, ~35 % gestos suaves, ~20 % exageradas. Las exageradas
  (las de frente: susto, enfado, llorar, celebrar, cruzado, ¡para!) SOLO en el remate de un chiste, una
  cifra escandalosa o una emoción fuerte, y como mucho una por escena.
- Antes de decidir, entiende el TONO de cada frase (queja irónica, consejo, dato, chiste, confesión) y lo
  que siente el narrador: el gesto tiene que contar eso, no ser decorativo. Ejemplos: «estamos
  agotados» → apenado o (si es el remate) llorar; «es tu culpa» dicho con ironía → índice/cadera con
  mirada escéptica; una lista de consejos («entrena, medita, haz terapia») → contar con los dedos;
  «somos lo que comemos» en tono de burla → encogerse con mirada escéptica.
- Cambia en la palabra que lleva el peso (el sustantivo, la cifra, el verbo clave), nunca en artículos o
  preposiciones. Cada postura dura entre 3 y 8 palabras (1,2-3 s): NUNCA más de 8 palabras seguidas sin
  cambiar de brazos o de mirada. Nada de cambios cada dos palabras.
- Varía: no repitas la misma postura en cambios seguidos. Cada escena empieza con una postura en su
  palabra 0 (puede ser la misma que venía si la frase continúa la idea).
- Usa SOLO nombres de postura del catálogo.

MIRADAS (si te dan un catálogo de miradas): los ojos cambian POR SU CUENTA, entre un cambio de brazos y
el siguiente, como en la referencia (brazos, ojos y boca nunca cambian todos a la vez). Úsalas para dar
matiz: ironía → escéptico, cifra escandalosa → platos, pensar → arriba, algo bonito → felices… Vuelve
a «propios» cuando pase el momento. Unas 1-3 miradas por escena, nunca en la misma palabra que un
cambio de postura. Solo valen con posturas tranquilas (las que empiezan por t_).`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['cambios'],
  properties: {
    cambios: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['motivo', 'escena', 'palabra', 'postura'],
        properties: {
          motivo: { type: 'string', description: 'Por qué este gesto en esta palabra (tono y significado), en pocas palabras.' },
          escena: { type: 'integer' },
          palabra: { type: 'integer' },
          postura: { type: 'string' },
        },
      },
    },
    miradas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['motivo', 'escena', 'palabra', 'ojos'],
        properties: {
          motivo: { type: 'string' },
          escena: { type: 'integer' },
          palabra: { type: 'integer' },
          ojos: { type: 'string' },
        },
      },
    },
  },
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Falta configurar las claves en Vercel.' }, 503)
  if (!claveOk(request)) return json({ error: 'clave' }, 401)
  let body: { escenas?: { escena: number; emocion: string; palabras: string[] }[]; posturas?: Record<string, string>; miradas?: Record<string, string> }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Petición no válida.' }, 400)
  }
  if (!body.escenas?.length || !body.posturas) return json({ error: 'Faltan escenas o posturas.' }, 400)
  const textoSeguido = body.escenas.map((e) => e.palabras.join(' ')).join(' ')
  const guion = body.escenas
    .map((e) => `Escena ${e.escena} (emoción: ${e.emocion}): ${e.palabras.map((w, i) => `${i}:${w}`).join(' ')}`)
    .join('\n')
  const catalogo = Object.entries(body.posturas).map(([k, v]) => `- ${k}: ${v}`).join('\n')
  if (guion.length > 20000) return json({ error: 'Guion demasiado largo.' }, 400)
  // La dirección necesita entender ironía y tono: por defecto Sonnet (cambiable con ACTUAR_MODELO)
  const model = MODELOS.includes(process.env.ACTUAR_MODELO ?? '') ? process.env.ACTUAR_MODELO! : 'claude-sonnet-5-5'
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
          content: `Catálogo de posturas:\n${catalogo}\n\n${body.miradas ? `Catálogo de miradas:\n${Object.entries(body.miradas).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\n` : ''}Texto completo (para entender el tono):\n${textoSeguido}\n\nGuion por escenas con las palabras numeradas:\n${guion}`,
        },
      ],
    })
    if (response.stop_reason !== 'end_turn') return json({ error: 'La IA no terminó la dirección.' }, 422)
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    return json(JSON.parse(text))
  } catch (e) {
    if (e instanceof Anthropic.APIError) return json({ error: `Error del servicio de IA (${e.status}).` }, 502)
    if (e instanceof SyntaxError) return json({ error: 'La respuesta de la IA no se pudo leer.' }, 502)
    throw e
  }
}
