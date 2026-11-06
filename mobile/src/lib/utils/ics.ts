/**
 * Archivo .ics (iCalendar, RFC 5545) de un itinerario: un evento por
 * actividad. Port fiel de src/lib/utils/ics.ts de la web (mismo texto, mismos
 * UID), sin la descarga del navegador: en la app se escribe en caché y se
 * comparte (lib/exportar/calendario.ts). Compatible con Google Calendar,
 * Apple Calendar y Outlook.
 *
 * - Horas «flotantes» (sin zona): se leen como hora local del destino.
 * - Si una actividad termina pasada la medianoche, el fin cae al día siguiente.
 * - Las líneas se pliegan a 75 octetos y los textos se escapan.
 */

/** Lo mínimo que necesita el .ics (sirve para el viaje guardado y el en vivo). */
export interface ActividadIcs {
  id: string
  nombre: string
  descripcion?: string
  direccion?: string
  horaInicio?: string
  horaFin?: string
  duracionMinutos: number
  lat: number
  lng: number
  estado?: string
  esPerdida?: boolean
}

export interface ViajeIcs {
  id: string
  destino: string
  fechaInicio: string
  dias: { numero: number; actividades: ActividadIcs[] }[]
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** "HH:MM" → [h, m]; null si no es una hora válida. */
function leerHora(hora: string | undefined): [number, number] | null {
  const m = /^(\d{1,2}):(\d{2})/.exec((hora ?? '').trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return [h, min]
}

/** Fecha local 'YYYY-MM-DD' + días de desplazamiento; null si no es válida. */
function fechaBase(fechaInicio: string, diaOffset: number): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaInicio.trim())
  if (!m) return null
  const fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(fecha.getTime())) return null
  fecha.setDate(fecha.getDate() + diaOffset)
  return fecha
}

function aIcs(fecha: Date, h: number, min: number): string {
  return (
    `${fecha.getFullYear()}${pad(fecha.getMonth() + 1)}${pad(fecha.getDate())}` +
    `T${pad(h)}${pad(min)}00`
  )
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * Octetos UTF-8 de un carácter (punto de código). Se calcula a mano: no todas
 * las versiones de Hermes traen `TextEncoder`.
 */
function bytesUtf8(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0
  if (cp < 0x80) return 1
  if (cp < 0x800) return 2
  if (cp < 0x10000) return 3
  return 4
}

/** Pliega una línea a 75 octetos (UTF-8) como pide RFC 5545 §3.1. */
function plegar(linea: string): string {
  let total = 0
  for (const ch of linea) total += bytesUtf8(ch)
  if (total <= 75) return linea
  const partes: string[] = []
  let actual = ''
  let bytes = 0
  for (const ch of linea) {
    const tam = bytesUtf8(ch)
    const limite = partes.length === 0 ? 75 : 74 // la continuación lleva un espacio
    if (bytes + tam > limite) {
      partes.push(actual)
      actual = ''
      bytes = 0
    }
    actual += ch
    bytes += tam
  }
  partes.push(actual)
  return partes.join('\r\n ')
}

export function buildIcs(trip: ViajeIcs, ahora: Date = new Date()): string {
  const stamp =
    `${ahora.getUTCFullYear()}${pad(ahora.getUTCMonth() + 1)}${pad(ahora.getUTCDate())}` +
    `T${pad(ahora.getUTCHours())}${pad(ahora.getUTCMinutes())}${pad(ahora.getUTCSeconds())}Z`

  const eventos: string[][] = []
  trip.dias.forEach((dia, indice) => {
    const offset =
      Number.isFinite(dia.numero) && dia.numero > 0 ? dia.numero - 1 : indice
    const fecha = fechaBase(trip.fechaInicio, offset)
    if (!fecha) return
    for (const act of dia.actividades) {
      if (act.estado === 'perdida' || act.esPerdida) continue
      const ini = leerHora(act.horaInicio) ?? [9, 0]
      const finLeido = leerHora(act.horaFin)
      const duracion =
        Number.isFinite(act.duracionMinutos) && act.duracionMinutos > 0
          ? act.duracionMinutos
          : 60
      let fin: [number, number]
      let fechaFin = fecha
      if (finLeido) {
        fin = finLeido
        // Termina pasada la medianoche: el fin es al día siguiente.
        if (finLeido[0] * 60 + finLeido[1] <= ini[0] * 60 + ini[1]) {
          fechaFin = new Date(fecha)
          fechaFin.setDate(fechaFin.getDate() + 1)
        }
      } else {
        const total = ini[0] * 60 + ini[1] + duracion
        fechaFin = new Date(fecha)
        fechaFin.setDate(fechaFin.getDate() + Math.floor(total / 1440))
        fin = [Math.floor((total % 1440) / 60), total % 60]
      }
      const desc = [act.descripcion, act.direccion].filter(Boolean).join(' — ')
      const tieneGeo =
        Number.isFinite(act.lat) &&
        Number.isFinite(act.lng) &&
        !(act.lat === 0 && act.lng === 0)
      eventos.push(
        [
          'BEGIN:VEVENT',
          `UID:${escapeIcs(`${act.id}-${trip.id}`)}@wayio`,
          `DTSTAMP:${stamp}`,
          `DTSTART:${aIcs(fecha, ini[0], ini[1])}`,
          `DTEND:${aIcs(fechaFin, fin[0], fin[1])}`,
          `SUMMARY:${escapeIcs(act.nombre)}`,
          desc ? `DESCRIPTION:${escapeIcs(desc)}` : '',
          tieneGeo ? `GEO:${act.lat.toFixed(6)};${act.lng.toFixed(6)}` : '',
          act.direccion ? `LOCATION:${escapeIcs(act.direccion)}` : '',
          'END:VEVENT',
        ].filter(Boolean)
      )
    }
  })

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wayio//Itinerario//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(`Viaje a ${trip.destino}`)}`,
    ...eventos.flat(),
    'END:VCALENDAR',
  ]
    .map(plegar)
    .join('\r\n')
}

/** ¿Hay al menos una actividad que llevar al calendario? */
export function tieneEventosIcs(trip: ViajeIcs): boolean {
  return trip.dias.some((d) =>
    d.actividades.some((a) => a.estado !== 'perdida' && !a.esPerdida)
  )
}

/** Base segura para nombres de archivo: «Cartagena de Indias» → «cartagena-de-indias». */
export function baseNombreArchivo(destino: string): string {
  const sinAcentos =
    typeof destino.normalize === 'function'
      ? destino.normalize('NFD').replace(/[̀-ͯ]/g, '')
      : destino
  return sinAcentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** Nombre de archivo seguro: «wayio-cartagena.ics». */
export function nombreArchivoIcs(destino: string): string {
  return `wayio-${baseNombreArchivo(destino) || 'viaje'}.ics`
}
