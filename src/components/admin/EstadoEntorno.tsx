import 'server-only'
import { AlertTriangle, CheckCircle2, MinusCircle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { aiConfigured, aiProvider } from '@/lib/ai/config'
import { topeDiarioUsd } from '@/lib/ai/presupuesto'
import {
  isStripeConfigured,
  isStripeWebhookConfigured,
  reservasHabilitadas,
} from '@/lib/stripe/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { ETIQUETA_PROVEEDOR_IA, usd } from './etiquetas'

type Estado = 'ok' | 'falta' | 'apagado'

interface Fila {
  nombre: string
  detalle: string
  estado: Estado
}

const hay = (nombre: string) => Boolean(process.env[nombre]?.trim())

/** Misma regla que videoAnalysisEnabled() (src/lib/ai/analyzeVideo.ts). */
function videoActivo(): boolean {
  const v = process.env['VIDEO_ANALYSIS_ENABLED']?.trim().toLowerCase()
  if (v === 'true' || v === '1') return true
  if (v === 'false' || v === '0') return false
  return process.env.NODE_ENV !== 'production'
}

function filas(): Fila[] {
  const proveedor = aiProvider()
  // El tope no es secreto: se muestra el monto.
  const tope = topeDiarioUsd()
  return [
    {
      nombre: 'Base de datos',
      detalle: 'Cuentas, viajes y grupos (Supabase)',
      estado: isSupabaseConfigured() ? 'ok' : 'falta',
    },
    {
      nombre: 'Clave de servicio',
      detalle: 'La usan este panel y el webhook de pagos',
      estado: hay('SUPABASE_SERVICE_ROLE_KEY') ? 'ok' : 'falta',
    },
    {
      nombre: 'Inteligencia artificial',
      detalle: `Proveedor: ${ETIQUETA_PROVEEDOR_IA[proveedor] ?? proveedor}`,
      estado: aiConfigured() ? 'ok' : 'falta',
    },
    {
      nombre: 'Tope diario de IA',
      detalle:
        tope === null
          ? 'AI_DAILY_BUDGET_USD: sin freno global de gasto'
          : `AI_DAILY_BUDGET_USD: ${usd(tope)} por día de RD`,
      estado: tope === null ? 'falta' : 'ok',
    },
    {
      nombre: 'Pagos',
      detalle: 'Suscripciones con Stripe',
      estado: isStripeConfigured() ? 'ok' : 'falta',
    },
    {
      nombre: 'Webhook de pagos',
      detalle: 'Mantiene las suscripciones al día',
      estado: isStripeWebhookConfigured() ? 'ok' : 'falta',
    },
    {
      nombre: 'Reservas con depósito',
      detalle: 'Desactivadas a propósito hasta tener un proveedor real',
      estado: reservasHabilitadas() ? 'ok' : 'apagado',
    },
    {
      nombre: 'Recrear desde video',
      detalle: 'Análisis de videos y fotos',
      estado: videoActivo() ? 'ok' : 'apagado',
    },
    {
      nombre: 'Analítica',
      detalle: 'Eventos de producto (PostHog)',
      estado: hay('NEXT_PUBLIC_POSTHOG_KEY') ? 'ok' : 'falta',
    },
    {
      nombre: 'Registro de errores',
      detalle: 'Sentry',
      estado:
        hay('NEXT_PUBLIC_SENTRY_DSN') || hay('SENTRY_DSN') ? 'ok' : 'falta',
    },
  ]
}

const BADGE: Record<
  Estado,
  { label: string; variant: 'success' | 'warning' | 'default' }
> = {
  ok: { label: 'Configurado', variant: 'success' },
  falta: { label: 'Falta configurar', variant: 'warning' },
  apagado: { label: 'Desactivado', variant: 'default' },
}

const ICONO = { ok: CheckCircle2, falta: AlertTriangle, apagado: MinusCircle }

/**
 * Card de solo lectura «Estado del entorno» (docs/DISENO.md §6.12): qué
 * servicios tiene configurados este servidor. No muestra ningún secreto (el
 * tope diario de IA sí, porque no lo es).
 */
export function EstadoEntorno() {
  return (
    <Card as="section" aria-labelledby="estado-entorno">
      <h2 id="estado-entorno" className="text-title text-fg">
        Estado del entorno
      </h2>
      <p className="mt-0.5 text-body-s text-fg-muted">
        Solo lectura. Se cambia en las variables del servidor, nunca desde aquí.
      </p>
      <ul className="mt-4 divide-y divide-border">
        {filas().map((f) => {
          const b = BADGE[f.estado]
          const Icono = ICONO[f.estado]
          return (
            <li
              key={f.nombre}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-[15px] font-medium text-fg">{f.nombre}</p>
                <p className="text-caption text-fg-muted">{f.detalle}</p>
              </div>
              <Badge variant={b.variant}>
                <Icono aria-hidden="true" />
                {b.label}
              </Badge>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
