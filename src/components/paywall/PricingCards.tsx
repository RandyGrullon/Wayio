'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check } from 'lucide-react'
import {
  ACCIONES_CON_CUPO,
  cantidadAccion,
  listaConY,
  textoRenovacion,
} from '@/components/trip/limitesIA'
import { Button, ButtonLink } from '@/components/ui/Button'
import { SelloInfo } from '@/components/ui/Badge'
import { Callout } from '@/components/ui/Callout'
import { Card } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Segmented'
import {
  COMPARATIVA,
  CUPO_GRATIS,
  DIAS_PASE,
  NOMBRE_PLAN,
  NOTA_USO_JUSTO,
  PLANES_A_LA_VENTA,
  type FilaComparativa,
} from '@/constants/planes'
import { PLANS } from '@/constants/pricing'
import type { PlanKey } from '@/constants/pricing'
import { useCupo, type Cupo } from '@/hooks/useCupo'
import { usePro } from '@/hooks/usePro'
import { track } from '@/lib/analytics/events'
import { formatCurrency, formatPorcentaje } from '@/lib/utils/formatters'

/**
 * Planes de Wayio (docs/DISENO.md §6, MON-05) a partir del catálogo público
 * (src/constants/planes.ts): Gratis con cuenta y cupos mensuales, Pro
 * (mensual o anual) y el Pase Pro de 30 días. Contrato de POST
 * /api/stripe/checkout { planId }:
 *   200 { url } → pago · 200 { url, portal: true, mensaje } → portal (ya
 *   suscrito) · 401 → /login?redirect=… · 409 already_pro · 503
 *   checkout_unavailable { mensaje } · 400 plan_no_disponible · 429/400
 *   { error }.
 *
 * Con sesión muestra el uso del mes (GET /api/cupo). Honestidad (§1.3.6): sin
 * «Más elegido» ni estrellas, solo funciones que el producto entrega.
 */

/** «2 viajes al mes», «5 ajustes con IA al mes», «3 fotos o videos al mes». */
const CUPOS_GRATIS = ACCIONES_CON_CUPO.map(
  (a) => `${cantidadAccion(a, CUPO_GRATIS[a])} al mes`
)

const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)

/** Lo que Pro suma a Gratis, sacado de la comparativa del catálogo. */
function extraDePro(f: FilaComparativa): string {
  return typeof f.pro === 'string'
    ? `${f.funcion}, ${minuscula(f.pro)}`
    : f.funcion
}
const EXTRAS_PRO = COMPARATIVA.filter(
  (f) => f.pro !== false && f.pro !== f.gratis
).map(extraDePro)

const A_LA_VENTA = new Set<PlanKey>(PLANES_A_LA_VENTA)

/** Precio de un pago: con centavos («US$6.99»), salvo el gratis («US$0»). */
const precio = (n: number) => formatCurrency(n, 'USD', { decimales: n !== 0 })

const AHORRO_ANUAL = Math.round(
  (1 - PLANS.pro_anual.precio / (PLANS.pro_mensual.precio * 12)) * 100
)

type Facturacion = 'mensual' | 'anual'

// Etiqueta corta (cabe en la tarjeta a 320 px); el ahorro completo va en el
// nombre accesible y en el sello de la tarjeta.
const FACTURACIONES = (
  [
    {
      value: 'mensual',
      plan: 'pro_mensual',
      label: 'Mensual',
      ariaLabel: 'Mensual',
    },
    {
      value: 'anual',
      plan: 'pro_anual',
      label: `Anual · −${formatPorcentaje(AHORRO_ANUAL)}`,
      ariaLabel: `Anual, ahorra ${formatPorcentaje(AHORRO_ANUAL)}`,
    },
  ] as const
).filter((f) => A_LA_VENTA.has(f.plan))

type Aviso = {
  tono: 'danger' | 'warning' | 'info'
  texto: string
  cuenta?: boolean
} | null

export interface PricingCardsProps {
  /** Volvió del pago sin pagar (?cancelado=1). */
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

/** «1 de 2 viajes, 3 de 5 ajustes con IA y 0 de 3 fotos o videos». */
function resumenUso(cupos: NonNullable<Cupo['cupos']>): string {
  return listaConY(
    ACCIONES_CON_CUPO.map((a) => {
      const { usados, limite } = cupos[a]
      return `${usados} de ${cantidadAccion(a, limite)}`
    })
  )
}

export function PricingCards({
  cancelado = false,
  redirectLogin = '/precios',
}: PricingCardsProps) {
  const router = useRouter()
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const { tier, loading: cargandoPlan } = usePro()
  const { cupo } = useCupo()
  const [facturacion, setFacturacion] = useState<Facturacion>(
    FACTURACIONES.some((f) => f.value === 'anual') ? 'anual' : 'mensual'
  )
  const [cargando, setCargando] = useState<PlanKey | null>(null)
  const [aviso, setAviso] = useState<Aviso>(null)

  async function handleCheckout(planId: PlanKey) {
    setCargando(planId)
    setAviso(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
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
      if (body['code'] === 'plan_no_disponible') {
        setAviso({
          tono: 'warning',
          texto:
            textoDe(body['error']) ??
            'Ese plan ya no está a la venta. Elige uno de los planes de esta página.',
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

      track('checkout_iniciado', { tipo: 'plan', planId, moneda: 'USD' })
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

  const planPro: PlanKey =
    facturacion === 'anual' && A_LA_VENTA.has('pro_anual')
      ? 'pro_anual'
      : 'pro_mensual'
  const vendePro = FACTURACIONES.length > 0
  const vendePase = A_LA_VENTA.has('pro_por_viaje')
  const ocupado = cargando !== null
  // cupos null = Pro sin límite (contrato de GET /api/cupo).
  const tienePro =
    (!cargandoPlan && tier !== 'free') || (cupo !== null && cupo.cupos === null)
  const conCuenta = cupo !== null
  const cuposGratis = cupo?.cupos ?? null
  const enGratis = cuposGratis !== null && !tienePro
  const renueva = textoRenovacion(cupo?.renueva)

  const idGratis = `${uid}-gratis`
  const idPro = `${uid}-pro`
  const idPase = `${uid}-pase`

  return (
    <div className="flex flex-col gap-6">
      {cancelado && !aviso ? (
        <Callout tone="info" title="No se completó el pago">
          No se te cobró nada. Puedes elegir un plan cuando quieras.
        </Callout>
      ) : null}

      {tienePro && !aviso ? (
        <Callout
          tone="success"
          title={
            tier === 'grupo'
              ? `Tienes ${NOMBRE_PLAN.pro_grupo}: sin límite`
              : 'Tienes Pro: sin límite'
          }
          action={
            <ButtonLink href="/cuenta" variant="link" iconEnd={<ArrowRight />}>
              Gestionar en Tu cuenta
            </ButtonLink>
          }
        >
          La IA no tiene límite, con uso justo. Gracias por apoyar a Wayio.
        </Callout>
      ) : null}

      {enGratis && cuposGratis && !aviso ? (
        <Callout tone="info" title="Tu uso este mes">
          Este mes llevas {resumenUso(cuposGratis)}.
          {renueva ? ` Tu cupo se renueva ${renueva}.` : ''}
          {cupo?.aproximado
            ? ' Ahora mismo no pudimos leer tu uso exacto: las cifras pueden no estar al día.'
            : ''}
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

      <ul className="grid gap-5 lg:grid-cols-3">
        {/* Gratis */}
        <li className="flex">
          <Card
            as="article"
            aria-labelledby={idGratis}
            className="flex w-full flex-col"
          >
            <div className="flex min-h-6 items-center justify-between gap-2">
              <h3 id={idGratis} className="kicker">
                {NOMBRE_PLAN.free}
              </h3>
              {enGratis ? <SelloInfo tone="tinta">Tu plan</SelloInfo> : null}
            </div>
            <p className="mt-1 text-title text-fg">Gratis con tu cuenta</p>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="text-num-xl text-fg tnum">{precio(0)}</span>
              <span className="text-caption text-fg-muted">para siempre</span>
            </p>
            <p className="mt-2 text-body-s text-fg-muted">
              Crea tu cuenta y planifica con IA cada mes. El cupo se renueva el
              día 1.
            </p>
            <ListaFunciones items={CUPOS_GRATIS} intro="Cada mes:" />
            <p className="-mt-2 mb-6 text-body-s text-fg-muted">
              Y sin pagar: mapa, modo sin conexión, PDF, historial y sala de
              grupo.{' '}
              <a
                href="#comparativa"
                className="rounded-sm text-accent underline decoration-1 underline-offset-[3px] hover:text-accent-hover"
              >
                Ver la comparativa
              </a>
            </p>
            <ButtonLink
              href="/planificar"
              variant="outline"
              size="lg"
              fullWidth
              className="mt-auto"
            >
              {conCuenta ? 'Trazar un viaje' : 'Empezar gratis'}
            </ButtonLink>
          </Card>
        </li>

        {/* Pro (mensual / anual) */}
        {vendePro ? (
          <li className="flex">
            <Card
              as="article"
              variant="elevated"
              aria-labelledby={idPro}
              className="relative flex w-full flex-col border-border-strong"
            >
              <div className="flex min-h-6 items-center justify-between gap-2">
                <h3 id={idPro} className="kicker text-fg">
                  Pro
                </h3>
                {planPro === 'pro_anual' ? (
                  <SelloInfo tone="laton">
                    Ahorra {formatPorcentaje(AHORRO_ANUAL)}
                  </SelloInfo>
                ) : null}
              </div>
              <p className="mt-1 text-title text-fg">IA sin límites</p>
              {FACTURACIONES.length > 1 ? (
                <Segmented<Facturacion>
                  label="Facturación de Pro"
                  value={facturacion}
                  onValueChange={setFacturacion}
                  options={FACTURACIONES.map((f) => ({
                    value: f.value,
                    label: f.label,
                    ariaLabel: f.ariaLabel,
                  }))}
                  fullWidth
                  className="mt-4"
                />
              ) : null}
              <p className="mt-4 flex items-baseline gap-2">
                <span className="text-num-xl text-fg tnum">
                  {precio(PLANS[planPro].precio)}
                </span>
                <span className="text-caption text-fg-muted">
                  {planPro === 'pro_anual' ? 'al año' : 'al mes'}
                </span>
              </p>
              <p className="mt-2 text-body-s text-fg-muted">
                {planPro === 'pro_anual'
                  ? `Equivale a ${precio(PLANS.pro_anual.precio / 12)} al mes. Se renueva cada año; cancela cuando quieras.`
                  : 'Se renueva cada mes. Cancela cuando quieras.'}
              </p>
              <ListaFunciones
                items={EXTRAS_PRO}
                intro="Todo lo de Gratis, más:"
              />
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
                {planPro === 'pro_anual'
                  ? `Elegir ${NOMBRE_PLAN.pro_anual}`
                  : `Elegir ${NOMBRE_PLAN.pro_mensual}`}
              </Button>
            </Card>
          </li>
        ) : null}

        {/* Pase Pro de 30 días */}
        {vendePase ? (
          <li className="flex">
            <Card
              as="article"
              aria-labelledby={idPase}
              className="flex w-full flex-col"
            >
              <div className="flex min-h-6 items-center">
                <h3 id={idPase} className="kicker">
                  {NOMBRE_PLAN.pro_por_viaje}
                </h3>
              </div>
              <p className="mt-1 text-title text-fg">Pro sin suscripción</p>
              <p className="mt-3 flex items-baseline gap-2">
                <span className="text-num-xl text-fg tnum">
                  {precio(PLANS.pro_por_viaje.precio)}
                </span>
                <span className="text-caption text-fg-muted">pago único</span>
              </p>
              <p className="mt-2 text-body-s text-fg-muted">
                Activa Pro en toda tu cuenta durante {DIAS_PASE} días. No se
                renueva solo.
              </p>
              <ListaFunciones
                items={[
                  `Todo Pro durante ${DIAS_PASE} días desde el pago`,
                  'Para todos tus viajes, no solo uno',
                  'Al terminar vuelves a Gratis sin cobros nuevos',
                ]}
                intro="Ideal para tu próximo viaje:"
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
                Elegir el pase de {DIAS_PASE} días
              </Button>
            </Card>
          </li>
        ) : null}
      </ul>

      <div className="flex flex-col gap-1.5 text-caption text-fg-subtle">
        <p>{NOTA_USO_JUSTO}</p>
        <p>
          Precios en dólares estadounidenses (USD). Los pagos se hacen con un
          procesador de pagos seguro: Wayio no ve ni guarda los datos de tu
          tarjeta. La ubicación en vivo y los avisos al llegar están en la app
          móvil.
        </p>
      </div>
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
