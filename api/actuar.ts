// Función del servidor: «director de actor». Lee el guion palabra a palabra y decide en qué palabra
// cambia de postura el personaje y a cuál, según lo que dice (no al azar), al estilo de los vídeos
// de «Estoy Tiesa». Usa ANTHROPIC_API_KEY, CLAVE_ESTUDIO y COPILOTO_MODELO como el copiloto.

import { claveOk } from './_clave.js'
import Anthropic from '@anthropic-ai/sdk'

const MODELOS = ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5']
const CON_RESPALDO = new Set(['claude-sonnet-5-5', 'claude-opus-5-5'])

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const ORDENES = `ÓRDENES DEL USUARIO (mandan sobre TODO lo demás): el usuario es el director y tú su
ayudante. Si una escena trae «indicaciones», cúmplelas al pie de la letra: el gesto que pida (si no
está en el catálogo, pídelo como gesto a medida en «nuevas»), la cara/mirada, el fondo exacto que
describa (en «fondos», con una entrada para CADA escena, repitiendo el texto si sigue el mismo lugar), los objetos que pida (en «objetos») y los rótulos que pida (en «rotulos») con su texto EXACTO letra por letra, su
color EXACTO y su sitio EXACTO, sin cambiarlos ni añadir palabras, en la palabra que encaje (o en la que
diga). Si pide una cara o mirada, ponla en «miradas» en ese momento. No sustituyas lo pedido por algo
«parecido»: el usuario lo ha decidido así. Las indicaciones generales se aplican a todo el vídeo. Lo que no te indique, complétalo tú
con las pautas.`

const GUIA = `Eres el director de animación de un vídeo de YouTube de dibujos al estilo del canal «Estoy Tiesa»: un
narrador dibujado (un chico de cabeza magenta) cuenta algo con humor e ironía. Recibes el guion dividido en
escenas y palabras numeradas, el catálogo de posturas del personaje (qué expresa cada una) y, si las hay,
las indicaciones del usuario. Decides qué se VE en cada momento. Tienes buen gusto: un buen animador
QUITA más de lo que pone.

1. PRIMERO LA HISTORIA. Escribe en «historia» la pequeña historia que VIVE el personaje mientras habla,
   momento a momento y con continuidad (llega a casa reventado → abre la nevera vacía → cena de pie un
   táper frío → se tira en el sofá → …). El guion es su voz; las imágenes son lo que le pasa. Todo lo
   demás sale de esta historia: si algo no forma parte de ella, no aparece.

2. VIÑETAS CON CONTINUIDAD. «vinetas»: el vídeo es una sucesión de momentos de 2 a 6 s (normalmente uno
   por frase; nunca más corto de 1,8 s). Cada viñeta: escena, palabra donde empieza (la primera, escena 0
   palabra 0), «idea» (el momento de la historia), «motivo» (por qué este corte aquí), «fondo», «tamano»
   y «lado».
   - «fondo»: el LUGAR donde está en ese momento de la historia (la cocina, el sofá de casa, el gimnasio…)
     o «blanco» para un remate o una reflexión corta. CONTINUIDAD: mientras la historia siga en el mismo
     sitio, el mismo lugar con el MISMO texto; solo cambia cuando la historia se mueve, y con lógica
     (no saltos sin motivo). LÍMITE: como mucho un lugar distinto por cada 10-15 s de vídeo (un vídeo de
     un minuto: 3-5 lugares) y cada lugar dura varias viñetas seguidas. Si la historia vuelve a un sitio
     (el sofá), escribe EXACTAMENTE el mismo texto que la primera vez: así se reutiliza el mismo dibujo
     (si lo nombras distinto, el sitio sale dibujado de otra manera y se pierde la continuidad).
   - «tamano»: «general» (cuerpo entero, para situarlo en el lugar), «medio» (de cintura arriba, para
     explicar), «primer» (la cara: el remate o la emoción fuerte, corto) o «lejos» (pequeño en un lugar
     grande: soledad, agobio). Varía con intención, no por variar.
   - «lado»: «centro» casi siempre. «izq»/«der» solo si al otro lado va a aparecer algo (un bocadillo, una
     cifra); el lado no cambia mientras siga en el mismo lugar.

3. EL PERSONAJE ACTÚA LA HISTORIA. «cambios»: en qué palabra cambia de postura y a cuál, con su «motivo».
   - Cada postura interpreta lo que dice y siente en ese momento (entiende el tono: queja irónica,
     confesión, consejo, chiste). Cambia en la palabra con peso, nunca en artículos o preposiciones; cada
     postura dura 3-8 palabras. Reparto: ~45 % tranquilas, ~35 % gestos suaves, ~20 % exageradas (caras
     t_e_* y gags de frente) SOLO en remates o emociones fuertes. Varía; no repitas la misma seguida.
   - GESTOS A MEDIDA («nuevas»): para las ACCIONES de la historia con un objeto (come de un táper, mira el
     móvil, levanta una pesa, se tumba agotado con la mano en la frente…): el personaje usa el objeto de
     verdad, dibujado con él. «nombre» corto, «dibujo» EN INGLÉS (brazos, manos y objeto), «que_expresa»
     y «motivo»; en «cambios» se usa como «x_<nombre>». Solo las acciones que más cuentan; si la misma
     acción vuelve, reutiliza el mismo gesto.

4. LO QUE APARECE AL LADO: MENOS ES MÁS. Cada cosa necesita un motivo claro; si dudas, NO la pongas. La
   mayoría de viñetas no llevan nada aparte del personaje y su lugar.
   - «objetos» (con «motivo»): solo (a) lo que IMAGINA, desea, teme o recuerda → pos «pensamiento»
     (bocadillo); (b) algo que ENSEÑA en la mano → pos «mano»; (c) algo que de verdad está DELANTE en ese
     lugar → pos «delante». Nunca algo que ya está usando en un gesto, nunca decoración, como mucho uno
     por viñeta. «que» en español, «dibujo» EN INGLÉS (un objeto sencillo).
   - NADA REPETIDO: una misma idea se cuenta UNA vez y de UNA forma. Si el lugar ya tiene un reloj, no
     pongas además un bocadillo con un reloj ni un rótulo con la hora; si dice «7 €» y ya lo pone un
     cartel, no hace falta también el billete. Elige lo más claro y quita el resto.
   - «rotulos» (con «motivo»): casi nunca. Solo una cifra o precio, o la palabra del remate, y nunca lo que
     ya se oye tal cual. Como mucho uno por viñeta y pocos en todo el vídeo. «estilo»: «nota» (palabra en
     color subrayada), «cartel» (cifra en un cartelito) o «grande» (una sola vez como mucho). Color: rojo
     lo malo, verde lo bueno, azul un dato, negro lo demás. «flecha» solo si une con lo anterior.

5. MIRADAS («miradas», si te dan catálogo): casi siempre al frente («propios»); una mirada distinta solo
   para un matiz (ironía → escéptico, cifra escandalosa → platos), entre cambios de brazos, 0-2 por
   escena. Solo con posturas tranquilas (t_).

Antes de responder, repasa: ¿se entiende la historia solo con las imágenes? ¿Hay algo que sobra? Quítalo.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['historia', 'cambios'],
  properties: {
    historia: { type: 'string', description: 'La pequeña historia que vive el personaje, momento a momento (se escribe ANTES de decidir lo demás).' },
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
    nuevas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['motivo', 'nombre', 'dibujo', 'que_expresa'],
        properties: { motivo: { type: 'string' }, nombre: { type: 'string' }, dibujo: { type: 'string' }, que_expresa: { type: 'string' } },
      },
    },
    fondos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['escena', 'fondo'],
        properties: { escena: { type: 'integer' }, fondo: { type: 'string' } },
      },
    },
    rotulos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['motivo', 'escena', 'palabra', 'texto', 'color', 'pos', 'estilo', 'flecha'],
        properties: {
          motivo: { type: 'string' },
          escena: { type: 'integer' },
          palabra: { type: 'integer' },
          texto: { type: 'string' },
          color: { type: 'string', enum: ['negro', 'rojo', 'verde', 'azul'] },
          pos: { type: 'string', enum: ['arriba', 'izq', 'der', 'izq_baja', 'der_baja', 'abajo'] },
          estilo: { type: 'string', enum: ['grande', 'nota', 'cartel'] },
          flecha: { type: 'boolean' },
        },
      },
    },
    vinetas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['escena', 'palabra', 'idea', 'motivo', 'fondo', 'tamano', 'lado'],
        properties: {
          motivo: { type: 'string' },
          escena: { type: 'integer' },
          palabra: { type: 'integer' },
          idea: { type: 'string' },
          fondo: { type: 'string' },
          tamano: { type: 'string', enum: ['lejos', 'general', 'medio', 'primer'] },
          lado: { type: 'string', enum: ['izq', 'centro', 'der'] },
        },
      },
    },
    objetos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['motivo', 'escena', 'palabra', 'que', 'dibujo', 'pos', 'flecha'],
        properties: {
          motivo: { type: 'string' },
          escena: { type: 'integer' },
          palabra: { type: 'integer' },
          que: { type: 'string' },
          dibujo: { type: 'string' },
          pos: { type: 'string', enum: ['arriba_izq', 'arriba_der', 'izq', 'der', 'izq_baja', 'der_baja', 'pensamiento', 'mano', 'delante'] },
          flecha: { type: 'boolean' },
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
  let body: { indicaciones?: string; escenas?: { escena: number; emocion: string; palabras: string[]; indicaciones?: string }[]; posturas?: Record<string, string>; miradas?: Record<string, string>; nuevasMax?: number; escenografia?: boolean; objetosMax?: number; vinetas?: boolean }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Petición no válida.' }, 400)
  }
  if (!body.escenas?.length || !body.posturas) return json({ error: 'Faltan escenas o posturas.' }, 400)
  const textoSeguido = body.escenas.map((e) => e.palabras.join(' ')).join(' ')
  const guion = body.escenas
    .map(
      (e) =>
        `Escena ${e.escena} (emoción: ${e.emocion}): ${e.palabras.map((w, i) => `${i}:${w}`).join(' ')}` +
        (e.indicaciones ? `\n  ➜ INDICACIONES DEL USUARIO PARA ESTA ESCENA: ${e.indicaciones}` : ''),
    )
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
      system: [{ type: 'text', text: GUIA + '\n\n' + ORDENES, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: `Catálogo de posturas:\n${catalogo}\n\n${body.miradas ? `Catálogo de miradas:\n${Object.entries(body.miradas).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\n` : ''}${body.nuevasMax ? `Gestos a medida permitidos: hasta ${Math.min(8, body.nuevasMax)}.\n\n` : 'No pidas gestos a medida (nuevas vacío).\n\n'}${body.escenografia ? 'Decide también «fondos» (uno por escena) y «rotulos».\n\n' : 'No hace falta «fondos» ni «rotulos» (déjalos vacíos).\n\n'}${body.vinetas ? 'Monta el vídeo por «vinetas» (los fondos van en cada viñeta; «fondos» puede ir vacío).\n\n' : ''}${body.objetosMax ? `Puedes poner «objetos» si de verdad aportan (como mucho ${Math.min(16, body.objetosMax)}, normalmente bastantes menos).\n\n` : 'No pongas «objetos» (vacío).\n\n'}${body.indicaciones ? `INDICACIONES GENERALES DEL USUARIO: ${body.indicaciones}\n\n` : ''}Texto completo (para entender el tono):\n${textoSeguido}\n\nGuion por escenas con las palabras numeradas:\n${guion}`,
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
