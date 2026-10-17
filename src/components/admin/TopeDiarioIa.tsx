import {
  AlertTriangle,
  CheckCircle2,
  MinusCircle,
  OctagonX,
} from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils/cn'
import { formatPorcentaje } from '@/lib/utils/formatters'
import { TituloBloque } from './Encabezado'
import { usd, usdPreciso } from './etiquetas'

/** A partir de aquí la tarjeta avisa de que el tope está cerca. */
const UMBRAL_AVISO = 0.8

type Estado = 'sin_tope' | 'dentro' | 'cerca' | 'agotado'

const ESTADO: Record<
  Estado,
  { label: string; variant: BadgeVariant; icono: typeof CheckCircle2 }
> = {
  sin_tope: { label: 'Sin tope', variant: 'default', icono: MinusCircle },
  dentro: { label: 'Dentro del tope', variant: 'success', icono: CheckCircle2 },
  cerca: { label: 'Cerca del tope', variant: 'warning', icono: AlertTriangle },
  agotado: { label: 'Agotado', variant: 'error', icono: OctagonX },
}

const BARRA: Record<Exclude<Estado, 'sin_tope'>, string> = {
  dentro: 'bg-success',
  cerca: 'bg-warning',
  agotado: 'bg-danger',
}

/**
 * Tarjeta «Tope diario de IA» de /admin/ai: lo gastado hoy (día natural de
 * RD, la última barra del «Costo diario») frente a AI_DAILY_BUDGET_USD.
 * Solo lectura: el tope se cambia en las variables del servidor.
 */
export function TopeDiarioIa({
  gastadoHoy,
  tope,
  margenCorte,
}: {
  /** USD gastados hoy según ai_logs (o los de ejemplo en modo demo). */
  gastadoHoy: number
  /** AI_DAILY_BUDGET_USD, o null si no hay tope. */
  tope: number | null
  /** Múltiplo del tope del corte duro de aiGenerate (1.25). */
  margenCorte: number
}) {
  const proporcion = tope ? gastadoHoy / tope : 0
  const estado: Estado =
    tope === null
      ? 'sin_tope'
      : proporcion >= 1
        ? 'agotado'
        : proporcion >= UMBRAL_AVISO
          ? 'cerca'
          : 'dentro'
  const e = ESTADO[estado]
  const Icono = e.icono
  const pct = Math.min(100, Math.max(0, proporcion * 100))

  return (
    <Card as="section" aria-labelledby="tope-ia" className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <TituloBloque id="tope-ia">Tope diario de IA</TituloBloque>
          <p className="mt-0.5 text-caption text-fg-muted">
            Gasto de hoy (día de RD) frente a AI_DAILY_BUDGET_USD
          </p>
        </div>
        <Badge variant={e.variant}>
          <Icono aria-hidden="true" />
          {e.label}
        </Badge>
      </div>

      <p className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={cn(
            'text-num-l tnum',
            estado === 'agotado' ? 'text-danger' : 'text-fg'
          )}
        >
          {usdPreciso(gastadoHoy)}
        </span>
        <span className="text-body-s text-fg-muted tnum">
          {tope === null ? 'gastados hoy' : `de ${usd(tope)} al día`}
        </span>
      </p>

      {tope !== null && estado !== 'sin_tope' ? (
        <div
          role="meter"
          aria-label="Gasto de IA de hoy frente al tope diario"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-valuetext={`${formatPorcentaje(proporcion * 100, 1)} del tope`}
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2"
        >
          <div
            className={cn('h-full rounded-full', BARRA[estado])}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}

      <p className="mt-3 text-caption text-fg-muted">
        {estado === 'sin_tope'
          ? 'Sin AI_DAILY_BUDGET_USD la IA no tiene freno global de gasto: solo los límites por cuenta. Ponlo en las variables del servidor.'
          : estado === 'agotado'
            ? `Las rutas de IA responden «límite de IA por hoy» hasta las 12:00 a. m. de RD. Al ${formatPorcentaje(margenCorte * 100, 0)} se corta también lo que ya estaba en marcha.`
            : `Quedan ${usd(Math.max(0, (tope ?? 0) - gastadoHoy))} hoy (${formatPorcentaje(proporcion * 100, 1)} usado). Se reinicia a las 12:00 a. m. de RD.`}
      </p>
      <p className="mt-1 text-caption text-fg-subtle">
        Coste estimado con los precios de pricing.ts; con Groq gratis es una
        estimación de su tarifa de pago. Si no se puede leer el gasto, el tope
        deja pasar (falla abierto).
      </p>
    </Card>
  )
}
