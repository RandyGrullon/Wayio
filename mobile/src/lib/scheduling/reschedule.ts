import { geofenceDetector } from '../geofencing/detector'
import {
  aISO,
  fechaDeDia,
  finMin,
  inicioMin,
  horaDeMinutos,
  minutosDelDia,
  ordenarPorHora,
} from '../geofencing/fechas'
import { formatFecha, formatHora12 } from '../utils/formatters'
import { guardarEnPendientes } from './pendientes'
import type { Activity } from '../../types/activity'
import type { Day } from '../../types/trip'
import type { RescheduleOption } from '../../types/alert'

/**
 * Busca huecos reales (por hora) para una actividad perdida: más tarde hoy o
 * en los días siguientes, sin solaparse con lo que ya está planeado. Si no
 * cabe en ningún sitio se guarda en «Para tu próxima visita».
 */

/** Opción de reagendado con la hora concreta propuesta. */
export interface OpcionReagendar extends RescheduleOption {
  /** Índice 0-based del día destino (igual que `dia`). */
  dia: number
  horaInicio: string
  horaFin: string
  /** Fecha ISO del día destino, si se conoce. */
  fecha: string | null
}

const MAX_DESVIO_MINUTOS = 30
const MARGEN_MIN = 15
const ABRE = 8 * 60
const CIERRA = 21 * 60
const MAX_OPCIONES = 3

interface Hueco {
  desde: number
  hasta: number
  posicion: number
}

/** Huecos libres del día entre actividades (las perdidas no ocupan sitio). */
function huecosDelDia(dia: Day, idPerdida: string, desdeMin: number): Hueco[] {
  const ocupadas = ordenarPorHora(
    dia.actividades.filter(
      (a) =>
        a.id !== idPerdida && a.estado !== 'perdida' && inicioMin(a) !== null
    )
  )
  const huecos: Hueco[] = []
  let cursor = Math.max(ABRE, desdeMin)
  ocupadas.forEach((a, i) => {
    const ini = inicioMin(a) ?? cursor
    if (ini - MARGEN_MIN > cursor) {
      huecos.push({ desde: cursor, hasta: ini - MARGEN_MIN, posicion: i })
    }
    cursor = Math.max(cursor, (finMin(a) ?? ini) + MARGEN_MIN)
  })
  if (CIERRA > cursor) {
    huecos.push({ desde: cursor, hasta: CIERRA, posicion: ocupadas.length })
  }
  return huecos
}

/** Minutos a pie aproximados hasta las actividades vecinas del hueco. */
function desvio(actividad: Activity, dia: Day, posicion: number): number {
  const ordenadas = ordenarPorHora(
    dia.actividades.filter(
      (a) => a.id !== actividad.id && a.estado !== 'perdida'
    )
  )
  const vecinas = [ordenadas[posicion - 1], ordenadas[posicion]].filter(
    (a): a is Activity => a !== undefined && (a.lat !== 0 || a.lng !== 0)
  )
  if (vecinas.length === 0 || (actividad.lat === 0 && actividad.lng === 0)) {
    return 0
  }
  const metros =
    vecinas.reduce(
      (acc, a) =>
        acc +
        geofenceDetector.haversineDistance(
          actividad.lat,
          actividad.lng,
          a.lat,
          a.lng
        ),
      0
    ) / vecinas.length
  return Math.round((metros / 1000 / 5) * 60)
}

export async function findRescheduleOptions(
  actividadPerdida: Activity,
  itinerarioCompleto: Day[],
  ahora: Date = new Date()
): Promise<OpcionReagendar[]> {
  const duracion = Math.max(15, actividadPerdida.duracionMinutos || 60)
  const hoyISO = aISO(ahora)
  const ahoraMin = minutosDelDia(ahora)
  const diaActual = actividadPerdida.diaIndex

  const opciones: OpcionReagendar[] = []
  for (const dia of itinerarioCompleto) {
    if (dia.index < diaActual) continue
    const fecha = fechaDeDia(dia)
    if (fecha !== null && fecha < hoyISO) continue
    const esHoy =
      fecha === hoyISO || (fecha === null && dia.index === diaActual)
    // El mismo día solo sirve si queda tiempo después de ahora.
    const desde = esHoy ? ahoraMin + MARGEN_MIN : ABRE
    if (dia.index === diaActual && !esHoy) continue

    const hueco = huecosDelDia(dia, actividadPerdida.id, desde)
      .filter((h) => h.hasta - h.desde >= duracion)
      .map((h) => ({ ...h, desvio: desvio(actividadPerdida, dia, h.posicion) }))
      .filter((h) => h.desvio < MAX_DESVIO_MINUTOS)
      .sort((a, b) => a.desvio - b.desvio || a.desde - b.desde)[0]
    if (!hueco) continue

    const horaInicio = horaDeMinutos(hueco.desde)
    const horaFin = horaDeMinutos(hueco.desde + duracion)
    const etiquetaDia = esHoy
      ? 'Hoy'
      : fecha
        ? `Día ${dia.index + 1} · ${formatFecha(fecha)}`
        : `Día ${dia.index + 1}`
    opciones.push({
      dia: dia.index,
      posicion: hueco.posicion,
      impactoMinutos: hueco.desvio,
      descripcion: `${etiquetaDia} · ${formatHora12(horaInicio)} – ${formatHora12(horaFin)}`,
      esOptima: false,
      horaInicio,
      horaFin,
      fecha,
    })
  }

  opciones.sort((a, b) => a.impactoMinutos - b.impactoMinutos || a.dia - b.dia)
  const mejores = opciones.slice(0, MAX_OPCIONES)
  const primera = mejores[0]
  if (primera) primera.esOptima = true

  if (mejores.length === 0) {
    try {
      await guardarEnPendientes(actividadPerdida)
    } catch {
      // Sin almacenamiento: sigue marcada como perdida en el viaje.
    }
  }
  return mejores
}
