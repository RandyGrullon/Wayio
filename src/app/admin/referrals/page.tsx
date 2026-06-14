import { listReferrals } from '@/lib/admin/queries'
import { StatCard } from '@/components/admin/StatCard'

export default async function ReferralsPage() {
  const { items, totalConversions } = await listReferrals()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Referidos</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Códigos" value={items.length} />
        <StatCard
          label="Conversiones totales"
          value={totalConversions}
          accent="text-green-600"
        />
        <StatCard
          label="Conversión media"
          value={
            items.length ? (totalConversions / items.length).toFixed(1) : '0'
          }
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Código</th>
              <th className="px-4 py-2">Usuario</th>
              <th className="px-4 py-2">Conversiones</th>
              <th className="px-4 py-2">Creado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map(({ ref, email }, i) => (
              <tr key={ref.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                <td className="px-4 py-2 font-mono font-medium text-gray-900">
                  {ref.code}
                </td>
                <td className="px-4 py-2 text-gray-600">{email ?? '—'}</td>
                <td className="px-4 py-2 font-semibold text-gray-900">
                  {ref.conversions}
                </td>
                <td className="px-4 py-2 text-gray-400">
                  {new Date(ref.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Sin referidos todavía.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
