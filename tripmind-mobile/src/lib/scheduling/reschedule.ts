import { geofenceDetector } from '../geofencing/detector'
import { guardarEnPendientes } from './pendientes'
import type { Activity } from '../../types/activity'
import type { Day } from '../../types/trip'
import type { RescheduleOption } from '../../types/alert'

const MAX_DESVIO_MINUTOS = 30

function calcularEspacioDisponible(dia: Day): number {
  if (dia.actividades.length === 0) return 480

  const completadas = dia.actividades.filter(
    (a) => a.estado === 'completada' || a.estado === 'perdida'
  )
  const restantes = dia.actividades.filter(
    (a) => a.estado === 'pendiente' || a.estado === 'en_curso'
  )

  const minutosUsados = restantes.reduce((acc, a) => acc + a.duracionMinutos, 0)
  const minutosCompletados = completadas.reduce(
    (acc, a) => acc + a.duracionMinutos,
    0
  )
  return Math.max(0, 480 - minutosUsados - minutosCompletados)
}

function calcularDistanciaMediaDia(actividad: Activity, dia: Day): number {
  if (dia.actividades.length === 0) return 0
  const distancias = dia.actividades.map((a) =>
    geofenceDetector.haversineDistance(
      actividad.lat,
      actividad.lng,
      a.lat,
      a.lng
    )
  )
  const avg = distancias.reduce((acc, d) => acc + d, 0) / distancias.length
  return (avg / 1000 / 5) * 60
}

function encontrarMejorPosicion(actividad: Activity, dia: Day): number {
  if (dia.actividades.length === 0) return 0

  let mejorPos = 0
  let mejorDist = Infinity

  for (let i = 0; i <= dia.actividades.length; i++) {
    const prev = dia.actividades[i - 1]
    const next = dia.actividades[i]

    const dPrev = prev
      ? geofenceDetector.haversineDistance(
          actividad.lat,
          actividad.lng,
          prev.lat,
          prev.lng
        )
      : 0

    const dNext = next
      ? geofenceDetector.haversineDistance(
          actividad.lat,
          actividad.lng,
          next.lat,
          next.lng
        )
      : 0

    const totalDist = dPrev + dNext
    if (totalDist < mejorDist) {
      mejorDist = totalDist
      mejorPos = i
    }
  }

  return mejorPos
}

function formatHora(actividad: Activity | undefined): string {
  return actividad?.horaInicio ?? '—'
}

export async function findRescheduleOptions(
  actividadPerdida: Activity,
  itinerarioCompleto: Day[]
): Promise<RescheduleOption[]> {
  const diaActual = actividadPerdida.diaIndex
  const diasRestantes = itinerarioCompleto.filter((d) => d.index > diaActual)

  const opciones: RescheduleOption[] = []

  for (const dia of diasRestantes) {
    const espacioMinutos = calcularEspacioDisponible(dia)
    const distanciaMedia = calcularDistanciaMediaDia(actividadPerdida, dia)

    if (
      espacioMinutos >= actividadPerdida.duracionMinutos &&
      distanciaMedia < MAX_DESVIO_MINUTOS
    ) {
      const posicion = encontrarMejorPosicion(actividadPerdida, dia)
      const prev = dia.actividades[posicion - 1]
      const next = dia.actividades[posicion]

      opciones.push({
        dia: dia.index,
        posicion,
        impactoMinutos: Math.round(distanciaMedia),
        descripcion: `Día ${dia.index} entre ${formatHora(prev)} y ${formatHora(next)}`,
        esOptima: distanciaMedia < 15,
      })
    }
  }

  if (opciones.length === 0) {
    await guardarEnPendientes(actividadPerdida)
  }

  return opciones
}
