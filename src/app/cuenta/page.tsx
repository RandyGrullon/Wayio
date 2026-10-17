import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ArrowRight, KeyRound } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { EstadoBadge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PLANS } from '@/constants/pricing'
import { RECUPERAR_PATH } from '@/lib/auth/constants'
import { modoLocalSinCuentas } from '@/lib/auth/irALogin'
import { tierEfectivo } from '@/lib/stripe/entitlements'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { formatFecha } from '@/lib/utils/formatters'
import type { SubscriptionRow } from '@/types/database'
import type { PlanTier } from '@/types/subscription'
import { AvisoPago } from './AvisoPago'
import { CerrarSesion } from './CerrarSesion'
import { GestionarSuscripcion } from './GestionarSuscripcion'
import { Referidos } from './Referidos'

export const metadata: Metadata = {
  title: 'Tu cuenta',
  robots: { index: false, follow: false },
}

type Params = Record<string, string | string[] | undefined>

type Carga =
  | { estado: 'ok'; user: User; tier: PlanTier; sub: SubscriptionRow | null }
  | { estado: 'sin_sesion' }
  | { estado: 'error' }

function esTier(v: unknown): v is PlanTier {
  return v === 'free' || v === 'pro' || v === 'grupo'
}

/**
 * Datos de la cuenta en el servidor (la ruta la protege proxy.ts). El plan
 * sale de la RPC my_effective_tier; si la RPC no existe todavía se calcula
 * con la misma regla (tierEfectivo) sobre la fila de subscriptions, que la
 * RLS deja leer al propio usuario.
 */
async function cargar(): Promise<Carga> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { estado: 'sin_sesion' }
    const [rpc, fila] = await Promise.all([
      supabase.rpc('my_effective_tier'),
      supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])
    const sub = (fila.data as SubscriptionRow | null) ?? null
    const tier: PlanTier =
      !rpc.error && esTier(rpc.data) ? rpc.data : tierEfectivo(sub)
    return { estado: 'ok', user, tier, sub }
  } catch {
    return { estado: 'error' }
  }
}

function nombreDe(user: User): string {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const nombre = meta['full_name'] ?? meta['name']
  return typeof nombre === 'string' && nombre.trim()
    ? nombre.trim()
    : (user.email?.split('@')[0] ?? 'Viajero')
}

const NOMBRE_TIER: Record<PlanTier, string> = {
  free: 'Plan gratis',
  pro: 'Wayio Pro',
  grupo: 'Wayio Pro grupo',
}

function nombrePlan(tier: PlanTier, sub: SubscriptionRow | null): string {
  if (tier === 'free' || !sub) return NOMBRE_TIER[tier]
  const id = sub.plan_id
  return id !== 'free' && id in PLANS ? PLANS[id].nombre : NOMBRE_TIER[tier]
}

/** Frase de vigencia del plan («Se renueva el 12 nov 2026»…). */
function vigencia(sub: SubscriptionRow | null): string | null {
  if (!sub?.current_period_end) return null
  const fecha = formatFecha(sub.current_period_end, {
    anio: true,
    diaSemana: false,
  })
  if (!fecha) return null
  if (sub.stripe_subscription_id) {
    if (sub.status === 'canceled') return `Terminó el ${fecha}.`
    return sub.cancel_at_period_end
      ? `Cancelado: tienes acceso hasta el ${fecha}.`
      : `Se renueva el ${fecha}.`
  }
  return `Válido hasta el ${fecha}.`
}

function Portada({ kicker, titulo }: { kicker: string; titulo: string }) {
  return (
    <div>
      <p className="kicker kicker-filete">{kicker}</p>
      <h1 className="mt-3 font-display text-h1 break-words text-fg">
        {titulo}
      </h1>
    </div>
  )
}

export default async function CuentaPage({
  searchParams,
}: {
  searchParams: Promise<Params>
}) {
  const params = await searchParams
  const pagoOk = params['pago'] === 'ok'

  if (!isSupabaseConfigured()) {
    return (
      <>
        <SiteHeader variant="app" />
        <main id="contenido" className="flex-1">
          <div className="mx-auto max-w-content px-4 py-16 md:px-6 lg:px-8">
            <EmptyState
              headingLevel="h1"
              title="Las cuentas todavía no están disponibles"
              description={
                modoLocalSinCuentas()
                  ? 'Mientras tanto puedes trazar tus viajes sin iniciar sesión.'
                  : 'Para trazar, guardar y compartir viajes hace falta una cuenta. Vuelve a intentarlo más tarde.'
              }
              action={
                <ButtonLink
                  href="/planificar"
                  variant="primary"
                  size="lg"
                  iconEnd={<ArrowRight />}
                >
                  Planificar un viaje
                </ButtonLink>
              }
            />
          </div>
        </main>
        <SiteFooter />
      </>
    )
  }

  const carga = await cargar()
  if (carga.estado === 'sin_sesion') {
    const vuelta = pagoOk ? '/cuenta?pago=ok' : '/cuenta'
    redirect(`/login?redirect=${encodeURIComponent(vuelta)}`)
  }

  if (carga.estado === 'error') {
    return (
      <>
        <SiteHeader variant="app" />
        <main id="contenido" className="flex-1">
          <div className="mx-auto max-w-content px-4 py-16 md:px-6 lg:px-8">
            <EmptyState
              headingLevel="h1"
              illustration="error"
              title="No pudimos cargar tu cuenta"
              description="Revisa tu conexión e inténtalo de nuevo en unos segundos."
              action={
                <ButtonLink href="/cuenta" variant="primary" size="lg">
                  Reintentar
                </ButtonLink>
              }
            />
          </div>
        </main>
        <SiteFooter />
      </>
    )
  }

  const { user, tier, sub } = carga
  const nombre = nombreDe(user)
  const proveedor = user.app_metadata?.['provider']
  const conGoogle = proveedor === 'google'
  const desde = formatFecha(user.created_at, { anio: true, diaSemana: false })
  const frase = vigencia(sub)
  const tieneCliente = Boolean(sub?.stripe_customer_id)
  const esPago = tier !== 'free'

  return (
    <>
      <SiteHeader variant="app" />
      <main id="contenido" className="flex-1">
        <div className="mx-auto max-w-[880px] px-4 pt-10 pb-20 md:px-6 md:pt-14">
          <Portada kicker="Tu cuenta" titulo={nombre} />
          {user.email && user.email !== nombre ? (
            <p className="mt-2 text-body-s text-fg-muted">{user.email}</p>
          ) : null}

          <div className="mt-10 flex flex-col gap-8">
            {pagoOk ? <AvisoPago activo={esPago} /> : null}

            {/* Plan */}
            <Card as="section" variant="elevated" aria-labelledby="cuenta-plan">
              <p className="kicker">Tu plan</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2 id="cuenta-plan" className="font-display text-h2 text-fg">
                  {nombrePlan(tier, sub)}
                </h2>
                {esPago && sub ? (
                  <EstadoBadge tipo="suscripcion" estado={sub.status} />
                ) : null}
              </div>

              {esPago ? (
                <div className="mt-3 flex flex-col gap-1 text-body-s text-fg-muted">
                  {frase ? <p>{frase}</p> : null}
                  {sub?.source === 'admin' ? (
                    <p>Este plan te lo concedió el equipo de Wayio.</p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 max-w-[60ch] text-body-s text-fg-muted">
                  Planifica, guarda y comparte tus viajes. Con Pro suma el modo
                  sin conexión, las alertas con IA y más.
                </p>
              )}

              {esPago && sub?.status === 'past_due' ? (
                <Callout
                  tone="warning"
                  title="Hubo un problema con tu último pago"
                  className="mt-5"
                >
                  Actualiza tu tarjeta en el portal de pagos para no perder tu
                  plan.
                </Callout>
              ) : null}

              <div className="mt-6 flex flex-wrap items-start gap-3">
                {esPago ? null : (
                  <ButtonLink
                    href="/precios"
                    variant="primary"
                    size="lg"
                    iconEnd={<ArrowRight />}
                  >
                    Ver planes Pro
                  </ButtonLink>
                )}
                {tieneCliente ? (
                  <GestionarSuscripcion
                    variant={esPago ? 'tinta' : 'outline'}
                    label={esPago ? 'Gestionar suscripción' : 'Ver mis pagos'}
                  />
                ) : null}
              </div>
            </Card>

            {/* Invitaciones */}
            <Card as="section" aria-labelledby="cuenta-invitaciones">
              <p className="kicker">Invitaciones</p>
              <h2
                id="cuenta-invitaciones"
                className="mt-2 font-display text-h3 text-fg"
              >
                Invita a quien viaja contigo
              </h2>
              <div className="mt-6">
                <Referidos />
              </div>
            </Card>

            {/* Acceso */}
            <Card as="section" aria-labelledby="cuenta-acceso">
              <p className="kicker">Acceso</p>
              <h2
                id="cuenta-acceso"
                className="mt-2 font-display text-h3 text-fg"
              >
                Datos de tu cuenta
              </h2>
              <dl className="mt-5 divide-y divide-border border-y border-border text-body-s">
                <div className="flex flex-wrap justify-between gap-2 py-3">
                  <dt className="text-fg-muted">Nombre</dt>
                  <dd className="font-medium text-fg">{nombre}</dd>
                </div>
                {user.email ? (
                  <div className="flex flex-wrap justify-between gap-2 py-3">
                    <dt className="text-fg-muted">Email</dt>
                    <dd className="min-w-0 font-medium break-all text-fg">
                      {user.email}
                    </dd>
                  </div>
                ) : null}
                <div className="flex flex-wrap justify-between gap-2 py-3">
                  <dt className="text-fg-muted">Cómo entras</dt>
                  <dd className="font-medium text-fg">
                    {conGoogle ? 'Con Google' : 'Con tu email'}
                  </dd>
                </div>
                {desde ? (
                  <div className="flex flex-wrap justify-between gap-2 py-3">
                    <dt className="text-fg-muted">Con Wayio desde</dt>
                    <dd className="font-medium text-fg tnum">{desde}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="mt-6 flex flex-wrap gap-3">
                {conGoogle ? null : (
                  <ButtonLink
                    href={RECUPERAR_PATH}
                    variant="ghost"
                    size="md"
                    icon={<KeyRound />}
                  >
                    Cambiar contraseña
                  </ButtonLink>
                )}
                <CerrarSesion />
              </div>
            </Card>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
