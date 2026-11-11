// ZIP sin compresión (las imágenes ya van comprimidas): sin dependencias, para descargar varias imágenes de golpe.

const TABLA = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(d: Uint8Array) {
  let c = 0xffffffff
  for (let i = 0; i < d.length; i++) c = TABLA[(c ^ d[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export async function crearZip(archivos: { nombre: string; blob: Blob }[]): Promise<Blob> {
  const partes: BlobPart[] = []
  const central: Uint8Array<ArrayBuffer>[] = []
  let offset = 0
  const enc = new TextEncoder()
  for (const a of archivos) {
    const datos = new Uint8Array(await a.blob.arrayBuffer())
    const nombre = new Uint8Array(enc.encode(a.nombre))
    const crc = crc32(datos)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, 0x0800, true) // nombres en UTF-8
    local.setUint32(14, crc, true)
    local.setUint32(18, datos.length, true)
    local.setUint32(22, datos.length, true)
    local.setUint16(26, nombre.length, true)
    partes.push(local.buffer, nombre, datos)
    const cen = new DataView(new ArrayBuffer(46))
    cen.setUint32(0, 0x02014b50, true)
    cen.setUint16(4, 20, true)
    cen.setUint16(6, 20, true)
    cen.setUint16(8, 0x0800, true)
    cen.setUint32(16, crc, true)
    cen.setUint32(20, datos.length, true)
    cen.setUint32(24, datos.length, true)
    cen.setUint16(28, nombre.length, true)
    cen.setUint32(42, offset, true)
    const c = new Uint8Array(46 + nombre.length)
    c.set(new Uint8Array(cen.buffer), 0)
    c.set(nombre, 46)
    central.push(c)
    offset += 30 + nombre.length + datos.length
  }
  const tamCentral = central.reduce((s, c) => s + c.length, 0)
  const fin = new DataView(new ArrayBuffer(22))
  fin.setUint32(0, 0x06054b50, true)
  fin.setUint16(8, archivos.length, true)
  fin.setUint16(10, archivos.length, true)
  fin.setUint32(12, tamCentral, true)
  fin.setUint32(16, offset, true)
  return new Blob([...partes, ...central, fin.buffer], { type: 'application/zip' })
}
