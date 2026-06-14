import Link from 'next/link'

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
}: {
  page: number
  pageSize: number
  total: number
  basePath: string
}) {
  const pages = Math.ceil(total / pageSize)
  if (pages <= 1) return null
  const mk = (p: number) =>
    `${basePath}${basePath.includes('?') ? '&' : '?'}page=${p}`
  return (
    <div className="flex items-center justify-between text-sm text-gray-500">
      <span>
        Página {page} de {pages} · {total} en total
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={mk(page - 1)}
            className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50"
          >
            Anterior
          </Link>
        ) : null}
        {page < pages ? (
          <Link
            href={mk(page + 1)}
            className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50"
          >
            Siguiente
          </Link>
        ) : null}
      </div>
    </div>
  )
}
