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
diga). Si pide una cara o mirada, ponla en «miradas» en ese momento. Si pide una «viñeta dibujada» (o
«inserto», «que se vea…» algo a pantalla completa), haz una viñeta con «inserto» describiendo eso en inglés. No sustituyas lo pedido por algo
«parecido»: el usuario lo ha decidido así. Las indicaciones generales se aplican a todo el vídeo. Lo que no te indique, complétalo tú
con las pautas.`

const MODO_ESCENAS = `MODO ESCENAS (MANDA SOBRE TODO LO ANTERIOR SOBRE INSERTOS, REPARTO Y MOVIMIENTO) — así monta de verdad
«Estoy Tiesa»: CADA PLANO ES UN DIBUJO NUEVO DE LA SITUACIÓN CON EL NARRADOR DENTRO, quieto en una postura que
cuenta lo que pasa (solo le moveremos la boca por encima). Ejemplos reales de ese canal: ella pegada al
cristal del concesionario con ojos de corazón; meditando en su cuarto con velas y un bocadillo; sentada
dentro de su coche viejo mientras el inspector de la ITV da vueltas con cara seria; conduciendo enfadada; en
la mesa con una calculadora; junto a una pizarra; en el metro con gafas de sol.
- Casi TODAS las viñetas llevan «inserto» = la escena entera, EN INGLÉS, describiendo: el lugar concreto, al
  narrador («the magenta round-headed boy») con su postura, lo que hace y su EXPRESIÓN DE OJOS Y CEJAS (la boca
  SIEMPRE «with a small closed mouth»), y a las demás personas haciendo lo suyo (personas normales, mismo
  trazo; su hermana: «his sister, a young woman with a messy dark bun and a mustard hoodie»). Él bien visible,
  grande (cabeza al menos una octava parte del ancho), de frente o tres cuartos, sin nada delante de la cara.
- Un plano nuevo en cada idea o chiste: normalmente cada 2-4 s y NUNCA más de 5 s seguidos con el mismo
  dibujo (contando el «cambio»); en 30 s, 9-12 planos. Más rápido (1-2 s) en un remate. Cada plano
  con un ENCUADRE distinto al anterior (cerca / de cuerpo entero / pequeño en el sitio / detalle) y muchos
  lugares (cada situación de la historia, su sitio; 6-10 en un minuto).
- Literaliza las metáforas y exagera: «parezco un rehén» → él con cara de rehén sujetando un periódico; «33
  intentos» → él rodeado de fotos fallidas.
- Gente: solo la que nombra el guion (su hermana, el camarero…). Nada de multitudes ni desconocidos de relleno,
  y él UNA sola vez en cada dibujo (si sale una foto suya, dilo claro: «a photo of him on the phone screen»).
- Manos: si en un detalle salen manos, di SIEMPRE de quién son: «his magenta hands» (su piel es magenta) o
  «his sister's hands». Nunca «hands holding a phone» sin más (salen manos color carne que parecen suyas).
- Algún plano corto sin él (un detalle: la pantalla del móvil, una calculadora con «NO SALE»), y algún plano
  sobre fondo blanco solo con él (inserto "" y fondo «blanco») para explicar.
- ANIMACIÓN DENTRO DEL PLANO: «cambio» = un segundo dibujo del MISMO plano (mismo encuadre, fondo y gente)
  en el que solo cambia la postura o la cara de alguien, y «palabra_cambio» = la palabra (de la misma escena,
  después del inicio del plano) en la que se ve. Es lo que hace que no parezcan estampas: la hermana pasa de
  teclear a enseñarle el móvil con una sonrisa; él pasa de mirar el móvil a poner cara de horror; ella le
  baja el móvil y pone los brazos en jarras. Úsalo en los planos con otra persona (casi siempre) y en muchos
  de los demás, en la palabra exacta de la acción. En inglés y solo lo que cambia («the sister now holds the
  phone up to his face, grinning; he leans back horrified, eyes wide»). Si no hay, "" y -1.
- LA CARA DICE LO QUE SUENA: la expresión de ojos y cejas de cada dibujo es la emoción de la frase que se
  oye mientras se ve; si la emoción cambia, otro plano o un «cambio».
- COSAS QUE SE MUEVEN POR LA ESCENA (como en ese canal: el Audi que pasa a toda velocidad por delante de ella,
  el ladrón que se lleva el coche, billetes que caen, corazones): «objetos» con «movimiento»: «cruza» = pasa
  de un lado al otro y se va («hacia» = a dónde va; un coche, alguien corriendo, un autobús), «entra» = llega
  desde un lado y se queda, «cae» = cae desde arriba con bote (dinero, una factura, un yunque), «tiembla» =
  aparece temblando (una alarma, un móvil que vibra), «aparece» = de golpe. «tamano» pequeno/mediano/grande y
  «pos» la altura (arriba_*, izq/der = en medio, *_baja = abajo). Pon 2-4 de estos en un vídeo de 30 s,
  justo en la palabra, cuando lo que se dice se pueda ENSEÑAR moviéndose. «dibujo» en inglés, un objeto
  sencillo de perfil si se mueve de lado.
- Encima de los planos van «rotulos» (cifras, la palabra del remate, a mano) en la palabra exacta, y si
  ayuda «objetos» en bocadillo de pensamiento. «secundarios» vacío y «movimiento» «ninguno»: las otras
  personas y las acciones van DIBUJADAS en la escena. «cambios» solo importa en los planos sin inserto.`

const GUIA = `Eres el director de animación de un vídeo de YouTube de dibujos al estilo del canal «Estoy Tiesa»: un
narrador dibujado (un chico de cabeza magenta) cuenta algo con humor e ironía. Recibes el guion dividido en
escenas y palabras numeradas, el catálogo de posturas del personaje (qué expresa cada una) y, si las hay,
las indicaciones del usuario. Decides qué se VE en cada momento. Tienes buen gusto: nada decorativo ni
puesto por meter, pero el vídeo tiene que ENSEÑAR lo que cuenta: un narrador quieto hablando delante de
un fondo es aburrido (es el error más grave). Lo que cuenta se ve: sus objetos, sus pantallas, la gente de
la que habla y él mismo viviendo la situación.

1. PRIMERO LA HISTORIA. Escribe en «historia» la pequeña historia que VIVE el personaje mientras habla,
   momento a momento y con continuidad (llega a casa reventado → abre la nevera vacía → cena de pie un
   táper frío → se tira en el sofá → …). El guion es su voz; las imágenes son lo que le pasa. Todo lo
   demás sale de esta historia: si algo no forma parte de ella, no aparece.

2. VIÑETAS CON CONTINUIDAD. «vinetas»: el vídeo es una sucesión de momentos de 2 a 6 s (normalmente uno
   por frase; nunca más corto de 1,8 s). Cada viñeta: escena, palabra donde empieza (la primera, escena 0
   palabra 0; las demás, SIEMPRE la primera palabra de una frase o de un inciso tras una coma: un corte a
   mitad de frase se nota a destiempo de la voz), «idea» (el momento de la historia), «motivo» (por qué este corte aquí), «fondo», «tamano»
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
   - «inserto» (LO QUE HACE DINÁMICO EL VÍDEO): una viñeta puede ser un DIBUJO A PANTALLA COMPLETA en vez
     del narrador hablando: la cosa de la que habla o la situación que cuenta, como un plano de recurso de
     un cómic. Escribe en «inserto» qué se ve, EN INGLÉS, concreto y gracioso (p. ej. «close-up of a
     supermarket receipt that is absurdly long, curling on the floor», «a gym membership card covered in
     dust next to a sofa full of crisps», «his boss pointing at a calendar full of red crosses», «a split
     panel: expectation, a perfect cake; reality, a burnt lump»). Puede
     salir él (se le dibuja igual que es: el chico de cabeza magenta redonda) y otras personas. El dibujo
     NO lleva textos ni etiquetas: describe lo que se ve, nunca palabras escritas (si hay una cifra clave,
     va como rótulo encima). Usa
     insertos SOLO para un plano de detalle que no se puede contar con los personajes animados (la
     pantalla del móvil de cerca, un recuerdo, un antes/después): son imágenes quietas, así que como mucho
     1 o 2 por vídeo, cortos (1,5-2,5 s). Lo que HACE alguien (quitarle el móvil, hacerle una foto, reírse
     de él) NO es un inserto: pasa en escena con los personajes animados (ver REPARTO). Si no es inserto, «inserto» = "". En un
     inserto «fondo» y «tamano» dan igual (pon el lugar de antes y «general»). No repitas un inserto.
   - «movimiento» y «hacia»: el personaje solo se mueve cuando LA HISTORIA lo pide, nunca de adorno.
     «entra» = llega caminando a un lugar (solo en la primera viñeta de ese lugar y solo si la historia
     dice que llega o va allí; si está sentado, cenando o ya estaba, NO entra); «sale» = se marcha o huye
     (como remate, en la última viñeta de un lugar); «se_mueve» = se acerca o se aparta de algo concreto
     que está pasando (como mucho una vez); «salta» = respingo con una cara exagerada de susto o alegría.
     En la duda, «ninguno». Lo normal en un vídeo de 30 s: 1 o 2 movimientos en total. Si no se mueve,
     «hacia» = «centro». Nunca en un inserto.
   - «lado»: «centro» casi siempre. «izq»/«der» solo si al otro lado va a aparecer algo (un bocadillo, una
     cifra); el lado no cambia mientras siga en el mismo lugar.

3. EL PERSONAJE ACTÚA LA HISTORIA. «cambios»: en qué palabra cambia de postura y a cuál, con su «motivo».
   - LA CARA Y EL GESTO DICEN LO MISMO QUE LA FRASE, literalmente y con su matiz: lee qué siente el
     narrador AHÍ (resignación, vergüenza, orgullo irónico, fastidio, pánico…) y elige la postura cuyo
     significado del catálogo encaja; si ninguna encaja de verdad, una tranquila neutra antes que una que
     diga otra cosa. Nunca enfado si no está enfadado, nunca alegría en una queja. Los números: no enseñes
     dedos que no coincidan con la cifra que dice (t_cuenta son TRES dedos: solo para «tres»).
   - Cada postura interpreta lo que dice y siente en ese momento (entiende el tono: queja irónica,
     confesión, consejo, chiste). Cambia en la palabra con peso, nunca en artículos o preposiciones; cada
     postura dura 3-8 palabras. Reparto: ~45 % tranquilas, ~35 % gestos suaves, ~20 % exageradas (caras
     t_e_* y gags de frente) SOLO en remates o emociones fuertes. Varía; no repitas la misma seguida.
   - GESTOS A MEDIDA («nuevas»): para las ACCIONES de la historia con un objeto (come de un táper, mira el
     móvil, levanta una pesa, se tumba agotado con la mano en la frente…): el personaje usa el objeto de
     verdad, dibujado con él. «nombre» corto, «dibujo» EN INGLÉS (brazos, manos y objeto), «que_expresa»
     y «motivo»; en «cambios» se usa como «x_<nombre>». Solo las acciones que más cuentan; si la misma
     acción vuelve, reutiliza el mismo gesto.

4. LO QUE APARECE AL LADO DEL NARRADOR (aparte de los insertos): cada cosa con un motivo claro, nada de
   decoración; pero si nombra un objeto concreto que forma parte del chiste (el ticket, el táper, la tarjeta),
   enséñalo (en la mano, en un bocadillo o en un inserto).
   - «objetos» (con «motivo»): solo (a) lo que IMAGINA, desea, teme o recuerda → pos «pensamiento»
     (bocadillo); (b) algo que ENSEÑA en la mano → pos «mano»; (c) algo que de verdad está DELANTE en ese
     lugar → pos «delante». Nunca algo que ya está usando en un gesto, nunca decoración, como mucho uno
     por viñeta. «que» en español, «dibujo» EN INGLÉS (un objeto sencillo).
   - SIMULTANEIDAD: un objeto o un rótulo sale en la palabra EXACTA en que se nombra («7 euros» → en «7»;
     el bocadillo de la boda → en «boda»), nunca antes ni después; y el gesto que lo interpreta, en esa
     misma palabra o justo antes.
   - NADA REPETIDO: una misma idea se cuenta UNA vez y de UNA forma. Si el lugar ya tiene un reloj, no
     pongas además un bocadillo con un reloj ni un rótulo con la hora; si dice «7 €» y ya lo pone un
     cartel, no hace falta también el billete. Elige lo más claro y quita el resto.
   - «rotulos» (con «motivo»): casi nunca. Solo una cifra o precio, o la palabra del remate, y nunca lo que
     ya se oye tal cual. Como mucho uno por viñeta y pocos en todo el vídeo. «estilo»: «nota» (palabra en
     color subrayada), «cartel» (cifra en un cartelito) o «grande» (una sola vez como mucho). Color: rojo
     lo malo, verde lo bueno, azul un dato, negro lo demás. «flecha» solo si une con lo anterior.

6. REPARTO («secundarios», si te dan reparto) — LO MÁS IMPORTANTE PARA QUE PAREZCA UN CAPÍTULO DE DIBUJOS:
   son personajes animados que están EN LA MISMA ESCENA que el narrador. Si la historia nombra a alguien
   del reparto, TIENE que salir en escena haciendo lo que se cuenta, en el momento en que se cuenta
   (nunca lo sustituyas por un inserto): la hermana le quita el móvil, le hace una foto, se ríe de él. Cada entrada es
   un momento: «quien» (su id), «escena», «palabra» (cuando empieza), «postura» (de SU catálogo, o
   «fuera» cuando ya no está), «lado» (izq o der: dónde está ella; el narrador se pone al otro lado,
   mirándose el uno al otro) y «movimiento» (entra caminando / sale caminando / ninguno). Mientras está,
   las viñetas son generales (se ven los dos enteros) y el narrador reacciona a lo que ella hace con su
   postura. Lo que hace ella y la frase van a la vez. Cuando cambia el lugar, desaparece salvo que la
   vuelvas a poner. Si el reparto sale en escena, no hace falta un inserto de lo mismo.

5. MIRADAS («miradas», si te dan catálogo): casi siempre al frente («propios»); una mirada distinta solo
   para un matiz (ironía → escéptico, cifra escandalosa → platos), entre cambios de brazos, 0-2 por
   escena. Solo con posturas tranquilas (t_).

Antes de responder, repasa: ¿se entiende la historia solo con las imágenes? ¿Hay algo que sobra? Quítalo.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['historia', 'secundarios', 'cambios', 'nuevas', 'fondos', 'rotulos', 'vinetas', 'objetos', 'miradas'],
  properties: {
    secundarios: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['quien', 'escena', 'palabra', 'postura', 'lado', 'movimiento', 'motivo'],
        properties: {
          quien: { type: 'string' },
          escena: { type: 'integer' },
          palabra: { type: 'integer' },
          postura: { type: 'string', description: 'Postura de su catálogo, o «fuera» cuando deja la escena' },
          lado: { type: 'string', enum: ['izq', 'der'] },
          movimiento: { type: 'string', enum: ['ninguno', 'entra', 'sale'] },
          motivo: { type: 'string' },
        },
      },
    },
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
        required: ['escena', 'palabra', 'idea', 'motivo', 'fondo', 'tamano', 'lado', 'inserto', 'movimiento', 'hacia', 'cambio', 'palabra_cambio'],
        properties: {
          motivo: { type: 'string' },
          inserto: { type: 'string', description: 'Dibujo a pantalla completa (en inglés) en vez del narrador, o "" si sale el narrador.' },
          movimiento: { type: 'string', enum: ['ninguno', 'entra', 'sale', 'se_mueve', 'salta'] },
          cambio: { type: 'string', description: 'Solo con inserto: qué cambia en un segundo dibujo del MISMO plano (en inglés), o "".' },
          palabra_cambio: { type: 'integer', description: 'Palabra de la misma escena en la que se ve el segundo dibujo, o -1.' },
          hacia: { type: 'string', enum: ['izq', 'centro', 'der'] },
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
        required: ['motivo', 'escena', 'palabra', 'que', 'dibujo', 'pos', 'flecha', 'movimiento', 'hacia', 'tamano'],
        properties: {
          motivo: { type: 'string' },
          escena: { type: 'integer' },
          palabra: { type: 'integer' },
          que: { type: 'string' },
          dibujo: { type: 'string' },
          pos: { type: 'string', enum: ['arriba_izq', 'arriba_der', 'izq', 'der', 'izq_baja', 'der_baja', 'pensamiento', 'mano', 'delante'] },
          flecha: { type: 'boolean' },
          movimiento: { type: 'string', enum: ['aparece', 'cruza', 'entra', 'cae', 'tiembla'] },
          hacia: { type: 'string', enum: ['izq', 'der'] },
          tamano: { type: 'string', enum: ['pequeno', 'mediano', 'grande'] },
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
  let body: { indicaciones?: string; escenas?: { escena: number; emocion: string; palabras: string[]; indicaciones?: string }[]; posturas?: Record<string, string>; reparto?: Record<string, { quien: string; posturas: Record<string, string> }>; miradas?: Record<string, string>; nuevasMax?: number; escenografia?: boolean; objetosMax?: number; vinetas?: boolean; modo?: string }
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
      system: [{ type: 'text', text: GUIA + '\n\n' + (body.modo === 'escenas' ? MODO_ESCENAS + '\n\n' : '') + ORDENES, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: `Catálogo de posturas:\n${catalogo}\n\n${body.reparto && Object.keys(body.reparto).length ? `Reparto (personajes que pueden salir en escena; solo si la historia los nombra):\n${Object.entries(body.reparto).map(([id, r]) => `- «${id}»: ${r.quien}. Posturas: ${Object.entries(r.posturas).map(([k, v]) => `${k} (${v})`).join('; ')}`).join('\n')}\n\n` : 'No hay reparto («secundarios» vacío).\n\n'}${body.miradas ? `Catálogo de miradas:\n${Object.entries(body.miradas).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\n` : ''}${body.nuevasMax ? `Gestos a medida permitidos: hasta ${Math.min(8, body.nuevasMax)}.\n\n` : 'No pidas gestos a medida (nuevas vacío).\n\n'}${body.escenografia ? 'Decide también «fondos» (uno por escena) y «rotulos».\n\n' : 'No hace falta «fondos» ni «rotulos» (déjalos vacíos).\n\n'}${body.vinetas ? 'Monta el vídeo por «vinetas» (los fondos van en cada viñeta; «fondos» puede ir vacío).\n\n' : ''}${body.modo === 'escenas' ? 'Pon 2-4 «objetos» QUE SE MUEVEN por la escena («movimiento» cruza, entra, cae o tiembla) en las palabras que se puedan enseñar así: es lo que da vida a los planos.\n\n' : body.objetosMax ? `Puedes poner «objetos» si de verdad aportan (como mucho ${Math.min(16, body.objetosMax)}, normalmente bastantes menos).\n\n` : 'No pongas «objetos» (vacío).\n\n'}${body.indicaciones ? `INDICACIONES GENERALES DEL USUARIO: ${body.indicaciones}\n\n` : ''}Texto completo (para entender el tono):\n${textoSeguido}\n\nGuion por escenas con las palabras numeradas:\n${guion}`,
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
