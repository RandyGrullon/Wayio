'use client'

import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { Avatar, indiceDesdeId } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Callout } from '@/components/ui/Callout'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Switch } from '@/components/ui/Switch'
import { formatFecha, formatHora12, parseFecha } from '@/lib/utils/formatters'
import type { TripMemberRow } from '@/types/database'
import type { CompartirUbicacion } from './useCompartirUbicacion'

/** «10:42 a. m.» si es de hoy; si no, «8 oct, 10:42 a. m.». */
function cuando(iso: string, hoy: string): string {
  const f = parseFecha(iso)
  if (!f) return ''
  const dia = formatFecha(f, { diaSemana: false })
  return dia === hoy ? formatHora12(f) : `${dia}, ${formatHora12(f)}`
}

/**
 * Miembros de la sala (docs/DISENO.md §6.8): avatar con el color del
 * miembro, «Ubicación actualizada 10:42 a. m.» o «Sin ubicación», badge «Tú»
 * y el switch «Compartir mi ubicación» (con consentimiento explícito).
 *
 * El estado de la ubicación llega de GroupRoom (useCompartirUbicacion): en
 * móvil este panel vive en una pestaña que se desmonta al cambiar a Chat, y
 * eso no debe apagar el GPS.
 */
export function MiembrosPanel({
  members,
  currentUserId,
  ubicacion,
  hoy,
}: {
  members: TripMemberRow[]
  currentUserId: string
  ubicacion: CompartirUbicacion
  /** Fecha de hoy ya formateada («8 oct»), calculada fuera del render. */
  hoy: string
}) {
  const [pidiendo, setPidiendo] = useState(false)
  const activo =
    ubicacion.estado === 'activa' || ubicacion.estado === 'activando'

  const alternar = (valor: boolean) => {
    if (valor) setPidiendo(true)
    else ubicacion.detener()
  }

  const descripcion =
    ubicacion.estado === 'activando'
      ? 'Activando…'
      : ubicacion.estado === 'activa'
        ? 'Ubicación activa mientras tengas esta página abierta.'
        : 'El grupo verá dónde estás mientras tengas esta página abierta.'

  return (
    <section aria-labelledby="grupo-miembros" className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="grupo-miembros" className="font-display text-h3 text-fg">
          Viajeros
        </h2>
        <span className="text-caption text-fg-subtle tnum">
          {members.length === 1 ? '1 persona' : `${members.length} personas`}
        </span>
      </div>

      <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
        {members.map((m) => {
          const yo = m.user_id === currentUserId
          return (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar
                name={m.nombre}
                index={indiceDesdeId(m.user_id)}
                decorative
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-fg">
                  {m.nombre}
                </p>
                <p className="flex items-center gap-1 text-caption text-fg-muted">
                  {m.ultima_ubicacion ? (
                    <>
                      <MapPin
                        aria-hidden="true"
                        strokeWidth={1.75}
                        className="size-3.5 shrink-0"
                      />
                      <span className="tnum">
                        Ubicación actualizada {cuando(m.ultima_ubicacion, hoy)}
                      </span>
                    </>
                  ) : (
                    'Sin ubicación'
                  )}
                </p>
              </div>
              {yo ? <Badge variant="brand">Tú</Badge> : null}
            </li>
          )
        })}
      </ul>

      <div className="rounded-card border border-border bg-surface p-4">
        <Switch
          checked={activo}
          onCheckedChange={alternar}
          label="Compartir mi ubicación"
          description={descripcion}
        />
        {ubicacion.error ? (
          <Callout
            tone={ubicacion.estado === 'denegada' ? 'warning' : 'info'}
            className="mt-4"
          >
            {ubicacion.error}
          </Callout>
        ) : null}
      </div>

      <ConfirmDialog
        open={pidiendo}
        onClose={() => setPidiendo(false)}
        onConfirm={() => ubicacion.iniciar()}
        tone="neutral"
        title="¿Compartir tu ubicación con el grupo?"
        description="Los miembros de esta sala verán dónde estás y a qué hora se actualizó, mientras tengas esta página abierta. Puedes apagarlo cuando quieras; al salir de la página deja de compartirse."
        confirmLabel="Compartir ubicación"
        cancelLabel="Ahora no"
      />
    </section>
  )
}
