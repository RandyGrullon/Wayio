import 'server-only'

/**
 * Límites de uso POR CUENTA de las rutas de IA (beta). Se aplican con
 * `limitarIa` (src/lib/ai/routeKit.ts): un bucket por hora y otro por día,
 * siempre en producción y en desarrollo solo con RATE_LIMIT_ENFORCE=true
 * (`limitesActivos`, src/lib/security/rateLimit.ts).
 *
 * - Con Upstash los contadores son globales; sin él, por instancia.
 * - La ventana diaria de Upstash es fija y se alinea a UTC (se reinicia a las
 *   8:00 p. m. de RD); el tope GLOBAL de gasto (presupuesto.ts) sí cuenta por
 *   día de RD.
 * - `anonimo` solo se alcanza donde no se exige sesión (interpretar) o en
 *   modoLocalSinCuentas (desarrollo sin Supabase), donde todo es anónimo.
 */

export interface Cupo {
  conSesion: number
  anonimo: number
}

export interface LimitesIa {
  /** Ventana de 1 hora (frena ráfagas). */
  hora: Cupo
  /** Ventana de 24 h (frena el goteo de todo el día). */
  dia?: Cupo
}

/**
 * Generar itinerario: /api/generate y /api/generate/stream comparten bucket.
 * Es la llamada más cara (Opus 5.5, de 1 llamada en viajes de ≤3 días a ~16
 * o más en uno de 30). Una sesión de planificación normal son 1-3 viajes más
 * un par de «Otra versión»: 6/hora la cubre con margen; 20/día deja varias
 * sesiones y acota lo que una sola cuenta puede gastar en un día.
 */
export const LIMITES_GENERAR: LimitesIa = {
  hora: { conSesion: 6, anonimo: 6 },
  dia: { conSesion: 20, anonimo: 20 },
}

/**
 * Ajustar con IA (/api/adjust, Opus 5.5 con el itinerario completo como
 * entrada). Cada mensaje del chat es una llamada: 20/hora permite una tarde
 * de retoques seguidos; 60/día corta el uso automatizado.
 */
export const LIMITES_AJUSTAR: LimitesIa = {
  hora: { conSesion: 20, anonimo: 20 },
  dia: { conSesion: 60, anonimo: 60 },
}

/**
 * Interpretar texto libre (/api/interpret, Haiku 5.5, ~1 céntimo cada 5-10
 * llamadas). Sigue abierta a anónimos para no frenar la primera visita:
 * 20/hora por IP basta para escribir y reescribir la idea del viaje; con
 * cuenta, 60/hora.
 */
export const LIMITES_INTERPRETAR: LimitesIa = {
  hora: { conSesion: 60, anonimo: 20 },
}

/**
 * Recrear desde una foto (Opus 5.5 con visión + Haiku). Se suben pocas fotos
 * por viaje: 10/hora y 20/día.
 */
export const LIMITES_ANALIZAR_IMAGEN: LimitesIa = {
  hora: { conSesion: 10, anonimo: 10 },
  dia: { conSesion: 20, anonimo: 20 },
}

/**
 * Recrear desde un video: hasta 2 llamadas Opus con 10 fotogramas cada una,
 * más descarga y ffmpeg (CPU, disco y red). 5/hora y 10/día.
 */
export const LIMITES_ANALIZAR_VIDEO: LimitesIa = {
  hora: { conSesion: 5, anonimo: 5 },
  dia: { conSesion: 10, anonimo: 10 },
}
