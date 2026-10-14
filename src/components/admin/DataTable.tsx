import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils/cn'
import { FilaEnlace } from './FilaEnlace'
import { MarcoTabla } from './MarcoTabla'

/**
 * Tabla del panel (docs/DISENO.md §5.13). Server Component: las celdas se
 * describen con funciones y se pintan en el servidor; lo interactivo de cada
 * celda (copiar, menú de fila, switch) son islas cliente.
 *
 * - Cabecera bg-surface-2 en mayúsculas; las columnas ordenables son enlaces
 *   (?orden=&dir=) con aria-sort.
 * - Filas de 52 px (40 con «Filas compactas»), hover surface-2; si hay `href`
 *   un clic en cualquier parte de la fila la abre (FilaEnlace) y el enlace
 *   real, con foco visible, es el ChevronRight de la última celda.
 * - Números a la derecha con tnum; IDs con <CopiarTexto>.
 * - Por debajo de md, tarjetas apiladas con el campo principal y 2–3 datos;
 *   ahí el enlace sí se estira a toda la tarjeta.
 *
 * Lo interactivo dentro de una celda debe llevar `relative z-10` para quedar
 * por encima del enlace estirado de la tarjeta móvil (CopiarTexto y
 * AccionesFila ya lo hacen).
 */

export interface OrdenTabla {
  columna: string
  dir: 'asc' | 'desc'
}

export interface Columna<T> {
  id: string
  encabezado: string
  celda: (fila: T) => ReactNode
  /** Contenido en la tarjeta móvil si debe leerse distinto («3 viajes»). */
  celdaTarjeta?: (fila: T) => ReactNode
  alinear?: 'inicio' | 'fin'
  ordenable?: boolean
  /** Clases extra de th y td (anchos, ocultar en tablet…). */
  className?: string
  /** En la tarjeta móvil: campo principal o metadato. Sin valor, se omite. */
  tarjeta?: 'titulo' | 'meta'
}

export interface DataTableProps<T> {
  columnas: readonly Columna<T>[]
  filas: readonly T[]
  clave: (fila: T) => string
  /** Nombre de la tabla (caption para lectores de pantalla). */
  etiqueta: string
  /** La fila entera enlaza a este destino. */
  href?: (fila: T) => string
  /** Nombre accesible del enlace de la fila («Ver ana@ejemplo.com»). */
  etiquetaEnlace?: (fila: T) => string
  /** Menú de acciones de la fila (columna final). */
  acciones?: (fila: T) => ReactNode
  orden?: {
    actual: OrdenTabla
    hrefDe: (columna: string, dir: 'asc' | 'desc') => string
  }
  /** Estado vacío (EmptyState) cuando no hay filas. */
  vacio?: ReactNode
  /** Contenido a la izquierda de la barra superior (contador). */
  cabecera?: ReactNode
  /** Pie (paginación). */
  pie?: ReactNode
  /** Muestra el toggle de densidad (por defecto, sí). */
  densidad?: boolean
  className?: string
}

const ALTO_FILA = 'h-[52px] group-data-[densidad=compacta]/tabla:h-10'
/** Fila de escritorio: hover y, con el enlace enfocado, la fila resaltada. */
const FILA =
  'group/fila border-t border-border transition-colors duration-(--dur-fast) hover:bg-surface-2 has-[a[data-fila]:focus-visible]:bg-surface-2'
/** Tarjeta móvil: un <li> sí es bloque contenedor, así que el enlace se
 * estira a toda la tarjeta; el foco lo dibuja el enlace, por dentro. */
const ENLACE_TARJETA =
  'absolute inset-0 z-[2] rounded-[inherit] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring'

export function DataTable<T>({
  columnas,
  filas,
  clave,
  etiqueta,
  href,
  etiquetaEnlace,
  acciones,
  orden,
  vacio,
  cabecera,
  pie,
  densidad = true,
  className,
}: DataTableProps<T>) {
  const titulo = columnas.find((c) => c.tarjeta === 'titulo') ?? columnas[0]
  const metas = columnas.filter((c) => c.tarjeta === 'meta')

  return (
    <Card className={cn('overflow-hidden p-0 md:p-0', className)}>
      <MarcoTabla cabecera={cabecera} densidad={densidad && filas.length > 0}>
        {filas.length === 0 ? (
          (vacio ?? (
            <p className="px-4 py-12 text-center text-body-s text-fg-muted">
              No hay nada que mostrar.
            </p>
          ))
        ) : (
          <>
            {/* Escritorio y tablet */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-[14px]">
                <caption className="sr-only">{etiqueta}</caption>
                <thead className="bg-surface-2">
                  <tr>
                    {columnas.map((c, i) => {
                      const activa = orden?.actual.columna === c.id
                      const dir = activa ? orden?.actual.dir : undefined
                      return (
                        <th
                          key={c.id}
                          scope="col"
                          aria-sort={
                            c.ordenable && orden
                              ? activa
                                ? dir === 'asc'
                                  ? 'ascending'
                                  : 'descending'
                                : 'none'
                              : undefined
                          }
                          className={cn(
                            'h-10 px-4 text-[12px] font-semibold tracking-[0.06em] whitespace-nowrap text-fg-muted uppercase',
                            c.alinear === 'fin' ? 'text-right' : 'text-left',
                            i === 0 &&
                              'bg-surface-2 md:sticky md:left-0 md:z-[2] lg:static',
                            c.className
                          )}
                        >
                          {c.ordenable && orden ? (
                            <Link
                              href={orden.hrefDe(
                                c.id,
                                activa && dir === 'desc' ? 'asc' : 'desc'
                              )}
                              scroll={false}
                              className={cn(
                                'inline-flex items-center gap-1 rounded-sm uppercase hover:text-fg',
                                activa && 'text-fg'
                              )}
                            >
                              {c.encabezado}
                              {activa ? (
                                dir === 'asc' ? (
                                  <ArrowUp
                                    aria-hidden="true"
                                    strokeWidth={2}
                                    className="size-3.5"
                                  />
                                ) : (
                                  <ArrowDown
                                    aria-hidden="true"
                                    strokeWidth={2}
                                    className="size-3.5"
                                  />
                                )
                              ) : (
                                <ArrowUpDown
                                  aria-hidden="true"
                                  strokeWidth={2}
                                  className="size-3.5 opacity-70"
                                />
                              )}
                            </Link>
                          ) : (
                            c.encabezado
                          )}
                        </th>
                      )
                    })}
                    {acciones ? (
                      <th scope="col" className="h-10 w-14 px-2">
                        <span className="sr-only">Acciones</span>
                      </th>
                    ) : null}
                    {href ? (
                      <th scope="col" className="h-10 w-12 pr-2">
                        <span className="sr-only">Abrir</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((fila) => {
                    const destino = href?.(fila)
                    const celdas = (
                      <>
                        {columnas.map((c, i) => (
                          <td
                            key={c.id}
                            className={cn(
                              ALTO_FILA,
                              'px-4 align-middle text-fg',
                              c.alinear === 'fin' && 'text-right tnum',
                              i === 0 &&
                                'bg-surface group-hover/fila:bg-surface-2 group-has-[a[data-fila]:focus-visible]/fila:bg-surface-2 md:sticky md:left-0 md:z-[1] lg:static lg:bg-transparent',
                              c.className
                            )}
                          >
                            {c.celda(fila)}
                          </td>
                        ))}
                        {acciones ? (
                          <td className={cn(ALTO_FILA, 'px-2 text-right')}>
                            <div className="relative z-10 inline-flex">
                              {acciones(fila)}
                            </div>
                          </td>
                        ) : null}
                        {destino ? (
                          <td className={cn(ALTO_FILA, 'w-12 pr-2 text-right')}>
                            {/* Enlace real de la fila (teclado y lectores);
                                el clic en el resto lo resuelve FilaEnlace. */}
                            <Link
                              data-fila
                              href={destino}
                              aria-label={etiquetaEnlace?.(fila) ?? 'Abrir'}
                              className="inline-grid size-10 place-items-center rounded-full text-fg-subtle transition-colors duration-(--dur-fast) group-hover/fila:text-fg"
                            >
                              <ChevronRight
                                aria-hidden="true"
                                strokeWidth={1.75}
                                className="size-4"
                              />
                            </Link>
                          </td>
                        ) : null}
                      </>
                    )
                    return destino ? (
                      <FilaEnlace
                        key={clave(fila)}
                        href={destino}
                        className={FILA}
                      >
                        {celdas}
                      </FilaEnlace>
                    ) : (
                      <tr key={clave(fila)} className={FILA}>
                        {celdas}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Móvil: tarjetas apiladas */}
            <ul
              className="divide-y divide-border md:hidden"
              aria-label={etiqueta}
            >
              {filas.map((fila) => {
                const destino = href?.(fila)
                return (
                  <li
                    key={clave(fila)}
                    className="relative flex items-center gap-3 px-4 py-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      {titulo ? (
                        <div className="min-w-0 text-[15px] font-medium text-fg">
                          {(titulo.celdaTarjeta ?? titulo.celda)(fila)}
                        </div>
                      ) : null}
                      {metas.length > 0 ? (
                        <dl className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-caption text-fg-muted">
                          {metas.map((c) => (
                            <div key={c.id} className="flex items-center gap-1">
                              <dt className="sr-only">{c.encabezado}</dt>
                              <dd className="tnum">
                                {(c.celdaTarjeta ?? c.celda)(fila)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </div>
                    {acciones ? (
                      <div className="relative z-10 shrink-0">
                        {acciones(fila)}
                      </div>
                    ) : null}
                    {destino ? (
                      <>
                        <Link
                          data-fila
                          href={destino}
                          aria-label={etiquetaEnlace?.(fila) ?? 'Abrir'}
                          className={ENLACE_TARJETA}
                        />
                        <ChevronRight
                          aria-hidden="true"
                          strokeWidth={1.75}
                          className="size-4 shrink-0 text-fg-subtle"
                        />
                      </>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </>
        )}
        {pie ? (
          <div className="border-t border-border px-4 py-3">{pie}</div>
        ) : null}
      </MarcoTabla>
    </Card>
  )
}
