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
- RITMO (obligatorio): un plano nuevo en cada idea o chiste, cada 2-4 s y NUNCA más de 4 s el mismo plano;
  y dentro del plano NINGÚN dibujo se queda más de ~1,5-2 s sin un «cambio»: el primero llega pronto (en las
  primeras 4-6 palabras del plano), nunca un arranque de 3 s con el dibujo quieto. REGLA CONTABLE: las palabras
  están numeradas; NINGÚN dibujo (plano o cambio) dura más de 7 palabras seguidas. Si una frase es larga y
  no pasa nada nuevo, pártela con una reacción de alguien a lo que se dice (ella le señala con el tenedor,
  él pone los ojos en blanco, ella asiente muy convencida). Esto vale sobre todo para el PRIMER plano del
  vídeo: en las primeras 5 palabras ya ha cambiado algo. En 30 s, 9-12 planos. Más rápido (1-2 s) en un remate. Cada plano
  con un ENCUADRE distinto al anterior (cerca / de cuerpo entero / pequeño en el sitio / detalle) y muchos
  lugares (cada situación de la historia, su sitio; 6-10 en un minuto).
- Literaliza las metáforas y exagera: «parezco un rehén» → él con cara de rehén sujetando un periódico; «33
  intentos» → él rodeado de fotos fallidas.
- Él siempre de frente o tres cuartos, con la cara visible: nunca de espaldas ni planos «por encima del hombro».
- Gente: solo la que nombra el guion (su hermana, el camarero…). Nada de multitudes ni desconocidos de relleno,
  y él UNA sola vez en cada dibujo (si sale una foto suya, dilo claro: «a photo of him on the phone screen»).
- Manos: si en un detalle salen manos, di SIEMPRE de quién son: «his magenta hands» (su piel es magenta) o
  «his sister's hands». Nunca «hands holding a phone» sin más (salen manos color carne que parecen suyas).
- Algún plano corto sin él (un detalle: la pantalla del móvil, una calculadora con «NO SALE»). TODOS los
  planos llevan «inserto», también el cierre o la pregunta final: él mirando a cámara en el último lugar de la
  historia, con la cara de esa frase (nunca el muñeco suelto sobre blanco: rompe el estilo del vídeo).
- ANIMACIÓN DENTRO DEL PLANO (lo que hace que no parezcan estampas): cada plano puede tener hasta TRES cambios
  de dibujo, «cambio», «cambio2» y «cambio3», con su palabra (en orden creciente, de la misma escena
  y posteriores al inicio del plano). En cada uno cambia SOLO la postura o la cara de alguien (mismo encuadre,
  fondo y gente): la hermana teclea → le enseña el móvil sonriendo → se cruza de brazos; él mira el móvil →
  levanta la vista horrorizado → se tapa la cara. Úsalos en CASI TODOS los planos (los dos cambios si el plano
  dura más de 3 s), en la palabra exacta de la acción, y que la otra persona haga algo distinto en cada uno.
  En inglés y solo lo que cambia («the sister now holds the phone up to his face, grinning; he leans back
  horrified, eyes wide»). Si no hay, "" y -1.
- Solo se oye al narrador, así que solo se mueve SU boca. LOS DEMÁS ACTÚAN CON LOS «cambio»: cada cosa que la
  frase dice que hacen o dicen («me ha instalado», «me hace una», «sonríe», «me dice que así no») es un
  cambio en esa palabra con SU gesto (ella le planta el móvil delante; levanta el móvil para la foto; le
  hace con la mano el gesto de «sonríe»; niega con el dedo). Nunca gestos que la frase no cuente.
- NUNCA contar con los dedos (la IA dibuja mal los dedos: «cuatro fotos» salía con seis dedos): las cifras van
  en un rótulo. «fondo» = el NOMBRE CORTO del lugar, idéntico en todos los planos del mismo sitio («el sofá de
  casa»): con él se mantiene el mismo decorado de un plano a otro.
- COMPOSICIÓN: di siempre dónde está cada uno: él a un lado y la otra persona al otro, LADO A LADO y con
  hueco entre los dos («he stands on the left, his sister on the right, side by side»), nunca uno delante o
  detrás del otro. Nada delante de su cara: si alguien le enseña o le apunta con un móvil, lo sujeta bajo, a
  la altura del pecho y a un lado. Si él sujeta algo, a la altura del pecho. En un detalle (pantalla de
  móvil, objeto) NO sale él: solo el objeto y sus manos magenta.
- NADA QUE NO SE DIGA: en el dibujo solo sale lo que nombra la locución o lo que hace falta para entender
  la situación. Nada de adornos con significado propio (calaveras, signos de victoria, carteles, iconos).
  Las caras, SENCILLAS: describe la emoción con ojos y cejas («eyes wide», «eyebrows sloped»), sin «tense»,
  «wrinkled», «stressed» (salen arrugas y ojeras que le deforman la cara).
- A TIEMPO CON LA VOZ (lo más importante de los cambios): el dibujo enseña cada cosa CUANDO SE DICE, nunca
  antes. El primer dibujo del plano es la situación de sus primeras palabras, sin adelantar lo que viene (si
  luego dice «tres del DNI y un ticket», el DNI y el ticket no están desde el principio: salen en su palabra).
  Cada «cambio» va en la palabra que nombra esa acción o reacción: «sonríe, sonrío» → cambio en «sonrío»: él
  con una sonrisa forzada; «me dice que así no» → cambio en «dice»: ella niega con la cabeza. Si la frase
  nombra un gesto suyo (sonrío, me tapo, levanto, miro), ese gesto ES un cambio en esa palabra.
- La otra persona NUNCA se queda igual de un dibujo al siguiente: en cada «cambio» hace un gesto grande y
  distinto con los brazos y otra cara (teclea → le planta el móvil en la cara → se ríe tapándose la boca →
  se cruza de brazos → levanta el pulgar). Descríbelo siempre, además de lo que hace él.
- En un «cambio» nadie cambia de sitio ni se da la vuelta: misma cámara, cada uno donde estaba y mirando hacia
  donde miraba; solo cambian brazos, postura y cara. Por eso dibuja desde el principio a la otra persona con
  la cara visible (de frente o tres cuartos), no de espaldas.
- LA CARA DICE LO QUE SUENA: la expresión de cada dibujo es la emoción de la frase que se oye mientras se ve;
  si la emoción cambia, otro plano o un «cambio». Algo que le hacen o le pasa por sorpresa («me ha instalado
  Tinder mientras cenaba») = ojos muy abiertos y cejas arriba, alarma; los ojos medio cerrados (aburrido,
  resignado) solo cuando la frase es de resignación. Las sonrisas y risas se DIBUJAN y se piden con todas las
  letras: «a big wide smile showing teeth» (para ellas la boca sí puede ir abierta o sonriendo; para él,
  «a big closed-mouth smile, curved line from cheek to cheek»).
- QUIÉN HACE QUÉ, PALABRA A PALABRA: mira el sujeto de cada verbo y dale su cambio en ESA palabra, aunque
  vayan seguidas: «Sonríe. Sonrío.» → en «Sonríe» ELLA sonríe enseñando los dientes y se señala la boca (él
  aún serio); en «Sonrío» ÉL pone la sonrisa enorme y forzada. Nunca los dos gestos en el mismo cambio ni el
  de él adelantado a la palabra de ella. Cada acción va en SU palabra exacta, ni una antes ni una
  después: si en un plano no caben los tres cambios que necesitas, corta a un PLANO NUEVO en esa palabra
  (mismo lugar, otro encuadre) en vez de juntar dos acciones o retrasar una. Las viñetas van en orden de
  tiempo y cada «palabra_cambio» es posterior a la «palabra» de su plano.
- COSAS QUE APARECEN EN LA ESCENA (como en ese canal: lo que nombra aparece dibujado a su lado en esa palabra):
  al menos uno de cada dos planos tiene un cambio que AÑADE al dibujo, grande y junto a los personajes (sin
  tapar caras), lo que la frase nombra: el icono de una llama enorme saliendo del móvil al decir «Tinder»,
  seis marcos vacíos flotando sobre él en «seis huecos», un carné y un ticket gigantes a su lado en «DNI» y
  «ticket», un flash de cámara en «me hace una», una lluvia de fotos cayendo en «33 intentos», corazones,
  una X roja, un signo de interrogación. Siempre cosas que la frase dice; se quitan en el cambio siguiente
  si ya no vienen a cuento («the big flame icon is gone»).
- «objetos»: VACÍO. Todo lo que se ve va DIBUJADO dentro del plano (en el inserto o en un cambio); las cosas
  sueltas pegadas encima no casaban con la escena.
- Encima de los planos van «rotulos» (cifras, la palabra del remate, a mano) en la palabra exacta, . «secundarios» vacío y «movimiento» «ninguno»: las otras
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
        required: ['escena', 'palabra', 'idea', 'motivo', 'fondo', 'tamano', 'lado', 'inserto', 'movimiento', 'hacia', 'cambio', 'palabra_cambio', 'cambio2', 'palabra_cambio2', 'cambio3', 'palabra_cambio3'],
        properties: {
          motivo: { type: 'string' },
          inserto: { type: 'string', description: 'Dibujo a pantalla completa (en inglés) en vez del narrador, o "" si sale el narrador.' },
          movimiento: { type: 'string', enum: ['ninguno', 'entra', 'sale', 'se_mueve', 'salta'] },
          cambio: { type: 'string', description: 'Solo con inserto: qué cambia en un segundo dibujo del MISMO plano (en inglés), o "".' },
          palabra_cambio: { type: 'integer', description: 'Palabra de la misma escena en la que se ve el segundo dibujo, o -1.' },
          cambio2: { type: 'string', description: 'Un tercer dibujo del mismo plano (otro cambio después del primero), o "".' },
          palabra_cambio2: { type: 'integer', description: 'Palabra (posterior a palabra_cambio) en la que se ve, o -1.' },
          cambio3: { type: 'string', description: 'Un cuarto dibujo del mismo plano, o "".' },
          palabra_cambio3: { type: 'integer', description: 'Palabra (posterior a palabra_cambio2) en la que se ve, o -1.' },
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

/** En modo escenas el esquema completo era demasiado grande para la salida estructurada: sin lo que no se usa. */
const SCHEMA_ESCENAS = (() => {
  const s = structuredClone(SCHEMA) as { required: string[]; properties: Record<string, { items?: { required: string[]; properties: Record<string, unknown> } }> }
  for (const k of ['secundarios', 'nuevas', 'fondos', 'miradas']) delete s.properties[k]
  s.required = s.required.filter((k) => k in s.properties)
  const quitar = (lista: string, campos: string[]) => {
    const it = s.properties[lista]?.items
    if (!it) return
    for (const c of campos) delete it.properties[c]
    it.required = it.required.filter((c) => c in it.properties)
  }
  quitar('vinetas', ['movimiento', 'hacia', 'lado', 'motivo'])
  quitar('objetos', ['flecha', 'motivo'])
  quitar('rotulos', ['flecha', 'motivo'])
  quitar('cambios', ['motivo'])
  return s
})()

type VinetaPlan = { escena: number; palabra: number; inserto: string; cambio: string; palabra_cambio: number; cambio2: string; palabra_cambio2: number; cambio3: string; palabra_cambio3: number }

/** Busca los dibujos que duran demasiadas palabras y pide a la IA un cambio intermedio para cada uno. */
async function rellenarQuietos(client: Anthropic, model: string, vinetas: VinetaPlan[], escenas: { escena: number; palabras: string[] }[]) {
  const MAX = 8
  const orden = [...vinetas].sort((a, b) => a.escena - b.escena || a.palabra - b.palabra)
  const cambiosDe = (v: VinetaPlan, fin: number) =>
    ([[v.cambio, v.palabra_cambio], [v.cambio2, v.palabra_cambio2], [v.cambio3, v.palabra_cambio3]] as [string, number][])
      .filter(([c, p]) => c?.trim() && p > v.palabra && p < fin)
      .sort((a, b) => a[1] - b[1])
  const huecos: { v: VinetaPlan; fin: number; desde: number; hasta: number; antes: string; palabras: string }[] = []
  orden.forEach((v, i) => {
    if (!v.inserto?.trim() || !/\bboy\b/i.test(v.inserto)) return
    const ws = escenas.find((e) => e.escena === v.escena)?.palabras ?? []
    const sig = orden[i + 1]
    const fin = sig && sig.escena === v.escena ? sig.palabra : ws.length
    const cs = cambiosDe(v, fin)
    if (cs.length >= 3) return
    const cortes = [v.palabra, ...cs.map((c) => c[1]), fin]
    // El tramo quieto más largo de este plano
    let k = -1
    for (let j = 0; j < cortes.length - 1; j++) if (cortes[j + 1] - cortes[j] > MAX && (k < 0 || cortes[j + 1] - cortes[j] > cortes[k + 1] - cortes[k])) k = j
    if (k < 0) return
    huecos.push({ v, fin, desde: cortes[k], hasta: cortes[k + 1], antes: k === 0 ? v.inserto : `${v.inserto} — and then: ${cs[k - 1][0]}`, palabras: ws.slice(cortes[k], cortes[k + 1]).map((w, j) => `${cortes[k] + j}:${w}`).join(' ') })
  })
  if (!huecos.length) return
  const r = await client.beta.messages.create({
    model,
    max_tokens: 3000,
    output_config: {
      effort: 'low',
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['cambios'],
          properties: {
            cambios: {
              type: 'array',
              items: { type: 'object', additionalProperties: false, required: ['hueco', 'palabra', 'cambio'], properties: { hueco: { type: 'integer' }, palabra: { type: 'integer' }, cambio: { type: 'string' } } },
            },
          },
        },
      },
    },
    messages: [
      {
        role: 'user',
        content:
          'Vídeo de dibujos narrado (el narrador es «the magenta round-headed boy»). En estos tramos el dibujo se queda quieto demasiado tiempo mientras se oye la locución. Para CADA tramo da UN cambio de dibujo intermedio: «palabra» = el número de una palabra hacia la mitad del tramo (mejor al empezar una frase o inciso, nunca la primera ni las dos últimas del tramo) y «cambio» = en inglés, solo lo que cambia respecto al dibujo actual: una reacción natural de él o de la otra persona a LO QUE SE DICE en esas palabras (un gesto con los brazos y otra cara: ella asiente muy convencida señalándole, él pone los ojos en blanco, ella se encoge de hombros sonriendo…), sin objetos nuevos, sin cambiar a nadie de sitio, sin tapar la cara de él y él con «a small closed mouth».\n\n' +
          huecos.map((h, i) => `Tramo ${i}. Dibujo actual: ${h.antes}\n  Palabras que se oyen: ${h.palabras}`).join('\n\n'),
      },
    ],
  })
  const out = JSON.parse(r.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')) as { cambios: { hueco: number; palabra: number; cambio: string }[] }
  for (const c of out.cambios ?? []) {
    const h = huecos[c.hueco]
    if (!h || !c.cambio?.trim() || !(c.palabra > h.desde + 1 && c.palabra < h.hasta - 1)) continue
    const todos = [...cambiosDe(h.v, h.fin), [c.cambio.trim(), c.palabra] as [string, number]].sort((a, b) => a[1] - b[1]).slice(0, 3)
    ;[h.v.cambio, h.v.palabra_cambio] = todos[0] ?? ['', -1]
    ;[h.v.cambio2, h.v.palabra_cambio2] = todos[1] ?? ['', -1]
    ;[h.v.cambio3, h.v.palabra_cambio3] = todos[2] ?? ['', -1]
  }
}

/** CORRECTOR del plan: compara cada dibujo con lo que se oye mientras se ve y devuelve solo las correcciones. */
async function afinarPlan(client: Anthropic, model: string, vinetas: VinetaPlan[], escenas: { escena: number; palabras: string[] }[]) {
  const orden = [...vinetas].sort((a, b) => a.escena - b.escena || a.palabra - b.palabra)
  type Tramo = { v: VinetaPlan; campo: 'inserto' | 'cambio' | 'cambio2' | 'cambio3'; desde: number; hasta: number; min: number; max: number; texto: string }
  const tramos: Tramo[] = []
  orden.forEach((v, i) => {
    if (!v.inserto?.trim()) return
    const ws = escenas.find((e) => e.escena === v.escena)?.palabras ?? []
    const sig = orden[i + 1]
    const fin = sig && sig.escena === v.escena ? sig.palabra : ws.length
    const cs = ([['cambio', v.cambio, v.palabra_cambio], ['cambio2', v.cambio2, v.palabra_cambio2], ['cambio3', v.cambio3, v.palabra_cambio3]] as ['cambio' | 'cambio2' | 'cambio3', string, number][])
      .filter(([, c, p]) => c?.trim() && p > v.palabra && p < fin)
      .sort((a, b) => a[2] - b[2])
    const cortes = [v.palabra, ...cs.map((c) => c[2]), fin]
    tramos.push({ v, campo: 'inserto', desde: cortes[0], hasta: cortes[1], min: v.palabra, max: v.palabra, texto: v.inserto })
    cs.forEach((c, k) => tramos.push({ v, campo: c[0], desde: cortes[k + 1], hasta: cortes[k + 2], min: cortes[k] + 1, max: cortes[k + 2] - 1, texto: c[1] }))
  })
  if (!tramos.length) return
  const palabrasDe = (t: Tramo) => (escenas.find((e) => e.escena === t.v.escena)?.palabras ?? []).slice(t.desde, t.hasta).map((w, j) => `${t.desde + j}:${w}`).join(' ')
  const r = await client.beta.messages.create({
    model,
    max_tokens: 6000,
    output_config: {
      effort: 'medium',
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['correcciones'],
          properties: {
            correcciones: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['tramo', 'fallo', 'palabra', 'dibujo'],
                properties: {
                  tramo: { type: 'integer' },
                  fallo: { type: 'string', description: 'En español, una frase: qué no cuadraba.' },
                  palabra: { type: 'integer', description: 'Nueva palabra en la que empieza este dibujo, o -1 para dejarla.' },
                  dibujo: { type: 'string', description: 'La descripción corregida y completa, en inglés, o "" para dejarla.' },
                },
              },
            },
          },
        },
      },
    },
    messages: [
      {
        role: 'user',
        content:
          `Eres el supervisor de un vídeo de dibujos narrado al estilo «Estoy Tiesa» (el narrador es «the magenta round-headed boy»; solo se oye su voz). Abajo está el plan: cada TRAMO es un dibujo que se ve mientras se oyen esas palabras (numeradas dentro de su escena). Los tramos «cambio» son el mismo plano que el anterior con lo que cambia. Repasa cada tramo contra LO QUE SE OYE mientras se ve y devuelve SOLO los que hay que corregir (lo normal es que la mayoría estén bien):
1. LA CARA Y EL GESTO de cada uno son los de esas palabras exactas: ironía, fastidio, susto, vergüenza, orgullo… Si la frase es un chiste de humillación («parezco un rehén») la cara es esa (ojos muy abiertos, cejas caídas), no aburrida. Si no cuadra, corrige la descripción.
2. NADA ADELANTADO: lo que se nombra en una palabra posterior no puede verse ya en este tramo. El REMATE se ve en SU palabra y antes se ve la expectativa («en el 33 salgo bien» → él sonriendo satisfecho con los ojos ABIERTOS; «pero con los ojos cerrados» → ahí aparece la foto con los ojos cerrados). Si un cambio llega antes o después de la palabra que lo cuenta, corrige su «palabra» (dentro del rango que se indica) y, si hace falta, quita del dibujo anterior lo adelantado.
3. CANTIDADES: si la locución da números, el dibujo los dice con exactitud y con su disposición («exactly three ID cards in a row and exactly one parking ticket below them, four items in total»); nada de «a few» ni cantidades distintas a las que se oyen.
4. COSAS DE UNA APP O UNA PANTALLA se dibujan como interfaz, no como objetos de la habitación: «seis huecos» de fotos de un perfil = «six empty photo slots of the app profile, a 2x3 grid of rounded grey squares each with a plus sign, floating big like a phone-screen panel», nunca marcos de cuadros colgados en la pared. Y aparecen en la palabra que los nombra.
5. Que lo que se ve sea lo que la frase cuenta de verdad (literal o exagerado), no algo genérico.
Mantén el estilo de las descripciones: en inglés, él «with a small closed mouth» (salvo sonrisa: «a big closed-mouth smile»), cada uno en su sitio lado a lado, nada delante de su cara, sin texto escrito. En un tramo «cambio» describe solo lo que cambia respecto al anterior. No inventes tramos nuevos ni cambies los que están bien.

` + tramos.map((t, i) => `TRAMO ${i} [${t.campo === 'inserto' ? 'PLANO NUEVO, su palabra no se puede mover' : `cambio; su palabra puede ir de ${t.min} a ${t.max}`}] escena ${t.v.escena}\n  Se oye: ${palabrasDe(t) || '(nada)'}\n  Dibujo: ${t.texto}`).join('\n\n'),
      },
    ],
  })
  const out = JSON.parse(r.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')) as { correcciones: { tramo: number; palabra: number; dibujo: string }[] }
  for (const c of out.correcciones ?? []) {
    const t = tramos[c.tramo]
    if (!t) continue
    const texto = c.dibujo?.trim()
    if (t.campo === 'inserto') {
      if (texto) t.v.inserto = texto
      continue
    }
    if (texto) t.v[t.campo] = texto
    if (c.palabra >= t.min && c.palabra <= t.max) t.v[`palabra_${t.campo}` as 'palabra_cambio' | 'palabra_cambio2' | 'palabra_cambio3'] = c.palabra
  }
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
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: body.modo === 'escenas' ? SCHEMA_ESCENAS : SCHEMA } },
      system: [{ type: 'text', text: GUIA + '\n\n' + (body.modo === 'escenas' ? MODO_ESCENAS + '\n\n' : '') + ORDENES, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: `Catálogo de posturas:\n${catalogo}\n\n${body.reparto && Object.keys(body.reparto).length ? `Reparto (personajes que pueden salir en escena; solo si la historia los nombra):\n${Object.entries(body.reparto).map(([id, r]) => `- «${id}»: ${r.quien}. Posturas: ${Object.entries(r.posturas).map(([k, v]) => `${k} (${v})`).join('; ')}`).join('\n')}\n\n` : 'No hay reparto («secundarios» vacío).\n\n'}${body.miradas ? `Catálogo de miradas:\n${Object.entries(body.miradas).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\n` : ''}${body.nuevasMax ? `Gestos a medida permitidos: hasta ${Math.min(8, body.nuevasMax)}.\n\n` : 'No pidas gestos a medida (nuevas vacío).\n\n'}${body.escenografia ? 'Decide también «fondos» (uno por escena) y «rotulos».\n\n' : 'No hace falta «fondos» ni «rotulos» (déjalos vacíos).\n\n'}${body.vinetas ? 'Monta el vídeo por «vinetas» (los fondos van en cada viñeta; «fondos» puede ir vacío).\n\n' : ''}${body.modo === 'escenas' ? `No pongas «objetos» (vacío): todo va dibujado en los planos. Este vídeo dura unos ${Math.round(textoSeguido.split(/\s+/).length / 2.7)} s: como mínimo ${Math.max(3, Math.ceil(textoSeguido.split(/\s+/).length / 2.7 / 3.4))} planos y ${Math.max(6, Math.ceil(textoSeguido.split(/\s+/).length / 2.7 / 1.8))} dibujos en total (planos + cambios), repartidos por todo el vídeo.\n\n` : body.objetosMax ? `Puedes poner «objetos» si de verdad aportan (como mucho ${Math.min(16, body.objetosMax)}, normalmente bastantes menos).\n\n` : 'No pongas «objetos» (vacío).\n\n'}${body.indicaciones ? `INDICACIONES GENERALES DEL USUARIO: ${body.indicaciones}\n\n` : ''}Texto completo (para entender el tono):\n${textoSeguido}\n\nGuion por escenas con las palabras numeradas:\n${guion}`,
        },
      ],
    })
    if (response.stop_reason !== 'end_turn') return json({ error: 'La IA no terminó la dirección.' }, 422)
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    const plan = JSON.parse(text)
    // SEGUNDA PASADA (escenas): ningún dibujo se queda quieto más de ~8 palabras. Donde pase, se pide un cambio
    // intermedio (una reacción a lo que se dice) y se mete en el plano si le queda hueco.
    if (body.modo === 'escenas' && Array.isArray(plan.vinetas)) await rellenarQuietos(client, model, plan.vinetas, body.escenas).catch(() => {})
    // TERCERA PASADA (escenas): un CORRECTOR repasa cada dibujo contra las palabras que se oyen mientras se ve
    // (cara que no cuadra, cosas adelantadas, cantidades, interfaces dibujadas como objetos) y lo afina.
    if (body.modo === 'escenas' && Array.isArray(plan.vinetas)) await afinarPlan(client, model, plan.vinetas, body.escenas).catch(() => {})
    return json(plan)
  } catch (e) {
    if (e instanceof Anthropic.APIError) return json({ error: `Error del servicio de IA (${e.status}): ${String(e.message).slice(0, 300)}` }, 502)
    if (e instanceof SyntaxError) return json({ error: 'La respuesta de la IA no se pudo leer.' }, 502)
    throw e
  }
}
