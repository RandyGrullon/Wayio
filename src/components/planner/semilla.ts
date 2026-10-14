/**
 * Semilla que la landing deja al planificador en sessionStorage (destino y
 * lugares de un video o una foto). Módulo sin dependencias para que la isla
 * de la portada no arrastre zod ni el resto del flujo.
 */

export const CLAVE_SEMILLA = 'wayio-semilla-v1'

export interface Semilla {
  descripcion?: string
  destino?: string
  lugaresDeseados?: string[]
}

export function guardarSemilla(semilla: Semilla): void {
  try {
    window.sessionStorage.setItem(CLAVE_SEMILLA, JSON.stringify(semilla))
  } catch {
    // Sin almacenamiento: el planificador abre vacío.
  }
}

/** Borra la semilla una vez aplicada (se usa una sola vez). */
export function borrarSemilla(): void {
  try {
    window.sessionStorage.removeItem(CLAVE_SEMILLA)
  } catch {
    // Nada que borrar.
  }
}

/** Lee la semilla sin borrarla (lectura pura: apta para inicializadores). */
export function leerSemilla(): Semilla | null {
  let v: unknown = null
  try {
    const raw = window.sessionStorage.getItem(CLAVE_SEMILLA)
    v = raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    return null
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  const semilla: Semilla = {}
  if (typeof o['descripcion'] === 'string')
    semilla.descripcion = o['descripcion']
  if (typeof o['destino'] === 'string') semilla.destino = o['destino']
  if (Array.isArray(o['lugaresDeseados'])) {
    semilla.lugaresDeseados = o['lugaresDeseados']
      .filter((l): l is string => typeof l === 'string')
      .slice(0, 30)
  }
  return semilla
}
