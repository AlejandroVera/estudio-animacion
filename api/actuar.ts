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
- Varía y usa TODO el catálogo: no repitas la misma postura en cambios seguidos ni la uses más de dos
  veces por minuto. Los gestos con los dedos (índice arriba, contar) solo cuando lo que dice lo pide de
  verdad. Cada escena empieza con una postura en su
  palabra 0 (puede ser la misma que venía si la frase continúa la idea).
- Usa nombres de postura del catálogo. GESTOS A MEDIDA (si te lo permiten): cuando en un momento
  importante lo que dice pide un gesto CONCRETO que no está en el catálogo (cocinar con una sartén, mirar
  el móvil, comer, bostezar, tirarse del pelo, sujetar dinero…), puedes pedir que se dibuje: añádelo a
  «nuevas» con un nombre corto (minúsculas, sin espacios) y «dibujo» = descripción EN INGLÉS de qué
  hacen los brazos y manos (y el objeto si lo hay), y úsalo en «cambios» como postura «x_<nombre>».
  Como mucho las que te digan; solo si aporta de verdad (lo concreto y visual es lo que hace gracia).

FONDOS Y RÓTULOS (si te lo piden), como en «Estoy Tiesa»:
- «fondos»: para cada escena, «blanco» (fondo blanco liso: cuando explica una idea abstracta, da datos o
  hay rótulos importantes) o la descripción breve en español de un LUGAR concreto y cotidiano que
  ilustre lo que cuenta (una cocina desordenada, el sofá de casa, un concesionario, una oficina…).
  Mantén el mismo lugar en escenas seguidas que hablan de lo mismo (escribe exactamente el mismo texto)
  y cambia cuando cambia la idea. Como mucho un lugar distinto cada 2-3 escenas.
- «rotulos»: palabras escritas a mano que aparecen de golpe EN la palabra que se dice: cifras y precios
  («33.000 €»), conceptos clave («DEPRECIACIÓN»), la conclusión o el remate. 0-3 por escena, 1-3
  palabras cada uno, en mayúsculas si es un concepto. Color: «negro» normal, «rojo» lo malo/escandaloso,
  «verde» lo bueno, «azul» un dato neutro. Posición: «arriba», «izq», «der», «izq_baja», «der_baja» o
  «abajo»; en una misma escena cada rótulo en un sitio distinto (se acumulan hasta que cambia la
  escena). No repitas tal cual frases enteras: el rótulo resume.

OBJETOS EN ESCENA (si te lo piden): lo que hace que «pase algo» en los vídeos de «Estoy Tiesa». Mientras
habla, APARECEN de golpe junto al personaje dibujos sencillos de lo que está contando: el objeto del que
habla (un táper, un coche, una factura, una pesa, un móvil con un podcast), un bocadillo de pensamiento
con un dibujo dentro (lo que imagina o desea), un cartel con un precio o una cifra con su flecha, un
icono (corazón roto, rayo de cansancio, reloj)… En «objetos»: escena, palabra (en la que aparece, la
palabra que lo nombra), «que» (en español, corto) y «dibujo» (EN INGLÉS, qué dibujar: un solo objeto o
bocadillo, simple y reconocible; si lleva texto, como mucho 1-3 palabras o una cifra). Pon 1-2 por
escena en casi todas las escenas con algo concreto (no en todas: alguna escena solo con el personaje
está bien) y nunca más de 2 a la vez. «pos»: «arriba_izq», «arriba_der», «izq», «der», «izq_baja» o
«der_baja», cada uno en un sitio distinto y distinto del de los rótulos de esa escena. En una
enumeración, un objeto por cosa enumerada en su palabra (se van acumulando). Si el usuario pide un
objeto en sus indicaciones, ponlo tal cual.

MIRADAS (si te dan un catálogo de miradas): casi todo el rato mira AL FRENTE, a cámara («propios»).
Cada postura ya trae una mirada coherente; una mirada distinta solo añade un matiz que encaje con el
gesto que esté haciendo en ese momento (nunca ojos felices con un gesto triste, ni al revés). Los ojos
cambian POR SU CUENTA, entre un cambio de brazos y
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
    nuevas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['nombre', 'dibujo', 'que_expresa'],
        properties: { nombre: { type: 'string' }, dibujo: { type: 'string' }, que_expresa: { type: 'string' } },
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
        required: ['escena', 'palabra', 'texto', 'color', 'pos'],
        properties: {
          escena: { type: 'integer' },
          palabra: { type: 'integer' },
          texto: { type: 'string' },
          color: { type: 'string', enum: ['negro', 'rojo', 'verde', 'azul'] },
          pos: { type: 'string', enum: ['arriba', 'izq', 'der', 'izq_baja', 'der_baja', 'abajo'] },
        },
      },
    },
    objetos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['escena', 'palabra', 'que', 'dibujo', 'pos'],
        properties: {
          escena: { type: 'integer' },
          palabra: { type: 'integer' },
          que: { type: 'string' },
          dibujo: { type: 'string' },
          pos: { type: 'string', enum: ['arriba_izq', 'arriba_der', 'izq', 'der', 'izq_baja', 'der_baja'] },
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
  let body: { indicaciones?: string; escenas?: { escena: number; emocion: string; palabras: string[]; indicaciones?: string }[]; posturas?: Record<string, string>; miradas?: Record<string, string>; nuevasMax?: number; escenografia?: boolean; objetosMax?: number }
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
          content: `Catálogo de posturas:\n${catalogo}\n\n${body.miradas ? `Catálogo de miradas:\n${Object.entries(body.miradas).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\n` : ''}${body.nuevasMax ? `Gestos a medida permitidos: hasta ${Math.min(8, body.nuevasMax)}.\n\n` : 'No pidas gestos a medida (nuevas vacío).\n\n'}${body.escenografia ? 'Decide también «fondos» (uno por escena) y «rotulos».\n\n' : 'No hace falta «fondos» ni «rotulos» (déjalos vacíos).\n\n'}${body.objetosMax ? `Pon «objetos» en escena (como mucho ${Math.min(14, body.objetosMax)} en todo el vídeo).\n\n` : 'No pongas «objetos» (vacío).\n\n'}${body.indicaciones ? `INDICACIONES GENERALES DEL USUARIO: ${body.indicaciones}\n\n` : ''}Texto completo (para entender el tono):\n${textoSeguido}\n\nGuion por escenas con las palabras numeradas:\n${guion}`,
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
