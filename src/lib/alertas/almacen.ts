import type { EstadoLlegada } from './geocercas'

/**
 * Lo que el modo en vivo recuerda del día en este navegador: llegadas,
 * «Seguir igual» y alertas cerradas. Así recargar la página no repite el
 * «Llegaste a…» ni la misma alerta. Una sola entrada por viaje, solo con el
 * día de hoy (se reemplaza al cambiar de día). Best-effort: sin
 * almacenamiento funciona igual, solo en esta visita.
 */

const PREFIJO = 'wayio:alertas-vivo:'
const MAX_ELEMENTOS = 200

export interface DiaGuardado {
  fecha: string
  llegadas: Record<string, EstadoLlegada>
  omitidas: string[]
  descartadas: string[]
}

export function diaVacio(fecha: string): DiaGuardado {
  return { fecha, llegadas: {}, omitidas: [], descartadas: [] }
}

const textos = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string').slice(-MAX_ELEMENTOS)
    : []

function leerLlegadas(v: unknown): Record<string, EstadoLlegada> {
  const salida: Record<string, EstadoLlegada> = {}
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return salida
  for (const [id, estado] of Object.entries(v).slice(0, MAX_ELEMENTOS)) {
    if (estado === 'en_curso' || estado === 'completada') salida[id] = estado
  }
  return salida
}

export function leerDia(tripId: string, fecha: string): DiaGuardado {
  try {
    const crudo = localStorage.getItem(PREFIJO + tripId)
    const v = crudo ? (JSON.parse(crudo) as unknown) : null
    if (typeof v !== 'object' || v === null) return diaVacio(fecha)
    const r = v as Record<string, unknown>
    if (r.fecha !== fecha) return diaVacio(fecha)
    return {
      fecha,
      llegadas: leerLlegadas(r.llegadas),
      omitidas: textos(r.omitidas),
      descartadas: textos(r.descartadas),
    }
  } catch {
    return diaVacio(fecha)
  }
}

export function guardarDia(tripId: string, dia: DiaGuardado): void {
  try {
    localStorage.setItem(
      PREFIJO + tripId,
      JSON.stringify({
        fecha: dia.fecha,
        llegadas: dia.llegadas,
        omitidas: dia.omitidas.slice(-MAX_ELEMENTOS),
        descartadas: dia.descartadas.slice(-MAX_ELEMENTOS),
      })
    )
  } catch {
    // Sin almacenamiento (privado, lleno): se recuerda solo en esta visita.
  }
}
