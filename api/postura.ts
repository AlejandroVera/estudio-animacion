// Gestos a medida: dibuja con IA (fal.ai Nano Banana, edición) una postura nueva del personaje a partir
// de su dibujo base, cambiando solo brazos/manos (y algún objeto sencillo si hace falta), con la cabeza
// y las piernas en el mismo sitio para que encaje con el resto de posturas.
//   POST {descripcion, base, cara?} -> {url}   (cara: expresión exagerada que sustituye a la de la base)
// Variables en Vercel: FAL_KEY

import { claveOk } from './_clave.js'
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export async function POST(request: Request): Promise<Response> {
  if (!process.env.FAL_KEY) return json({ error: 'Falta FAL_KEY en Vercel.' }, 503)
  if (!claveOk(request)) return json({ error: 'clave' }, 401)
  let body: { descripcion?: string; base?: string; cara?: string }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Petición no válida.' }, 400)
  }
  const descripcion = (body.descripcion ?? '').trim()
  if (!descripcion || descripcion.length > 600) return json({ error: 'Describe el gesto.' }, 400)
  const propio = new URL(request.url).origin
  if (!body.base || !body.base.startsWith(propio + '/')) return json({ error: 'Falta la imagen base.' }, 400)
  const cara = (body.cara ?? '').trim().slice(0, 300)
  const prompt =
    'Edit this image. Keep EXACTLY the same: character, head in exactly the same place and size ' +
    (cara
      ? `(same round head shape, same nose ring; CHANGE THE FACE to this exaggerated cartoon expression, drawn in the same simple style: ${cara}), `
      : '(same eyes looking at the viewer, same nose ring, closed mouth; do NOT change the facial expression at all, even if the gesture is sad, tired or angry: the face is animated separately), ') +
    'same legs and feet in exactly the same ' +
    'place, same t-shirt and jeans, same hand-drawn wobbly black outline and flat colors, plain pure white ' +
    'background. Change ONLY the arms and hands (both arms may move, he may hold one simple object if the ' +
    `gesture needs it): ${descripcion}. Keep the arms and any object CLOSE to the body, never reaching far ` +
    'to the sides (no wider than his shoulders plus one hand). Natural body language of a YouTuber talking to camera, readable ' +
    (cara ? 'silhouette. Small cartoon effect marks (tears, sweat drops, hearts, steam, sparkles) are allowed close to the head. ' : 'silhouette, arms and hands never covering the face. ') + 'No text, no shadow, no extra characters.'
  const res = await fetch('https://fal.run/fal-ai/nano-banana/edit', {
    method: 'POST',
    headers: { authorization: `Key ${process.env.FAL_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, num_images: 1, aspect_ratio: '3:4', output_format: 'png', image_urls: [body.base] }),
  })
  const data = (await res.json().catch(() => ({}))) as { images?: { url: string }[]; detail?: unknown }
  if (!res.ok || !data.images?.[0]?.url) {
    if (res.status === 401 || res.status === 403) return json({ error: 'La clave de fal.ai no es válida o no tiene saldo.' }, 502)
    return json({ error: `fal.ai no ha podido dibujar el gesto (${res.status}).` }, 502)
  }
  return json({ url: data.images[0].url })
}
