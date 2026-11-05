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
  let body: { descripcion?: string; referencia?: string; formato?: string; tipo?: 'fondo' | 'libre' | 'objeto'; hueco?: 'izq' | 'der' }
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
  const ref = body.referencia && body.referencia.startsWith(propio + '/') ? body.referencia : null

  // Mitad que debe quedar vacía (ahí irá el contenido de la viñeta, el personaje va en la otra)
  const hueco =
    body.hueco === 'izq' || body.hueco === 'der'
      ? `The ${body.hueco === 'izq' ? 'LEFT' : 'RIGHT'} half of the picture must be almost EMPTY: plain wall and floor only, nothing on it. Put the few objects of the place in the ${body.hueco === 'izq' ? 'right' : 'left'} half and near the edges. `
      : ''
  const llamar = async (conRef: boolean) => {
    const prompt =
      body.tipo === 'libre'
        ? descripcion
        : body.tipo === 'objeto'
          ? `One single isolated drawing for a 2D cartoon video: ${descripcion}. ${conRef ? 'Match the line style of the reference image but do NOT draw the character from it. ' : ''}Style: crude amateur doodle drawn fast in a basic paint app by a YouTuber, thick shaky black outlines, flat paint-bucket colors with no shading, slightly lopsided, simple and instantly recognizable. Isolated on a plain pure white background, centered, filling most of the square canvas, nothing else around it: no shadow, no frame, no other objects, no people, and no text unless the description explicitly includes words or a number.`
          : `Background illustration for a 2D animated video. ${conRef ? 'Use the reference image ONLY to match the line style. Do NOT draw the character from the reference or any other person. Style: crude amateur doodle drawn fast with a finger or mouse in a basic paint app by a YouTuber, NOT a professional illustration. Camera looks STRAIGHT at a wall that is close behind the character: flat frontal view, almost no perspective, no depth, no vanishing point; the floor is just a plain band at the bottom. Thick shaky black outlines, wobbly and uneven, crooked straight lines drawn without a ruler, lines that overshoot or do not quite close at corners. Paint-bucket flat fills with no shading, no gradients, no texture, colors slightly spilling or not reaching the lines. Only 2 to 4 big simple lopsided objects that are TYPICAL OF THIS PLACE (nothing generic), drawn in a childish way with no white outline around them; most of the picture is EMPTY plain wall (it is only a backdrop: text and drawings will be added on top). Muted slightly washed-out colors (greyish lilac, dusty blue, beige, faded green). ' : 'Style: crude amateur doodle drawn fast with a finger or mouse in a basic paint app by a YouTuber, NOT a professional illustration. Camera looks STRAIGHT at a wall that is close behind the character: flat frontal view, almost no perspective, no depth, no vanishing point; the floor is just a plain band at the bottom. Thick shaky black outlines, wobbly and uneven, crooked straight lines drawn without a ruler, lines that overshoot or do not quite close at corners. Paint-bucket flat fills with no shading, no gradients, no texture, colors slightly spilling or not reaching the lines. Only 2 to 4 big simple lopsided objects that are TYPICAL OF THIS PLACE (nothing generic), drawn in a childish way with no white outline around them; most of the picture is EMPTY plain wall (it is only a backdrop: text and drawings will be added on top). Muted slightly washed-out colors (greyish lilac, dusty blue, beige, faded green). '}Scene: ${descripcion}. ${hueco}Empty location with no people, no characters, no animals unless asked, no text, no letters, no watermark. Keep the lower middle as plain empty floor (a character will be added later; do NOT draw any box, mark, shadow or placeholder there). The drawing must fill the WHOLE ${formato} canvas edge to edge (${formato === '9:16' ? 'tall vertical scene: show the floor in the lower part and the wall or sky up to the top' : 'wide scene'}): no white bands, no borders, no margins, no frame.`
    const model = conRef ? 'fal-ai/nano-banana/edit' : 'fal-ai/nano-banana'
    const res = await fetch(`https://fal.run/${model}`, {
      method: 'POST',
      headers: { authorization: `Key ${process.env.FAL_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, num_images: 1, aspect_ratio: formato, output_format: 'jpeg', ...(conRef ? { image_urls: [ref] } : {}) }),
    })
    const data = (await res.json().catch(() => ({}))) as { images?: { url: string }[]; detail?: unknown }
    return { res, data }
  }

  let { res, data } = await llamar(!!ref)
  // Si fal no puede usar la referencia (no la descarga, formato…), se hace sin ella: mejor un fondo que un error
  if (ref && res.status !== 401 && res.status !== 403 && (!res.ok || !data.images?.[0]?.url)) ({ res, data } = await llamar(false))
  if (!res.ok || !data.images?.[0]?.url) {
    const det = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail ?? '')
    if (res.status === 401 || res.status === 403) return json({ error: 'La clave de fal.ai no es válida o no tiene saldo.' }, 502)
    return json({ error: `fal.ai no ha podido generar la imagen (${res.status}). ${det}`.slice(0, 300) }, 502)
  }
  return json({ url: data.images[0].url })
}
