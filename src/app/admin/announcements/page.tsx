import { listAnnouncements } from '@/lib/admin/queries'
import { setAnnouncementActive, deleteAnnouncement } from '@/lib/admin/actions'
import { AnnouncementForm } from '@/components/admin/AnnouncementForm'
import { ToggleAction } from '@/components/admin/ToggleAction'
import { ActionButton } from '@/components/admin/ActionButton'
import { Badge } from '@/components/ui/Badge'

const LEVEL_VARIANT = {
  info: 'brand',
  warning: 'warning',
  critical: 'error',
} as const

export default async function AnnouncementsPage() {
  const announcements = await listAnnouncements()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Anuncios</h1>
        <p className="text-sm text-gray-500">
          Banners para usuarios. Aparecen en la web al instante y en mobile vía{' '}
          <code>/api/config</code>.
        </p>
      </div>

      <AnnouncementForm />

      <div className="space-y-2">
        {announcements.map((a) => (
          <div
            key={a.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900">{a.title}</p>
                <Badge variant={LEVEL_VARIANT[a.level]}>{a.level}</Badge>
                <Badge variant="default">{a.platform}</Badge>
                {a.active ? (
                  <Badge variant="success">activo</Badge>
                ) : (
                  <Badge variant="default">inactivo</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-600">{a.body}</p>
              <p className="mt-1 text-xs text-gray-400">
                {new Date(a.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <ToggleAction
                enabled={a.active}
                action={setAnnouncementActive.bind(null, a.id)}
              />
              <ActionButton
                action={deleteAnnouncement.bind(null, a.id)}
                label="Borrar"
                variant="danger"
                confirm="¿Eliminar este anuncio?"
              />
            </div>
          </div>
        ))}
        {announcements.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-400">
            Sin anuncios. Crea uno arriba.
          </p>
        ) : null}
      </div>
    </div>
  )
}
