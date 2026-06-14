import { getSubscriptionsData } from '@/lib/admin/queries'
import { StatCard } from '@/components/admin/StatCard'
import { Badge } from '@/components/ui/Badge'

function money(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

export default async function SubscriptionsPage() {
  const { items, mrr, arr, activeCount, byTier } = await getSubscriptionsData()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        Suscripciones e ingresos
      </h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="MRR" value={money(mrr)} accent="text-green-600" />
        <StatCard
          label="ARR estimado"
          value={money(arr)}
          accent="text-green-600"
        />
        <StatCard label="Activas (de pago)" value={activeCount} />
        <StatCard
          label="Pro / Grupo"
          value={`${byTier['pro'] ?? 0} / ${byTier['grupo'] ?? 0}`}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Usuario</th>
              <th className="px-4 py-2">Plan</th>
              <th className="px-4 py-2">Tier</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Stripe</th>
              <th className="px-4 py-2">Desde</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map(({ sub, email }) => (
              <tr key={sub.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-700">{email ?? '—'}</td>
                <td className="px-4 py-2 font-medium text-gray-900">
                  {sub.plan_id}
                </td>
                <td className="px-4 py-2">
                  <Badge variant={sub.tier === 'free' ? 'default' : 'success'}>
                    {sub.tier}
                  </Badge>
                </td>
                <td className="px-4 py-2">
                  <Badge
                    variant={sub.status === 'active' ? 'success' : 'warning'}
                  >
                    {sub.status}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-xs text-gray-400">
                  {sub.stripe_subscription_id ?? sub.stripe_customer_id ?? '—'}
                </td>
                <td className="px-4 py-2 text-gray-400">
                  {new Date(sub.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Sin suscripciones todavía.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
