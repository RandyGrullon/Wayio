import { formatFechaHora, formatHora12, parseFecha } from '../ui/formato'

/**
 * Cuándo se actualizó la ubicación de un miembro, como en la web
 * (MiembrosPanel): «10:42 a. m.» si es de hoy; si no, «8 oct, 10:42 a. m.».
 */
export function cuandoUbicacion(iso: string, ahora = new Date()): string {
  const f = parseFecha(iso)
  if (!f) return ''
  const hoy =
    f.getFullYear() === ahora.getFullYear() &&
    f.getMonth() === ahora.getMonth() &&
    f.getDate() === ahora.getDate()
  return hoy ? formatHora12(f) : formatFechaHora(f)
}
