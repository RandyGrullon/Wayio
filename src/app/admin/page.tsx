import { getDashboardMetrics } from '@/lib/admin/queries'
import { StatCard } from '@/components/admin/StatCard'
import { BarChart } from '@/components/admin/BarChart'

function money(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

export default async function AdminDashboard() {
  const m = await getDashboardMetrics()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Visión general de Wayio (web + mobile comparten este backend)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Usuarios"
          value={m.totalUsers}
          sub={`+${m.newUsers24h} hoy · +${m.newUsers7d} en 7d`}
        />
        <StatCard
          label="Viajes"
          value={m.totalTrips}
          sub={`+${m.trips30d} en 30d`}
        />
        <StatCard
          label="Suscripciones activas"
          value={m.activeSubs}
          accent="text-green-600"
        />
        <StatCard
          label="MRR"
          value={money(m.mrr)}
          sub={`ARR ≈ ${money(m.mrr * 12)}`}
          accent="text-green-600"
        />
        <StatCard label="Nuevos (30d)" value={m.newUsers30d} />
        <StatCard label="Llamadas IA (30d)" value={m.aiCalls30d} />
        <StatCard
          label="Tokens IA (30d)"
          value={m.aiTokens30d.toLocaleString('en-US')}
        />
        <StatCard
          label="Costo IA (30d)"
          value={money(m.aiCost30d)}
          accent="text-amber-600"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">
            Registros (últimos 14 días)
          </h2>
          <BarChart data={m.signupSeries} color="bg-blue-500" />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">
            Viajes creados (últimos 14 días)
          </h2>
          <BarChart data={m.tripSeries} color="bg-indigo-500" />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          Viajes por paquete
        </h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-2xl font-bold text-gray-900">
              {m.tripsByPackage.basico}
            </p>
            <p className="text-xs text-gray-500">Básico</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-2xl font-bold text-gray-900">
              {m.tripsByPackage.confort}
            </p>
            <p className="text-xs text-gray-500">Confort</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-2xl font-bold text-gray-900">
              {m.tripsByPackage.premium}
            </p>
            <p className="text-xs text-gray-500">Premium</p>
          </div>
        </div>
      </div>
    </div>
  )
}
