/**
 * Rechaza si la promesa tarda más de `ms`. Las peticiones al backend ya se
 * cortan a los 60 s (lib/api/http.ts), pero el modo en vivo no puede esperar
 * tanto en mitad de la calle: aquí se usan topes más cortos.
 */
export function conTiempoLimite<T>(
  promesa: Promise<T>,
  ms: number
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('tiempo agotado')), ms)
    promesa.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e: unknown) => {
        clearTimeout(t)
        reject(e instanceof Error ? e : new Error('fallo'))
      }
    )
  })
}
