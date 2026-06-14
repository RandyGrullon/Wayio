import { getAiUsage } from '@/lib/admin/queries'
import { StatCard } from '@/components/admin/StatCard'
import { BarChart } from '@/components/admin/BarChart'
import { Badge } from '@/components/ui/Badge'

function money(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 4 })}`
}

export default async function AiUsagePage() {
  const s = await getAiUsage(30)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Uso de IA (30 días)
        </h1>
        <p className="text-sm text-gray-500">
          Cada generación de web y mobile se registra aquí (tokens, costo,
          latencia).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Llamadas" value={s.totalCalls} />
        <StatCard
          label="Costo"
          value={money(s.totalCost)}
          accent="text-amber-600"
        />
        <StatCard
          label="Tokens"
          value={s.totalTokens.toLocaleString('en-US')}
        />
        <StatCard
          label="Éxito"
          value={`${(s.successRate * 100).toFixed(1)}%`}
          accent={s.successRate > 0.95 ? 'text-green-600' : 'text-red-600'}
        />
        <StatCard label="Latencia media" value={`${s.avgLatency} ms`} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">
          Costo diario (USD)
        </h2>
        <BarChart data={s.series} color="bg-amber-500" format={money} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white">
          <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700">
            Por proveedor
          </h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-50">
              {s.byProvider.map((p) => (
                <tr key={p.provider}>
                  <td className="px-4 py-2 font-medium text-gray-900">
                    {p.provider}
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {p.calls} llamadas
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700">
                    {money(p.cost)}
                  </td>
                </tr>
              ))}
              {s.byProvider.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-400">
                    Sin datos.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white">
          <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700">
            Por modelo
          </h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-50">
              {s.byModel.map((m) => (
                <tr key={m.model}>
                  <td className="px-4 py-2 font-mono text-xs text-gray-900">
                    {m.model}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{m.calls}</td>
                  <td className="px-4 py-2 text-right text-gray-700">
                    {money(m.cost)}
                  </td>
                </tr>
              ))}
              {s.byModel.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-400">
                    Sin datos.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700">
          Llamadas recientes
        </h2>
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Cuándo</th>
              <th className="px-4 py-2">Proveedor</th>
              <th className="px-4 py-2">Modelo</th>
              <th className="px-4 py-2">Tokens</th>
              <th className="px-4 py-2">Costo</th>
              <th className="px-4 py-2">Latencia</th>
              <th className="px-4 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {s.recent.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-xs text-gray-400">
                  {new Date(l.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-gray-600">{l.provider}</td>
                <td className="px-4 py-2 font-mono text-xs text-gray-500">
                  {l.model}
                </td>
                <td className="px-4 py-2 text-gray-600">{l.total_tokens}</td>
                <td className="px-4 py-2 text-gray-600">
                  {money(Number(l.cost_usd))}
                </td>
                <td className="px-4 py-2 text-gray-500">{l.latency_ms} ms</td>
                <td className="px-4 py-2">
                  {l.success ? (
                    <Badge variant="success">ok</Badge>
                  ) : (
                    <Badge variant="error">error</Badge>
                  )}
                </td>
              </tr>
            ))}
            {s.recent.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Aún no hay registros de IA. Genera un viaje para verlos aquí.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
