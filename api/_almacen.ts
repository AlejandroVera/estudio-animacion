// Almacén compartido entre la web y el conector de Claude (Redis de Upstash, conectado desde Vercel).
// La web guarda aquí el estado de su proyecto y recoge las órdenes que Claude deja en la cola.

const URL_REDIS = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
const TOKEN_REDIS = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN

export const almacenListo = () => Boolean(URL_REDIS && TOKEN_REDIS)

async function redis<T = unknown>(...cmd: (string | number)[]): Promise<T> {
  const res = await fetch(URL_REDIS!, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN_REDIS}`, 'content-type': 'application/json' },
    body: JSON.stringify(cmd),
  })
  const data = (await res.json()) as { result?: T; error?: string }
  if (!res.ok || data.error) throw new Error(`Almacén: ${data.error ?? res.status}`)
  return data.result as T
}

export type Operacion = { tipo: 'animar'; resultado: unknown } | { tipo: 'guion' | 'proponer'; resultado: unknown } | { tipo: 'deshacer' }
export interface EntradaCola {
  seq: number
  at: number
  op: Operacion
}

export async function guardarContexto(contexto: unknown) {
  await redis('SET', 'estudio:contexto', JSON.stringify({ contexto, at: Date.now() }))
}

export async function leerContexto(): Promise<{ contexto: unknown; at: number } | null> {
  const raw = await redis<string | null>('GET', 'estudio:contexto')
  return raw ? JSON.parse(raw) : null
}

export async function encolar(op: Operacion): Promise<number> {
  const seq = await redis<number>('INCR', 'estudio:seq')
  await redis('RPUSH', 'estudio:cola', JSON.stringify({ seq, at: Date.now(), op }))
  await redis('LTRIM', 'estudio:cola', -50, -1)
  return seq
}

export async function leerCola(): Promise<EntradaCola[]> {
  const items = await redis<string[]>('LRANGE', 'estudio:cola', 0, -1)
  return items.map((s) => JSON.parse(s))
}

// Estilos de guion (compartidos por la web y el conector de Claude)
export interface EstiloGuion {
  id: string
  nombre: string
  texto: string
}

export async function leerEstilos(): Promise<{ estilos: EstiloGuion[]; activo: string | null }> {
  const raw = await redis<string | null>('GET', 'estudio:estilos')
  return raw ? JSON.parse(raw) : { estilos: [], activo: null }
}

export async function guardarEstilos(data: { estilos: EstiloGuion[]; activo: string | null }) {
  await redis('SET', 'estudio:estilos', JSON.stringify(data))
}

export async function estiloActivo(): Promise<EstiloGuion | null> {
  const { estilos, activo } = await leerEstilos()
  return estilos.find((e) => e.id === activo) ?? null
}
