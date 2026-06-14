/**
 * Bridges the planning model (web-compatible, rich) into the leaner model the
 * live-tracking / geofencing engine expects (`types/trip.ts` + `types/activity.ts`).
 */
import type { PlanningTrip, PlanningActivityType } from '../../types/planning'
import type { Trip, Day } from '../../types/trip'
import type { Activity, ActivityStatus } from '../../types/activity'
import type { ActivityType } from '../../constants/geofencingRadii'

const TYPE_MAP: Record<PlanningActivityType, ActivityType> = {
  museo: 'museo',
  restaurante: 'restaurante',
  templo: 'templo',
  parque: 'parque',
  barrio: 'barrio',
  playa: 'playa',
  actividad: 'defecto',
  traslado: 'defecto',
}

function mapEstado(estado: string): ActivityStatus {
  switch (estado) {
    case 'en_curso':
      return 'en_curso'
    case 'completada':
      return 'completada'
    case 'perdida':
      return 'perdida'
    default:
      return 'pendiente'
  }
}

export function planningTripToLiveTrip(trip: PlanningTrip): Trip {
  const isCrucero = trip.dias.some((d) =>
    d.actividades.some((a) => a.puertoCrucero === true)
  )

  const dias: Day[] = trip.dias.map((dia, index) => ({
    index,
    fecha: `Día ${dia.numero}: ${dia.titulo}`,
    actividades: dia.actividades.map<Activity>((a) => ({
      id: a.id,
      nombre: a.nombre,
      descripcion: a.descripcion,
      lat: a.lat,
      lng: a.lng,
      tipo: a.puertoCrucero === true ? 'puerto_crucero' : TYPE_MAP[a.tipo],
      radioGeofencingMetros: a.radioGeofencingMetros,
      estado: mapEstado(a.estado),
      horaInicio: a.horaInicio,
      horaFin: a.horaFin,
      diaIndex: index,
      duracionMinutos: a.duracionMinutos,
      precio: a.precioEstimado,
      ...(a.linkAfiliado !== undefined ? { linkAfiliado: a.linkAfiliado } : {}),
      ...(a.puertoCrucero !== undefined
        ? { puertoCrucero: a.puertoCrucero }
        : {}),
      ...(a.tiempoEmbarqueMinutos !== undefined
        ? { tiempoEmbarqueMinutos: a.tiempoEmbarqueMinutos }
        : {}),
      tieneReserva: a.reservaRequerida,
    })),
  }))

  return {
    id: trip.id,
    destino: trip.destino,
    dias,
    paquete: trip.paquete,
    presupuesto: trip.presupuestoTotal,
    moneda: 'USD',
    isCrucero,
  }
}
