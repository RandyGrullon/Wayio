/**
 * Bridges the planning model (web-compatible, rich) into the leaner model the
 * live-tracking / geofencing engine expects (`types/trip.ts` + `types/activity.ts`).
 */
import type { PlanningTrip, PlanningActivityType } from '../../types/planning'
import type { Trip, Day } from '../../types/trip'
import type { Activity, ActivityStatus } from '../../types/activity'
import type { ActivityType } from '../../constants/geofencingRadii'
import { fechaLocal, sumarDias } from '../geofencing/fechas'
import { monedaDe } from '../utils/formatters'

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

/**
 * Fecha real del día `index` ('YYYY-MM-DD' = fechaInicio + index), o '' si
 * cae después de fechaFin o el viaje no tiene fechas válidas. Misma regla
 * que `conFechasReales` (lib/geofencing/fechas.ts).
 */
function fechaDelDia(trip: PlanningTrip, index: number): string {
  const iso = sumarDias(trip.fechaInicio, index)
  const fecha = iso ? fechaLocal(iso) : null
  if (!iso || !fecha) return ''
  const fin = fechaLocal(trip.fechaFin)
  return fin === null || fecha <= fin ? iso : ''
}

/**
 * @param trip viaje (trips.data)
 * @param rowId id de la FILA de Supabase (trips.id). Pásalo siempre que se
 *   tenga: el modo en vivo lo usa como id del viaje y la sync offline lo
 *   escribe en activity_states.trip_id (FK a trips.id). Si falta se usa el id
 *   interno del JSON, y la sync intentará resolver la fila por ese id.
 */
export function planningTripToLiveTrip(
  trip: PlanningTrip,
  rowId?: string
): Trip {
  const isCrucero = trip.dias.some((d) =>
    d.actividades.some((a) => a.puertoCrucero === true)
  )

  const dias: Day[] = trip.dias.map((dia, index) => ({
    index,
    fecha: fechaDelDia(trip, index),
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
    id: rowId ?? trip.id,
    destino: trip.destino,
    dias,
    paquete: trip.paquete,
    presupuesto: trip.presupuestoTotal,
    // Moneda del viaje (trips.data.moneda) o USD para viajes antiguos.
    moneda: monedaDe(trip),
    isCrucero,
  }
}
