import { getSettings } from '@/lib/admin/queries'
import { SettingsPanel } from '@/components/admin/SettingsPanel'

export default async function SettingsPage() {
  const settings = await getSettings()
  const maintenance = settings['maintenance_mode'] ?? {}
  const aiProvider = settings['ai_provider'] ?? {}

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">
          Configuración global que afecta a web y mobile.
        </p>
      </div>

      <SettingsPanel
        maintenanceEnabled={Boolean(maintenance['enabled'])}
        maintenanceMessage={String(maintenance['message'] ?? '')}
        aiProvider={String(aiProvider['provider'] ?? 'groq')}
      />
    </div>
  )
}
