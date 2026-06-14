import Link from 'next/link'
import { listTrips } from '@/lib/admin/queries'
import { deleteTrip } from '@/lib/admin/actions'
import { SearchBar } from '@/components/admin/SearchBar'
import { Pagination } from '@/components/admin/Pagination'
import { ActionButton } from '@/components/admin/ActionButton'
import { Badge } from '@/components/ui/Badge'

const ESTADOS = ['all', 'planificando', 'en_viaje', 'completado'] as const

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; estado?: string; page?: string }>
}) {
  const sp = await searchParams
  const page = Number(sp.page ?? '1') || 1
  const estado = sp.estado ?? 'all'
  const { items, total, pageSize } = await listTrips({
    search: sp.search,
    estado,
    page,
  })

  const params = new URLSearchParams()
  if (sp.search) params.set('search', sp.search)
  if (estado !== 'all') params.set('estado', estado)
  const base = `/admin/trips${params.toString() ? `?${params.toString()}` : ''}`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Viajes</h1>
        <SearchBar
          basePath="/admin/trips"
          placeholder="Buscar por destino…"
          defaultValue={sp.search}
        />
      </div>

      <div className="flex gap-2">
        {ESTADOS.map((e) => {
          const qp = new URLSearchParams()
          if (sp.search) qp.set('search', sp.search)
          if (e !== 'all') qp.set('estado', e)
          return (
            <Link
              key={e}
              href={`/admin/trips${qp.toString() ? `?${qp.toString()}` : ''}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                estado === e
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {e === 'all' ? 'Todos' : e}
            </Link>
          )
        })}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Destino</th>
              <th className="px-4 py-2">Dueño</th>
              <th className="px-4 py-2">Paquete</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Días</th>
              <th className="px-4 py-2">Presup.</th>
              <th className="px-4 py-2">Creado</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-gray-900">
                  {t.destino}
                </td>
                <td className="px-4 py-2 text-xs text-gray-400">
                  {t.ownerEmail ?? '—'}
                </td>
                <td className="px-4 py-2 text-gray-600">{t.paquete}</td>
                <td className="px-4 py-2">
                  <Badge variant="default">{t.estado}</Badge>
                </td>
                <td className="px-4 py-2 text-gray-600">{t.dias}</td>
                <td className="px-4 py-2 text-gray-600">${t.presupuesto}</td>
                <td className="px-4 py-2 text-gray-400">
                  {new Date(t.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-right">
                  <span className="inline-flex items-center gap-2">
                    <Link
                      href={`/admin/trips/${t.id}`}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Ver
                    </Link>
                    <ActionButton
                      action={deleteTrip.bind(null, t.id)}
                      label="Borrar"
                      variant="danger"
                      confirm="¿Eliminar este viaje?"
                    />
                  </span>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  Sin viajes.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        basePath={base}
      />
    </div>
  )
}
