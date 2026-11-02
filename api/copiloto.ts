// Función del servidor (Vercel): recibe una orden en español y el estado de la animación,
// y devuelve las claves de animación que la cumplen. La clave de Anthropic solo vive aquí.
//
// Variables de entorno en Vercel:
//   ANTHROPIC_API_KEY  clave de la API de Anthropic
//   CLAVE_ESTUDIO      contraseña que pide la web antes de usar el copiloto

import Anthropic from '@anthropic-ai/sdk'

const SYSTEM = `Eres el copiloto de un estudio de animación 2D por piezas (estilo cut-out). El usuario,
que no es animador, te pide en español lo que quiere que haga su personaje y tú lo conviertes en
claves de animación (keyframes). Recibes la descripción del personaje y la animación actual en JSON.

Cómo funciona el personaje:
- Cada pieza gira alrededor de su articulación. "angulo_reposo" es hacia dónde apunta la pieza en
  reposo, en grados de pantalla: 0 = derecha, 90 = abajo, 180 = izquierda, -90 = arriba.
- El canal part:<id>:rot es el giro en grados respecto al reposo. Positivo = sentido horario en
  pantalla. La dirección final de una pieza = su angulo_reposo + su giro + los giros de todas las
  piezas de las que cuelga (padre, abuelo...). Ejemplo: si un brazo apunta a 115° y quieres que
  apunte hacia arriba (-90°), su giro debe ser -205°, o mejor el equivalente +155° si es el camino
  natural; elige el sentido que no atraviese el cuerpo. Usa la geometría, no adivines el signo.
- part:<id>:x y part:<id>:y desplazan la pieza en píxeles del dibujo (y positivo = abajo). Úsalos
  sobre todo en la cadera (raíz) para botes, pasos o agacharse. part:<id>:scale cambia el tamaño (1 = normal).
- Cara: face:gazeX y face:gazeY (-1..1, mirada; x positivo = mirar a la derecha de la pantalla,
  y positivo = abajo), face:blink (0 abierto .. 1 cerrado; un parpadeo dura ~0,2 s: 0 → 1 → 0),
  face:mouth y face:brows (nombres de variante, cambian de golpe).
- Expresiones = combinaciones de cejas + boca que ya trae el personaje.

Reglas para animar bien:
- Movimiento natural: anticipación breve, llegar a la pose, mantenerla un poco y volver si tiene
  sentido. Los gestos de brazos duran 0,3-0,8 s; un saludo agita el antebrazo 2-3 veces.
- Para hablar sin audio, alterna bocas (abierta, E, O, cerrada, MBP) cada 0,08-0,15 s y termina cerrada.
- Añade algún parpadeo y pequeños movimientos de cabeza si dan vida, sin exagerar.
- Toca solo los canales necesarios para lo que pide. No borres lo que ya existe salvo que lo pida o
  sea necesario para que lo nuevo funcione; usa "borrar" para quitar claves en un tramo antes de
  rehacerlo.
- Usa los tiempos en segundos. Si dice "ahora" o "a partir de aquí", empieza en "instante_actual".
  Si no dice cuándo y la animación está vacía, empieza en 0; si ya hay animación, empieza en el
  instante actual. Si lo pedido no cabe en la duración, alarga "duracion".
- Transición: "suave" para casi todo, "lineal" para movimientos continuos, "salto" para cambios
  bruscos. Bocas y cejas siempre "salto".
- "valor" es un número escrito como texto ("-35", "0.8") salvo en face:mouth y face:brows, que
  llevan el nombre exacto de una variante disponible.
- En "mensaje" explica en una o dos frases sencillas qué has hecho y cuándo pasa. Si algo no se
  puede hacer con las piezas que hay (por ejemplo girarse de perfil), dilo y haz lo más parecido.`

const SCHEMA = {
  type: 'object',
  properties: {
    mensaje: { type: 'string' },
    duracion: { type: 'number', description: 'Nueva duración total en segundos, o 0 para dejarla igual' },
    borrar: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          canal: { type: 'string', description: 'Canal o "*" para todos' },
          desde: { type: 'number' },
          hasta: { type: 'number' },
        },
        required: ['canal', 'desde', 'hasta'],
        additionalProperties: false,
      },
    },
    claves: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          canal: { type: 'string' },
          t: { type: 'number' },
          valor: { type: 'string' },
          transicion: { type: 'string', enum: ['suave', 'lineal', 'salto'] },
        },
        required: ['canal', 't', 'valor', 'transicion'],
        additionalProperties: false,
      },
    },
  },
  required: ['mensaje', 'duracion', 'borrar', 'claves'],
  additionalProperties: false,
}

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

  const client = new Anthropic()
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
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
