import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { diaRD, horaRDaIso } from '@/lib/admin/horaRD'
import { createAdminClientSafe } from '@/lib/supabase/admin'

/**
 * Tope GLOBAL de gasto diario de IA (AI_DAILY_BUDGET_USD).
 *
 * - El día es el natural de República Dominicana (America/Santo_Domingo,
 *   UTC-4 fijo): el tope se reinicia a las 00:00 de RD, igual que el «Costo
 *   diario» del panel /admin/ai.
 * - El gasto sale de ai_logs.cost_usd (coste ESTIMADO con pricing.ts) vía la
 *   RPC ai_gasto_desde, cacheado 30 s por instancia. Como ai_logs se escribe
 *   con after() (al terminar cada respuesta), cada instancia suma además el
 *   coste de sus llamadas ya terminadas cuyo registro aún no ha visto la BD.
 * - Si hay tope pero no se puede leer el gasto (sin service role, sin la RPC,
 *   error de red), falla ABIERTO: deja pasar y avisa (consola y Sentry) como
 *   mucho una vez por hora por instancia. El tope es un freno de factura, no
 *   un control de acceso: preferimos no tumbar la app por un fallo de lectura.
 * - Las rutas comprueban el tope (1 ×) antes de gastar; aiGenerate tiene un
 *   corte duro a 1,25 × para frenar generaciones largas o concurrentes que ya
 *   habían pasado la comprobación de la ruta.
 */

export const MENSAJE_TOPE_DIARIO =
  'Wayio llegó a su límite de IA por hoy. Vuelve a intentarlo mañana.'

/** Variante para /api/adjust: el cliente ofrece editar a mano. */
export const MENSAJE_TOPE_DIARIO_AJUSTE =
  'Wayio llegó a su límite de IA por hoy. Puedes editar tu itinerario a mano.'

/**
 * Múltiplo del tope a partir del cual aiGenerate ya no llama al proveedor.
 * El 25 % de margen deja terminar lo que ya estaba en marcha (un viaje largo
 * son decenas de llamadas) sin dejar que la concurrencia dispare la factura.
 */
export const MARGEN_CORTE_DURO = 1.25

/** Vida del valor leído de la BD en cada instancia. */
const CACHE_MS = 30_000
/** Tiempo máximo de la lectura del gasto: no frena las rutas de IA. */
const LECTURA_TIMEOUT_MS = 3_000
/** Como mucho un aviso de «no se pudo leer el gasto» por hora y instancia. */
const AVISO_LECTURA_MS = 3_600_000
/**
 * Un gasto local sin confirmar en la BD se olvida pasado este tiempo (si el
 * after() de su registro se perdió o el insert falló, la BD nunca lo verá).
 * Cubre de sobra el maxDuration de 300 s de las rutas largas.
 */
const PENDIENTE_MAX_MS = 15 * 60_000
const PENDIENTES_MAX = 2_000

const DIA_MS = 86_400_000

export interface EstadoPresupuesto {
  /** Tope diario en USD, o null si no hay tope. */
  tope: number | null
  /** Gasto conocido de hoy (día de RD) en USD; null si no se pudo leer. */
  gastado: number | null
  /** true si hay tope y el gasto conocido lo alcanzó. */
  agotado: boolean
  /** Segundos hasta las 00:00 de RD (para Retry-After). */
  segundosHastaReinicio: number
}

/** Tope diario en USD (AI_DAILY_BUDGET_USD), o null si no hay tope. */
export function topeDiarioUsd(): number | null {
  const v = Number.parseFloat(process.env['AI_DAILY_BUDGET_USD']?.trim() ?? '')
  return Number.isFinite(v) && v > 0 ? v : null
}

// ─── Día de RD ────────────────────────────────────────────────────────────

/** Instante (ms) de las 00:00 de RD de un día 'YYYY-MM-DD'. */
function inicioDeDiaRD(dia: string): number {
  const iso = horaRDaIso(`${dia}T00:00`)
  // RD no tiene horario de verano: 00:00 de RD = 04:00 UTC.
  return Date.parse(iso ?? `${dia}T04:00:00.000Z`)
}

function diaSiguiente(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number)
  return new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1) + DIA_MS)
    .toISOString()
    .slice(0, 10)
}

/** Segundos que faltan para la próxima medianoche de RD (mínimo 1). */
export function segundosHastaReinicioRD(ahora: number = Date.now()): number {
  const fin = inicioDeDiaRD(diaSiguiente(diaRD(ahora)))
  return Math.max(1, Math.ceil((fin - ahora) / 1000))
}

// ─── Estado por instancia ─────────────────────────────────────────────────

interface Lectura {
  dia: string
  valor: number
  /** Cuándo EMPEZÓ la lectura que dio este valor. */
  leidoEn: number
}

interface GastoLocal {
  dia: string
  costo: number
  creado: number
  /** Cuándo terminó el insert en ai_logs (null si aún no). */
  escritoEn: number | null
}

let lectura: Lectura | null = null
let ultimoIntento: { dia: string; en: number } | null = null
let lecturaEnCurso: Promise<void> | null = null
const pendientes: GastoLocal[] = []
let ultimoAvisoLectura = 0
let diaAvisoTope = ''
let diaAvisoCorte = ''

function podarPendientes(leidoHasta: number | null, ahora: number): void {
  const hoy = diaRD(ahora)
  for (let i = pendientes.length - 1; i >= 0; i--) {
    const p = pendientes[i]
    if (!p) continue
    const yaEnLaBd =
      leidoHasta !== null && p.escritoEn !== null && p.escritoEn <= leidoHasta
    if (yaEnLaBd || p.dia !== hoy || ahora - p.creado > PENDIENTE_MAX_MS) {
      pendientes.splice(i, 1)
    }
  }
}

function gastoLocalPendiente(dia: string): number {
  let total = 0
  for (const p of pendientes) if (p.dia === dia) total += p.costo
  return total
}

/**
 * Suma el coste estimado de una llamada de IA ya terminada en esta instancia
 * (también las fallidas: abortos, timeouts y rechazos se facturan). Devuelve
 * la función que hay que llamar cuando su fila llegue DE VERDAD a ai_logs (a
 * partir de ahí la cuenta la lectura de la BD y no se suma dos veces); si el
 * insert falla no se llama y el coste sigue sumando hasta PENDIENTE_MAX_MS.
 */
export function registrarGastoLocal(costoUsd: number): () => void {
  if (!(costoUsd > 0) || topeDiarioUsd() === null) return () => undefined
  const ahora = Date.now()
  podarPendientes(null, ahora)
  if (pendientes.length >= PENDIENTES_MAX) pendientes.shift()
  const entrada: GastoLocal = {
    dia: diaRD(ahora),
    costo: costoUsd,
    creado: ahora,
    escritoEn: null,
  }
  pendientes.push(entrada)
  return () => {
    entrada.escritoEn = Date.now()
  }
}

// ─── Lectura del gasto ────────────────────────────────────────────────────

async function leerGastoDesde(desdeIso: string): Promise<number> {
  const admin = createAdminClientSafe()
  if (!admin) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')
  const { data, error } = await admin
    .rpc('ai_gasto_desde', { p_desde: desdeIso })
    .abortSignal(AbortSignal.timeout(LECTURA_TIMEOUT_MS))
  if (error) throw new Error(`RPC ai_gasto_desde: ${error.message}`)
  const valor = Number(data ?? 0)
  if (!Number.isFinite(valor))
    throw new Error('RPC ai_gasto_desde: no numérico')
  return valor
}

function avisarLecturaFallida(err: unknown): void {
  const ahora = Date.now()
  if (ahora - ultimoAvisoLectura < AVISO_LECTURA_MS) return
  ultimoAvisoLectura = ahora
  const detalle = err instanceof Error ? err.message : String(err)
  // eslint-disable-next-line no-console
  console.warn(
    `[wayio] ai-presupuesto: no se pudo leer el gasto de IA de hoy; el tope diario queda ABIERTO hasta poder leerlo (${detalle})`
  )
  Sentry.captureMessage('No se pudo leer el gasto diario de IA', {
    level: 'warning',
    tags: { area: 'ai-presupuesto' },
    extra: { detalle },
  })
}

async function refrescarSiHaceFalta(dia: string, ahora: number): Promise<void> {
  if (lectura?.dia === dia && ahora - lectura.leidoEn < CACHE_MS) return
  if (lecturaEnCurso) return lecturaEnCurso
  // Tras un intento fallido no se reintenta en cada petición.
  if (ultimoIntento?.dia === dia && ahora - ultimoIntento.en < CACHE_MS) return

  ultimoIntento = { dia, en: ahora }
  const enCurso = (async () => {
    const inicio = Date.now()
    try {
      const valor = await leerGastoDesde(
        new Date(inicioDeDiaRD(dia)).toISOString()
      )
      lectura = { dia, valor, leidoEn: inicio }
      podarPendientes(inicio, Date.now())
    } catch (err) {
      avisarLecturaFallida(err)
    } finally {
      lecturaEnCurso = null
    }
  })()
  lecturaEnCurso = enCurso
  return enCurso
}

function avisarUnaVezAlDia(
  tipo: 'tope' | 'corte',
  dia: string,
  gastado: number,
  tope: number
): void {
  if (tipo === 'tope') {
    if (diaAvisoTope === dia) return
    diaAvisoTope = dia
  } else {
    if (diaAvisoCorte === dia) return
    diaAvisoCorte = dia
  }
  Sentry.captureMessage(
    tipo === 'tope'
      ? 'Tope diario de IA alcanzado'
      : 'Corte duro del tope diario de IA',
    {
      level: 'warning',
      tags: { area: 'ai-presupuesto' },
      extra: { gastoUsd: gastado, topeUsd: tope, diaRD: dia },
    }
  )
}

/**
 * Estado del tope de hoy. Sin tope no consulta nada. Con tope lee el gasto
 * (caché de 30 s por instancia) y le suma el gasto local aún no registrado.
 */
export async function estadoPresupuesto(): Promise<EstadoPresupuesto> {
  const ahora = Date.now()
  const segundosHastaReinicio = segundosHastaReinicioRD(ahora)
  const tope = topeDiarioUsd()
  if (tope === null) {
    return { tope: null, gastado: null, agotado: false, segundosHastaReinicio }
  }

  const dia = diaRD(ahora)
  await refrescarSiHaceFalta(dia, ahora)
  // Si el último refresco falló se sigue usando la lectura de hoy, aunque
  // sea vieja: sigue siendo gasto conocido. Sin ninguna de hoy, abierto.
  if (lectura?.dia !== dia) {
    return { tope, gastado: null, agotado: false, segundosHastaReinicio }
  }

  const gastado = lectura.valor + gastoLocalPendiente(dia)
  const agotado = gastado >= tope
  if (agotado) avisarUnaVezAlDia('tope', dia, gastado, tope)
  return { tope, gastado, agotado, segundosHastaReinicio }
}

/** Para las rutas que degradan sin error (validate, alert-message…). */
export async function presupuestoAgotado(): Promise<boolean> {
  return (await estadoPresupuesto()).agotado
}

/**
 * Corte duro de aiGenerate: true si el gasto conocido ya pasó
 * MARGEN_CORTE_DURO × tope. Con el gasto sin leer, falla abierto (false).
 */
export async function corteDuroAlcanzado(): Promise<boolean> {
  const e = await estadoPresupuesto()
  if (e.tope === null || e.gastado === null) return false
  const alcanzado = e.gastado >= MARGEN_CORTE_DURO * e.tope
  if (alcanzado)
    avisarUnaVezAlDia('corte', diaRD(Date.now()), e.gastado, e.tope)
  return alcanzado
}

/**
 * 429 del contrato para las rutas que bloquean (generate, stream, interpret,
 * analyze-video): {error, code:'tope_diario', retryAfter} + Retry-After hasta
 * las 00:00 de RD.
 */
export function respuestaTopeDiario(
  estado?: Pick<EstadoPresupuesto, 'segundosHastaReinicio'>
): Response {
  const retryAfter = estado?.segundosHastaReinicio ?? segundosHastaReinicioRD()
  return Response.json(
    { error: MENSAJE_TOPE_DIARIO, code: 'tope_diario', retryAfter },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'Cache-Control': 'no-store',
      },
    }
  )
}

/** La respuesta 429 del tope si está agotado; null si se puede seguir. */
export async function bloqueoPorTopeDiario(): Promise<Response | null> {
  const estado = await estadoPresupuesto()
  return estado.agotado ? respuestaTopeDiario(estado) : null
}
