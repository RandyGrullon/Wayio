import Link from 'next/link'
import { listUsers } from '@/lib/admin/queries'
import { SearchBar } from '@/components/admin/SearchBar'
import { Pagination } from '@/components/admin/Pagination'
import { Badge } from '@/components/ui/Badge'

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; role?: string; page?: string }>
}) {
  const sp = await searchParams
  const page = Number(sp.page ?? '1') || 1
  const { items, total, pageSize } = await listUsers({
    search: sp.search,
    role: sp.role,
    page,
  })
  const base = `/admin/users${sp.search ? `?search=${encodeURIComponent(sp.search)}` : ''}`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
        <SearchBar
          basePath="/admin/users"
          placeholder="Buscar por email…"
          defaultValue={sp.search}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Usuario</th>
              <th className="px-4 py-2">Rol</th>
              <th className="px-4 py-2">Plan</th>
              <th className="px-4 py-2">Viajes</th>
              <th className="px-4 py-2">Registro</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map(({ profile, tier, tripCount }) => (
              <tr key={profile.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  <p className="font-medium text-gray-900">
                    {profile.full_name ?? '—'}
                    {profile.is_banned ? (
                      <Badge variant="error" className="ml-2">
                        baneado
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-xs text-gray-400">{profile.email}</p>
                </td>
                <td className="px-4 py-2">
                  <Badge
                    variant={profile.role === 'admin' ? 'brand' : 'default'}
                  >
                    {profile.role}
                  </Badge>
                </td>
                <td className="px-4 py-2">
                  <Badge variant={tier === 'free' ? 'default' : 'success'}>
                    {tier}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-gray-600">{tripCount}</td>
                <td className="px-4 py-2 text-gray-500">
                  {new Date(profile.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/admin/users/${profile.id}`}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Sin usuarios.
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
