// Voz con ElevenLabs (usa la suscripción de la cuenta de la clave).
//   GET  -> lista de voces de la cuenta
//   POST {texto, voz} -> audio MP3
// Variables en Vercel: ELEVENLABS_API_KEY, CLAVE_ESTUDIO

const API = 'https://api.elevenlabs.io/v1'
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function comprobar(request: Request): Response | null {
  if (!process.env.ELEVENLABS_API_KEY || !process.env.CLAVE_ESTUDIO) return json({ error: 'Falta ELEVENLABS_API_KEY en Vercel.' }, 503)
  if (request.headers.get('x-clave-estudio') !== process.env.CLAVE_ESTUDIO) return json({ error: 'clave' }, 401)
  return null
}

async function errorDe(res: Response): Promise<string> {
  const d = (await res.json().catch(() => ({}))) as { detail?: { message?: string; status?: string } | string }
  const det = typeof d.detail === 'object' ? d.detail : undefined
  if (det?.status === 'missing_permissions') return `A la clave de ElevenLabs le falta un permiso: ${det.message ?? ''}`
  if (det?.status === 'quota_exceeded') return 'Se han acabado los caracteres de tu plan de ElevenLabs este mes.'
  if (res.status === 401) return 'La clave de ElevenLabs no es válida.'
  return `ElevenLabs respondió con un error (${res.status}). ${det?.message ?? ''}`.trim()
}

export async function GET(request: Request): Promise<Response> {
  const fallo = comprobar(request)
  if (fallo) return fallo
  const res = await fetch(`${API}/voices`, { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY! } })
  if (!res.ok) return json({ error: await errorDe(res) }, 502)
  const d = (await res.json()) as { voices: { voice_id: string; name: string; category?: string; labels?: Record<string, string> }[] }
  return json({
    voces: d.voices.map((v) => ({ id: v.voice_id, nombre: v.name, tipo: v.category ?? '', idioma: v.labels?.language ?? v.labels?.accent ?? '' })),
  })
}

export async function POST(request: Request): Promise<Response> {
  const fallo = comprobar(request)
  if (fallo) return fallo
  let body: { texto?: string; voz?: string; estabilidad?: number }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Petición no válida.' }, 400)
  }
  const texto = (body.texto ?? '').trim()
  const voz = (body.voz ?? '').trim()
  if (!texto || texto.length > 2500) return json({ error: 'Texto vacío o demasiado largo.' }, 400)
  if (!/^[A-Za-z0-9]{10,40}$/.test(voz)) return json({ error: 'Elige una voz.' }, 400)
  const res = await fetch(`${API}/text-to-speech/${voz}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'content-type': 'application/json' },
    body: JSON.stringify({
      text: texto,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: body.estabilidad ?? 0.45, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
    }),
  })
  if (!res.ok) return json({ error: await errorDe(res) }, 502)
  return new Response(await res.arrayBuffer(), { headers: { 'content-type': 'audio/mpeg' } })
}
