/**
 * Baja al final del periodo (y deshacerla) de una suscripción pagada en la
 * WEB (Creem o Stripe), como src/app/cuenta/CancelarSuscripcion.tsx:
 * POST /api/pagos/suscripcion { accion: 'cancelar' | 'reanudar' } con el
 * Bearer de la sesión (lib/api/http.ts). Las compras de App Store / Google
 * Play no pasan por aquí: se gestionan en la tienda.
 */
import { getSupabase } from '../supabase/client'
import { postJSON } from './http'

export type AccionSuscripcion = 'cancelar' | 'reanudar'

/** Suscripción recurrente web con acceso, la única que se cancela aquí. */
export interface SuscripcionWeb {
  /** Ya tiene la baja programada (cancel_at_period_end). */
  cancelaAlFinal: boolean
  /** Fin del periodo pagado (ISO), si se conoce. */
  finPeriodo: string | null
}

interface FilaSuscripcion {
  tier?: unknown
  status?: unknown
  source?: unknown
  stripe_customer_id?: unknown
  stripe_subscription_id?: unknown
  cancel_at_period_end?: unknown
  current_period_end?: unknown
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null
}

/**
 * ¿La cobra el pago web? Misma regla que proveedorDeFila
 * (src/lib/pagos/proveedor.ts): source 'creem'/'stripe'; cualquier otro
 * origen explícito (tiendas, 'admin'…) no; las filas antiguas o 'system' se
 * reconocen por el prefijo del cliente (Creem cust_…, Stripe cus_…).
 */
function esDelPagoWeb(fila: FilaSuscripcion): boolean {
  if (fila.source === 'creem' || fila.source === 'stripe') return true
  if (fila.source !== undefined && fila.source !== 'system') return false
  const cliente = texto(fila.stripe_customer_id) ?? ''
  if (cliente.startsWith('cust_') || cliente.startsWith('cus_')) return true
  return texto(fila.stripe_subscription_id) !== null
}

/**
 * Lee la fila de subscriptions del usuario (la RLS deja leer la propia) y
 * devuelve sus datos si es una suscripción recurrente web con acceso (la
 * misma condición que `recurrente` en src/app/cuenta/page.tsx y que
 * tieneRecurrenteActiva en el servidor). null si no aplica o no se pudo leer.
 */
export async function leerSuscripcionWeb(
  uid: string
): Promise<SuscripcionWeb | null> {
  try {
    const { data, error } = await getSupabase()
      .from('subscriptions')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle()
    if (error || !data) return null
    const fila = data as FilaSuscripcion
    const conAcceso =
      fila.status === 'active' ||
      fila.status === 'trialing' ||
      fila.status === 'past_due'
    if (
      !conAcceso ||
      fila.tier === 'free' ||
      !texto(fila.stripe_subscription_id) ||
      !esDelPagoWeb(fila)
    ) {
      return null
    }
    return {
      cancelaAlFinal: fila.cancel_at_period_end === true,
      finPeriodo: texto(fila.current_period_end),
    }
  } catch {
    return null
  }
}

interface RespuestaSuscripcion {
  ok?: boolean
  cancelaAlFinal?: boolean
  finPeriodo?: string | null
}

/**
 * Programa (`cancelar`) o deshace (`reanudar`) la baja al final del periodo.
 * Devuelve el estado nuevo. Lanza BackendError con el mensaje del servidor
 * (p. ej. 404 «No tienes una suscripción activa que cambiar.»).
 */
export async function cambiarSuscripcion(
  accion: AccionSuscripcion
): Promise<SuscripcionWeb> {
  const r = await postJSON<RespuestaSuscripcion>(
    '/api/pagos/suscripcion',
    { accion },
    { requiereSesion: true, timeoutMs: 30_000 }
  )
  return {
    cancelaAlFinal:
      typeof r.cancelaAlFinal === 'boolean'
        ? r.cancelaAlFinal
        : accion === 'cancelar',
    finPeriodo: texto(r.finPeriodo),
  }
}
