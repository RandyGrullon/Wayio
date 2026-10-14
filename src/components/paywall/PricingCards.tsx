'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { SelloInfo } from '@/components/ui/Badge'
import { Callout } from '@/components/ui/Callout'
import { Card } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Segmented'
import { PLANS } from '@/constants/pricing'
import type { PlanKey } from '@/constants/pricing'
import { FEATURES } from '@/constants/features'
import type { FeatureKey } from '@/constants/features'
import { usePro } from '@/hooks/usePro'
import { track } from '@/lib/analytics/events'
import { cn } from '@/lib/utils/cn'
import { formatCurrency, formatPorcentaje } from '@/lib/utils/formatters'

/**
 * Planes de Wayio (docs/DISENO.md §6, MON-05). Contrato de POST
 * /api/stripe/checkout { planId, tripId? }:
 *   200 { url } → Stripe · 200 { url, portal: true, mensaje } → portal (ya
 *   suscrito) · 401 → /login?redirect=… · 409 already_pro · 503
 *   checkout_unavailable { mensaje } · 429/400 { error }.
 *
 * Honestidad (§1.3.6): sin «Más elegido» ni estrellas; solo se listan
 * funciones con nombre claro y se avisa de las que son de la app móvil.
 */

/** Etiquetas visibles; las funciones sin etiqueta no se anuncian. */
const ETIQUETAS: Partial<Record<FeatureKey, string>> = {
  planificacion: 'Itinerarios con IA en tres versiones',
  mapa_basico: 'Mapa, horarios y presupuesto día a día',
  reservas_con_afiliado: 'Enlaces de reserva con nuestros socios',
  sala_grupal: 'Sala de grupo con votos',
  tiktok_3_por_mes: 'Viajes desde un video (3 al mes)',
  gps_en_vivo: 'Ubicación en vivo durante el viaje',
  alerta_nivel_1: 'Alertas básicas de demora',
  geofencing_basico: 'Avisos al llegar a cada lugar (app móvil)',
  alertas_ia_completas: 'Alertas de demora con análisis de IA',
  reoptimizacion_en_vivo: 'Reorganizar el día sobre la marcha',
  recuperacion_actividades: 'Recuperar actividades perdidas',
  modo_offline: 'Modo sin conexión',
  tiktok_ilimitado: 'Viajes desde videos, sin límite',
  pdf_export: 'Exportar el itinerario en PDF',
  historial_viajes: 'Historial de viajes',
  chat_integrado: 'Chat del grupo',
  split_gastos: 'Dividir gastos entre todos',
  ubicacion_grupo_vivo: 'Ubicación del grupo en tiempo real',
  alertas_sincronizadas: 'Alertas para todo el grupo',
  hasta_15_personas: 'Hasta 15 personas por viaje',
}

function funciones(nivel: true | 'pro' | 'grupo'): string[] {
  return (Object.keys(FEATURES) as FeatureKey[])
    .filter((k) => FEATURES[k] === nivel)
    .map((k) => ETIQUETAS[k])
    .filter((e): e is string => Boolean(e))
}

const GRATIS = funciones(true)
const PRO = funciones('pro')
const GRUPO = funciones('grupo')

/** Precio de un pago: con centavos («US$6.99»), salvo el gratis («US$0»). */
const precio = (n: number) => formatCurrency(n, 'USD', { decimales: n !== 0 })

const AHORRO_ANUAL = Math.round(
  (1 - PLANS.pro_anual.precio / (PLANS.pro_mensual.precio * 12)) * 100
)

type Facturacion = 'mensual' | 'anual'

type Aviso = {
  tono: 'danger' | 'warning' | 'info'
  texto: string
  cuenta?: boolean
} | null

export interface PricingCardsProps {
  /** Versión compacta para el paywall (2 columnas como máximo). */
  compacto?: boolean
  /** Liga el «Pro por viaje» a un viaje guardado (trips.id). */
  tripId?: string
  /** Volvió de Stripe sin pagar (?cancelado=1). */
  cancelado?: boolean
  /** A dónde volver tras iniciar sesión (401). */
  redirectLogin?: string
}

async function leerCuerpo(res: Response): Promise<Record<string, unknown>> {
  try {
    const body = (await res.json()) as unknown
    return typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

const textoDe = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v : null

export function PricingCards({
  compacto = false,
  tripId,
  cancelado = false,
  redirectLogin = '/precios',
}: PricingCardsProps) {
  const router = useRouter()
  const { tier, loading: cargandoPlan } = usePro()
  const [facturacion, setFacturacion] = useState<Facturacion>('anual')
  const [cargando, setCargando] = useState<PlanKey | null>(null)
  const [aviso, setAviso] = useState<Aviso>(null)

  async function handleCheckout(planId: PlanKey) {
    setCargando(planId)
    setAviso(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          ...(tripId && planId === 'pro_por_viaje' ? { tripId } : {}),
        }),
      })
      const body = await leerCuerpo(res)

      if (res.status === 401) {
        router.push(`/login?redirect=${encodeURIComponent(redirectLogin)}`)
        return
      }
      if (res.status === 409 || body['code'] === 'already_pro') {
        setAviso({
          tono: 'info',
          texto:
            textoDe(body['error']) ??
            'Ya tienes Wayio Pro activo en tu cuenta.',
          cuenta: true,
        })
        setCargando(null)
        return
      }
      if (res.status === 503 || body['error'] === 'checkout_unavailable') {
        setAviso({
          tono: 'warning',
          texto:
            textoDe(body['mensaje']) ??
            'Los pagos no están disponibles en este momento. Inténtalo de nuevo en unos minutos.',
        })
        setCargando(null)
        return
      }
      const url = textoDe(body['url'])
      if (!res.ok || !url) {
        setAviso({
          tono: 'danger',
          texto:
            textoDe(body['error']) ??
            'No pudimos abrir el pago. Inténtalo de nuevo en unos segundos.',
        })
        setCargando(null)
        return
      }

      track('checkout_iniciado', {
        tipo: 'plan',
        planId,
        moneda: 'USD',
        tripId: planId === 'pro_por_viaje' ? tripId : undefined,
      })
      track('pro_paywall_shown', { plan: planId })
      // { url, portal: true }: ya suscrito → portal de pagos (misma salida).
      window.location.href = url
    } catch {
      setAviso({
        tono: 'danger',
        texto: 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.',
      })
      setCargando(null)
    }
  }

  const planPro: PlanKey = facturacion === 'anual' ? 'pro_anual' : 'pro_mensual'
  const ocupado = cargando !== null

  return (
    <div className="flex flex-col gap-6">
      {cancelado && !aviso ? (
        <Callout tone="info" title="No se completó el pago">
          No se te cobró nada. Puedes elegir un plan cuando quieras.
        </Callout>
      ) : null}

      {!cargandoPlan && tier !== 'free' && !aviso ? (
        <Callout
          tone="success"
          title={
            tier === 'grupo'
              ? 'Ya tienes Wayio Pro grupo'
              : 'Ya tienes Wayio Pro'
          }
          action={
            <ButtonLink href="/cuenta" variant="link" iconEnd={<ArrowRight />}>
              Gestionar en Tu cuenta
            </ButtonLink>
          }
        >
          Gracias por apoyar a Wayio. Puedes cambiar o cancelar tu plan desde tu
          cuenta.
        </Callout>
      ) : null}

      {aviso ? (
        <Callout
          tone={aviso.tono}
          {...(aviso.cuenta
            ? {
                action: (
                  <ButtonLink
                    href="/cuenta"
                    variant="link"
                    iconEnd={<ArrowRight />}
                  >
                    Ir a Tu cuenta
                  </ButtonLink>
                ),
              }
            : {})}
        >
          {aviso.texto}
        </Callout>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<Facturacion>
          label="Facturación de Pro"
          value={facturacion}
          onValueChange={setFacturacion}
          options={[
            { value: 'mensual', label: 'Mensual' },
            {
              value: 'anual',
              label: `Anual · ahorra ${formatPorcentaje(AHORRO_ANUAL)}`,
            },
          ]}
        />
        <p className="text-caption text-fg-subtle">
          Precios en dólares estadounidenses (USD).
        </p>
      </div>

      <ul
        className={cn(
          'grid gap-5',
          compacto ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-4'
        )}
      >
        {/* Gratis */}
        <li className="flex">
          <Card as="article" className="flex w-full flex-col">
            <p className="kicker">Gratis</p>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="text-num-xl text-fg tnum">{precio(0)}</span>
              <span className="text-caption text-fg-muted">para siempre</span>
            </p>
            <p className="mt-2 text-body-s text-fg-muted">
              Para planificar tus viajes y compartirlos.
            </p>
            <ListaFunciones items={GRATIS} />
            <ButtonLink
              href="/planificar"
              variant="outline"
              size="lg"
              fullWidth
              className="mt-auto"
            >
              Empezar gratis
            </ButtonLink>
          </Card>
        </li>

        {/* Pro (mensual / anual) */}
        <li className="flex">
          <Card
            as="article"
            variant="elevated"
            className="relative flex w-full flex-col border-border-strong"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="kicker text-fg">Pro viajero</p>
              {facturacion === 'anual' ? (
                <SelloInfo tone="laton">
                  Ahorra {formatPorcentaje(AHORRO_ANUAL)}
                </SelloInfo>
              ) : null}
            </div>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="text-num-xl text-fg tnum">
                {precio(PLANS[planPro].precio)}
              </span>
              <span className="text-caption text-fg-muted">
                {facturacion === 'anual' ? 'al año' : 'al mes'}
              </span>
            </p>
            <p className="mt-2 text-body-s text-fg-muted">
              {facturacion === 'anual'
                ? `Equivale a ${precio(PLANS.pro_anual.precio / 12)} al mes. Cancela cuando quieras.`
                : 'Se renueva cada mes. Cancela cuando quieras.'}
            </p>
            <ListaFunciones items={PRO} intro="Todo lo gratis, más:" />
            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="mt-auto"
              iconEnd={<ArrowRight />}
              onClick={() => void handleCheckout(planPro)}
              disabled={ocupado}
              loading={cargando === planPro}
              loadingText="Abriendo el pago…"
            >
              {facturacion === 'anual'
                ? 'Elegir Pro anual'
                : 'Elegir Pro mensual'}
            </Button>
          </Card>
        </li>

        {/* Pro por viaje */}
        <li className="flex">
          <Card as="article" className="flex w-full flex-col">
            <p className="kicker">Pro por viaje</p>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="text-num-xl text-fg tnum">
                {precio(PLANS.pro_por_viaje.precio)}
              </span>
              <span className="text-caption text-fg-muted">pago único</span>
            </p>
            <p className="mt-2 text-body-s text-fg-muted">
              Todo Pro para un solo viaje, sin suscripción.
            </p>
            <ListaFunciones
              items={PRO}
              intro="Lo mismo que Pro, para un viaje:"
            />
            <Button
              variant="outline"
              size="lg"
              fullWidth
              className="mt-auto"
              onClick={() => void handleCheckout('pro_por_viaje')}
              disabled={ocupado}
              loading={cargando === 'pro_por_viaje'}
              loadingText="Abriendo el pago…"
            >
              {/* Sin viaje concreto (p. ej. en /precios) no hay «este». */}
              {tripId ? 'Pagar este viaje' : 'Elegir Pro por viaje'}
            </Button>
          </Card>
        </li>

        {/* Grupo */}
        <li className="flex">
          <Card as="article" className="flex w-full flex-col">
            <p className="kicker">Pro grupo</p>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="text-num-xl text-fg tnum">
                {precio(PLANS.pro_grupo.precio)}
              </span>
              <span className="text-caption text-fg-muted">al mes</span>
            </p>
            <p className="mt-2 text-body-s text-fg-muted">
              Para viajar con familia o amigos y decidir juntos.
            </p>
            <ListaFunciones items={GRUPO} intro="Todo Pro, más:" />
            <Button
              variant="tinta"
              size="lg"
              fullWidth
              className="mt-auto"
              onClick={() => void handleCheckout('pro_grupo')}
              disabled={ocupado}
              loading={cargando === 'pro_grupo'}
              loadingText="Abriendo el pago…"
            >
              Elegir Pro grupo
            </Button>
          </Card>
        </li>
      </ul>

      <p className="text-caption text-fg-subtle">
        Los pagos los procesa Stripe; Wayio no guarda los datos de tu tarjeta.
        Algunas funciones, como los avisos por cercanía y las alertas durante el
        viaje, están en la app móvil.
      </p>
    </div>
  )
}

function ListaFunciones({ items, intro }: { items: string[]; intro?: string }) {
  return (
    <div className="mt-5 mb-6 border-t border-border pt-5">
      {intro ? <p className="mb-3 text-label text-fg">{intro}</p> : null}
      <ul className="flex flex-col gap-2.5 text-body-s text-fg">
        {items.map((f) => (
          <li key={f} className="flex gap-2.5">
            <Check
              aria-hidden="true"
              strokeWidth={1.75}
              className="mt-[3px] size-4 shrink-0 text-success"
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
