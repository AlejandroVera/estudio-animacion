// Función del servidor: REVISOR de los dibujos de las escenas. Mira el dibujo que ha hecho la IA de imágenes
// y dice si tiene fallos de composición (la cara del protagonista tapada o cortada, alguien delante de él,
// franjas, texto, dos protagonistas…) para repetirlo antes de usarlo. Usa ANTHROPIC_API_KEY.
//   POST {url, descripcion} -> {ok, fallos: string[]}   (si algo falla aquí, se da por bueno)

import { claveOk } from './_clave.js'
import Anthropic from '@anthropic-ai/sdk'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const GUIA = `You are the quality checker of a 2D cartoon video. You get ONE drawing (a full-screen shot) and
the description that was requested. The protagonist is "the magenta boy": a boy with a big perfectly round
flat magenta head, simple round white eyes with black pupils, two thin eyebrows, a small gold nose ring, grey
t-shirt, jeans. His mouth will be animated later on top of the drawing, so his whole face must be clean and
visible. Other people are normal cartoon people.

Check ONLY these defects (be strict with 1-4, they ruin the animation):
1. FACE COVERED: anything in front of the magenta boy's face (a phone, a hand, an object, another person, a
   speech bubble) hiding his eyes or his mouth area, even partly.
2. HEAD CUT: his head is cut by the edge of the picture, or is so big that it does not fit.
3. PEOPLE OVERLAP: another person stands in front of him covering his head or a big part of his body, or is
   mostly hidden behind him. Sitting or standing next to each other, touching, or an arm reaching towards him
   is FINE as long as his head and most of his torso stay visible.
4. TWO BOYS: more than one magenta boy as a character in the scene (a small photo of him on a screen, a
   printed photo or a poster does not count).
5. BANDS: big empty flat bands (more than about a sixth of the picture) at the top/bottom/sides because the
   drawing does not fill the frame. A thin outline or border, or a plain wall or floor, is NOT a defect.
6. TEXT: readable words or letters drawn in the picture (numbers and simple icons are fine).
7. (Small characters are NOT a defect: the shot will be reframed with "caja".)
8. BACK: he is seen from behind or his face is not visible at all although he is in the shot.
9. WRONG: the drawing clearly does not show the requested moment (main action missing or contradicted), or
   adds a prominent element with its own meaning that was not requested (a skull, a random symbol).

If the requested shot is a close-up of an object or screen WITHOUT him as a character, only 5, 6 and 9 apply.
His expression and an open mouth are never defects; objects that the description asks for are never defects.
Minor style differences, small imperfections or missing tiny details are NOT defects. When in doubt, pass.

Answer with "ok" (true if none of the defects) and "fallos": for each defect found, one short imperative
instruction IN ENGLISH for the illustrator to fix it in a new attempt (e.g. "Nothing may cover his face: the
phone is held low, at chest height, away from his head", "Put the sister clearly to his right, side by side,
with a gap, not in front of him"). Empty list if ok.

Also give "caja": the tight box [x0, y0, x1, y1] (fractions 0-1 of the picture, origin top-left) that contains
all the characters completely and the objects they use. If the shot is an object close-up, the box of the object
and hands. It is used to reframe shots where the characters were drawn too small.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ok', 'fallos', 'caja'],
  properties: {
    ok: { type: 'boolean' },
    fallos: { type: 'array', items: { type: 'string' } },
    caja: { type: 'array', items: { type: 'number' }, description: '[x0, y0, x1, y1] as fractions 0-1 of the picture: the tight box that contains ALL the characters completely (heads to feet as drawn) and the objects of the action.' },
  },
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json({ ok: true, fallos: [] })
  if (!claveOk(request)) return json({ error: 'clave' }, 401)
  const body = (await request.json().catch(() => ({}))) as { url?: string; descripcion?: string }
  const url = String(body.url ?? '')
  // Solo dibujos de fal
  if (!/^https:\/\/[a-z0-9.-]*fal\.media\//.test(url)) return json({ error: 'Imagen no válida.' }, 400)
  const client = new Anthropic()
  try {
    const response = await client.beta.messages.create({
      model: 'claude-sonnet-5-5',
      max_tokens: 1500,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: [{ type: 'text', text: GUIA, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url } },
            { type: 'text', text: `Requested shot: ${String(body.descripcion ?? '').slice(0, 1500)}` },
          ],
        },
      ],
    })
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    const r = JSON.parse(text) as { ok: boolean; fallos: string[]; caja?: number[] }
    const caja = Array.isArray(r.caja) && r.caja.length === 4 && r.caja.every((v) => typeof v === 'number' && v >= 0 && v <= 1) && r.caja[2] > r.caja[0] && r.caja[3] > r.caja[1] ? r.caja : undefined
    return json({ ok: !!r.ok || !r.fallos?.length, fallos: (r.fallos ?? []).slice(0, 4), caja })
  } catch {
    // El revisor no puede frenar el vídeo: si falla, el dibujo se da por bueno
    return json({ ok: true, fallos: [] })
  }
}
