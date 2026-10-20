import type { AccionConCupo } from '@/constants/planes'
import type { PlanKey } from '@/constants/pricing'

/**
 * Tipos de la calculadora de rentabilidad del panel (solo el dueño).
 *
 * Este módulo y calculo.ts llegan al navegador (los importa la isla cliente):
 * aquí van solo FORMAS, nombres e ids públicos de modelos. Las cifras del
 * negocio (comisiones, costos fijos, perfiles del informe) viven en
 * src/lib/admin/rentabilidad/supuestos.ts ('server-only') y llegan a la isla
 * como props, tras requireOwner.
 */

// ─── Escenarios de IA ─────────────────────────────────────────────────────

export const ESCENARIOS_IA = ['opus', 'sonnet', 'haiku', 'groq'] as const
export type EscenarioIa = (typeof ESCENARIOS_IA)[number]
export type PorEscenario<T> = Record<EscenarioIa, T>

/**
 * Modelos de cada escenario. `principal` hace el itinerario y el ajuste,
 * `vision` las fotos y los videos y `rapido` las tareas cortas (interpretar,
 * validar, reagendar, alertas y la consolidación del video), igual que
 * src/lib/ai/config.ts con AI_ITINERARY_MODEL / AI_VISION_MODEL /
 * AI_FAST_MODEL, o AI_PROVIDER=groq.
 */
export const MODELOS_ESCENARIO: PorEscenario<{
  nombre: string
  principal: string
  vision: string
  rapido: string
}> = {
  opus: {
    nombre: 'Opus 5.5',
    principal: 'claude-opus-5-5',
    vision: 'claude-opus-5-5',
    rapido: 'claude-haiku-5-5',
  },
  sonnet: {
    nombre: 'Sonnet 5.5',
    principal: 'claude-sonnet-5-5',
    vision: 'claude-sonnet-5-5',
    rapido: 'claude-haiku-5-5',
  },
  haiku: {
    nombre: 'Haiku 5.5',
    principal: 'claude-haiku-5-5',
    vision: 'claude-haiku-5-5',
    rapido: 'claude-haiku-5-5',
  },
  groq: {
    nombre: 'Groq gpt-oss-120b',
    principal: 'openai/gpt-oss-120b',
    vision: 'qwen/qwen3.8-27b',
    rapido: 'openai/gpt-oss-120b',
  },
}

// ─── Familias de acciones de IA (ai_logs.endpoint) ────────────────────────

export const FAMILIAS_IA = [
  'generar',
  'ajustar',
  'foto_video',
  'interpretar',
  'validar',
  'reagendar',
  'alertas',
  'otros',
] as const
export type FamiliaIa = (typeof FAMILIAS_IA)[number]

export const NOMBRE_FAMILIA: Record<FamiliaIa, string> = {
  generar: 'Generar viaje',
  ajustar: 'Ajustar con IA',
  foto_video: 'Foto o video',
  interpretar: 'Interpretar texto',
  validar: 'Validar horarios',
  reagendar: 'Reagendar',
  alertas: 'Alertas',
  otros: 'Otras',
}

/** Familia de cada acción con cupo del plan Gratis. */
export const FAMILIA_DE_ACCION: Record<AccionConCupo, FamiliaIa> = {
  generar: 'generar',
  ajustar: 'ajustar',
  analizar: 'foto_video',
}

export const ACCIONES_CUPO: readonly AccionConCupo[] = [
  'generar',
  'ajustar',
  'analizar',
]

// ─── Grupos de usuarios ───────────────────────────────────────────────────

/**
 * pago: plan efectivo Pro o Grupo (cobrado, pase vigente o concedido a mano);
 * gratis: con cuenta y sin plan; anonimo: user_id null; equipo: role admin.
 */
export const GRUPOS_USUARIO = ['pago', 'gratis', 'anonimo', 'equipo'] as const
export type GrupoUsuario = (typeof GRUPOS_USUARIO)[number]

export const NOMBRE_GRUPO: Record<GrupoUsuario, string> = {
  pago: 'Pro (de pago o concedido)',
  gratis: 'Gratis',
  anonimo: 'Sin cuenta',
  equipo: 'Equipo (admins)',
}

export type TierUso = 'pago' | 'gratis'

// ─── Datos reales (los calcula el servidor) ───────────────────────────────

export interface Estadistica {
  media: number
  p50: number
  p90: number
}

export interface FamiliaReal {
  familia: FamiliaIa
  llamadas: number
  /** Acciones aproximadas (ai_logs no guarda un id de acción). */
  acciones: number
  tokensEntrada: number
  tokensSalida: number
  /** Llamadas cortadas por max_tokens (su costo sí cuenta). */
  truncadas: number
  /** Suma de ai_logs.cost_usd (precio del día en que se registró). */
  costoReal: number
  porAccionReal: Estadistica
  /** Costo recalculado desde los tokens con los modelos de cada escenario. */
  porEscenario: PorEscenario<{ total: number; porAccion: Estadistica }>
}

export interface GrupoReal {
  llamadas: number
  /** Personas distintas con alguna llamada (0 en «sin cuenta»). */
  usuariosConIa: number
  costoReal: number
  costoEscenario: PorEscenario<number>
}

/** Acciones con cupo por usuario y mes (por plan efectivo). */
export interface UsoPorUsuario {
  fuente: 'usage_counters' | 'ai_logs'
  /** «octubre de 2026 (en curso)» · «últimos 30 días». */
  etiqueta: string
  /** El periodo aún no ha terminado (los conteos seguirán subiendo). */
  parcial: boolean
  /**
   * Factor que lleva los conteos a un mes completo (mes en curso: duración
   * del mes ÷ lo transcurrido; periodo cerrado o 30 días: 1). Lo aplica el
   * perfil de uso «real»; la tabla muestra los conteos tal cual.
   */
  factorMes: number
  porTier: Record<
    TierUso,
    {
      /** Usuarios con al menos una acción en el periodo. */
      usuarios: number
      porAccion: Record<AccionConCupo, Estadistica>
    }
  >
}

export type ClavePeriodo = 'mes' | '30d'

export interface PeriodoReal {
  clave: ClavePeriodo
  etiqueta: string
  /** Inicio del periodo (ISO). Termina ahora. */
  desde: string
  /** Días del periodo transcurridos (con decimales). */
  dias: number
  /**
   * Factor que lleva un costo del periodo a un mes completo: en el mes en
   * curso, la duración del mes entre lo transcurrido; en 30 días, 1.
   */
  factorMes: number
  ia: {
    llamadas: number
    costoReal: number
    costoEscenario: PorEscenario<number>
    familias: FamiliaReal[]
    grupos: Record<GrupoUsuario, GrupoReal>
  }
  /** Usuarios activos aproximados (sin admins). */
  activos: {
    total: number
    pago: number
    gratis: number
    conIa: number
    conViajes: number
  }
  /** Acciones por usuario sacadas de ai_logs (aproximadas). */
  uso: UsoPorUsuario
}

export interface SuscriptoresReales {
  /** Suscripciones activas cobradas (Stripe), por plan. Sin admins. */
  recurrentes: Record<PlanKey, number>
  /** trialing o past_due: tienen acceso pero su cobro no se cuenta. */
  enGracia: number
  /** Pases de 30 días vigentes (≈ pases vendidos en los últimos 30 días). */
  pasesVigentes: number
  /** Planes concedidos a mano y vigentes: no suman ingreso. */
  concedidos: number
}

export interface ModeloActual {
  proveedor: string
  principal: string
  vision: string
  rapido: string
  /** Escenario que corresponde al modelo principal de hoy (null si ninguno). */
  escenario: EscenarioIa | null
}

export type EstadoSupuestos =
  | 'guardados'
  | 'por_defecto'
  | 'sin_tabla'
  | 'invalidos'

export interface DatosRentabilidad {
  generadoEn: string
  periodos: Record<ClavePeriodo, PeriodoReal>
  suscriptores: SuscriptoresReales
  /** usage_counters (migración 20261017130000): conteos exactos. */
  contadores: { disponible: boolean; uso: UsoPorUsuario | null }
  /** Alguna lectura llegó al tope de filas: los totales se quedan cortos. */
  truncado: boolean
  modeloActual: ModeloActual
  supuestos: { estado: EstadoSupuestos; actualizado: string | null }
}

// ─── Supuestos editables ──────────────────────────────────────────────────

export const CANALES_COBRO = [
  'creem',
  'paddle',
  'dodo',
  'paypal',
  'stripe_llc',
] as const
export type CanalCobro = (typeof CANALES_COBRO)[number]

export const NOMBRE_CANAL: Record<CanalCobro, string> = {
  creem: 'Creem',
  paddle: 'Paddle',
  dodo: 'Dodo Payments',
  paypal: 'PayPal RD',
  stripe_llc: 'Stripe (con LLC en EE. UU.)',
}

export interface ComisionCanal {
  /** % sobre el precio en cada cobro. */
  pct: number
  /** % adicional solo en suscripciones (Dodo, Stripe Billing). */
  pctRecurrente: number
  /** US$ fijos por cobro. */
  fijo: number
  /** Retiro: US$ mínimos por pago al banco. */
  retiroMinimo: number
  /** Retiro: % del importe de cada pago al banco. */
  retiroPct: number
  /** Pagos al banco por mes. */
  retirosMes: number
}

export const PERIODICIDADES = ['mes', 'anio', 'unico'] as const
export type Periodicidad = (typeof PERIODICIDADES)[number]

export interface CostoFijo {
  id: string
  nombre: string
  /** US$ por periodicidad (único = una vez, se reparte en 12 meses). */
  monto: number
  periodicidad: Periodicidad
}

export const PERFILES_USO = ['real', 'real_p90', 'tipico', 'intenso'] as const
export type PerfilUso = (typeof PERFILES_USO)[number]

export type FuenteCosto = 'real' | 'informe'

export interface Supuestos {
  version: 1
  canal: CanalCobro
  comisiones: Record<CanalCobro, ComisionCanal>
  /** Comisión de Apple y Google (Small Business Program: 15 %). */
  comisionTiendaPct: number
  /** % de los cobros que entran por las tiendas (compras integradas). */
  ventasTiendasPct: number
  costosFijos: CostoFijo[]
  /** % de los usuarios activos que pagan. */
  conversionPct: number
  /** Usuarios activos al mes de la proyección. */
  usuariosActivos: number
  /** Reparto de los suscriptores entre planes (%; se normaliza a 100). */
  mezcla: Record<PlanKey, number>
  escenario: EscenarioIa
  perfil: PerfilUso
  fuenteCosto: FuenteCosto
  cupo: Record<AccionConCupo, number>
  /** US$ de comisiones de afiliados por usuario activo al mes. */
  afiliadosPorUsuario: number
  /** Impuesto sobre las ventas (ITBIS, si aplica). Confirmar con contador. */
  impuestoVentasPct: number
  /** Retención sobre pagos al exterior (Ley 30-26). Confirmar con contador. */
  retencionExteriorPct: number
  /** ISR sobre la ganancia. Confirmar con contador. */
  isrPct: number
  /** Margen objetivo sobre el precio, para el precio mínimo de cada plan. */
  margenObjetivoPct: number
}

/** Valores de referencia del informe (server-only; llegan como props). */
export interface Referencias {
  /** Acciones al mes de los usuarios típico e intenso del informe. */
  perfilesInforme: Record<'tipico' | 'intenso', Record<AccionConCupo, number>>
  /** Costo por acción del informe con cada escenario (tope del rango). */
  costoAccionInforme: PorEscenario<Record<AccionConCupo, number>>
  /** Tarifa del modelo principal de cada escenario (US$ por millón). */
  tarifas: PorEscenario<{ entrada: number; salida: number } | null>
  /** Mínimo de acciones reales para usar su costo medio. */
  minAccionesReales: number
  /** Nota de una línea de cada canal (fuente del informe). */
  notasCanal: Record<CanalCobro, string>
  /** Cita del informe con su fecha. */
  fuente: string
}

/** Todo lo que la página pasa a la isla cliente. */
export interface PropsRentabilidad {
  datos: DatosRentabilidad
  /** Supuestos vigentes (guardados y completados con los por defecto). */
  supuestos: Supuestos
  porDefecto: Supuestos
  referencias: Referencias
}
