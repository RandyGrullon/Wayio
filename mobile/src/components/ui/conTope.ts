/** Error de tiempo agotado (mensaje ya apto para el usuario). */
export class ErrorTope extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorTope'
  }
}

/**
 * Promesa con tope de tiempo: si `promesa` no responde en `ms`, rechaza con un
 * `ErrorTope` de mensaje amable. La petición puede seguir en segundo plano,
 * pero la pantalla deja de esperar. lib/api/http.ts ya corta a los 60 s: usar
 * esto solo para topes MÁS CORTOS (pagos, interpretación) con un mensaje
 * propio de la pantalla.
 */
export function conTope<T>(
  promesa: Promise<T>,
  ms: number,
  mensaje: string
): Promise<T> {
  let id: ReturnType<typeof setTimeout> | undefined
  const tope = new Promise<never>((_, reject) => {
    id = setTimeout(() => reject(new ErrorTope(mensaje)), ms)
  })
  return Promise.race([promesa, tope]).finally(() => {
    if (id !== undefined) clearTimeout(id)
  })
}
