import 'server-only'
import type { PostgrestError } from '@supabase/supabase-js'
import { requireOwner } from '@/lib/admin/dueno'
import { clasificarError } from '@/lib/admin/errores'
import { aiModel, aiProvider } from '@/lib/ai/config'
import type { PropsRentabilidad } from '@/lib/rentabilidad/tipos'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  construirDatos,
  rangosRD,
  type FilaContador,
  type FilaIa,
  type FilaViaje,
  type ModelosVigentes,
  type SubRentabilidad,
} from './agregar'
import {
  CLAVE_SUPUESTOS,
  referencias,
  resolverSupuestos,
  supuestosPorDefecto,
} from './supuestos'

/**
 * Datos reales de la calculadora de rentabilidad (/admin/rentabilidad).
 * Solo el dueño: requireOwner() al principio (patrón DAL de auth.ts). Lee con
 * la service role las columnas mínimas desde el inicio del periodo más
 * antiguo (mes en curso de RD o últimos 30 días) y agrega en memoria
 * (PostgREST no hace GROUP BY): agregar.ts.
 */

/** PostgREST corta cada respuesta en 1,000 filas (max-rows de Supabase). */
const LOTE = 1000
/** Tope de filas por tabla; si se alcanza, la página lo avisa. */
const MAX_FILAS = 50_000

interface Respuesta {
  data: unknown
  error: PostgrestError | null
}

/** Error de lectura; `esquema` = falta la tabla o la columna (migración). */
class ErrorLectura extends Error {
  constructor(
    contexto: string,
    error: PostgrestError,
    readonly esquema: boolean
  ) {
    super(
      `No se pudo leer ${contexto} (${error.code || 'sin código'}): ${error.message}`
    )
  }
}

function comprobar(res: Respuesta, contexto: string): void {
  if (res.error) {
    throw new ErrorLectura(
      contexto,
      res.error,
      clasificarError(res.error) === 'esquema'
    )
  }
}

/**
 * Todas las filas por lotes de 1,000 hasta MAX_FILAS. A diferencia de la de
 * queries.ts, dice si se cortó (la calculadora lo avisa en pantalla). La
 * consulta debe ir ordenada y construirse de nuevo en cada llamada.
 */
async function todasConAviso<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<Respuesta>,
  contexto: string
): Promise<{ filas: T[]; truncado: boolean }> {
  const filas: T[] = []
  for (let desde = 0; desde < MAX_FILAS; desde += LOTE) {
    const res = await consulta(desde, desde + LOTE - 1)
    comprobar(res, contexto)
    const lote = Array.isArray(res.data) ? (res.data as T[]) : []
    filas.push(...lote)
    if (lote.length < LOTE) return { filas, truncado: false }
  }
  return { filas, truncado: true }
}

/** Ejecuta una lectura de una tabla nueva: null si aún no existe. */
async function siExiste<T>(lectura: () => Promise<T>): Promise<T | null> {
  try {
    return await lectura()
  } catch (e) {
    if (e instanceof ErrorLectura && e.esquema) return null
    throw e
  }
}

export async function getRentabilidad(): Promise<PropsRentabilidad> {
  await requireOwner()
  const admin = createAdminClient()
  const ahora = Date.now()
  const r = rangosRD(ahora)
  const desde = new Date(Math.min(r.inicioMes, r.inicio30)).toISOString()

  const [ia, viajes, subs, admins, contadores, guardado] = await Promise.all([
    todasConAviso<FilaIa>(
      (a, b) =>
        admin
          .from('ai_logs')
          .select(
            'user_id, model, endpoint, prompt_tokens, completion_tokens, cost_usd, error, created_at'
          )
          .gte('created_at', desde)
          .order('created_at')
          .order('id')
          .range(a, b),
      'el uso de IA'
    ),
    todasConAviso<FilaViaje>(
      (a, b) =>
        admin
          .from('trips')
          .select('user_id, updated_at')
          .gte('updated_at', desde)
          .order('updated_at')
          .order('id')
          .range(a, b),
      'los viajes del periodo'
    ),
    // select('*'): funciona con o sin la columna source (migración).
    todasConAviso<SubRentabilidad>(
      (a, b) =>
        admin
          .from('subscriptions')
          .select('*')
          .neq('plan_id', 'free')
          .order('created_at')
          .order('id')
          .range(a, b),
      'las suscripciones'
    ),
    todasConAviso<{ id: string }>(
      (a, b) =>
        admin
          .from('profiles')
          .select('id')
          .eq('role', 'admin')
          .order('id')
          .range(a, b),
      'los admins'
    ),
    siExiste(() =>
      todasConAviso<FilaContador>(
        (a, b) =>
          admin
            .from('usage_counters')
            .select('user_id, periodo, accion, usados')
            .in('periodo', [r.periodoPrevio, r.periodoActual])
            .order('user_id')
            .order('periodo')
            .order('accion')
            .range(a, b),
        'los contadores de uso'
      )
    ),
    siExiste(async () => {
      const res = await admin
        .from('admin_private_settings')
        .select('value, updated_at')
        .eq('key', CLAVE_SUPUESTOS)
        .maybeSingle()
      comprobar(res, 'los supuestos guardados')
      return (res.data ?? { value: null, updated_at: null }) as {
        value: unknown
        updated_at: string | null
      }
    }),
  ])

  const vigentes: ModelosVigentes = {
    proveedor: aiProvider(),
    principal: aiModel('itinerario'),
    vision: aiModel('vision'),
    rapido: aiModel('rapido'),
  }

  const datos = construirDatos({
    ahora,
    filasIa: ia.filas,
    viajes: viajes.filas,
    suscripciones: subs.filas,
    admins: admins.filas.map((p) => p.id),
    contadores: contadores?.filas ?? null,
    truncado:
      ia.truncado ||
      viajes.truncado ||
      subs.truncado ||
      Boolean(contadores?.truncado),
    vigentes,
    supuestos: {
      estado: guardado === null ? 'sin_tabla' : 'por_defecto',
      actualizado: guardado?.updated_at ?? null,
    },
  })

  const porDefecto = supuestosPorDefecto(datos)
  const { supuestos, estado } = resolverSupuestos(
    guardado?.value ?? null,
    porDefecto
  )
  if (guardado !== null) datos.supuestos.estado = estado

  return { datos, supuestos, porDefecto, referencias: referencias() }
}
