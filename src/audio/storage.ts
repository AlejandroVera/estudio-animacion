// Los audios se guardan en el navegador (IndexedDB): no caben en el guardado normal del proyecto.

const DB = 'estudio-animacion'
const STORE = 'audios'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveAudio(id: string, blob: Blob): Promise<void> {
  const db = await open()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(blob, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

const cache = new Map<string, Blob>()
export async function loadAudio(id: string): Promise<Blob | null> {
  if (cache.has(id)) return cache.get(id)!
  try {
    const db = await open()
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(id)
      req.onsuccess = () => resolve((req.result as Blob) ?? null)
      req.onerror = () => reject(req.error)
    })
    if (blob) cache.set(id, blob)
    return blob
  } catch {
    return null
  }
}

const decoded = new Map<string, AudioBuffer>()
export async function decodeAudio(id: string): Promise<AudioBuffer | null> {
  if (decoded.has(id)) return decoded.get(id)!
  const blob = await loadAudio(id)
  if (!blob) return null
  const ctx = new OfflineAudioContext(1, 1, 48000)
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer())
  decoded.set(id, buf)
  return buf
}
