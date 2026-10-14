import { AlertLevel1 } from './AlertLevel1'
import { AlertLevel2 } from './AlertLevel2'
import { AlertLevel3 } from './AlertLevel3'
import { AlertLevel4, type OpcionAlerta } from './AlertLevel4'
import { AlertLevel5 } from './AlertLevel5'
import type { Activity } from '../../types/activity'
import type { AlertState } from '../../types/alert'
import type { Embarque } from '../../lib/geofencing/alertEngine'

export type { OpcionAlerta } from './AlertLevel4'

interface Props {
  alertState: AlertState
  /** Actividad a la que se refiere la alerta (la que vas tarde). */
  actividadActual: Activity | null
  /** Datos de la vuelta al barco (solo crucero, nivel 5). */
  embarque: Embarque | null
  /** Actividad que la IA propone quitar (ya validada contra el día). */
  recomendada: Activity | null
  onDismiss: () => void
  onAceptarRecomendacion: (actividadId: string) => void
  /** A = mover a otro día, B = saltar, C = seguir igual. */
  onElegirOpcion: (opcion: OpcionAlerta) => void
  onVerPuerto: () => void
  onOcultarEmbarque: () => void
}

/**
 * Elige la pieza según el nivel. El 1 y el 2 se colocan dentro del área de
 * contenido; el 3, el 4 y el 5 son modales. Cerrar los niveles 1-3 solo
 * descarta ese nivel (si el retraso crece, se vuelve a avisar); «Seguir
 * igual» en el 4 es la decisión final para esa actividad.
 */
export function AlertOverlay({
  alertState,
  actividadActual,
  embarque,
  recomendada,
  onDismiss,
  onAceptarRecomendacion,
  onElegirOpcion,
  onVerPuerto,
  onOcultarEmbarque,
}: Props): React.ReactElement | null {
  if (alertState.dismissed || alertState.level === 0) return null
  const nombre = actividadActual?.nombre ?? null

  switch (alertState.level) {
    case 1:
      return (
        <AlertLevel1
          actividadNombre={nombre}
          retrasoMinutos={alertState.retrasoMinutos}
          onDismiss={onDismiss}
        />
      )

    case 2:
      return (
        <AlertLevel2
          retrasoMinutos={alertState.retrasoMinutos}
          actividadNombre={nombre}
          onMover={() => onElegirOpcion('A')}
          onIgnorar={onDismiss}
        />
      )

    case 3:
      return (
        <AlertLevel3
          retrasoMinutos={alertState.retrasoMinutos}
          actividadNombre={nombre}
          aiMessage={alertState.aiMessage}
          aiLoading={alertState.aiLoading}
          recomendadaNombre={recomendada?.nombre ?? null}
          onAceptar={() => {
            if (recomendada) onAceptarRecomendacion(recomendada.id)
            onDismiss()
          }}
          onVerOpciones={() => onElegirOpcion('A')}
          onRechazar={onDismiss}
        />
      )

    case 4:
      return (
        <AlertLevel4
          retrasoMinutos={alertState.retrasoMinutos}
          actividadNombre={nombre}
          onElegir={onElegirOpcion}
        />
      )

    case 5:
      // Sin datos del puerto, el nivel 5 se trata como un retraso urgente.
      if (!embarque) {
        return (
          <AlertLevel4
            retrasoMinutos={alertState.retrasoMinutos}
            actividadNombre={nombre}
            onElegir={onElegirOpcion}
          />
        )
      }
      return (
        <AlertLevel5
          puertoNombre={embarque.nombre}
          hora={embarque.hora}
          minutosRestantes={embarque.minutosRestantes}
          onVerPuerto={onVerPuerto}
          onOcultarHoy={onOcultarEmbarque}
        />
      )

    default:
      return null
  }
}
