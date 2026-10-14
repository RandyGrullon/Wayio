import type { OrdenTabla } from '@/components/admin/DataTable'

/**
 * Utilidades de las listas del panel: leer searchParams, construir enlaces
 * que conservan los demás filtros y ordenar/paginar en memoria las listas
 * que el backend devuelve completas (suscripciones, referidos, auditoría).
 */

export type ParamsBusqueda = Record<string, string | string[] | undefined>

export const TAMANO_PAGINA = 25

export function param(sp: ParamsBusqueda, clave: string): string | undefined {
  const v = sp[clave]
  const valor = Array.isArray(v) ? v[0] : v
  return valor?.trim() ? valor.trim() : undefined
}

export function pagina(sp: ParamsBusqueda): number {
  const n = Number(param(sp, 'page') ?? '1')
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}

/** Params actuales como objeto plano (para conservarlos en los enlaces). */
export function planos(sp: ParamsBusqueda): Record<string, string> {
  const out: Record<string, string> = {}
  for (const clave of Object.keys(sp)) {
    const v = param(sp, clave)
    if (v !== undefined) out[clave] = v
  }
  return out
}

/**
 * Enlace a `base` con los params actuales y los cambios (null/undefined
 * quita la clave). Cualquier cambio de filtro reinicia `page`, salvo que el
 * propio cambio la fije.
 */
export function hrefCon(
  base: string,
  actuales: Record<string, string>,
  cambios: Record<string, string | null | undefined>
): string {
  const params = new URLSearchParams()
  const reiniciaPagina = !('page' in cambios)
  for (const [k, v] of Object.entries(actuales)) {
    if (k in cambios) continue
    if (k === 'page' && reiniciaPagina) continue
    params.set(k, v)
  }
  for (const [k, v] of Object.entries(cambios)) {
    if (v === null || v === undefined || v === '') continue
    if (k === 'page' && v === '1') continue
    params.set(k, v)
  }
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

/** Orden leído de ?orden=col&dir=asc|desc, validado contra las columnas. */
export function leerOrden(
  sp: ParamsBusqueda,
  permitidas: readonly string[],
  porDefecto: OrdenTabla
): OrdenTabla {
  const col = param(sp, 'orden')
  const dir = param(sp, 'dir')
  if (!col || !permitidas.includes(col)) return porDefecto
  return { columna: col, dir: dir === 'asc' ? 'asc' : 'desc' }
}

export function ordenar<T>(
  filas: readonly T[],
  orden: OrdenTabla,
  valores: Record<string, (fila: T) => string | number>
): T[] {
  const valor = valores[orden.columna]
  if (!valor) return [...filas]
  const signo = orden.dir === 'asc' ? 1 : -1
  return [...filas].sort((a, b) => {
    const va = valor(a)
    const vb = valor(b)
    if (typeof va === 'number' && typeof vb === 'number') {
      return (va - vb) * signo
    }
    return String(va).localeCompare(String(vb), 'es') * signo
  })
}

export function paginar<T>(
  filas: readonly T[],
  page: number
): { items: T[]; total: number; page: number; pageSize: number } {
  const total = filas.length
  const ultima = Math.max(1, Math.ceil(total / TAMANO_PAGINA))
  const p = Math.min(Math.max(1, page), ultima)
  return {
    items: filas.slice((p - 1) * TAMANO_PAGINA, p * TAMANO_PAGINA),
    total,
    page: p,
    pageSize: TAMANO_PAGINA,
  }
}

/** Búsqueda sin tildes ni mayúsculas. */
export function coincide(
  texto: string | null | undefined,
  q: string | undefined
): boolean {
  if (!q) return true
  const n = (t: string) =>
    t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  return n(texto ?? '').includes(n(q))
}
