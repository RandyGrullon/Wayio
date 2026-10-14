import type { Metadata } from 'next'
import { AccionesFila } from '@/components/admin/AccionesFila'
import { AnnouncementForm } from '@/components/admin/AnnouncementForm'
import { Encabezado, TituloBloque } from '@/components/admin/Encabezado'
import { ToggleAction } from '@/components/admin/ToggleAction'
import {
  ETIQUETA_NIVEL_ANUNCIO,
  ETIQUETA_PLATAFORMA,
  cantidad,
  etiqueta,
  fecha,
  fechaHora,
} from '@/components/admin/etiquetas'
import { Badge } from '@/components/ui/Badge'
import type { BadgeVariant } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { deleteAnnouncement, setAnnouncementActive } from '@/lib/admin/actions'
import type { AnnouncementRow } from '@/types/admin'
import { exigirAdmin } from '../_lib/acceso'
import { datosAnuncios } from '../_lib/datos'

export const metadata: Metadata = { title: 'Anuncios · Admin' }

const VARIANTE_NIVEL: Record<string, BadgeVariant> = {
  info: 'info',
  warning: 'warning',
  critical: 'error',
}

type EstadoAnuncio = 'visible' | 'programado' | 'finalizado' | 'oculto'

const BADGE_ESTADO: Record<
  EstadoAnuncio,
  { label: string; variant: BadgeVariant }
> = {
  visible: { label: 'Visible', variant: 'success' },
  programado: { label: 'Programado', variant: 'info' },
  finalizado: { label: 'Finalizado', variant: 'default' },
  oculto: { label: 'Oculto', variant: 'default' },
}

/** Lo que ve hoy el viajero: activo y dentro de sus fechas (como /api/config). */
function estadoAnuncio(a: AnnouncementRow): EstadoAnuncio {
  if (!a.active) return 'oculto'
  const ahora = Date.now()
  if (Date.parse(a.starts_at) > ahora) return 'programado'
  if (a.ends_at && Date.parse(a.ends_at) < ahora) return 'finalizado'
  return 'visible'
}

export default async function AnnouncementsPage() {
  if (!(await exigirAdmin())) return null
  const anuncios = (await datosAnuncios()).map((a) => ({
    ...a,
    estado: estadoAnuncio(a),
  }))
  const visibles = anuncios.filter((a) => a.estado === 'visible').length

  return (
    <div className="space-y-8">
      <Encabezado
        titulo="Anuncios"
        descripcion="Banners para avisar a los viajeros de novedades o incidencias."
      />

      <AnnouncementForm />

      <section aria-labelledby="lista-anuncios" className="space-y-3">
        <TituloBloque
          id="lista-anuncios"
          acciones={
            <span className="text-body-s text-fg-muted tnum">
              {cantidad(anuncios.length, 'anuncio', 'anuncios')} ·{' '}
              {cantidad(visibles, 'visible', 'visibles')}
            </span>
          }
        >
          Publicados
        </TituloBloque>

        {anuncios.length === 0 ? (
          <Card>
            <EmptyState
              title="Aún no hay anuncios"
              description="Escribe el primero arriba: lo verás en la vista previa antes de publicarlo."
              className="py-6"
            />
          </Card>
        ) : (
          <ul className="space-y-3">
            {anuncios.map((a) => (
              <li key={a.id}>
                <Card
                  as="article"
                  aria-labelledby={`anuncio-${a.id}`}
                  className="p-5 md:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          id={`anuncio-${a.id}`}
                          className="text-title break-words text-fg"
                        >
                          {a.title}
                        </h3>
                        <Badge variant={VARIANTE_NIVEL[a.level] ?? 'info'}>
                          {etiqueta(ETIQUETA_NIVEL_ANUNCIO, a.level)}
                        </Badge>
                        <Badge variant="default">
                          {etiqueta(ETIQUETA_PLATAFORMA, a.platform)}
                        </Badge>
                        <Badge variant={BADGE_ESTADO[a.estado].variant}>
                          {BADGE_ESTADO[a.estado].label}
                        </Badge>
                      </div>
                      <p className="mt-1.5 max-w-prose text-body-s break-words text-fg-muted">
                        {a.body}
                      </p>
                      <p className="mt-2 text-caption text-fg-subtle">
                        Creado el {fecha(a.created_at)} · Desde{' '}
                        {fechaHora(a.starts_at)}
                        {a.ends_at
                          ? ` · Hasta ${fechaHora(a.ends_at)}`
                          : ' · Sin fecha de fin'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <ToggleAction
                        enabled={a.active}
                        action={setAnnouncementActive.bind(null, a.id)}
                        label={`Mostrar el anuncio «${a.title}»`}
                        exitoActivar="Anuncio visible"
                        exitoDesactivar="Anuncio oculto"
                        error="No se pudo cambiar el anuncio"
                      />
                      <AccionesFila
                        etiqueta={`Acciones del anuncio «${a.title}»`}
                        acciones={[
                          {
                            tipo: 'accion',
                            clave: 'eliminar',
                            label: 'Eliminar anuncio',
                            icono: 'borrar',
                            peligro: true,
                            action: deleteAnnouncement.bind(null, a.id),
                            confirm: {
                              titulo: '¿Eliminar este anuncio?',
                              descripcion: `«${a.title}» deja de mostrarse y se borra. Si solo quieres ocultarlo, usa el interruptor.`,
                              confirmar: 'Eliminar anuncio',
                              cargando: 'Eliminando…',
                            },
                            exito: 'Anuncio eliminado',
                            error: 'No se pudo eliminar el anuncio',
                          },
                        ]}
                      />
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
