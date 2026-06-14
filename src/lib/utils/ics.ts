import type { Trip } from '@/types/trip'

/**
 * Genera un archivo .ics (iCalendar) a partir de un itinerario, con un evento
 * por actividad. Compatible con Google Calendar, Apple Calendar y Outlook.
 * Sin dependencias: solo construye el texto del formato.
 */

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Convierte "YYYY-MM-DD" + offset de días + "HH:MM" a formato ICS local. */
function toIcsDate(
  fechaInicio: string,
  diaOffset: number,
  hora: string
): string {
  const [y, m, d] = fechaInicio.split('-').map(Number)
  const [hh, mm] = (hora || '09:00').split(':').map(Number)
  const base = new Date(y ?? 2025, (m ?? 1) - 1, d ?? 1)
  base.setDate(base.getDate() + diaOffset)
  return (
    `${base.getFullYear()}${pad(base.getMonth() + 1)}${pad(base.getDate())}` +
    `T${pad(hh ?? 9)}${pad(mm ?? 0)}00`
  )
}

function escapeIcs(text: string): string {
  return text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')
}

export function buildIcs(trip: Trip): string {
  const now = new Date()
  const stamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`

  const events: string[] = []
  for (const dia of trip.dias) {
    const offset = dia.numero - 1
    for (const act of dia.actividades) {
      const uid = `${act.id}-${trip.id}@wayio`
      const desc = [act.descripcion, act.direccion].filter(Boolean).join(' — ')
      events.push(
        [
          'BEGIN:VEVENT',
          `UID:${uid}`,
          `DTSTAMP:${stamp}`,
          `DTSTART:${toIcsDate(trip.fechaInicio, offset, act.horaInicio)}`,
          `DTEND:${toIcsDate(trip.fechaInicio, offset, act.horaFin || act.horaInicio)}`,
          `SUMMARY:${escapeIcs(act.nombre)}`,
          `DESCRIPTION:${escapeIcs(desc)}`,
          act.lat && act.lng ? `GEO:${act.lat};${act.lng}` : '',
          act.direccion ? `LOCATION:${escapeIcs(act.direccion)}` : '',
          'END:VEVENT',
        ]
          .filter(Boolean)
          .join('\r\n')
      )
    }
  }

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wayio//Itinerario//ES',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcs(`Viaje a ${trip.destino}`)}`,
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')
}

/** Dispara la descarga del .ics en el navegador. */
export function downloadIcs(trip: Trip): void {
  const blob = new Blob([buildIcs(trip)], {
    type: 'text/calendar;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `wayio-${trip.destino.toLowerCase().replace(/\s+/g, '-')}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
