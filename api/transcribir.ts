// Función del servidor: transcribe la voz grabada por el usuario con ElevenLabs (Scribe) y devuelve cada
// palabra con su instante, para animar su propia locución igual que la voz generada.
//   POST (cuerpo: audio WAV, máx. ~4 MB) -> {palabras: [{texto, inicio, fin, tipo}]}
// Usa ELEVENLABS_API_KEY (la clave necesita el permiso de «Speech to Text»).

import { claveOk } from './_clave.js'

const API = 'https://api.elevenlabs.io/v1'
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ELEVENLABS_API_KEY) return json({ error: 'Falta ELEVENLABS_API_KEY en Vercel.' }, 503)
  if (!claveOk(request)) return json({ error: 'clave' }, 401)
  const audio = await request.arrayBuffer().catch(() => null)
  if (!audio || audio.byteLength < 1000) return json({ error: 'No ha llegado el audio.' }, 400)
  if (audio.byteLength > 4_400_000) return json({ error: 'Trozo de audio demasiado grande.' }, 413)

  const pedir = async (modelo: string) => {
    const form = new FormData()
    form.append('file', new Blob([audio], { type: 'audio/wav' }), 'voz.wav')
    form.append('model_id', modelo)
    form.append('language_code', 'es')
    form.append('timestamps_granularity', 'word')
    form.append('tag_audio_events', 'false')
    form.append('diarize', 'false')
    return fetch(`${API}/speech-to-text`, { method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY! }, body: form })
  }
  let res = await pedir('scribe_v2')
  // Si la cuenta aún no tiene el modelo nuevo, con el anterior
  if (res.status === 400 || res.status === 422 || res.status === 404) res = await pedir('scribe_v1')
  if (!res.ok) {
    const d = (await res.json().catch(() => ({}))) as { detail?: { message?: string; status?: string } | string }
    const det = typeof d.detail === 'object' ? d.detail : undefined
    if (det?.status === 'missing_permissions') return json({ error: `A la clave de ElevenLabs le falta el permiso de «Speech to Text» (${det.message ?? ''}).` }, 502)
    if (det?.status === 'quota_exceeded') return json({ error: 'Se ha acabado el saldo de ElevenLabs de este mes.' }, 502)
    return json({ error: `ElevenLabs no pudo transcribir el audio (${res.status}). ${det?.message ?? (typeof d.detail === 'string' ? d.detail : '')}`.trim() }, 502)
  }
  const d = (await res.json()) as { text?: string; words?: { text: string; start: number; end: number; type: string }[] }
  return json({
    texto: d.text ?? '',
    palabras: (d.words ?? [])
      .filter((w) => w.type === 'word' || w.type === 'spacing')
      .map((w) => ({ texto: w.text, inicio: w.start, fin: w.end, tipo: w.type })),
  })
}
