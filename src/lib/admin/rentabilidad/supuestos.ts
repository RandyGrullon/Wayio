import 'server-only'
import { z } from 'zod'
import { CUPO_GRATIS } from '@/constants/planes'
import { tarifaModelo } from '@/lib/ai/pricing'
import {
  CANALES_COBRO,
  ESCENARIOS_IA,
  MODELOS_ESCENARIO,
  PERFILES_USO,
  PERIODICIDADES,
  type CanalCobro,
  type ComisionCanal,
  type CostoFijo,
  type DatosRentabilidad,
  type EstadoSupuestos,
  type Referencias,
  type Supuestos,
} from '@/lib/rentabilidad/tipos'

/**
 * Valores por defecto de la calculadora de rentabilidad (solo el dueño).
 *
 * 'server-only': estas cifras del negocio (comisiones, costos fijos,
 * perfiles) NUNCA deben ir en un módulo que importe un componente cliente,
 * porque acabarían en un chunk JS público de /_next/static. Llegan a la isla
 * como props de la página, después de requireOwner().
 *
 * Fuente de TODAS las cifras: informe «Wayio IA cobros y servicios gratis»
 * (C:\Users\rgrullon\code\Wayio\reports), con tarifas leídas el 17-oct-2026
 * en las páginas oficiales de cada proveedor. Son estimaciones: revisarlas
 * cuando cambie una tarifa. Lo guardado por el dueño (admin_private_settings,
 * clave 'rentabilidad_supuestos') manda sobre esto.
 */

export const CLAVE_SUPUESTOS = 'rentabilidad_supuestos'

const FUENTE =
  'Informe «Wayio IA cobros y servicios gratis» (tarifas leídas el 17-oct-2026)'

/** Mínimo de acciones reales en el periodo para usar su costo medio. */
const MIN_ACCIONES_REALES = 5

// ─── Comisiones por canal (informe, «Sin Stripe en RD…», 17-oct-2026) ─────

const COMISIONES: Record<CanalCobro, ComisionCanal> = {
  // Creem: 3,9 % + 0,40, sin recargo internacional. Paga los días 1 y 15
  // cobrando US$7 o el 1 % por pago, lo que sea mayor.
  creem: {
    pct: 3.9,
    pctRecurrente: 0,
    fijo: 0.4,
    retiroMinimo: 7,
    retiroPct: 1,
    retirosMes: 2,
  },
  // Paddle: 5 % + 0,50 (pide tarifa a medida para productos de menos de
  // US$10). Pago mensual con posible cargo SWIFT de US$15.
  paddle: {
    pct: 5,
    pctRecurrente: 0,
    fijo: 0.5,
    retiroMinimo: 15,
    retiroPct: 0,
    retirosMes: 1,
  },
  // Dodo: 4 % + 0,40, +1,5 % tarjeta internacional, +0,5 % suscripciones.
  // Transferencia SWIFT en dólares: US$25.
  dodo: {
    pct: 5.5,
    pctRecurrente: 0.5,
    fijo: 0.4,
    retiroMinimo: 25,
    retiroPct: 0,
    retirosMes: 1,
  },
  // PayPal RD: 5,40 % + 0,30 (procesador, no MoR). Retiro en dólares: 0,5 %
  // con mínimo de US$10.
  paypal: {
    pct: 5.4,
    pctRecurrente: 0,
    fijo: 0.3,
    retiroMinimo: 10,
    retiroPct: 0.5,
    retirosMes: 1,
  },
  // Stripe con LLC: 2,9 % + 0,30, +1,5 % internacional (60 % de clientes
  // fuera de EE. UU. = +0,9 %), +0,5 % Stripe Tax; +0,7 % Billing en las
  // suscripciones. La LLC (≈ US$1.000 al año) va como costo fijo aparte.
  stripe_llc: {
    pct: 4.3,
    pctRecurrente: 0.7,
    fijo: 0.3,
    retiroMinimo: 0,
    retiroPct: 0,
    retirosMes: 1,
  },
}

const NOTAS_CANAL: Record<CanalCobro, string> = {
  creem:
    'MoR; 3.9 % + US$0.40 sin recargo internacional; retiros los días 1 y 15 (US$7 o 1 %).',
  paddle:
    'MoR; 5 % + US$0.50 (pide tarifa para productos de menos de US$10); SWIFT US$15.',
  dodo: 'MoR; 4 % + US$0.40, +1.5 % internacional y +0.5 % en suscripciones; SWIFT US$25.',
  paypal:
    'Procesador (no cobra impuestos por ti); retiro en dólares 0.5 % con mínimo US$10.',
  stripe_llc:
    'Exige LLC en EE. UU. (formulario 5472 cada año); 60 % de tarjetas extranjeras.',
}

/** Apple (Small Business Program) y Google: 15 %. */
const COMISION_TIENDA_PCT = 15

// ─── Costos fijos (informe, «Casi toda la infraestructura…») ──────────────

const COSTOS_FIJOS: CostoFijo[] = [
  { id: 'vercel', nombre: 'Vercel Pro', monto: 20, periodicidad: 'mes' },
  { id: 'supabase', nombre: 'Supabase Pro', monto: 25, periodicidad: 'mes' },
  {
    id: 'apple',
    nombre: 'Apple Developer',
    monto: 99,
    periodicidad: 'anio',
  },
  { id: 'google', nombre: 'Google Play', monto: 25, periodicidad: 'unico' },
  {
    id: 'dominio',
    nombre: 'Dominio .app (renovación)',
    monto: 14.2,
    periodicidad: 'anio',
  },
  {
    id: 'geoapify',
    nombre: 'Geoapify (Free 0 · de pago 59)',
    monto: 0,
    periodicidad: 'mes',
  },
  {
    id: 'resend',
    nombre: 'Resend (Free 0 · Pro 20)',
    monto: 0,
    periodicidad: 'mes',
  },
  {
    id: 'sentry',
    nombre: 'Sentry (Free 0 · Team 29)',
    monto: 0,
    periodicidad: 'mes',
  },
  {
    id: 'eas',
    nombre: 'EAS de Expo (Free 0 · Starter 19)',
    monto: 0,
    periodicidad: 'mes',
  },
  { id: 'upstash', nombre: 'Upstash Redis', monto: 0, periodicidad: 'mes' },
  {
    id: 'llc',
    nombre: 'LLC en EE. UU. (solo con Stripe, ≈ 1,000 al año)',
    monto: 0,
    periodicidad: 'anio',
  },
  { id: 'otros', nombre: 'Otros', monto: 0, periodicidad: 'mes' },
]

// ─── IA (informe, «Opus cuesta cuarenta veces más que Haiku…») ────────────

/**
 * Usuario típico al mes: 1 viaje de 5 días + 1 «Otra versión» + 3 ajustes.
 * Intenso: 4 viajes con su «Otra versión» + 10 ajustes. «Otra versión»
 * cuenta como un viaje nuevo (igual que el cupo). El informe no incluye
 * fotos ni videos en los perfiles.
 */
const PERFILES_INFORME: Referencias['perfilesInforme'] = {
  tipico: { generar: 2, ajustar: 3, analizar: 0 },
  intenso: { generar: 8, ajustar: 10, analizar: 0 },
}

/**
 * Costo por acción, tope de cada rango del informe (como hace él para los
 * márgenes): viaje de 5 días, ajuste de un viaje de 5 días y foto (el video
 * está apagado en producción; con video serían 0.08–0.24 en Opus). Sonnet =
 * 0.5 × Opus y Haiku = 0.025 × Opus exactos con la misma mezcla de tokens;
 * Groq, de la tabla del informe (foto estimada con la misma proporción).
 */
const COSTO_ACCION_INFORME: Referencias['costoAccionInforme'] = {
  opus: { generar: 0.33, ajustar: 0.17, analizar: 0.03 },
  sonnet: { generar: 0.17, ajustar: 0.09, analizar: 0.015 },
  haiku: { generar: 0.008, ajustar: 0.004, analizar: 0.00075 },
  groq: { generar: 0.011, ajustar: 0.006, analizar: 0.001 },
}

// ─── Esquema (zod) ────────────────────────────────────────────────────────

const numero = (min: number, max: number) => z.number().min(min).max(max)
const entero = (min: number, max: number) => z.number().int().min(min).max(max)

const esquemaComision = z.object({
  pct: numero(0, 50),
  pctRecurrente: numero(0, 20),
  fijo: numero(0, 20),
  retiroMinimo: numero(0, 1000),
  retiroPct: numero(0, 20),
  retirosMes: entero(0, 31),
})

const esquemaCostoFijo = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[a-z0-9_-]{1,40}$/i),
  nombre: z.string().trim().min(1).max(60),
  monto: numero(0, 100_000),
  periodicidad: z.enum(PERIODICIDADES),
})

/** Lo que guarda la server action (y lo que se acepta al leer). */
export const esquemaSupuestos = z.object({
  version: z.literal(1),
  canal: z.enum(CANALES_COBRO),
  comisiones: z.object({
    creem: esquemaComision,
    paddle: esquemaComision,
    dodo: esquemaComision,
    paypal: esquemaComision,
    stripe_llc: esquemaComision,
  }),
  comisionTiendaPct: numero(0, 50),
  ventasTiendasPct: numero(0, 100),
  costosFijos: z
    .array(esquemaCostoFijo)
    .max(40)
    .refine((l) => new Set(l.map((c) => c.id)).size === l.length, {
      message: 'Hay dos costos fijos con el mismo id.',
    }),
  conversionPct: numero(0, 100),
  usuariosActivos: entero(0, 10_000_000),
  mezcla: z.object({
    pro_mensual: numero(0, 100),
    pro_anual: numero(0, 100),
    pro_por_viaje: numero(0, 100),
    pro_grupo: numero(0, 100),
  }),
  escenario: z.enum(ESCENARIOS_IA),
  perfil: z.enum(PERFILES_USO),
  fuenteCosto: z.enum(['real', 'informe']),
  cupo: z.object({
    generar: entero(0, 1000),
    ajustar: entero(0, 1000),
    analizar: entero(0, 1000),
  }),
  afiliadosPorUsuario: numero(0, 1000),
  impuestoVentasPct: numero(0, 50),
  retencionExteriorPct: numero(0, 50),
  isrPct: numero(0, 50),
  margenObjetivoPct: numero(0, 95),
})

/** Comprobación en tiempo de compilación: el esquema produce Supuestos. */
const _forma: (s: z.infer<typeof esquemaSupuestos>) => Supuestos = (s) => s
void _forma

// ─── Por defecto, fusión y referencias ────────────────────────────────────

/**
 * Supuestos por defecto. El modelo es el de producción y el perfil, el real
 * si ya hay datos de uso; lo demás sale del informe (conversión del 3 % y
 * 1,000 usuarios activos: el escenario de su última sección).
 */
export function supuestosPorDefecto(datos: DatosRentabilidad): Supuestos {
  const uso =
    datos.contadores.disponible && datos.contadores.uso
      ? datos.contadores.uso
      : datos.periodos['30d'].uso
  const hayUsoReal = uso.porTier.pago.usuarios + uso.porTier.gratis.usuarios > 0
  return {
    version: 1,
    canal: 'creem',
    comisiones: structuredClone(COMISIONES),
    comisionTiendaPct: COMISION_TIENDA_PCT,
    ventasTiendasPct: 0,
    costosFijos: structuredClone(COSTOS_FIJOS),
    conversionPct: 3,
    usuariosActivos: 1000,
    mezcla: { pro_mensual: 60, pro_anual: 30, pro_por_viaje: 10, pro_grupo: 0 },
    escenario: datos.modeloActual.escenario ?? 'opus',
    perfil: hayUsoReal ? 'real' : 'tipico',
    fuenteCosto: 'real',
    cupo: { ...CUPO_GRATIS },
    afiliadosPorUsuario: 0,
    impuestoVentasPct: 0,
    retencionExteriorPct: 0,
    isrPct: 0,
    margenObjetivoPct: 50,
  }
}

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Supuestos guardados completados con los por defecto (un campo nuevo que no
 * existía al guardar toma su valor por defecto). Si lo guardado no es válido,
 * se usan los por defecto y se avisa.
 */
export function resolverSupuestos(
  guardado: unknown,
  porDefecto: Supuestos
): { supuestos: Supuestos; estado: EstadoSupuestos } {
  if (!esObjeto(guardado)) {
    return { supuestos: porDefecto, estado: 'por_defecto' }
  }
  const fusion: Record<string, unknown> = { ...porDefecto, ...guardado }
  for (const clave of ['mezcla', 'cupo'] as const) {
    const g = guardado[clave]
    if (esObjeto(g)) fusion[clave] = { ...porDefecto[clave], ...g }
  }
  const comisiones = guardado['comisiones']
  if (esObjeto(comisiones)) {
    fusion['comisiones'] = Object.fromEntries(
      CANALES_COBRO.map((c) => {
        const g = comisiones[c]
        return [
          c,
          esObjeto(g)
            ? { ...porDefecto.comisiones[c], ...g }
            : porDefecto.comisiones[c],
        ]
      })
    )
  }
  const res = esquemaSupuestos.safeParse(fusion)
  return res.success
    ? { supuestos: res.data, estado: 'guardados' }
    : { supuestos: porDefecto, estado: 'invalidos' }
}

export function referencias(): Referencias {
  const tarifas = Object.fromEntries(
    ESCENARIOS_IA.map((e) => {
      const t = tarifaModelo(MODELOS_ESCENARIO[e].principal)
      return [e, t ? { entrada: t.input, salida: t.output } : null]
    })
  ) as Referencias['tarifas']
  return {
    perfilesInforme: PERFILES_INFORME,
    costoAccionInforme: COSTO_ACCION_INFORME,
    tarifas,
    minAccionesReales: MIN_ACCIONES_REALES,
    notasCanal: NOTAS_CANAL,
    fuente: FUENTE,
  }
}
