import type { Metadata } from 'next'
import { AccionesFila } from '@/components/admin/AccionesFila'
import { DataTable } from '@/components/admin/DataTable'
import type { Columna } from '@/components/admin/DataTable'
import { Encabezado } from '@/components/admin/Encabezado'
import { FiltrosChips } from '@/components/admin/FiltrosChips'
import { Pagination } from '@/components/admin/Pagination'
import { SearchBar } from '@/components/admin/SearchBar'
import {
  ETIQUETA_PAQUETE,
  cantidad,
  etiqueta,
  fecha,
} from '@/components/admin/etiquetas'
import { BADGE_VIAJE, EstadoBadge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { deleteTrip } from '@/lib/admin/actions'
import type { TripListItem } from '@/lib/admin/queries'
import { formatCurrency, formatNumero } from '@/lib/utils/formatters'
import { exigirAdmin } from '../_lib/acceso'
import { datosViajes } from '../_lib/datos'
import { hrefCon, pagina, param, planos } from '../_lib/listas'
import type { ParamsBusqueda } from '../_lib/listas'

export const metadata: Metadata = { title: 'Viajes · Admin' }

const BASE = '/admin/trips'

const ESTADOS = ['all', 'planificando', 'en_viaje', 'completado'] as const

function presupuesto(t: TripListItem): string {
  return t.presupuesto > 0 ? formatCurrency(t.presupuesto, t.moneda) : '—'
}

const COLUMNAS: readonly Columna<TripListItem>[] = [
  {
    id: 'destino',
    encabezado: 'Destino',
    tarjeta: 'titulo',
    className: 'min-w-[240px]',
    celda: (t) => (
      <span className="block min-w-0">
        <span className="block truncate font-medium text-fg">{t.destino}</span>
        <span className="block truncate text-caption text-fg-muted">
          {t.ownerEmail ?? 'Dueño desconocido'}
        </span>
      </span>
    ),
  },
  {
    id: 'paquete',
    encabezado: 'Paquete',
    tarjeta: 'meta',
    celda: (t) => etiqueta(ETIQUETA_PAQUETE, t.paquete),
  },
  {
    id: 'estado',
    encabezado: 'Estado',
    tarjeta: 'meta',
    celda: (t) => <EstadoBadge tipo="viaje" estado={t.estado} />,
  },
  {
    id: 'dias',
    encabezado: 'Días',
    alinear: 'fin',
    celda: (t) => formatNumero(t.dias),
  },
  {
    id: 'presupuesto',
    encabezado: 'Presupuesto',
    alinear: 'fin',
    tarjeta: 'meta',
    className: 'whitespace-nowrap',
    // En la moneda de cada viaje («US$1,840», «RD$108,500», «€1,840»).
    celda: (t) => presupuesto(t),
    // En la tarjeta móvil va junto a los días (máximo 3 metadatos).
    celdaTarjeta: (t) =>
      `${presupuesto(t)} · ${cantidad(t.dias, 'día', 'días')}`,
  },
  {
    id: 'creado',
    encabezado: 'Creado',
    className: 'whitespace-nowrap text-fg-muted',
    celda: (t) => fecha(t.created_at),
  },
]

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<ParamsBusqueda>
}) {
  if (!(await exigirAdmin())) return null
  const sp = await searchParams
  const actuales = planos(sp)
  const search = param(sp, 'search')
  const pedido = param(sp, 'estado') ?? 'all'
  const estado = (ESTADOS as readonly string[]).includes(pedido)
    ? pedido
    : 'all'

  const { items, total, page, pageSize, conteos } = await datosViajes({
    search,
    estado,
    page: pagina(sp),
  })

  const vacio = search ? (
    <EmptyState
      illustration="sello"
      title={`Ningún resultado para «${search}»`}
      description="Busca por el nombre del destino."
      action={
        <ButtonLink
          href={hrefCon(BASE, actuales, { search: null })}
          variant="outline"
        >
          Limpiar búsqueda
        </ButtonLink>
      }
    />
  ) : estado !== 'all' ? (
    <EmptyState
      illustration="sello"
      title="Ningún viaje en este estado"
      action={
        <ButtonLink
          href={hrefCon(BASE, actuales, { estado: null })}
          variant="outline"
        >
          Ver todos
        </ButtonLink>
      }
    />
  ) : (
    <EmptyState
      title="Aún no hay viajes guardados"
      description="Cuando alguien guarde un viaje en la web o en la app, aparecerá aquí."
    />
  )

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Viajes"
        descripcion="Itinerarios guardados por los viajeros."
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchBar
          basePath={BASE}
          actuales={actuales}
          etiqueta="Buscar viajes por destino"
          placeholder="Buscar por destino…"
        />
        <FiltrosChips
          etiqueta="Filtrar por estado"
          activo={estado}
          opciones={ESTADOS.map((e) => ({
            valor: e,
            label: e === 'all' ? 'Todos' : (BADGE_VIAJE[e]?.label ?? e),
            count: conteos[e] ?? (e === estado ? total : undefined),
          }))}
          hrefDe={(v) =>
            hrefCon(BASE, actuales, { estado: v === 'all' ? null : v })
          }
        />
      </div>

      <DataTable
        etiqueta="Viajes"
        cabecera={
          <span className="tnum">
            {cantidad(total, 'viaje', 'viajes')}
            {search ? ` a «${search}»` : ''}
          </span>
        }
        columnas={COLUMNAS}
        filas={items}
        clave={(t) => t.id}
        href={(t) => `/admin/trips/${t.id}`}
        etiquetaEnlace={(t) => `Ver el viaje a ${t.destino}`}
        acciones={(t) => (
          <AccionesFila
            etiqueta={`Acciones del viaje a ${t.destino}`}
            acciones={[
              {
                tipo: 'enlace',
                clave: 'ver',
                label: 'Ver detalle',
                href: `/admin/trips/${t.id}`,
                icono: 'ver',
              },
              {
                tipo: 'accion',
                clave: 'eliminar',
                label: 'Eliminar viaje',
                icono: 'borrar',
                peligro: true,
                action: deleteTrip.bind(null, t.id),
                confirm: {
                  titulo: '¿Eliminar este viaje?',
                  descripcion: `Se borran el itinerario a ${t.destino} y su grupo: chat, votos y gastos. No se puede deshacer.`,
                  confirmar: 'Eliminar viaje',
                  cargando: 'Eliminando…',
                  escribir: t.destino,
                },
                exito: 'Viaje eliminado',
                error: 'No se pudo eliminar el viaje',
              },
            ]}
          />
        )}
        vacio={vacio}
        pie={
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            hrefPagina={(p) => hrefCon(BASE, actuales, { page: String(p) })}
          />
        }
      />
    </div>
  )
}
