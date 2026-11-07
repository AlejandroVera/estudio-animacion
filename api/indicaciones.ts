// Función del servidor: propone las INDICACIONES de cada escena («🎬 Lo que quieres que haga») a partir
// del guion, como lo haría el animador de un vídeo de «Estoy Tiesa». El usuario las revisa y retoca, y
// luego «Generar voces y animar» las cumple. Usa ANTHROPIC_API_KEY (y ACTUAR_MODELO si está).
//   POST {escenas: [{dialogo}], indicaciones?, formato?} -> {generales, escenas: [{indicacion}]}

import { claveOk } from './_clave.js'
import Anthropic from '@anthropic-ai/sdk'

const MODELOS = ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5']
const CON_RESPALDO = new Set(['claude-sonnet-5-5', 'claude-opus-5-5'])

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const GUIA = `Eres el animador y director de arte de vídeos de YouTube de dibujos al estilo del canal «Estoy
Tiesa»: un narrador dibujado (aquí, un chico de cabeza magenta redonda con aro en la nariz, camiseta gris
con una montaña y vaqueros rotos) habla a cámara con humor e ironía. Te dan el guion ya dividido en
escenas. Para CADA escena escribes, en español y en 2-4 frases cortas, lo que tiene que pasar en pantalla,
como notas de un animador para su equipo. El usuario las leerá, las retocará y luego un sistema las
cumplirá al pie de la letra, así que sé concreto.

LO MÁS IMPORTANTE: cuéntalo como una HISTORIA que vive el personaje (llega a casa reventado, abre la nevera
vacía, cena de pie un táper frío, se tira en el sofá…): cada escena es un momento de esa historia, con el
personaje en un lugar HACIENDO algo con un objeto o reaccionando. TEXTO MUY ESCASO: nunca escribas lo que
se oye; como mucho un rótulo en algunas escenas (una cifra, la palabra del remate) y la mayoría sin texto.
Nada de listas escritas: si enumera cosas, el personaje las HACE una tras otra.

LO QUE LO HACE DINÁMICO: no todo es el narrador hablando delante de un fondo. Muchas frases se ENSEÑAN
con una «viñeta dibujada» a pantalla completa (como un plano de recurso de cómic): el móvil con la app
abierta, la galería de fotos con tres fotos del DNI y un ticket, la hermana sacándole una foto en el
pasillo, una cuadrícula de 32 fotos fallidas, la foto final con los ojos cerrados… Propón una en 1 de cada
2-3 escenas, en la frase que mejor se entiende viéndola, y luego el narrador reacciona. Escríbela así:
«Viñeta dibujada en "palabra": lo que se ve.»

Qué hace que funcione (cómo es «Estoy Tiesa»):
- Cada frase o golpe es una VIÑETA pensada: el personaje en una situación, y a veces a su lado un bocadillo
  de pensamiento con lo que imagina, un cartelito con una cifra o UNA palabra escrita a mano en el remate.
- El personaje ACTÚA lo que dice: si habla de comer, come de un táper; si dice «entrena», levanta una pesa;
  si habla del móvil, lo mira. Cuando enseña algo, lo sujeta en la mano. A veces hay cosas delante de él
  (velas, platos, cajas). Reacciona con caras exageradas SOLO en los remates (ojos de corazón, susto, llorar
  a mares, agotado, furioso, ojos de euro, cabeza que explota, carcajada, mareado…); el resto del tiempo,
  gestos tranquilos y naturales (explicar, señalar, encogerse de hombros, brazos cruzados, mano en la
  barbilla…), casi siempre mirando a cámara.
- Fondos: un LUGAR cotidiano que ilustre lo que cuenta (la cocina, el sofá, la oficina, el gimnasio, el
  supermercado, la cama…) y fondo blanco solo en remates cortos o listas de palabras grandes. Repite el mismo
  lugar con el mismo nombre si sigue allí. Cambia de lugar cuando cambia la idea.
- Tamaño: cuerpo entero para situarlo en un lugar, de cintura arriba para explicar, primer plano (la cara)
  en el remate o la ironía.
- Ritmo: algo nuevo cada 2-4 segundos; nada decorativo «porque sí»: todo ilustra lo que dice.

Formato de cada indicación (sigue este estilo, sin listas ni viñetas, todo en una línea o dos):
«Fondo: la cocina de noche. Cuerpo entero, de pie junto a la encimera comiendo de un táper frío con
cara de resignación. En "agotados" se deja caer con cara de agotado.» (sin rótulo: la imagen lo cuenta)
«Fondo: el salón. Viñeta dibujada en "fotos": la pantalla del móvil con seis huecos de foto vacíos. En
"Seis" vuelve él, de cintura arriba, con cara de agobio.»
Usa «Fondo: …» al principio (o «Fondo blanco.»), nombra las palabras exactas entre comillas cuando algo
pasa en una palabra, y escribe los rótulos con su texto EXACTO en mayúsculas, su color (negro, rojo, verde
o azul) y si es palabra grande, nota subrayada o cartel con cifra. Si sujeta algo, di «sujeta X en la
mano»; si algo está delante de él, «X delante de él»; si lo imagina, «bocadillo de pensamiento con X».

Además escribe unas «generales»: 1-2 frases de tono y estilo para todo el vídeo.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['generales', 'escenas'],
  properties: {
    generales: { type: 'string' },
    escenas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['escena', 'indicacion'],
        properties: { escena: { type: 'integer' }, indicacion: { type: 'string' } },
      },
    },
  },
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Falta configurar las claves en Vercel.' }, 503)
  if (!claveOk(request)) return json({ error: 'clave' }, 401)
  let body: { escenas?: { dialogo: string; indicaciones?: string }[]; indicaciones?: string; formato?: string }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Petición no válida.' }, 400)
  }
  const escenas = (body.escenas ?? []).filter((e) => typeof e?.dialogo === 'string')
  if (!escenas.length) return json({ error: 'No hay escenas.' }, 400)
  const guion = escenas
    .map((e, i) => `Escena ${i}: ${e.dialogo.trim() || '(sin diálogo)'}${e.indicaciones?.trim() ? `\n  (el usuario ya había anotado: ${e.indicaciones.trim()})` : ''}`)
    .join('\n')
  if (guion.length > 20000) return json({ error: 'Guion demasiado largo.' }, 400)
  const model = MODELOS.includes(process.env.ACTUAR_MODELO ?? '') ? process.env.ACTUAR_MODELO! : 'claude-sonnet-5-5'
  const client = new Anthropic()
  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 8000,
      ...(CON_RESPALDO.has(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      system: [{ type: 'text', text: GUIA, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content:
            `Formato del vídeo: ${body.formato === 'vertical' ? 'vertical (el personaje va en el centro y el contenido arriba y a los lados)' : 'horizontal (personaje a un lado, contenido al otro)'}.\n` +
            (body.indicaciones?.trim() ? `Indicaciones generales que ya puso el usuario (respétalas): ${body.indicaciones.trim()}\n` : '') +
            `Si el usuario ya había anotado algo en una escena, CONSÉRVALO y complétalo.\n\nGuion:\n${guion}`,
        },
      ],
    })
    if (response.stop_reason !== 'end_turn') return json({ error: 'La IA no terminó las indicaciones.' }, 422)
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    return json(JSON.parse(text))
  } catch (e) {
    if (e instanceof Anthropic.APIError) return json({ error: `Error del servicio de IA (${e.status}).` }, 502)
    if (e instanceof SyntaxError) return json({ error: 'La respuesta de la IA no se pudo leer.' }, 502)
    throw e
  }
}
