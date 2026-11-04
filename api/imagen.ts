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

  const llamar = async (conRef: boolean) => {
    const prompt =
      body.tipo === 'libre'
        ? descripcion
        : `Background illustration for a 2D animated video. ${conRef ? 'Use the reference image ONLY as a style reference: same simple drawing style: hand-drawn black outlines, completely flat colors with no shading, minimal detail, like a simple YouTube doodle explainer, similar color palette. Do NOT draw the character from the reference or any other person. ' : 'Simple hand-drawn style: black ink outlines, completely flat colors with no shading, minimal detail, like a simple YouTube doodle explainer. '}Scene: ${descripcion}. Empty location with no people, no characters, no animals unless asked, no text, no letters, no watermark. Leave open space in the lower middle where a standing character will be placed. The drawing must fill the WHOLE ${formato} canvas edge to edge (${formato === '9:16' ? 'tall vertical scene: show the floor in the lower part and the wall or sky up to the top' : 'wide scene'}): no white bands, no borders, no margins, no frame.`
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
