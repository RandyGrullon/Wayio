import { listFlags } from '@/lib/admin/queries'
import { toggleFlag, deleteFlag } from '@/lib/admin/actions'
import { ToggleAction } from '@/components/admin/ToggleAction'
import { ActionButton } from '@/components/admin/ActionButton'
import { FlagCreateForm } from '@/components/admin/FlagCreateForm'
import { Badge } from '@/components/ui/Badge'

export default async function FlagsPage() {
  const flags = await listFlags()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Feature Flags</h1>
        <p className="text-sm text-gray-500">
          Control remoto de funciones. Web y mobile las leen vía{' '}
          <code>/api/config</code>.
        </p>
      </div>

      <FlagCreateForm />

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Clave</th>
              <th className="px-4 py-2">Descripción</th>
              <th className="px-4 py-2">Plataforma</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {flags.map((f) => (
              <tr key={f.key} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  <ToggleAction
                    enabled={f.enabled}
                    action={toggleFlag.bind(null, f.key)}
                  />
                </td>
                <td className="px-4 py-2 font-mono font-medium text-gray-900">
                  {f.key}
                </td>
                <td className="px-4 py-2 text-gray-500">
                  {f.description ?? '—'}
                </td>
                <td className="px-4 py-2">
                  <Badge variant="brand">{f.platform}</Badge>
                </td>
                <td className="px-4 py-2 text-right">
                  <ActionButton
                    action={deleteFlag.bind(null, f.key)}
                    label="Borrar"
                    variant="danger"
                    confirm={`¿Eliminar la flag "${f.key}"?`}
                  />
                </td>
              </tr>
            ))}
            {flags.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Sin flags. Crea una arriba.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
