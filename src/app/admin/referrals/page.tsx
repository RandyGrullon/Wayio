import type { Metadata } from 'next'
import { CopiarTexto } from '@/components/admin/CopiarTexto'
import { DataTable } from '@/components/admin/DataTable'
import type { Columna } from '@/components/admin/DataTable'
import { Encabezado } from '@/components/admin/Encabezado'
import { Pagination } from '@/components/admin/Pagination'
import { SearchBar } from '@/components/admin/SearchBar'
import { StatCard } from '@/components/admin/StatCard'
import { cantidad, fecha } from '@/components/admin/etiquetas'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatNumero } from '@/lib/utils/formatters'
import type { ReferralRow } from '@/types/database'
import { exigirAdmin } from '../_lib/acceso'
import { datosReferidos } from '../_lib/datos'
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

export const metadata: Metadata = { title: 'Referidos · Admin' }

const BASE = '/admin/referrals'

interface FilaReferido {
  ref: ReferralRow
  email: string | null
  puesto: number
}

const VALORES_ORDEN: Record<string, (f: FilaReferido) => string | number> = {
  puesto: (f) => f.puesto,
  codigo: (f) => f.ref.code,
  usuario: (f) => f.email ?? '',
  conversiones: (f) => f.ref.conversions,
  creado: (f) => f.ref.created_at,
}

const COLUMNAS: readonly Columna<FilaReferido>[] = [
  {
    id: 'puesto',
    encabezado: '#',
    ordenable: true,
    alinear: 'fin',
    className: 'w-16 text-fg-muted',
    celda: (f) => formatNumero(f.puesto),
  },
  {
    id: 'usuario',
    encabezado: 'Usuario',
    ordenable: true,
    tarjeta: 'titulo',
    className: 'min-w-[220px]',
    celda: (f) => (
      <span className="block truncate font-medium text-fg">
        {f.email ?? 'Sin email'}
      </span>
    ),
  },
  {
    id: 'codigo',
    encabezado: 'Código',
    ordenable: true,
    tarjeta: 'meta',
    celda: (f) => (
      <CopiarTexto
        valor={f.ref.code}
        etiqueta="Copiar código"
        aviso="Código copiado"
      />
    ),
  },
  {
    id: 'conversiones',
    encabezado: 'Conversiones',
    ordenable: true,
    alinear: 'fin',
    tarjeta: 'meta',
    celda: (f) => formatNumero(f.ref.conversions),
    celdaTarjeta: (f) =>
      cantidad(f.ref.conversions, 'conversión', 'conversiones'),
  },
  {
    id: 'creado',
    encabezado: 'Creado',
    ordenable: true,
    className: 'whitespace-nowrap text-fg-muted',
    celda: (f) => fecha(f.ref.created_at),
  },
]

export default async function ReferralsPage({
  searchParams,
}: {
  searchParams: Promise<ParamsBusqueda>
}) {
  if (!(await exigirAdmin())) return null
  const sp = await searchParams
  const actuales = planos(sp)
  const search = param(sp, 'search')
  const orden = leerOrden(sp, Object.keys(VALORES_ORDEN), {
    columna: 'conversiones',
    dir: 'desc',
  })

  const { items, totalConversions } = await datosReferidos()
  // El puesto es el del ranking por conversiones (como lo da la consulta).
  const filas: FilaReferido[] = items.map((x, i) => ({ ...x, puesto: i + 1 }))
  const filtradas = filas.filter(
    (f) => coincide(f.email, search) || coincide(f.ref.code, search)
  )
  const {
    items: visibles,
    total,
    page,
    pageSize,
  } = paginar(ordenar(filtradas, orden, VALORES_ORDEN), pagina(sp))
  const media = items.length ? totalConversions / items.length : 0

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Referidos"
        descripcion="Códigos de invitación y cuántas personas trajo cada uno."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Códigos" value={formatNumero(items.length)} />
        <StatCard
          label="Conversiones"
          value={formatNumero(totalConversions)}
          caption="Personas que se unieron con un código"
        />
        <StatCard
          label="Media por código"
          value={formatNumero(media, 1)}
          caption="Conversiones por código creado"
        />
      </div>

      <SearchBar
        basePath={BASE}
        actuales={actuales}
        etiqueta="Buscar referidos por email o código"
        placeholder="Buscar por email o código…"
      />

      <DataTable
        etiqueta="Códigos de referido"
        cabecera={
          <span className="tnum">{cantidad(total, 'código', 'códigos')}</span>
        }
        columnas={COLUMNAS}
        filas={visibles}
        clave={(f) => f.ref.id}
        href={(f) => `/admin/users/${f.ref.user_id}?tab=referidos`}
        etiquetaEnlace={(f) => `Ver la ficha de ${f.email ?? 'este usuario'}`}
        orden={{
          actual: orden,
          hrefDe: (columna, dir) =>
            hrefCon(BASE, actuales, { orden: columna, dir }),
        }}
        vacio={
          search ? (
            <EmptyState
              illustration="sello"
              title={`Ningún resultado para «${search}»`}
              action={
                <ButtonLink
                  href={hrefCon(BASE, actuales, { search: null })}
                  variant="outline"
                >
                  Limpiar búsqueda
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              title="Aún no hay códigos de referido"
              description="Se crean cuando alguien abre su sección de referidos."
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
