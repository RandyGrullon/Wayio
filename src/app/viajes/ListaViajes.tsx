'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Ellipsis,
  ExternalLink,
  MessagesSquare,
  Trash2,
} from 'lucide-react'
import { Badge, EstadoBadge } from '@/components/ui/Badge'
import { Button, ButtonLink, buttonClasses } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { CardFranja, CardPerforado } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Menu } from '@/components/ui/Menu'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Segmented } from '@/components/ui/Segmented'
import { Skeleton, SkeletonRegion } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useUser } from '@/hooks/useUser'
import { modoLocalSinCuentas } from '@/lib/auth/irALogin'
import { cn } from '@/lib/utils/cn'
import {
  contarDias,
  diasHasta,
  formatDias,
  formatFaltan,
  formatHaceTiempo,
  formatRangoFechas,
  formatViajeros,
  hoyLocal,
} from '@/lib/utils/formatters'
import type { TripRow } from '@/types/database'

type Periodo = 'proximos' | 'en_curso' | 'pasados'

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'ok'; trips: TripRow[]; hoy: string; ahora: number }
  | { tipo: 'sin_sesion' }
  | { tipo: 'no_disponible' }
  | { tipo: 'error'; mensaje: string }

const PAQUETE: Record<string, string> = {
  basico: 'Básico',
  confort: 'Confort',
  premium: 'Premium',
}

/** 'YYYY-MM-DD' comparable como texto; '' si no hay fecha. */
function fechaDe(v: unknown): string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)
    ? v.slice(0, 10)
    : ''
}

function periodoDe(row: TripRow, hoy: string): Periodo {
  const inicio = fechaDe(row.data?.fechaInicio)
  const fin = fechaDe(row.data?.fechaFin) || inicio
  if (row.estado === 'completado') return 'pasados'
  if (!inicio) return 'proximos'
  if (fin && fin < hoy) return 'pasados'
  if (inicio <= hoy) return 'en_curso'
  return 'proximos'
}

function ordenar(lista: TripRow[], periodo: Periodo): TripRow[] {
  const ini = (r: TripRow) => fechaDe(r.data?.fechaInicio)
  const fin = (r: TripRow) => fechaDe(r.data?.fechaFin) || ini(r)
  const copia = lista.slice()
  if (periodo === 'pasados') {
    copia.sort((a, b) => fin(b).localeCompare(fin(a)))
  } else if (periodo === 'en_curso') {
    copia.sort((a, b) => fin(a).localeCompare(fin(b)))
  } else {
    copia.sort((a, b) => ini(a).localeCompare(ini(b)))
  }
  return copia
}

async function leerJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const b = (await res.json()) as unknown
    return typeof b === 'object' && b !== null
      ? (b as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

/** GET /api/trips → estado de la lista. Nunca lanza. */
async function pedirViajes(): Promise<Estado> {
  try {
    const res = await fetch('/api/trips', { cache: 'no-store' })
    const body = await leerJson(res)
    if (res.status === 401) return { tipo: 'sin_sesion' }
    if (res.status === 503 && body['code'] === 'auth_unavailable') {
      return { tipo: 'no_disponible' }
    }
    if (!res.ok || !Array.isArray(body['trips'])) {
      return {
        tipo: 'error',
        mensaje:
          typeof body['error'] === 'string'
            ? body['error']
            : 'Revisa tu conexión e inténtalo de nuevo.',
      }
    }
    return {
      tipo: 'ok',
      trips: body['trips'] as TripRow[],
      hoy: hoyLocal(),
      ahora: Date.now(),
    }
  } catch {
    return {
      tipo: 'error',
      mensaje: 'Revisa tu conexión e inténtalo de nuevo.',
    }
  }
}

/**
 * «Mis viajes» (docs/DISENO.md §6.11): GET /api/trips → viajes propios y
 * aquellos en los que soy miembro (user_id distinto = «compartido contigo»).
 * Filtros Próximos | En curso | Pasados, boletos mini y estados de carga,
 * error, vacío y sin sesión.
 */
export function ListaViajes({ suscripcionOk }: { suscripcionOk: boolean }) {
  const { user } = useUser()
  const { success, error: toastError } = useToast()
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' })
  const [periodoElegido, setPeriodoElegido] = useState<Periodo | null>(null)
  const [aBorrar, setABorrar] = useState<TripRow | null>(null)

  useEffect(() => {
    let vivo = true
    void pedirViajes().then((e) => {
      if (vivo) setEstado(e)
    })
    return () => {
      vivo = false
    }
  }, [])

  const reintentar = () => {
    setEstado({ tipo: 'cargando' })
    void pedirViajes().then(setEstado)
  }

  const grupos = useMemo(() => {
    const vacio: Record<Periodo, TripRow[]> = {
      proximos: [],
      en_curso: [],
      pasados: [],
    }
    if (estado.tipo !== 'ok') return vacio
    for (const row of estado.trips) vacio[periodoDe(row, estado.hoy)].push(row)
    return vacio
  }, [estado])

  // Por defecto: en curso si hay alguno; si no, próximos; si no, pasados.
  const periodoPorDefecto: Periodo =
    grupos.en_curso.length > 0
      ? 'en_curso'
      : grupos.proximos.length > 0 || grupos.pasados.length === 0
        ? 'proximos'
        : 'pasados'
  const periodo = periodoElegido ?? periodoPorDefecto

  async function borrar(row: TripRow) {
    let res: Response
    try {
      res = await fetch(`/api/trips/${row.id}`, { method: 'DELETE' })
    } catch (e) {
      toastError(
        'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.'
      )
      throw e
    }
    if (!res.ok) {
      const body = await leerJson(res)
      toastError(
        typeof body['error'] === 'string'
          ? body['error']
          : 'No pudimos eliminar el viaje. Inténtalo de nuevo.'
      )
      throw new Error('borrado fallido')
    }
    setEstado((e) =>
      e.tipo === 'ok'
        ? { ...e, trips: e.trips.filter((t) => t.id !== row.id) }
        : e
    )
    success('Viaje eliminado')
  }

  const avisoSuscripcion = suscripcionOk ? (
    <Callout tone="success" title="¡Gracias! Recibimos tu pago">
      Tu plan puede tardar unos segundos en activarse. Puedes verlo en{' '}
      <Link
        href="/cuenta"
        className="font-semibold underline underline-offset-[3px]"
      >
        Tu cuenta
      </Link>
      .
    </Callout>
  ) : null

  if (estado.tipo === 'cargando') {
    return (
      <>
        {avisoSuscripcion}
        <SkeletonRegion
          label="Cargando tus viajes…"
          className={cn(suscripcionOk && 'mt-6')}
        >
          <Skeleton className="h-11 w-80 max-w-full rounded-full" />
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                aria-hidden="true"
                className="overflow-hidden rounded-card border border-border bg-surface"
              >
                <Skeleton className="h-9 rounded-none" />
                <div className="flex flex-col gap-3 p-5">
                  <Skeleton className="h-6 w-2/3 rounded-[6px]" />
                  <Skeleton className="h-3 w-1/2 rounded-[4px]" />
                  <Skeleton className="h-3 w-1/3 rounded-[4px]" />
                </div>
                <div className="flex justify-between border-t border-border px-5 py-3">
                  <Skeleton className="h-6 w-24 rounded-stamp" />
                  <Skeleton className="h-3 w-20 rounded-[4px]" />
                </div>
              </li>
            ))}
          </ul>
        </SkeletonRegion>
      </>
    )
  }

  if (estado.tipo === 'sin_sesion') {
    return (
      <EmptyState
        title="Inicia sesión para ver tus viajes"
        description="Tus viajes guardados y los que te compartan aparecen aquí."
        action={
          <ButtonLink
            href="/login?redirect=%2Fviajes"
            variant="primary"
            size="lg"
            iconEnd={<ArrowRight />}
          >
            Iniciar sesión
          </ButtonLink>
        }
      />
    )
  }

  if (estado.tipo === 'no_disponible') {
    return (
      <EmptyState
        title="Tus viajes guardados aparecerán aquí"
        description={
          modoLocalSinCuentas()
            ? 'Guardar viajes necesita una cuenta, y las cuentas todavía no están disponibles. Mientras tanto puedes trazar un viaje sin iniciar sesión.'
            : 'Guardar viajes necesita una cuenta, y las cuentas todavía no están disponibles. Vuelve a intentarlo más tarde.'
        }
        action={
          <ButtonLink
            href="/planificar"
            variant="primary"
            size="lg"
            iconEnd={<ArrowRight />}
          >
            Trazar un viaje
          </ButtonLink>
        }
      />
    )
  }

  if (estado.tipo === 'error') {
    return (
      <EmptyState
        illustration="error"
        title="No pudimos cargar tus viajes"
        description={estado.mensaje}
        action={
          <Button variant="primary" size="lg" onClick={reintentar}>
            Reintentar
          </Button>
        }
      />
    )
  }

  if (estado.trips.length === 0) {
    return (
      <>
        {avisoSuscripcion}
        <EmptyState
          title="Aún no tienes viajes guardados"
          description="Cuando guardes un itinerario, o alguien te invite a su grupo, lo verás aquí."
          action={
            <ButtonLink
              href="/planificar"
              variant="primary"
              size="lg"
              iconEnd={<ArrowRight />}
            >
              Trazar mi primer viaje
            </ButtonLink>
          }
        />
      </>
    )
  }

  const visibles = ordenar(grupos[periodo], periodo)
  const ahora = new Date(estado.ahora)

  return (
    <>
      {avisoSuscripcion}
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-4',
          suscripcionOk && 'mt-6'
        )}
      >
        <Segmented<Periodo>
          label="Filtrar viajes"
          value={periodo}
          onValueChange={setPeriodoElegido}
          options={[
            {
              value: 'proximos',
              label: `Próximos · ${grupos.proximos.length}`,
              ariaLabel: `Próximos, ${grupos.proximos.length}`,
            },
            {
              value: 'en_curso',
              label: `En curso · ${grupos.en_curso.length}`,
              ariaLabel: `En curso, ${grupos.en_curso.length}`,
            },
            {
              value: 'pasados',
              label: `Pasados · ${grupos.pasados.length}`,
              ariaLabel: `Pasados, ${grupos.pasados.length}`,
            },
          ]}
        />
      </div>

      {visibles.length === 0 ? (
        <p className="mt-10 text-body text-fg-muted" role="status">
          {periodo === 'proximos'
            ? 'No tienes viajes próximos.'
            : periodo === 'en_curso'
              ? 'Ningún viaje en curso ahora mismo.'
              : 'Todavía no tienes viajes pasados.'}
        </p>
      ) : (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((row) => (
            <BoletoViaje
              key={row.id}
              row={row}
              periodo={periodo}
              ahora={ahora}
              esDueno={Boolean(user && row.user_id === user.id)}
              compartido={Boolean(user && row.user_id !== user.id)}
              onEliminar={() => setABorrar(row)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={aBorrar !== null}
        onClose={() => setABorrar(null)}
        onConfirm={() => (aBorrar ? borrar(aBorrar) : undefined)}
        title="¿Eliminar este viaje?"
        description={
          aBorrar
            ? `Se borrará «${aBorrar.data?.destino ?? 'este viaje'}» con su sala de grupo, chat, votos y gastos. No se puede deshacer.`
            : undefined
        }
        confirmLabel="Eliminar viaje"
        loadingLabel="Eliminando…"
      />
    </>
  )
}

function BoletoViaje({
  row,
  periodo,
  ahora,
  esDueno,
  compartido,
  onEliminar,
}: {
  row: TripRow
  periodo: Periodo
  ahora: Date
  esDueno: boolean
  compartido: boolean
  onEliminar: () => void
}) {
  const trip = row.data
  const destino = trip?.destino?.trim() || 'Viaje sin nombre'
  const inicio = fechaDe(trip?.fechaInicio)
  const fin = fechaDe(trip?.fechaFin) || inicio
  const dias = contarDias(inicio, fin)
  const personas = typeof trip?.personas === 'number' ? trip.personas : 0
  const paquete = PAQUETE[row.paquete] ?? null

  const meta: string[] = []
  if (personas > 0) meta.push(formatViajeros(personas))
  if (paquete) meta.push(`Plan ${paquete}`)

  const faltan =
    periodo === 'proximos' && inicio ? formatFaltan(diasHasta(inicio)) : null
  // Día del viaje en curso: 1 el día de salida (diasHasta es negativo después).
  const diaActual =
    periodo === 'en_curso' && inicio && dias > 0
      ? Math.min(dias, Math.max(1, 1 - diasHasta(inicio, ahora)))
      : null

  const items = [
    {
      key: 'abrir',
      label: 'Abrir viaje',
      icon: <ExternalLink />,
      href: `/trip/${row.id}`,
    },
    ...(row.grupo_link
      ? [
          {
            key: 'grupo',
            label: 'Sala del grupo',
            icon: <MessagesSquare />,
            href: `/group/${row.grupo_link}`,
          },
        ]
      : []),
    ...(esDueno
      ? [
          {
            key: 'eliminar',
            label: 'Eliminar viaje',
            icon: <Trash2 />,
            onSelect: onEliminar,
            tone: 'danger' as const,
            separatorBefore: true,
          },
        ]
      : []),
  ]

  return (
    <li className="flex">
      <article className="group/boleto relative flex w-full flex-col overflow-hidden rounded-card border border-border bg-surface transition-[border-color,box-shadow,transform] duration-(--dur-base) ease-papel focus-within:border-rule hover:-translate-y-0.5 hover:border-rule hover:shadow-elev">
        <CardFranja extra={dias > 0 ? formatDias(dias) : undefined}>
          {compartido ? 'Compartido contigo' : 'Wayio · Tu ruta'}
        </CardFranja>
        <div className="flex-1 px-5 pt-4 pb-5">
          <h2 className="font-display text-[20px] leading-tight text-fg">
            {/* El enlace cubre toda la tarjeta (el menú queda por encima). */}
            <Link
              href={`/trip/${row.id}`}
              className="rounded-sm after:absolute after:inset-0 after:content-['']"
            >
              {destino}
            </Link>
          </h2>
          {inicio ? (
            <p className="mt-1.5 text-body-s text-fg-muted tnum">
              {formatRangoFechas(inicio, fin)}
            </p>
          ) : null}
          {meta.length > 0 ? (
            <p className="mt-0.5 text-caption text-fg-subtle">
              {meta.join(' · ')}
            </p>
          ) : null}
          {faltan ? (
            <p className="mt-3 text-label text-fg tnum">{faltan}</p>
          ) : null}
          {diaActual ? (
            <p className="mt-3 text-label text-fg tnum">
              Día {diaActual} de {dias}
            </p>
          ) : null}
        </div>
        <CardPerforado />
        <div className="flex items-center justify-between gap-3 px-5 pt-1 pb-3">
          {periodo === 'pasados' && row.estado !== 'completado' ? (
            <Badge>Terminado</Badge>
          ) : (
            <EstadoBadge tipo="viaje" estado={row.estado} />
          )}
          <div className="relative z-10 flex items-center gap-1">
            <span className="text-caption text-fg-subtle">
              Editado {formatHaceTiempo(row.updated_at, ahora)}
            </span>
            <Menu
              label={`Acciones de ${destino}`}
              align="end"
              triggerClassName={cn(
                buttonClasses({ variant: 'ghost', size: 'icon-sm' })
              )}
              trigger={<Ellipsis aria-hidden="true" strokeWidth={1.75} />}
              items={items}
            />
          </div>
        </div>
      </article>
    </li>
  )
}
