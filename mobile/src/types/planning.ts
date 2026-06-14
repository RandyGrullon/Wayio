/**
 * Planning-side domain model — mirrors the Wayio web app's types so that
 * `trips.data` (jsonb) round-trips identically between web and mobile.
 *
 * NOTE: the live-tracking engine uses the leaner `types/trip.ts` +
 * `types/activity.ts` model. `lib/trips/convert.ts` bridges the two.
 */

export type PlanningActivityType =
  | 'museo'
  | 'restaurante'
  | 'templo'
  | 'parque'
  | 'barrio'
  | 'playa'
  | 'actividad'
  | 'traslado'

export type PlanningActivityEstado =
  | 'pendiente'
  | 'en_curso'
  | 'completada'
  | 'perdida'
  | 'recuperada'

export interface PlanningActivity {
  id: string
  nombre: string
  descripcion: string
  horaInicio: string
  horaFin: string
  duracionMinutos: number
  tipo: PlanningActivityType
  direccion: string
  lat: number
  lng: number
  radioGeofencingMetros: number
  precioEstimado: number
  reservaRequerida: boolean
  reservaPagada: boolean
  mejorHoraVisita: string
  consejos: string[]
  linkAfiliado?: string
  tiempoHastaSiguiente: number
  estado: PlanningActivityEstado
  esPerdida: boolean
  reagendadaDesdeDia?: number
  tiempoEmbarqueMinutos?: number
  puertoCrucero?: boolean
}

export interface PlanningDay {
  numero: number
  titulo: string
  descripcion: string
  ciudad: string
  actividades: PlanningActivity[]
  presupuestoDia: number
  colorMapa: string
}

export type Paquete = 'basico' | 'confort' | 'premium'
export type Moneda = 'USD' | 'EUR' | 'DOP'

export interface PlanningTrip {
  id: string
  destino: string
  origen: string
  personas: number
  fechaInicio: string
  fechaFin: string
  presupuestoTotal: number
  presupuestoPorPersona: number
  dias: PlanningDay[]
  paquete: Paquete
  resumenViaje: string
  consejos: string[]
  advertencias: string[]
  listaActividades: string[]
  actividadesPendientes: PlanningActivity[]
}

export interface WeatherData {
  temp: number
  description: string
  humidity: number
  windSpeed: number
  icon: string
}

export interface GenerateResult {
  basico: PlanningTrip
  confort: PlanningTrip
  premium: PlanningTrip
  weather: WeatherData | null
}

export interface TripFormValues {
  destino: string
  destinoSorpresa: boolean
  origen: string
  personas: number
  fechaInicio: string
  fechaFin: string
  presupuesto: number
  moneda: Moneda
  tipo:
    | 'aventura'
    | 'relax'
    | 'cultura'
    | 'familia'
    | 'crucero'
    | 'romantico'
    | 'gastronomia'
  paquete: Paquete
}

export type ConflictSeverity = 'critico' | 'advertencia' | 'sugerencia' | 'info'

export interface Conflict {
  id: string
  tipo: string
  severidad: ConflictSeverity
  titulo: string
  descripcion: string
  actividadesAfectadas: { nombre: string }[]
  soluciones: { label: string; descripcion: string }[]
}

// ── Database rows (Supabase) ────────────────────────────────────────────────

export interface TripRow {
  id: string
  user_id: string
  data: PlanningTrip
  paquete: Paquete
  grupo_link: string | null
  estado: 'planificando' | 'en_viaje' | 'completado'
  actividades_pendientes: PlanningActivity[]
  created_at: string
  updated_at: string
}

export interface TripMemberRow {
  id: string
  trip_id: string
  user_id: string
  nombre: string
  avatar_url: string | null
  lat_actual: number | null
  lng_actual: number | null
  ultima_ubicacion: string | null
  joined_at: string
}

export interface GroupMessageRow {
  id: string
  trip_id: string
  user_id: string
  nombre_usuario: string
  mensaje: string
  tipo: 'mensaje' | 'sistema' | 'alerta'
  created_at: string
}

export interface GroupExpenseRow {
  id: string
  trip_id: string
  pagado_por: string
  nombre_pagador: string
  concepto: string
  monto: number
  entre_todos: boolean
  created_at: string
}

export interface ActivityVoteRow {
  id: string
  trip_id: string
  activity_id: string
  user_id: string
  voto: boolean
  created_at: string
}

export type PlanTier = 'free' | 'pro' | 'grupo'
