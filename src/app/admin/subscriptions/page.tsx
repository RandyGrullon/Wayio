import type { Metadata } from 'next'
import { CopiarTexto } from '@/components/admin/CopiarTexto'
import { DataTable } from '@/components/admin/DataTable'
import type { Columna } from '@/components/admin/DataTable'
import { Encabezado } from '@/components/admin/Encabezado'
import { FiltrosChips } from '@/components/admin/FiltrosChips'
import { Pagination } from '@/components/admin/Pagination'
import { SearchBar } from '@/components/admin/SearchBar'
import { StatCard } from '@/components/admin/StatCard'
import {
  ETIQUETA_NIVEL,
  cantidad,
  etiqueta,
  fecha,
  idCorto,
  nombrePlan,
  origenSuscripcion,
  usd,
} from '@/components/admin/etiquetas'
import { Badge, EstadoBadge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import type { SubscriptionItem } from '@/lib/admin/queries'
import { formatNumero } from '@/lib/utils/formatters'
import { exigirAdmin } from '../_lib/acceso'
import { datosSuscripciones } from '../_lib/datos'
import {
  coincide,
  hrefCon,
  leerOrden,
  ordenar,
  pagina,
  paginar,
  param,
  planos,
} from '../_lib/listas'
import type { ParamsBusqueda } from '../_lib/listas'

export const metadata: Metadata = { title: 'Suscripciones · Admin' }

const BASE = '/admin/subscriptions'
const PRINCIPALES = ['active', 'trialing', 'past_due', 'canceled']
const FILTROS = [
  { valor: 'all', label: 'Todas' },
  { valor: 'active', label: 'Activas' },
  { valor: 'trialing', label: 'En prueba' },
  { valor: 'past_due', label: 'Pago pendiente' },
  { valor: 'canceled', label: 'Canceladas' },
  { valor: 'otras', label: 'Otras' },
] as const

function enFiltro(s: SubscriptionItem, filtro: string): boolean {
  if (filtro === 'all') return true
  if (filtro === 'otras') return !PRINCIPALES.includes(s.sub.status)
  return s.sub.status === filtro
}

const VALORES_ORDEN: Record<string, (s: SubscriptionItem) => string | number> =
  {
    usuario: (s) => s.email ?? '',
    plan: (s) => nombrePlan(s.sub.plan_id),
    estado: (s) => s.sub.status,
    fin: (s) => s.sub.current_period_end ?? '',
    alta: (s) => s.sub.created_at,
  }

const COLUMNAS: readonly Columna<SubscriptionItem>[] = [
  {
    id: 'usuario',
    encabezado: 'Usuario',
    ordenable: true,
    tarjeta: 'titulo',
    className: 'min-w-[220px]',
    celda: (s) => (
      <span className="block truncate font-medium text-fg">
        {s.email ?? 'Sin email'}
      </span>
    ),
  },
  {
    id: 'plan',
    encabezado: 'Plan',
    ordenable: true,
    tarjeta: 'meta',
    celda: (s) => (
      <span className="block min-w-0">
        <span className="block whitespace-nowrap text-fg">
          {nombrePlan(s.sub.plan_id)}
        </span>
        <span className="block text-caption text-fg-muted">
          {etiqueta(ETIQUETA_NIVEL, s.sub.tier)}
        </span>
      </span>
    ),
    celdaTarjeta: (s) => nombrePlan(s.sub.plan_id),
  },
  {
    id: 'estado',
    encabezado: 'Estado',
    ordenable: true,
    tarjeta: 'meta',
    celda: (s) => <EstadoBadge tipo="suscripcion" estado={s.sub.status} />,
  },
  {
    id: 'origen',
    encabezado: 'Origen',
    tarjeta: 'meta',
    celda: (s) => {
      const o = origenSuscripcion(s.sub)
      return <Badge variant={o.variant}>{o.label}</Badge>
    },
  },
  {
    id: 'stripe',
    encabezado: 'ID de Stripe',
    className: 'max-lg:hidden',
    celda: (s) => {
      const valor = s.sub.stripe_subscription_id ?? s.sub.stripe_customer_id
      return valor ? (
        <CopiarTexto
          valor={valor}
          mostrar={idCorto(valor)}
          etiqueta="Copiar ID de Stripe"
        />
      ) : (
        <span className="text-fg-subtle">—</span>
      )
    },
  },
  {
    id: 'fin',
    encabezado: 'Fin del periodo',
    ordenable: true,
    className: 'whitespace-nowrap text-fg-muted',
    celda: (s) =>
      s.sub.current_period_end ? fecha(s.sub.current_period_end) : '—',
  },
  {
    id: 'alta',
    encabezado: 'Alta',
    ordenable: true,
    className: 'whitespace-nowrap text-fg-muted',
    celda: (s) => fecha(s.sub.created_at),
  },
]

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<ParamsBusqueda>
}) {
  if (!(await exigirAdmin())) return null
  const sp = await searchParams
  const actuales = planos(sp)
  const search = param(sp, 'search')
  const pedido = param(sp, 'estado') ?? 'all'
  const filtro = FILTROS.some((f) => f.valor === pedido) ? pedido : 'all'
  const orden = leerOrden(sp, Object.keys(VALORES_ORDEN), {
    columna: 'alta',
    dir: 'desc',
  })

  const { items, mrr, arr, activeCount, payingCount, manualCount, byTier } =
    await datosSuscripciones()

  const buscadas = items.filter((s) => coincide(s.email, search))
  const filtradas = buscadas.filter((s) => enFiltro(s, filtro))
  const {
    items: visibles,
    total,
    page,
    pageSize,
  } = paginar(ordenar(filtradas, orden, VALORES_ORDEN), pagina(sp))
  const opciones = FILTROS.map((f) => ({
    valor: f.valor,
    label: f.label,
    count: buscadas.filter((s) => enFiltro(s, f.valor)).length,
  })).filter((f) => f.valor !== 'otras' || f.count > 0)

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Suscripciones"
        descripcion="Planes de pago e ingresos recurrentes. Los planes concedidos a mano no suman al MRR."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          principal
          label="Ingreso mensual (MRR)"
          value={usd(mrr)}
          caption={`ARR estimado: ${usd(arr)}`}
        />
        <StatCard
          label="Activas de pago"
          value={formatNumero(activeCount)}
          caption={`${formatNumero(payingCount)} cobradas · ${formatNumero(manualCount)} concedidas`}
        />
        <StatCard
          label="Pro / Grupo"
          value={`${formatNumero(byTier['pro'] ?? 0)} / ${formatNumero(byTier['grupo'] ?? 0)}`}
          caption={`${formatNumero(byTier['free'] ?? 0)} en Gratis`}
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchBar
          basePath={BASE}
          actuales={actuales}
          etiqueta="Buscar suscripciones por email"
          placeholder="Buscar por email…"
        />
        <FiltrosChips
          etiqueta="Filtrar por estado"
          activo={filtro}
          opciones={opciones}
          hrefDe={(v) =>
            hrefCon(BASE, actuales, { estado: v === 'all' ? null : v })
          }
        />
      </div>

      <DataTable
        etiqueta="Suscripciones"
        cabecera={
          <span className="tnum">
            {cantidad(total, 'suscripción', 'suscripciones')}
          </span>
        }
        columnas={COLUMNAS}
        filas={visibles}
        clave={(s) => s.sub.id}
        href={(s) => `/admin/users/${s.sub.user_id}?tab=suscripcion`}
        etiquetaEnlace={(s) =>
          `Ver la suscripción de ${s.email ?? 'este usuario'}`
        }
        orden={{
          actual: orden,
          hrefDe: (columna, dir) =>
            hrefCon(BASE, actuales, { orden: columna, dir }),
        }}
        vacio={
          search || filtro !== 'all' ? (
            <EmptyState
              illustration="sello"
              title={
                search
                  ? `Ningún resultado para «${search}»`
                  : 'Ninguna suscripción en este estado'
              }
              action={
                <ButtonLink
                  href={hrefCon(BASE, actuales, { search: null, estado: null })}
                  variant="outline"
                >
                  {search ? 'Limpiar búsqueda' : 'Ver todas'}
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              title="Aún no hay suscripciones"
              description="Cuando alguien pague un plan o le concedas uno, aparecerá aquí."
            />
          )
        }
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
