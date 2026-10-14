'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import dynamic from 'next/dynamic'
import { AnimatePresence, m } from 'framer-motion'
import { Check, Copy, Map as MapIcon } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { AvatarStack, indiceDesdeId } from '@/components/ui/Avatar'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  Skeleton,
  SkeletonMapa,
  SkeletonRegion,
  SkeletonText,
} from '@/components/ui/Skeleton'
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'
import { DUR, EASE } from '@/components/ui/motion'
import { useGroup } from '@/hooks/useGroup'
import { track } from '@/lib/analytics/events'
import {
  formatFecha,
  formatHora12,
  formatRangoFechas,
  formatViajeros,
  toISODateLocal,
} from '@/lib/utils/formatters'
import type { Trip } from '@/types/trip'
import { GroupChat } from './GroupChat'
import { GroupExpenses } from './GroupExpenses'
import { MiembrosPanel } from './MiembrosPanel'
import { useCompartirUbicacion } from './useCompartirUbicacion'
import { VotingPanel } from './VotingPanel'

const TripMap = dynamic(
  () => import('@/components/map/TripMap').then((mod) => mod.TripMap),
  { ssr: false, loading: () => <SkeletonMapa className="h-full" /> }
)

type GroupTab = 'chat' | 'votos' | 'gastos' | 'miembros'

interface GroupRoomProps {
  tripId: string
  trip: Trip
  currentUser: User
  /** Enlace de invitación (grupo_link) con el que se abrió la sala. */
  grupoLink: string
}

// ─── Escritorio (≥ lg): la columna de miembros va a la izquierda ──────────
const MQ_ESCRITORIO = '(min-width: 1024px)'
function suscribirMq(cb: () => void) {
  const mq = window.matchMedia(MQ_ESCRITORIO)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const esEscritorioAhora = () => window.matchMedia(MQ_ESCRITORIO).matches
const enServidor = () => false

/** Hoy y ayer en hora local (la sala solo se pinta en el cliente). */
function fechasDeHoy() {
  const hoy = new Date()
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1)
  return {
    hoy: toISODateLocal(hoy),
    ayer: toISODateLocal(ayer),
    hoyCorto: formatFecha(hoy, { diaSemana: false }),
  }
}

/**
 * Sala del grupo (docs/DISENO.md §6.8): header app con avatares, portada
 * con «Invitar», mapa y miembros a la izquierda (grid 5/7) y pestañas Chat ·
 * Votos · Gastos (+ Miembros en móvil). Todo con useGroup: optimista, con
 * pendingIds y actionError.
 */
export function GroupRoom({
  tripId,
  trip,
  currentUser,
  grupoLink,
}: GroupRoomProps) {
  const grupo = useGroup(tripId, currentUser.id)
  // Aquí y no en MiembrosPanel: en móvil ese panel es una pestaña que se
  // desmonta al cambiar de pestaña, y eso apagaría el GPS sin avisar.
  const ubicacion = useCompartirUbicacion(grupo.updateLocation)
  const { success, error: toastError } = useToast()
  const [tab, setTab] = useState<GroupTab>('chat')
  const [copiado, setCopiado] = useState(false)
  const [fechas] = useState(fechasDeHoy)
  const escritorio = useSyncExternalStore(
    suscribirMq,
    esEscritorioAhora,
    enServidor
  )
  // En escritorio no existe la pestaña Miembros (va en la columna izquierda).
  const tabActiva: GroupTab = escritorio && tab === 'miembros' ? 'chat' : tab
  const moneda = trip.moneda ?? 'USD'

  const personas = grupo.members.map((mm) => ({
    name: mm.user_id === currentUser.id ? `${mm.nombre} (tú)` : mm.nombre,
    index: indiceDesdeId(mm.user_id),
  }))

  // Avatares-pin en el mapa con la última ubicación compartida (§6.8).
  const miembrosMapa = useMemo(
    () =>
      grupo.members.flatMap((mm) =>
        mm.lat_actual !== null && mm.lng_actual !== null
          ? [
              {
                id: mm.user_id,
                nombre:
                  mm.user_id === currentUser.id
                    ? `${mm.nombre} (tú)`
                    : mm.nombre,
                lat: mm.lat_actual,
                lng: mm.lng_actual,
                index: indiceDesdeId(mm.user_id),
              },
            ]
          : []
      ),
    [grupo.members, currentUser.id]
  )

  // Actividades votables por día (los traslados no se votan).
  const dias = useMemo(
    () =>
      trip.dias
        .map((d) => ({
          dia: d,
          actividades: d.actividades.filter((a) => a.tipo !== 'traslado'),
        }))
        .filter((d) => d.actividades.length > 0),
    [trip.dias]
  )
  const totalVotables = dias.reduce((n, d) => n + d.actividades.length, 0)

  const votos = useMemo(() => {
    const porActividad = new Map<
      string,
      { si: number; no: number; mio: boolean | null }
    >()
    for (const v of grupo.votes) {
      const actual = porActividad.get(v.activity_id) ?? {
        si: 0,
        no: 0,
        mio: null,
      }
      if (v.voto) actual.si++
      else actual.no++
      if (v.user_id === currentUser.id) actual.mio = v.voto
      porActividad.set(v.activity_id, actual)
    }
    return porActividad
  }, [grupo.votes, currentUser.id])

  async function invitar() {
    const url = `${window.location.origin}/group/${grupoLink}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 1600)
      success('Enlace copiado', {
        description: 'Envíalo a quien quieras sumar a la sala.',
      })
      track('viaje_compartido', { tripId, metodo: 'grupo' })
    } catch {
      toastError('No pudimos copiar el enlace. Cópialo desde la barra.')
    }
  }

  const columnaMiembros = (
    <div className="flex flex-col gap-6">
      <div className="h-80 overflow-hidden rounded-card border border-border">
        <TripMap
          dias={trip.dias}
          miembros={miembrosMapa}
          moneda={moneda}
          etiqueta={`Mapa del grupo: ${trip.destino}`}
          className="h-full"
        />
      </div>
      <MiembrosPanel
        members={grupo.members}
        currentUserId={currentUser.id}
        ubicacion={ubicacion}
        hoy={fechas.hoyCorto}
      />
    </div>
  )

  const fechasViaje = formatRangoFechas(trip.fechaInicio, trip.fechaFin)

  return (
    <>
      <SiteHeader
        variant="app"
        // Señal visible en cualquier pestaña de que tu ubicación se comparte.
        enVivo={ubicacion.estado === 'activa'}
        extra={
          personas.length > 0 ? (
            <AvatarStack people={personas} max={3} size="sm" />
          ) : null
        }
      />
      <main id="contenido" className="flex-1">
        <div className="mx-auto max-w-content px-4 pt-8 pb-20 md:px-6 md:pt-12 lg:px-8">
          {/* Portada */}
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="min-w-0">
              <p className="kicker kicker-filete">Sala del grupo</p>
              <h1 className="mt-3 font-display text-h1 break-words text-fg">
                {trip.destino}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {personas.length > 0 ? (
                  <AvatarStack people={personas} max={5} />
                ) : null}
                <p className="text-body-s text-fg-muted tnum">
                  {grupo.loading && grupo.members.length === 0
                    ? 'Cargando viajeros…'
                    : formatViajeros(grupo.members.length)}
                  {fechasViaje ? ` · ${fechasViaje}` : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="md"
                onClick={() => void invitar()}
                icon={
                  <AnimatePresence mode="popLayout" initial={false}>
                    <m.span
                      key={copiado ? 'ok' : 'copiar'}
                      className="inline-flex"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: DUR.fast, ease: EASE.papel }}
                    >
                      {copiado ? <Check /> : <Copy />}
                    </m.span>
                  </AnimatePresence>
                }
              >
                {copiado ? 'Enlace copiado' : 'Invitar'}
              </Button>
              <ButtonLink
                href={`/trip/${tripId}`}
                variant="ghost"
                size="md"
                icon={<MapIcon />}
              >
                Ver itinerario
              </ButtonLink>
            </div>
          </div>

          {grupo.error ? (
            <EmptyState
              illustration="error"
              title="No pudimos cargar la sala"
              description={grupo.error}
              className="mt-8"
              action={
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => void grupo.reload()}
                >
                  Reintentar
                </Button>
              }
            />
          ) : grupo.loading && grupo.members.length === 0 ? (
            <SkeletonRegion label="Cargando la sala…" className="mt-10">
              <div className="lg:grid lg:grid-cols-12 lg:gap-8">
                <div className="hidden flex-col gap-6 lg:col-span-5 lg:flex">
                  <SkeletonMapa className="h-80" />
                  <Skeleton className="h-40 rounded-card" />
                </div>
                <div className="flex flex-col gap-4 lg:col-span-7">
                  <Skeleton className="h-12 w-72 max-w-full rounded-[6px]" />
                  <div className="rounded-card border border-border p-4">
                    <SkeletonText lines={4} />
                  </div>
                </div>
              </div>
            </SkeletonRegion>
          ) : (
            <div className="mt-10 lg:grid lg:grid-cols-12 lg:gap-8">
              {escritorio ? (
                <aside
                  aria-label="Mapa y viajeros"
                  className="lg:sticky lg:top-24 lg:col-span-5 lg:self-start"
                >
                  {columnaMiembros}
                </aside>
              ) : null}

              <div className="min-w-0 lg:col-span-7">
                {grupo.actionError ? (
                  <Callout
                    tone="danger"
                    className="mb-5"
                    action={
                      <Button variant="link" onClick={grupo.clearActionError}>
                        Entendido
                      </Button>
                    }
                  >
                    {grupo.actionError}
                  </Callout>
                ) : null}

                <Tabs
                  value={tabActiva}
                  onValueChange={(v) => setTab(v as GroupTab)}
                  id="grupo"
                >
                  <TabList label="Secciones de la sala">
                    <Tab value="chat">Chat</Tab>
                    <Tab value="votos" count={totalVotables}>
                      Votos
                    </Tab>
                    <Tab
                      value="gastos"
                      {...(grupo.expenses.length > 0
                        ? { count: grupo.expenses.length }
                        : {})}
                    >
                      Gastos
                    </Tab>
                    {escritorio ? null : <Tab value="miembros">Miembros</Tab>}
                  </TabList>

                  <TabPanel value="chat" className="pt-5">
                    <GroupChat
                      messages={grupo.messages}
                      currentUserId={currentUser.id}
                      pendingIds={grupo.pendingIds}
                      onSend={grupo.sendMessage}
                      hoy={fechas.hoy}
                      ayer={fechas.ayer}
                    />
                  </TabPanel>

                  <TabPanel value="votos" className="pt-5">
                    {dias.length === 0 ? (
                      <EmptyState
                        title="No hay actividades para votar"
                        description="Cuando el itinerario tenga actividades, el grupo podrá decidir cuáles incluir."
                        className="py-6"
                      />
                    ) : (
                      <div className="flex flex-col gap-8">
                        {dias.map(({ dia, actividades }) => (
                          <section
                            key={dia.numero}
                            aria-labelledby={`grupo-dia-${dia.numero}`}
                          >
                            <h2
                              id={`grupo-dia-${dia.numero}`}
                              className="kicker"
                            >
                              Día {String(dia.numero).padStart(2, '0')}
                              {dia.ciudad ? ` · ${dia.ciudad}` : ''}
                            </h2>
                            <ul className="mt-3 flex flex-col gap-3">
                              {actividades.map((act) => {
                                const v = votos.get(act.id)
                                const hora = formatHora12(act.horaInicio)
                                return (
                                  <li key={act.id}>
                                    <VotingPanel
                                      question={`¿Incluimos ${act.nombre}?`}
                                      {...(hora
                                        ? {
                                            detalle: `Día ${dia.numero} · ${hora}`,
                                          }
                                        : {})}
                                      si={v?.si ?? 0}
                                      no={v?.no ?? 0}
                                      miVoto={v?.mio ?? null}
                                      onVote={(voto) =>
                                        void grupo.castVote(act.id, voto)
                                      }
                                    />
                                  </li>
                                )
                              })}
                            </ul>
                          </section>
                        ))}
                      </div>
                    )}
                  </TabPanel>

                  <TabPanel value="gastos" className="pt-5">
                    <GroupExpenses
                      expenses={grupo.expenses}
                      members={grupo.members}
                      currentUserId={currentUser.id}
                      moneda={moneda}
                      pendingIds={grupo.pendingIds}
                      addExpense={grupo.addExpense}
                    />
                  </TabPanel>

                  {escritorio ? null : (
                    <TabPanel value="miembros" className="pt-5">
                      {columnaMiembros}
                    </TabPanel>
                  )}
                </Tabs>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
