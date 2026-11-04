// Contraseña del estudio (CLAVE_ESTUDIO). DESACTIVADA de momento a petición de Alejandro, para usar la
// web sin escribirla: cualquiera con el enlace puede gastar los saldos de ElevenLabs, Anthropic y fal.ai.
// Para volver a pedirla, poner PEDIR_CLAVE = true. (El conector MCP sigue usando ?clave= en su URL.)
export const PEDIR_CLAVE = false

export function claveOk(request: Request): boolean {
  if (!PEDIR_CLAVE) return true
  const clave = process.env.CLAVE_ESTUDIO
  return !!clave && request.headers.get('x-clave-estudio') === clave
}
