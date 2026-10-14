'use client'

import { useEffect, useState, useSyncExternalStore, useTransition } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  LogIn,
  LogOut,
  Map as MapIcon,
  Menu as MenuIcon,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Avatar, indiceDesdeId } from '@/components/ui/Avatar'
import { SelloInfo } from '@/components/ui/Badge'
import { ButtonLink, buttonClasses } from '@/components/ui/Button'
import { Menu } from '@/components/ui/Menu'
import { Sheet } from '@/components/ui/Modal'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { DUR, EASE } from '@/components/ui/motion'
import { useUser } from '@/hooks/useUser'
import { signOut } from '@/lib/auth/actions'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { cn } from '@/lib/utils/cn'
import {
  StepperRuta,
  StepperRutaCompacto,
  avancePaso,
  type PasoRuta,
} from './Stepper'

/**
 * Header único (docs/DISENO.md §5.11), variantes:
 * - marketing (por defecto): navegación central (≥lg), sesión y CTA
 *   «Planificar viaje» (desde md, oculto mientras se ve [data-wy-hero]).
 * - flujo: Stepper de ruta en el centro (compacto + barra de 2 px en móvil).
 * - app: «← Mis viajes», pill EN VIVO, sello SOLO LECTURA, extra (avatares).
 * - minimo: wordmark, sello opcional, tema y CTA opcional («Crear el mío»).
 * El wordmark lleva data-wy-logo: destino del relevo de la intro.
 */

export type SiteHeaderVariant = 'marketing' | 'flujo' | 'app' | 'minimo'

export interface SiteHeaderCta {
  label: string
  href: string
}

export interface SiteHeaderProps {
  variant?: SiteHeaderVariant
  /** flujo: estación actual del Stepper de ruta. */
  paso?: PasoRuta
  /** flujo: enlaces de las estaciones hechas. */
  pasosHref?: Partial<Record<PasoRuta, string>>
  /** Acciones extra a la derecha (p. ej. «Cancelar» ghost sm en el flujo). */
  acciones?: ReactNode
  /** Contenido extra en el centro/derecha (pila de avatares del grupo). */
  extra?: ReactNode
  /** app: destino de «← Mis viajes». */
  volverHref?: string
  volverLabel?: string
  /** app: pill «EN VIVO» con el punto GPS. */
  enVivo?: boolean
  /** app/minimo: sello «SOLO LECTURA». */
  soloLectura?: boolean
  /** CTA primario (sm). marketing usa «Planificar viaje» por defecto; false lo quita. */
  cta?: SiteHeaderCta | false
  /** Muestra «Admin» en el menú de usuario. */
  esAdmin?: boolean
  className?: string
}

const NAV_MARKETING = [
  { label: 'Destinos', href: '/#destinos' },
  { label: 'Cómo funciona', href: '/#como-funciona' },
  { label: 'Viajes en grupo', href: '/#grupo' },
] as const

const CTA_MARKETING: SiteHeaderCta = {
  label: 'Planificar viaje',
  href: '/planificar',
}

// Scroll > 8 px → aparece la hairline inferior.
function suscribirScroll(cb: () => void) {
  window.addEventListener('scroll', cb, { passive: true })
  return () => window.removeEventListener('scroll', cb)
}
const conScroll = () => window.scrollY > 8
const sinScroll = () => false

function nombreDe(user: {
  email?: string | undefined
  user_metadata?: Record<string, unknown>
}): string {
  const meta = user.user_metadata ?? {}
  const nombre = meta['full_name'] ?? meta['name']
  return typeof nombre === 'string' && nombre.trim()
    ? nombre.trim()
    : (user.email ?? 'Tu cuenta')
}

export function SiteHeader({
  variant = 'marketing',
  paso = 'datos',
  pasosHref,
  acciones,
  extra,
  volverHref = '/viajes',
  volverLabel = 'Mis viajes',
  enVivo = false,
  soloLectura = false,
  cta,
  esAdmin = false,
  className,
}: SiteHeaderProps = {}) {
  const pathname = usePathname()
  const { user, loading } = useUser()
  const demo = !isSupabaseConfigured()
  const scrolled = useSyncExternalStore(suscribirScroll, conScroll, sinScroll)
  const [menuMovil, setMenuMovil] = useState(false)
  const [heroVisible, setHeroVisible] = useState<boolean | null>(null)
  const [saliendo, startSalida] = useTransition()

  // El punto del logo salta al guardar con saltarPuntoDelLogo()
  // (src/components/brand/salto.ts), que marca el logo con [data-salto].

  // CTA oculto mientras se ve el hero ([data-wy-hero]) de la landing.
  useEffect(() => {
    if (variant !== 'marketing') return
    const hero = document.querySelector('[data-wy-hero]')
    if (!hero || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entradas) => {
        const e = entradas[0]
        if (e) setHeroVisible(e.isIntersecting)
      },
      { rootMargin: '-64px 0px 0px 0px' }
    )
    io.observe(hero)
    return () => io.disconnect()
  }, [variant, pathname])

  const ctaFinal: SiteHeaderCta | null =
    cta === false
      ? null
      : (cta ?? (variant === 'marketing' ? CTA_MARKETING : null))
  // Sin observador aún: en la landing se asume que el hero se ve.
  const ctaOculto =
    variant === 'marketing' && cta === undefined
      ? (heroVisible ?? pathname === '/')
      : false

  // Contrato de plataforma: antes de signOut se borran los datos sin conexión
  // y se reinicia la analítica (igual que src/app/cuenta/CerrarSesion.tsx).
  const cerrarSesion = () =>
    startSalida(async () => {
      try {
        const { clearOfflineData } = await import('@/lib/offline/cleanup')
        await clearOfflineData()
      } catch {
        // Limpieza best-effort: nunca bloquea el cierre de sesión.
      }
      try {
        const { resetAnalytics } = await import('@/lib/analytics/events')
        resetAnalytics()
      } catch {
        // La analítica nunca bloquea el cierre de sesión.
      }
      await signOut()
    })

  const nombre = user ? nombreDe(user) : ''
  const menuUsuario = user ? (
    <Menu
      label={`Cuenta de ${nombre}`}
      triggerClassName={cn(
        buttonClasses({ variant: 'ghost', size: 'icon' }),
        'size-10'
      )}
      trigger={
        <Avatar name={nombre} index={indiceDesdeId(user.id)} decorative />
      }
      header={
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-fg">{nombre}</p>
          {user.email && user.email !== nombre ? (
            <p
              className="truncate text-caption text-fg-muted"
              title={user.email}
            >
              {user.email}
            </p>
          ) : null}
        </div>
      }
      items={[
        {
          key: 'viajes',
          label: 'Mis viajes',
          icon: <MapIcon />,
          href: '/viajes',
        },
        {
          key: 'cuenta',
          label: 'Cuenta',
          icon: <UserRound />,
          href: '/cuenta',
        },
        ...(esAdmin
          ? [
              {
                key: 'admin',
                label: 'Admin',
                icon: <ShieldCheck />,
                href: '/admin',
              },
            ]
          : []),
        {
          key: 'salir',
          label: saliendo ? 'Cerrando sesión…' : 'Cerrar sesión',
          icon: <LogOut />,
          onSelect: cerrarSesion,
          disabled: saliendo,
          separatorBefore: true,
        },
      ]}
    />
  ) : null

  const iniciarSesion =
    !user && !loading && !demo ? (
      <ButtonLink
        href="/login"
        variant="ghost"
        size="sm"
        className="hidden sm:inline-flex"
      >
        Iniciar sesión
      </ButtonLink>
    ) : null

  const botonCta = ctaFinal ? (
    <AnimatePresence initial={false}>
      {!ctaOculto ? (
        <m.div
          key="cta"
          className="hidden md:block"
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            transition: { duration: DUR.base, ease: EASE.papel },
          }}
          exit={{
            opacity: 0,
            transition: { duration: 0.14, ease: EASE.salida },
          }}
        >
          <ButtonLink href={ctaFinal.href} variant="primary" size="sm">
            {ctaFinal.label}
          </ButtonLink>
        </m.div>
      ) : null}
    </AnimatePresence>
  ) : null

  return (
    <header
      data-print="hide"
      className={cn(
        'sticky top-0 z-(--z-header) h-header-sm w-full border-b bg-bg/88 backdrop-blur-header md:h-header',
        'transition-[border-color] duration-(--dur-base) ease-papel',
        scrolled ? 'border-border' : 'border-transparent',
        className
      )}
    >
      {/* El SkipLink («Saltar al contenido») lo monta el layout raíz como
          primer elemento del <body>, antes del banner de anuncios. */}
      <div className="mx-auto flex h-full max-w-content items-center gap-3 px-4 md:gap-4 md:px-6 lg:px-8">
        {/* Izquierda */}
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/"
            aria-label="Wayio, inicio"
            className="wy-logo-salto -m-1 inline-flex rounded-sm p-1"
          >
            <Logo
              data-wy-logo
              className="h-[26px] w-auto overflow-visible md:h-[30px]"
            />
          </Link>
          {variant === 'app' ? (
            <ButtonLink
              href={volverHref}
              variant="ghost"
              size="sm"
              icon={<ArrowLeft />}
              className="ml-1 max-sm:px-2.5"
            >
              {/* En móvil solo la flecha (el texto queda para lectores) */}
              <span className="max-sm:sr-only">{volverLabel}</span>
            </ButtonLink>
          ) : null}
        </div>

        {/* Centro */}
        <div className="flex min-w-0 flex-1 items-center justify-center">
          {variant === 'marketing' ? (
            <nav
              aria-label="Principal"
              className="hidden items-center gap-7 lg:flex"
            >
              {NAV_MARKETING.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-sm text-[15px] font-medium text-fg-muted transition-colors duration-(--dur-fast) hover:text-fg"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          ) : null}
          {variant === 'flujo' ? (
            <>
              <StepperRuta
                paso={paso}
                hrefs={pasosHref}
                className="hidden md:block"
              />
              <StepperRutaCompacto paso={paso} className="md:hidden" />
            </>
          ) : null}
          {variant === 'app' && enVivo ? (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 text-[12px] font-semibold tracking-[0.08em] text-fg uppercase [font-stretch:85%]">
              <span aria-hidden="true" className="size-2 rounded-full bg-gps" />
              En vivo
            </span>
          ) : null}
          {(variant === 'app' || variant === 'minimo') && soloLectura ? (
            <SelloInfo tone="tinta" className="ml-2">
              Solo lectura
            </SelloInfo>
          ) : null}
          {extra ? <div className="ml-2 flex items-center">{extra}</div> : null}
        </div>

        {/* Derecha */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          {acciones}
          <ThemeToggle />
          {variant === 'marketing' && user ? (
            <ButtonLink
              href="/viajes"
              variant="ghost"
              size="sm"
              icon={<MapIcon />}
              className="hidden md:inline-flex"
            >
              Mis viajes
            </ButtonLink>
          ) : null}
          {variant !== 'minimo' ? (iniciarSesion ?? menuUsuario) : null}
          {botonCta}
          {variant === 'marketing' ? (
            <button
              type="button"
              aria-label="Abrir menú"
              aria-haspopup="dialog"
              aria-expanded={menuMovil}
              onClick={() => setMenuMovil(true)}
              className={cn(
                buttonClasses({ variant: 'ghost', size: 'icon' }),
                'size-10 lg:hidden'
              )}
            >
              <MenuIcon aria-hidden="true" strokeWidth={1.75} />
            </button>
          ) : null}
        </div>
      </div>

      {variant === 'flujo' ? (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-0.5 md:hidden"
        >
          <m.div
            className="h-full origin-left bg-primary"
            initial={false}
            animate={{ scaleX: avancePaso(paso) }}
            transition={{ duration: 0.42, ease: EASE.tinta }}
          />
        </div>
      ) : null}

      {variant === 'marketing' ? (
        <Sheet
          open={menuMovil}
          onClose={() => setMenuMovil(false)}
          title="Menú"
        >
          <nav aria-label="Principal (móvil)" className="flex flex-col">
            {NAV_MARKETING.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuMovil(false)}
                className="flex h-12 items-center justify-between border-b border-border text-[17px] font-medium text-fg"
              >
                {l.label}
                <ArrowRight
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-[18px] text-fg-subtle"
                />
              </Link>
            ))}
            {user ? (
              <>
                <Link
                  href="/viajes"
                  onClick={() => setMenuMovil(false)}
                  className="flex h-12 items-center justify-between border-b border-border text-[17px] font-medium text-fg"
                >
                  Mis viajes
                  <MapIcon
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="size-[18px] text-fg-subtle"
                  />
                </Link>
                <Link
                  href="/cuenta"
                  onClick={() => setMenuMovil(false)}
                  className="flex h-12 items-center justify-between border-b border-border text-[17px] font-medium text-fg"
                >
                  Cuenta
                  <UserRound
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="size-[18px] text-fg-subtle"
                  />
                </Link>
              </>
            ) : !demo && !loading ? (
              <Link
                href="/login"
                onClick={() => setMenuMovil(false)}
                className="flex h-12 items-center justify-between border-b border-border text-[17px] font-medium text-fg"
              >
                Iniciar sesión
                <LogIn
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-[18px] text-fg-subtle"
                />
              </Link>
            ) : null}
          </nav>
          {ctaFinal ? (
            <ButtonLink
              href={ctaFinal.href}
              variant="primary"
              size="lg"
              fullWidth
              iconEnd={<ArrowRight />}
              className="mt-6"
              onClick={() => setMenuMovil(false)}
            >
              {ctaFinal.label}
            </ButtonLink>
          ) : null}
        </Sheet>
      ) : null}
    </header>
  )
}

export default SiteHeader
