// Imágenes con fal.ai (Nano Banana): fondos en el estilo del personaje.
//   POST {descripcion, referencia?, formato?} -> {url}
// Variables en Vercel: FAL_KEY, CLAVE_ESTUDIO

import { claveOk } from './_clave.js'
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const FORMATOS = ['9:16', '16:9', '1:1', '4:5', '3:4']

export async function POST(request: Request): Promise<Response> {
  if (!process.env.FAL_KEY) return json({ error: 'Falta FAL_KEY en Vercel.' }, 503)
  if (!claveOk(request)) return json({ error: 'clave' }, 401)
  let body: { descripcion?: string; referencia?: string; formato?: string; tipo?: 'fondo' | 'libre' | 'objeto' | 'inserto'; hueco?: 'izq' | 'der'; variante?: number; referencias?: string[] }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Petición no válida.' }, 400)
  }
  const descripcion = (body.descripcion ?? '').trim()
  if (!descripcion || descripcion.length > 1500) return json({ error: 'Describe la imagen.' }, 400)
  const formato = FORMATOS.includes(body.formato ?? '') ? body.formato! : '9:16'
  // La referencia de estilo solo puede ser una imagen de esta misma web
  const propio = new URL(request.url).origin
  // Referencia: una imagen de esta web o una que acaba de dibujar fal (para editarla, p. ej. la boca)
  const deFal = (u: string) => /^https:\/\/[a-z0-9.-]+\.fal\.media\//.test(u)
  const ref = body.referencia && (body.referencia.startsWith(propio + '/') || deFal(body.referencia)) ? body.referencia : null
  // Más referencias (p. ej. el dibujo de la hermana, para que salga siempre igual)
  const otras = (body.referencias ?? []).filter((u) => typeof u === 'string' && (u.startsWith(propio + '/') || deFal(u))).slice(0, 3)

  // Mitad que debe quedar vacía (ahí irá el contenido de la viñeta, el personaje va en la otra)
  const hueco =
    body.hueco === 'izq' || body.hueco === 'der'
      ? `The ${body.hueco === 'izq' ? 'LEFT' : 'RIGHT'} half of the picture must be almost EMPTY: plain wall and floor only, nothing on it. Put the few objects of the place in the ${body.hueco === 'izq' ? 'right' : 'left'} half and near the edges. `
      : ''
  // Variedad entre los lugares de un mismo vídeo: cada uno con su color dominante y su encuadre
  // (antes todos salían iguales: pared gris lila de frente con dos muebles)
  const PALETAS = [
    'warm mustard yellow and terracotta',
    'mint green and soft pink',
    'deep navy blue night with warm yellow lamp light',
    'faded teal and orange',
    'dusty pink and burgundy',
    'sky blue and grass green',
    'lilac and lemon yellow',
    'brick red and cream',
  ]
  const ENCUADRES = [
    'flat frontal view of a wall close behind the character, floor as a plain band at the bottom',
    'a corner of the room seen slightly from the side, two walls meeting, a bit of depth',
    'if it is an outdoor place, a wide open view with a big sky and a low horizon; if indoors, a wide room with the far wall and a window or door showing outside',
    'seen from a bit lower than usual, with tall things rising around and a ceiling or sky at the top',
  ]
  const v = Number.isInteger(body.variante) && body.variante! >= 0 ? body.variante! : -1
  const variedad =
    v >= 0
      ? `For THIS place use a dominant color palette of ${PALETAS[v % PALETAS.length]} (still flat and slightly washed-out) and this framing: ${ENCUADRES[Math.floor(v / 2) % ENCUADRES.length]}. If the place is outdoors (street, park, beach, terrace…) show it outdoors with sky, never as an indoor wall. `
      : ''
  const camara = v >= 0 ? 'Simple flat cartoon backdrop with very little perspective. ' : 'Camera looks STRAIGHT at a wall that is close behind the character: flat frontal view, almost no perspective, no depth, no vanishing point; the floor is just a plain band at the bottom. '
  const llamar = async (conRef: boolean) => {
    const prompt =
      body.tipo === 'libre'
        ? descripcion
        : body.tipo === 'inserto'
          ? `One full-frame panel of a funny 2D cartoon video (a cutaway that SHOWS what the narrator is talking about): ${descripcion}. ${conRef ? 'If the narrator (the young man) appears, draw him EXACTLY like the character in the reference image: big perfectly round magenta head, small dot eyes in white circles, gold ring in the nose, grey t-shirt with a mountain drawing, ripped blue jeans, white sneakers; his head fully visible and never covered by hands or objects, and ALWAYS with a SMALL CLOSED MOUTH (just a short simple curved line, never an open mouth: the mouth is animated later). His face is ALWAYS drawn very simply, whatever the emotion: two round white eyes with black dot pupils, two thin eyebrow lines, the small gold nose ring and the short mouth line, on flat magenta; NO wrinkles, no eye bags, no shading or extra lines on his face. He is drawn BIG: his head is at least one sixth of the picture width. He is an adult of the SAME HEIGHT as the other adults in the picture (shoulders and feet at the same level as theirs; never a giant next to them, never child-sized), and his whole head fits inside the picture with a margin above it. His skin is magenta: his hands and arms are MAGENTA too (never flesh-colored hands for him; no first-person hands — if a hand holds something in a close-up it is his magenta hand). He is ALWAYS seen from the front or three-quarter front with his face visible (never from behind, never an over-the-shoulder shot, never a back of a head in the foreground). There is only ONE magenta boy in the picture (never two of him, never a second small copy of him) and he is the only magenta thing (nothing else magenta or hot pink). No extra people or crowds unless the description asks for them. Other people are NORMAL people with natural skin tones, simple cartoon people in the same style' + (otras.length ? '; his sister (if she appears) is drawn EXACTLY like the young woman in the second reference image (same face, messy dark bun, gold hoops, mustard hoodie, black leggings)' : '') + '. Everything important (his whole head and body, and the other people) stays well INSIDE the picture, never cut by the edges. ' : ''}Style: crude amateur doodle drawn fast in a basic paint app by a YouTuber, thick shaky black outlines, flat paint-bucket colors with no shading, slightly lopsided, funny and instantly readable at a glance, one clear idea, big simple shapes. ABSOLUTELY NO TEXT anywhere: no words, letters, labels, names, captions, signs or speech bubbles (people and things are never labelled; phone screens and documents show only simple shapes, icons and photos; at most a short number if the description gives one). The drawing fills the WHOLE ${formato} canvas edge to edge: no white bands, no borders, no frame, no captions.${formato === '9:16' || formato === '4:5' ? ' It is a TALL vertical picture: the characters are drawn BIG, filling most of the width, in the lower two thirds; the wall with a window or pictures goes up to the top edge and the floor reaches the bottom edge. Never a small wide scene in the middle.' : ''}`
        : body.tipo === 'objeto'
          ? `One single isolated drawing for a 2D cartoon video: ${descripcion}. ${conRef ? 'Match the line style of the reference image but do NOT draw the character from it. ' : ''}Style: crude amateur doodle drawn fast in a basic paint app by a YouTuber, thick shaky black outlines, flat paint-bucket colors with no shading, slightly lopsided, simple and instantly recognizable. Isolated on a plain pure white background, centered, filling most of the square canvas, nothing else around it: no shadow, no frame, no other objects, no people, and no text unless the description explicitly includes words or a number.`
          : `Background illustration for a 2D animated video. ${conRef ? 'Use the reference image ONLY to match the line style. Do NOT draw the character from the reference or any other person. Style: crude amateur doodle drawn fast with a finger or mouse in a basic paint app by a YouTuber, NOT a professional illustration. ' + camara + 'Thick shaky black outlines, wobbly and uneven, crooked straight lines drawn without a ruler, lines that overshoot or do not quite close at corners. Paint-bucket flat fills with no shading, no gradients, no texture, colors slightly spilling or not reaching the lines. Only 2 to 4 big simple lopsided objects that are TYPICAL OF THIS PLACE (nothing generic), drawn in a childish way with no white outline around them; most of the picture is EMPTY plain wall (it is only a backdrop: text and drawings will be added on top). Muted slightly washed-out colors' + (variedad ? '. ' : ' (greyish lilac, dusty blue, beige, faded green). ') : 'Style: crude amateur doodle drawn fast with a finger or mouse in a basic paint app by a YouTuber, NOT a professional illustration. ' + camara + 'Thick shaky black outlines, wobbly and uneven, crooked straight lines drawn without a ruler, lines that overshoot or do not quite close at corners. Paint-bucket flat fills with no shading, no gradients, no texture, colors slightly spilling or not reaching the lines. Only 2 to 4 big simple lopsided objects that are TYPICAL OF THIS PLACE (nothing generic), drawn in a childish way with no white outline around them; most of the picture is EMPTY plain wall (it is only a backdrop: text and drawings will be added on top). Muted slightly washed-out colors' + (variedad ? '. ' : ' (greyish lilac, dusty blue, beige, faded green). ')}Scene: ${descripcion}. ${variedad}${hueco}Empty location with no people, no characters, no animals unless asked, no text, no letters, no watermark. Keep the lower middle as plain empty floor (a character will be added later; do NOT draw any box, mark, shadow or placeholder there). The drawing must fill the WHOLE ${formato} canvas edge to edge (${formato === '9:16' ? 'tall vertical scene: show the floor in the lower part and the wall or sky up to the top' : 'wide scene'}): no white bands, no borders, no margins, no frame.`
    const model = conRef ? 'fal-ai/nano-banana/edit' : 'fal-ai/nano-banana'
    const res = await fetch(`https://fal.run/${model}`, {
      method: 'POST',
      headers: { authorization: `Key ${process.env.FAL_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, num_images: 1, aspect_ratio: formato, output_format: 'jpeg', ...(conRef ? { image_urls: [ref, ...otras] } : {}) }),
    })
    const data = (await res.json().catch(() => ({}))) as { images?: { url: string }[]; detail?: unknown }
    return { res, data }
  }

  let { res, data } = await llamar(!!ref)
  // Si fal no puede usar la referencia (no la descarga, formato…), se hace sin ella: mejor un fondo que un error
  // (Una edición «libre» sin su imagen no tiene sentido: ahí no se reintenta)
  if (ref && body.tipo !== 'libre' && res.status !== 401 && res.status !== 403 && (!res.ok || !data.images?.[0]?.url)) ({ res, data } = await llamar(false))
  if (!res.ok || !data.images?.[0]?.url) {
    const det = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail ?? '')
    if (res.status === 401 || res.status === 403) {
      // El motivo exacto que da fal (saldo agotado, clave no válida, cuenta bloqueada…), para no adivinar
      const motivo = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail ?? '')
      const sinSaldo = /balance|saldo|credit|exhausted|insufficient|locked/i.test(motivo)
      return json({ error: `${sinSaldo ? 'fal.ai dice que no queda saldo' : 'fal.ai rechaza la clave'} (${res.status}): ${motivo || 'sin más detalle'}`.slice(0, 300) }, 502)
    }
    return json({ error: `fal.ai no ha podido generar la imagen (${res.status}). ${det}`.slice(0, 300) }, 502)
  }
  return json({ url: data.images[0].url })
}
