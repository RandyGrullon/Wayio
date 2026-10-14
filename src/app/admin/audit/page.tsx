import type { Metadata } from 'next'
import Link from 'next/link'
import { DataTable } from '@/components/admin/DataTable'
import type { Columna } from '@/components/admin/DataTable'
import { Encabezado } from '@/components/admin/Encabezado'
import { FiltrosChips } from '@/components/admin/FiltrosChips'
import { Pagination } from '@/components/admin/Pagination'
import { SearchBar } from '@/components/admin/SearchBar'
import {
  FILTROS_AUDITORIA,
  enFiltroAuditoria,
  humanizarAccion,
} from '@/components/admin/auditoria'
import type { AccionHumanizada } from '@/components/admin/auditoria'
import { cantidad, fechaHora } from '@/components/admin/etiquetas'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { AdminAuditRow } from '@/types/admin'
import { exigirAdmin } from '../_lib/acceso'
import { datosAuditoria } from '../_lib/datos'
import {
  coincide,
  hrefCon,
  pagina,
  paginar,
  param,
  planos,
} from '../_lib/listas'
import type { ParamsBusqueda } from '../_lib/listas'

export const metadata: Metadata = { title: 'Auditoría · Admin' }

const BASE = '/admin/audit'

interface FilaAuditoria {
  row: AdminAuditRow
  humana: AccionHumanizada
}

const COLUMNAS: readonly Columna<FilaAuditoria>[] = [
  {
    id: 'accion',
    encabezado: 'Acción',
    tarjeta: 'titulo',
    className: 'min-w-[240px]',
    celda: (f) => (
      <span className="block min-w-0">
        <span className="block font-medium text-fg">{f.humana.texto}</span>
        <span className="block truncate text-caption text-fg-muted">
          {f.row.admin_email ?? 'Admin desconocido'}
        </span>
      </span>
    ),
  },
  {
    id: 'objetivo',
    encabezado: 'Objetivo',
    tarjeta: 'meta',
    celda: (f) => {
      const o = f.humana.objetivo
      if (!o) return <span className="text-fg-subtle">—</span>
      const texto = (
        <span className={cn(o.mono && 'font-mono text-[13px]')}>
          {o.etiqueta}
        </span>
      )
      return (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span className="text-caption text-fg-muted">{o.tipo}</span>
          {o.href ? (
            <Link
              href={o.href}
              className="relative z-10 truncate rounded-sm text-accent underline decoration-1 underline-offset-[3px] hover:text-accent-hover"
            >
              {texto}
            </Link>
          ) : (
            <span className="truncate text-fg">{texto}</span>
          )}
        </span>
      )
    },
  },
  {
    id: 'cuando',
    encabezado: 'Cuándo',
    tarjeta: 'meta',
    className: 'whitespace-nowrap text-fg-muted',
    celda: (f) => fechaHora(f.row.created_at),
  },
  {
    id: 'detalle',
    encabezado: 'Detalles',
    className: 'w-[220px]',
    celda: (f) => {
      const meta = f.row.metadata ?? {}
      if (Object.keys(meta).length === 0) {
        return <span className="text-fg-subtle">—</span>
      }
      return (
        <details className="group/det relative z-10">
          <summary className="cursor-pointer rounded-sm text-[13px] font-medium text-accent marker:text-fg-subtle hover:text-accent-hover">
            Ver datos
          </summary>
          <pre className="mt-2 max-w-[320px] overflow-x-auto rounded-control bg-surface-2 p-2.5 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-fg">
            {JSON.stringify(meta, null, 2)}
          </pre>
        </details>
      )
    },
  },
]

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<ParamsBusqueda>
}) {
  if (!(await exigirAdmin())) return null
  const sp = await searchParams
  const actuales = planos(sp)
  const search = param(sp, 'search')
  const pedido = param(sp, 'tipo') ?? 'all'
  const tipo = FILTROS_AUDITORIA.some((f) => f.valor === pedido)
    ? pedido
    : 'all'

  const rows = await datosAuditoria()
  const filas: FilaAuditoria[] = rows.map((row) => ({
    row,
    humana: humanizarAccion(row),
  }))
  const buscadas = filas.filter(
    (f) =>
      coincide(f.humana.texto, search) ||
      coincide(f.row.admin_email, search) ||
      coincide(f.row.target_id, search)
  )
  const filtradas = buscadas.filter((f) => enFiltroAuditoria(f.row, tipo))
  const { items, total, page, pageSize } = paginar(filtradas, pagina(sp))

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Auditoría"
        descripcion="Las últimas 200 acciones hechas desde el panel: quién, qué y sobre qué."
      />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <SearchBar
          basePath={BASE}
          actuales={actuales}
          etiqueta="Buscar en la auditoría"
          placeholder="Buscar por admin, acción o id…"
        />
        <FiltrosChips
          etiqueta="Filtrar por tipo de objetivo"
          activo={tipo}
          opciones={FILTROS_AUDITORIA.map((f) => ({
            valor: f.valor,
            label: f.label,
            count: buscadas.filter((x) => enFiltroAuditoria(x.row, f.valor))
              .length,
          }))}
          hrefDe={(v) =>
            hrefCon(BASE, actuales, { tipo: v === 'all' ? null : v })
          }
        />
      </div>

      <DataTable
        etiqueta="Acciones de administración"
        cabecera={
          <span className="tnum">{cantidad(total, 'acción', 'acciones')}</span>
        }
        columnas={COLUMNAS}
        filas={items}
        clave={(f) => f.row.id}
        vacio={
          search || tipo !== 'all' ? (
            <EmptyState
              illustration="sello"
              title={
                search
                  ? `Ningún resultado para «${search}»`
                  : 'Nada de este tipo todavía'
              }
              action={
                <ButtonLink
                  href={hrefCon(BASE, actuales, { search: null, tipo: null })}
                  variant="outline"
                >
                  {search ? 'Limpiar búsqueda' : 'Ver todo'}
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              title="Aún no hay acciones registradas"
              description="Cada cambio que hagas desde el panel quedará anotado aquí."
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
