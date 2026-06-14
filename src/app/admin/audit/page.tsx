import { listAudit } from '@/lib/admin/queries'

export default async function AuditPage() {
  const rows = await listAudit()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Auditoría</h1>
        <p className="text-sm text-gray-500">
          Últimas 200 acciones realizadas desde el panel.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Cuándo</th>
              <th className="px-4 py-2">Admin</th>
              <th className="px-4 py-2">Acción</th>
              <th className="px-4 py-2">Objetivo</th>
              <th className="px-4 py-2">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-xs text-gray-400">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-gray-600">
                  {r.admin_email ?? '—'}
                </td>
                <td className="px-4 py-2 font-mono text-xs font-medium text-gray-900">
                  {r.action}
                </td>
                <td className="px-4 py-2 text-xs text-gray-500">
                  {r.target_type
                    ? `${r.target_type}:${r.target_id ?? ''}`
                    : '—'}
                </td>
                <td className="px-4 py-2 text-xs text-gray-400">
                  {Object.keys(r.metadata).length
                    ? JSON.stringify(r.metadata)
                    : '—'}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Sin acciones registradas aún.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
