/**
 * Planes, precios y cupos de la app. Es una COPIA A MANO del catálogo público
 * de la web (src/constants/planes.ts y src/constants/pricing.ts): el móvil no
 * comparte código con la web, así que si allí cambia un precio, un cupo o un
 * nombre, hay que cambiarlo también aquí. Nunca pongas costos ni márgenes.
 */

/** Planes de pago configurados en el cobro (Stripe). */
export type PlanId = 'pro_mensual' | 'pro_anual' | 'pro_por_viaje' | 'pro_grupo'

/** Acciones de IA con cupo mensual en el plan Gratis. */
export type AccionConCupo = 'generar' | 'ajustar' | 'analizar'

export const ACCIONES_CON_CUPO: readonly AccionConCupo[] = [
  'generar',
  'ajustar',
  'analizar',
]

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

/** Texto corto de cada acción con cupo (mensajes de límite). */
export const NOMBRE_ACCION: Record<
  AccionConCupo,
  { uno: string; varios: string }
> = {
  generar: { uno: 'viaje', varios: 'viajes' },
  ajustar: { uno: 'ajuste con IA', varios: 'ajustes con IA' },
  analizar: { uno: 'foto o video', varios: 'fotos o videos' },
}

/** Rótulo de cada acción en el uso del mes de la pantalla de planes. */
export const ETIQUETA_USO: Record<AccionConCupo, string> = {
  generar: 'Viajes con IA',
  ajustar: 'Ajustes con IA',
  analizar: 'Fotos o videos',
}

/** Cuándo se renueva el cupo del plan Gratis. */
export const RENOVACION_CUPO =
  'Los cupos se renuevan el día 1 de cada mes a las 00:00 (hora de RD).'

/** Días que dura el «Pase Pro de 30 días» (el pago lo activa 30 días). */
export const DIAS_PASE = 30

/** Nombre comercial que ve el cliente. */
export const NOMBRE_PLAN: Record<PlanId | 'free', string> = {
  free: 'Gratis',
  pro_mensual: 'Pro mensual',
  pro_anual: 'Pro anual',
  pro_por_viaje: 'Pase Pro de 30 días',
  pro_grupo: 'Pro Grupo',
}

export interface Plan {
  id: PlanId
  nombre: string
  /** Precio en US$. */
  precio: number
  /** «al mes», «al año», «pago único». */
  periodo: string
  /** Qué compra exactamente (renovación, duración). */
  detalle: string
  /** Ahorro frente al mensual, si lo hay («40 %»). */
  ahorro: string | null
  destacado: boolean
}

/**
 * Planes A LA VENTA, en el orden del catálogo. `pro_grupo` sigue configurado
 * en el cobro, pero está oculto hasta que entregue algo distinto de Pro
 * (decisión 2026-10-17): quien ya lo tenga lo sigue viendo como su plan.
 */
export const PLANS: readonly Plan[] = [
  {
    id: 'pro_mensual',
    nombre: NOMBRE_PLAN.pro_mensual,
    precio: 6.99,
    periodo: 'al mes',
    detalle: 'Se renueva cada mes. Cancelas cuando quieras.',
    ahorro: null,
    destacado: false,
  },
  {
    id: 'pro_anual',
    nombre: NOMBRE_PLAN.pro_anual,
    precio: 49.99,
    periodo: 'al año',
    detalle: 'Un solo cobro al año. Se renueva cada año.',
    ahorro: '40 %',
    destacado: true,
  },
  {
    id: 'pro_por_viaje',
    nombre: NOMBRE_PLAN.pro_por_viaje,
    precio: 4.99,
    periodo: 'pago único',
    detalle: `Pro durante ${DIAS_PASE} días en toda tu cuenta. No se renueva.`,
    ahorro: null,
    destacado: false,
  },
]

/** Lo que trae el plan Gratis (con cuenta), con sus cupos del mes. */
export const FREE_FEATURES: readonly string[] = [
  `${CUPO_GRATIS.generar} viajes con IA al mes, cada uno en tres versiones`,
  `${CUPO_GRATIS.ajustar} ajustes con IA al mes`,
  `${CUPO_GRATIS.analizar} fotos o videos al mes para crear un viaje`,
  'Modo sin conexión, exportar en PDF e historial de tus viajes',
  'Sala del grupo con votos, chat, gastos y ubicación',
  'Ubicación en vivo, avisos al llegar y alertas básicas de demora',
  'Reagendar lo que te pierdas eligiendo tú el nuevo hueco',
]

/** Lo que Pro AÑADE de verdad sobre Gratis (el servidor lo aplica). */
export const PRO_FEATURES: readonly string[] = [
  'Viajes con IA sin límite*',
  'Ajustes con IA sin límite*',
  'Viajes desde fotos o videos sin límite*',
  'Alertas de demora con análisis de IA',
  'Reagendar con IA: te propone la mejor hora para lo que te pierdas',
]

/** Aclaración del asterisco de «sin límite». */
export const NOTA_USO_JUSTO =
  '*Sin límite con uso justo: para proteger el servicio hay topes por hora y por día que alguien planificando y viajando no alcanza.'
