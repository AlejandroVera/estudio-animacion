// Imágenes con fal.ai (Nano Banana): fondos en el estilo del personaje.
//   POST {descripcion, referencia?, formato?} -> {url}
// Variables en Vercel: FAL_KEY, CLAVE_ESTUDIO

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const FORMATOS = ['9:16', '16:9', '1:1', '4:5', '3:4']

export async function POST(request: Request): Promise<Response> {
  if (!process.env.FAL_KEY || !process.env.CLAVE_ESTUDIO) return json({ error: 'Falta FAL_KEY en Vercel.' }, 503)
  if (request.headers.get('x-clave-estudio') !== process.env.CLAVE_ESTUDIO) return json({ error: 'clave' }, 401)
  let body: { descripcion?: string; referencia?: string; formato?: string; tipo?: 'fondo' | 'libre' }
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

  const prompt =
    body.tipo === 'libre'
      ? descripcion
      : `Background illustration for a 2D animated video. ${ref ? 'Use the reference image ONLY as a style reference: same drawing style, flat colors, clean black ink outlines, subtle paper grain, similar color palette. Do NOT draw the character from the reference or any other person. ' : 'Flat colors, clean black ink outlines, subtle paper grain. '}Scene: ${descripcion}. Empty location with no people, no characters, no animals unless asked, no text, no letters, no watermark. Leave open space in the lower middle where a standing character will be placed. Full-bleed, ${formato} composition.`

  const model = ref ? 'fal-ai/nano-banana/edit' : 'fal-ai/nano-banana'
  const res = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: { authorization: `Key ${process.env.FAL_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, num_images: 1, aspect_ratio: formato, output_format: 'jpeg', ...(ref ? { image_urls: [ref] } : {}) }),
  })
  const data = (await res.json().catch(() => ({}))) as { images?: { url: string }[]; detail?: unknown }
  if (!res.ok || !data.images?.[0]?.url) {
    const det = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail ?? '')
    if (res.status === 401 || res.status === 403) return json({ error: 'La clave de fal.ai no es válida o no tiene saldo.' }, 502)
    return json({ error: `fal.ai no ha podido generar la imagen (${res.status}). ${det}`.slice(0, 300) }, 502)
  }
  return json({ url: data.images[0].url })
}
