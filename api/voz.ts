// Voz con ElevenLabs (usa la suscripción de la cuenta de la clave).
//   GET  -> lista de voces de la cuenta
//   POST {texto, voz, antes?, despues?} -> audio MP3 (antes/despues: contexto para rehacer una frase)
// Variables en Vercel: ELEVENLABS_API_KEY, CLAVE_ESTUDIO

import { claveOk } from './_clave.js'
const API = 'https://api.elevenlabs.io/v1'
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function comprobar(request: Request): Response | null {
  if (!process.env.ELEVENLABS_API_KEY) return json({ error: 'Falta ELEVENLABS_API_KEY en Vercel.' }, 503)
  if (!claveOk(request)) return json({ error: 'clave' }, 401)
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
  let body: { texto?: string; voz?: string; modelo?: string; tiempos?: boolean; antes?: string; despues?: string }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Petición no válida.' }, 400)
  }
  const texto = (body.texto ?? '').trim()
  const voz = (body.voz ?? '').trim()
  if (!texto || texto.length > 4500) return json({ error: 'Texto vacío o demasiado largo (máx. 4500 letras).' }, 400)
  if (!/^[A-Za-z0-9]{10,40}$/.test(voz)) return json({ error: 'Elige una voz.' }, 400)
  const modelo = ['eleven_v3', 'eleven_multilingual_v2'].includes(body.modelo ?? '') ? body.modelo! : 'eleven_multilingual_v2'
  // Sin voice_settings: se usan los ajustes guardados de la voz en la cuenta del usuario.
  const ruta = body.tiempos ? 'with-timestamps' : ''
  const res = await fetch(`${API}/text-to-speech/${voz}${ruta ? '/' + ruta : ''}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'content-type': 'application/json' },
    // antes/despues: el texto que va alrededor, para que una frase rehecha suene con el mismo tono
    body: JSON.stringify({
      text: texto,
      model_id: modelo,
      ...(body.antes ? { previous_text: body.antes.slice(-1000) } : {}),
      ...(body.despues ? { next_text: body.despues.slice(0, 1000) } : {}),
    }),
  })
  if (!res.ok) return json({ error: await errorDe(res) }, 502)
  if (body.tiempos) {
    const d = (await res.json()) as { audio_base64: string; alignment: unknown }
    return json({ audio: d.audio_base64, alineacion: d.alignment })
  }
  return new Response(await res.arrayBuffer(), { headers: { 'content-type': 'audio/mpeg' } })
}
