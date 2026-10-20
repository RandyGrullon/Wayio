import type { PlanKey } from './pricing'

/**
 * Catálogo PÚBLICO de planes: fuente única para la página de planes, los
 * cupos que aplica el servidor (src/lib/planes/cupo.ts) y la copia de la app
 * móvil (mobile/src/constants/pricing.ts). Este módulo llega al navegador:
 * NUNCA pongas aquí costos, comisiones ni márgenes (esos viven en módulos
 * 'server-only' del panel admin).
 */

/** Acciones de IA con cupo mensual en el plan Gratis. */
export type AccionConCupo = 'generar' | 'ajustar' | 'analizar'

/**
 * Cupo mensual del plan Gratis (con cuenta). Se renueva el día 1 a las 00:00
 * de RD. «Otra versión» y «Reintentar» cuentan como un viaje nuevo; los viajes
 * que salen de la caché o del modo demo no gastan cupo.
 */
export const CUPO_GRATIS: Record<AccionConCupo, number> = {
  generar: 2,
  ajustar: 5,
  analizar: 3,
}

/** Texto corto de cada acción con cupo, para mensajes y la página de planes. */
export const NOMBRE_ACCION: Record<
  AccionConCupo,
  { uno: string; varios: string }
> = {
  generar: { uno: 'viaje', varios: 'viajes' },
  ajustar: { uno: 'ajuste con IA', varios: 'ajustes con IA' },
  analizar: { uno: 'foto o video', varios: 'fotos o videos' },
}

/** Funciones de IA reservadas a Pro (el servidor las aplica). */
export const SOLO_PRO = ['alertas_ia', 'reagendar_ia'] as const
export type FuncionPro = (typeof SOLO_PRO)[number]

/**
 * Planes que se venden hoy. `pro_grupo` sigue configurado en el cobro, pero
 * está oculto hasta que entregue algo distinto de Pro (decisión 2026-10-17).
 */
export const PLANES_A_LA_VENTA: readonly PlanKey[] = [
  'pro_mensual',
  'pro_anual',
  'pro_por_viaje',
]

/** Nombre comercial que ve el cliente. */
export const NOMBRE_PLAN: Record<PlanKey | 'free', string> = {
  free: 'Gratis',
  pro_mensual: 'Pro mensual',
  pro_anual: 'Pro anual',
  pro_por_viaje: 'Pase Pro de 30 días',
  pro_grupo: 'Pro Grupo',
}

/** Días que dura el pase (el webhook lo activa 30 días desde el pago). */
export const DIAS_PASE = 30

/** Fila de la comparativa Gratis vs Pro de la página de planes. */
export interface FilaComparativa {
  funcion: string
  /** true = incluido, false = no incluido, texto = incluido con matiz. */
  gratis: boolean | string
  pro: boolean | string
  nota?: string
}

/** Comparativa honesta: solo lo que el producto entrega y aplica de verdad. */
export const COMPARATIVA: readonly FilaComparativa[] = [
  {
    funcion: 'Itinerarios con IA en tres versiones',
    gratis: `${CUPO_GRATIS.generar} al mes`,
    pro: 'Sin límite*',
  },
  {
    funcion: 'Ajustes con IA',
    gratis: `${CUPO_GRATIS.ajustar} al mes`,
    pro: 'Sin límite*',
  },
  {
    funcion: 'Viajes desde una foto o un video',
    gratis: `${CUPO_GRATIS.analizar} al mes`,
    pro: 'Sin límite*',
  },
  {
    funcion: 'Escribir tu viaje a tu manera y que la IA lo entienda',
    gratis: true,
    pro: true,
  },
  {
    funcion: 'Mapa con rutas, horarios y presupuesto día a día',
    gratis: true,
    pro: true,
  },
  {
    funcion: 'Guardar, compartir e historial de tus viajes',
    gratis: true,
    pro: true,
  },
  { funcion: 'Modo sin conexión y exportar en PDF', gratis: true, pro: true },
  {
    funcion: 'Sala de grupo con votos, chat, gastos y ubicación',
    gratis: true,
    pro: true,
  },
  {
    funcion: 'Ubicación en vivo y avisos al llegar (app móvil)',
    gratis: true,
    pro: true,
  },
  { funcion: 'Alertas básicas de demora', gratis: true, pro: true },
  { funcion: 'Alertas de demora con análisis de IA', gratis: false, pro: true },
  {
    funcion: 'Reagendar con IA lo que te pierdas',
    gratis: false,
    pro: true,
    nota: 'En Gratis eliges tú el nuevo hueco.',
  },
  {
    funcion: 'Enlaces de reserva con nuestros socios',
    gratis: true,
    pro: true,
  },
]

/** Aclaración del asterisco de «Sin límite». */
export const NOTA_USO_JUSTO =
  '*Sin límite con uso justo: para proteger el servicio hay topes por hora y por día que alguien planificando y viajando no alcanza.'
