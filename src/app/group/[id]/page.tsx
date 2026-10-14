'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { GroupRoom } from '@/components/group/GroupRoom'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  SkeletonMapa,
  SkeletonPortada,
  SkeletonRegion,
  SkeletonText,
} from '@/components/ui/Skeleton'
import { useUser } from '@/hooks/useUser'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { Trip } from '@/types/trip'
import type { TripRow } from '@/types/database'

type Carga =
  | { tipo: 'cargando' }
  | { tipo: 'ok'; tripId: string; trip: Trip }
  | { tipo: 'error'; mensaje: string; titulo: string; reintentable: boolean }

async function mensajeDe(res: Response, porDefecto: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown }
    return typeof body.error === 'string' && body.error
      ? body.error
      : porDefecto
  } catch {
    return porDefecto
  }
}

/** Unirse por el enlace y cargar el viaje. Nunca lanza. */
async function unirseYCargar(grupoLink: string): Promise<Carga> {
  try {
    const joinRes = await fetch(
      `/api/groups/join/${encodeURIComponent(grupoLink)}`,
      { method: 'POST' }
    )
    if (!joinRes.ok) {
      // 404 enlace inválido y 403 cuenta bloqueada: reintentar no ayuda.
      const definitivo = joinRes.status === 404 || joinRes.status === 403
      return {
        tipo: 'error',
        titulo:
          joinRes.status === 404
            ? 'Este enlace de grupo no existe'
            : 'No pudimos abrir la sala',
        mensaje: await mensajeDe(
          joinRes,
          'No pudimos unirte al grupo. Inténtalo de nuevo.'
        ),
        reintentable: !definitivo,
      }
    }
    const { tripId } = (await joinRes.json()) as { tripId: string }

    const tripRes = await fetch(`/api/trips/${tripId}`)
    if (!tripRes.ok) {
      return {
        tipo: 'error',
        titulo: 'No pudimos abrir la sala',
        mensaje: await mensajeDe(
          tripRes,
          'No pudimos cargar el viaje del grupo. Inténtalo de nuevo.'
        ),
        reintentable: tripRes.status !== 404 && tripRes.status !== 403,
      }
    }
    const { trip: row } = (await tripRes.json()) as { trip: TripRow }
    return { tipo: 'ok', tripId, trip: row.data }
  } catch {
    return {
      tipo: 'error',
      titulo: 'No pudimos abrir la sala',
      mensaje: 'Revisa tu conexión e inténtalo de nuevo.',
      reintentable: true,
    }
  }
}

/**
 * Sala del grupo /group/[enlace]. Se une con POST /api/groups/join/[link]
 * → { tripId, member } (idempotente), carga el viaje con GET /api/trips/[id]
 * y monta GroupRoom. Sin sesión, al login con ?redirect a esta sala.
 */
export default function GroupPage() {
  const params = useParams<{ id: string }>()
  const grupoLink = params.id
  const router = useRouter()
  const demo = !isSupabaseConfigured()

  const { user, loading: userLoading } = useUser()
  const [carga, setCarga] = useState<Carga>({ tipo: 'cargando' })

  const hayUsuario = Boolean(user)
  useEffect(() => {
    if (demo || userLoading) return
    if (!hayUsuario) {
      router.push(
        `/login?redirect=${encodeURIComponent(`/group/${grupoLink}`)}`
      )
      return
    }
    let vivo = true
    void unirseYCargar(grupoLink).then((c) => {
      if (vivo) setCarga(c)
    })
    return () => {
      vivo = false
    }
  }, [demo, hayUsuario, userLoading, grupoLink, router])

  const reintentar = () => {
    setCarga({ tipo: 'cargando' })
    void unirseYCargar(grupoLink).then(setCarga)
  }

  if (demo) {
    return (
      <>
        <SiteHeader variant="app" />
        <main id="contenido" className="flex-1">
          <div className="mx-auto max-w-content px-4 py-16 md:px-6 lg:px-8">
            <EmptyState
              headingLevel="h1"
              title="Los viajes en grupo no están disponibles ahora"
              description="Las salas de grupo necesitan una cuenta, y las cuentas todavía no están listas. Mientras tanto puedes trazar tu viaje y compartirlo."
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
      </>
    )
  }

  if (carga.tipo === 'ok' && user) {
    return (
      <GroupRoom
        tripId={carga.tripId}
        trip={carga.trip}
        currentUser={user}
        grupoLink={grupoLink}
      />
    )
  }

  if (carga.tipo === 'error') {
    return (
      <>
        <SiteHeader variant="app" />
        <main id="contenido" className="flex-1">
          <div className="mx-auto max-w-content px-4 py-16 md:px-6 lg:px-8">
            <EmptyState
              headingLevel="h1"
              illustration="error"
              title={carga.titulo}
              description={carga.mensaje}
              action={
                carga.reintentable ? (
                  <Button variant="primary" size="lg" onClick={reintentar}>
                    Reintentar
                  </Button>
                ) : (
                  <ButtonLink href="/viajes" variant="primary" size="lg">
                    Ir a Mis viajes
                  </ButtonLink>
                )
              }
            />
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <SiteHeader variant="app" />
      <main id="contenido" className="flex-1">
        <SkeletonRegion
          label="Abriendo la sala del grupo…"
          className="mx-auto max-w-content px-4 pt-8 pb-20 md:px-6 md:pt-12 lg:px-8"
        >
          <SkeletonPortada />
          <div className="mt-10 lg:grid lg:grid-cols-12 lg:gap-8">
            <div className="hidden lg:col-span-5 lg:block">
              <SkeletonMapa className="h-80" />
            </div>
            <div className="rounded-card border border-border p-4 lg:col-span-7">
              <SkeletonText lines={5} />
            </div>
          </div>
        </SkeletonRegion>
      </main>
    </>
  )
}
