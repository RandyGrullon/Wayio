'use client'

import { useState } from 'react'
import { ArrowRight, Share2 } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Switch } from '@/components/ui/Switch'
import { useToast } from '@/components/ui/Toast'
import { CopiarEnlace } from '@/components/trip/CopiarEnlace'
import { track } from '@/lib/analytics/events'

interface CompartirSheetProps {
  open: boolean
  onClose: () => void
  /** trips.id (fila guardada). */
  tripId: string | null
  destino: string
  grupoLink: string | null
  isPublic: boolean
  esDueno: boolean
  online: boolean
  /** PATCH is_public (useTrip().setPublic). */
  setPublic: (tripId: string, isPublic: boolean) => Promise<boolean>
}

/**
 * Compartir (docs/DISENO.md §6.6): «Vista de solo lectura» (el dueño la
 * publica u oculta con setPublic) y «Sala del grupo», cada una con copiar y
 * toast. Si el navegador lo permite, también el menú nativo de compartir.
 */
export function CompartirSheet({
  open,
  onClose,
  tripId,
  destino,
  grupoLink,
  isPublic,
  esDueno,
  online,
  setPublic,
}: CompartirSheetProps) {
  const { success } = useToast()
  const [cambiando, setCambiando] = useState(false)
  const origen = typeof window === 'undefined' ? '' : window.location.origin
  const urlVista = tripId ? `${origen}/viaje-compartido/${tripId}` : ''
  const urlGrupo = grupoLink ? `${origen}/group/${grupoLink}` : ''
  const puedeNativo =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const alternarPublico = async (valor: boolean) => {
    if (!tripId) return
    setCambiando(true)
    const ok = await setPublic(tripId, valor)
    setCambiando(false)
    // Si falla, useTrip expone saveError con el mensaje del servidor y la
    // pantalla ya lo muestra en un toast: aquí no se repite.
    if (ok) {
      success(
        valor
          ? 'Vista de solo lectura activada'
          : 'Dejaste de compartir la vista'
      )
    }
  }

  const compartirNativo = async () => {
    if (!urlVista || !tripId) return
    try {
      await navigator.share({
        title: `Viaje a ${destino} · Wayio`,
        text: `Mira el plan de mi viaje a ${destino}.`,
        url: urlVista,
      })
      track('viaje_compartido', { tripId, metodo: 'nativo' })
    } catch {
      // El usuario cerró el menú nativo: nada que avisar.
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Compartir el viaje"
      description="Elige qué quieres compartir. Puedes dejar de hacerlo cuando quieras."
    >
      <div className="flex flex-col gap-8">
        <section
          aria-labelledby="compartir-vista"
          className="flex flex-col gap-4"
        >
          <h3 id="compartir-vista" className="text-title text-fg">
            Vista de solo lectura
          </h3>
          {esDueno ? (
            <Switch
              checked={isPublic}
              disabled={cambiando || !online || !tripId}
              onCheckedChange={(v) => void alternarPublico(v)}
              label="Compartir con un enlace"
              description={
                online
                  ? 'Cualquiera con el enlace verá el plan, sin poder editarlo.'
                  : 'Necesitas conexión para cambiarlo.'
              }
            />
          ) : null}
          {isPublic && urlVista ? (
            <>
              <CopiarEnlace
                url={urlVista}
                etiqueta="Enlace de la vista"
                onCopiado={() =>
                  tripId &&
                  track('viaje_compartido', { tripId, metodo: 'enlace' })
                }
              />
              {puedeNativo ? (
                <Button
                  variant="outline"
                  icon={<Share2 />}
                  onClick={() => void compartirNativo()}
                  className="self-start"
                >
                  Compartir con…
                </Button>
              ) : null}
            </>
          ) : !esDueno ? (
            <p className="text-body-s text-fg-muted">
              Solo quien creó el viaje puede compartir la vista de solo lectura.
            </p>
          ) : null}
        </section>

        <section
          aria-labelledby="compartir-grupo"
          className="flex flex-col gap-4"
        >
          <h3 id="compartir-grupo" className="text-title text-fg">
            Sala del grupo
          </h3>
          {urlGrupo ? (
            <>
              <CopiarEnlace
                url={urlGrupo}
                etiqueta="Enlace de invitación"
                ayuda="Quien entre podrá chatear, votar y repartir gastos contigo."
                mensajeCopiado="Invitación copiada"
                onCopiado={() =>
                  tripId &&
                  track('viaje_compartido', { tripId, metodo: 'grupo' })
                }
              />
              <ButtonLink
                href={`/group/${grupoLink}`}
                variant="ghost"
                iconEnd={<ArrowRight />}
                className="self-start"
              >
                Abrir la sala
              </ButtonLink>
            </>
          ) : (
            <p className="text-body-s text-fg-muted">
              Este viaje no tiene sala de grupo.
            </p>
          )}
        </section>
      </div>
    </Modal>
  )
}
