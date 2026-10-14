import type { Metadata } from 'next'
import { Ban } from 'lucide-react'
import { DataTable } from '@/components/admin/DataTable'
import type { Columna } from '@/components/admin/DataTable'
import { Encabezado } from '@/components/admin/Encabezado'
import { FiltrosChips } from '@/components/admin/FiltrosChips'
import { Pagination } from '@/components/admin/Pagination'
import { SearchBar } from '@/components/admin/SearchBar'
import {
  ETIQUETA_NIVEL,
  ETIQUETA_ROL,
  cantidad,
  etiqueta,
  fecha,
} from '@/components/admin/etiquetas'
import { Avatar, indiceDesdeId } from '@/components/ui/Avatar'
import { Badge, EstadoBadge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import type { UserListItem } from '@/lib/admin/queries'
import { formatNumero } from '@/lib/utils/formatters'
import { exigirAdmin } from '../_lib/acceso'
import { datosUsuarios } from '../_lib/datos'
import { hrefCon, pagina, param, planos } from '../_lib/listas'
import type { ParamsBusqueda } from '../_lib/listas'

export const metadata: Metadata = { title: 'Usuarios · Admin' }

const BASE = '/admin/users'

const ROLES = [
  { valor: 'all', label: 'Todos' },
  { valor: 'user', label: 'Usuarios' },
  { valor: 'admin', label: 'Admins' },
] as const

function Persona({ item }: { item: UserListItem }) {
  const p = item.profile
  const nombre = p.full_name?.trim()
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar name={nombre || p.email} index={indiceDesdeId(p.id)} decorative />
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-fg">
            {nombre || p.email || 'Sin email'}
          </span>
          {p.is_banned ? (
            <Badge variant="error">
              <Ban aria-hidden="true" />
              Baneado
            </Badge>
          ) : null}
        </span>
        {nombre && p.email ? (
          <span className="block truncate text-caption text-fg-muted">
            {p.email}
          </span>
        ) : null}
      </span>
    </span>
  )
}

const COLUMNAS: readonly Columna<UserListItem>[] = [
  {
    id: 'usuario',
    encabezado: 'Usuario',
    tarjeta: 'titulo',
    className: 'min-w-[260px]',
    celda: (u) => <Persona item={u} />,
  },
  {
    id: 'rol',
    encabezado: 'Rol',
    tarjeta: 'meta',
    celda: (u) => (
      <Badge variant={u.profile.role === 'admin' ? 'brand' : 'default'}>
        {etiqueta(ETIQUETA_ROL, u.profile.role)}
      </Badge>
    ),
  },
  {
    id: 'plan',
    encabezado: 'Plan',
    tarjeta: 'meta',
    celda: (u) => (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <Badge variant={u.tier === 'free' ? 'default' : 'success'}>
          {etiqueta(ETIQUETA_NIVEL, u.tier)}
        </Badge>
        {u.status && u.status !== 'active' ? (
          <EstadoBadge tipo="suscripcion" estado={u.status} />
        ) : null}
      </span>
    ),
  },
  {
    id: 'viajes',
    encabezado: 'Viajes',
    alinear: 'fin',
    tarjeta: 'meta',
    celda: (u) => formatNumero(u.tripCount),
    celdaTarjeta: (u) => cantidad(u.tripCount, 'viaje', 'viajes'),
  },
  {
    id: 'registro',
    encabezado: 'Registro',
    className: 'whitespace-nowrap text-fg-muted',
    celda: (u) => fecha(u.profile.created_at),
  },
]

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<ParamsBusqueda>
}) {
  if (!(await exigirAdmin())) return null
  const sp = await searchParams
  const actuales = planos(sp)
  const search = param(sp, 'search')
  const pedido = param(sp, 'role') ?? 'all'
  const rol = ROLES.some((r) => r.valor === pedido) ? pedido : 'all'

  const { items, total, page, pageSize, conteos } = await datosUsuarios({
    search,
    role: rol,
    page: pagina(sp),
  })

  const vacio = search ? (
    <EmptyState
      illustration="sello"
      title={`Ningún resultado para «${search}»`}
      description="Prueba con otra parte del email."
      action={
        <ButtonLink
          href={hrefCon(BASE, actuales, { search: null })}
          variant="outline"
        >
          Limpiar búsqueda
        </ButtonLink>
      }
    />
  ) : rol !== 'all' ? (
    <EmptyState
      illustration="sello"
      title={rol === 'admin' ? 'No hay admins' : 'No hay usuarios con ese rol'}
      action={
        <ButtonLink
          href={hrefCon(BASE, actuales, { role: null })}
          variant="outline"
        >
          Ver todos
        </ButtonLink>
      }
    />
  ) : (
    <EmptyState
      title="Aún no hay usuarios"
      description="Cuando alguien cree su cuenta en la web o en la app, aparecerá aquí."
    />
  )

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Usuarios"
        descripcion="Cuentas registradas en la web y en la app."
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchBar
          basePath={BASE}
          actuales={actuales}
          etiqueta="Buscar usuarios por email"
          placeholder="Buscar por email…"
        />
        <FiltrosChips
          etiqueta="Filtrar por rol"
          activo={rol}
          opciones={ROLES.map((r) => ({
            valor: r.valor,
            label: r.label,
            count: conteos[r.valor] ?? (r.valor === rol ? total : undefined),
          }))}
          hrefDe={(v) =>
            hrefCon(BASE, actuales, { role: v === 'all' ? null : v })
          }
        />
      </div>

      <DataTable
        etiqueta="Usuarios"
        cabecera={
          <span className="tnum">
            {cantidad(total, 'usuario', 'usuarios')}
            {search ? ` para «${search}»` : ''}
          </span>
        }
        columnas={COLUMNAS}
        filas={items}
        clave={(u) => u.profile.id}
        href={(u) => `/admin/users/${u.profile.id}`}
        etiquetaEnlace={(u) =>
          `Ver la ficha de ${u.profile.full_name?.trim() || u.profile.email || 'este usuario'}`
        }
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
