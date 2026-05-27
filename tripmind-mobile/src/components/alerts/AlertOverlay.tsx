import { AlertLevel1 } from './AlertLevel1'
import { AlertLevel2 } from './AlertLevel2'
import { AlertLevel3 } from './AlertLevel3'
import { AlertLevel4 } from './AlertLevel4'
import { AlertLevel5 } from './AlertLevel5'
import type { Activity } from '../../types/activity'
import type { AlertState } from '../../types/alert'

interface Props {
  alertState: AlertState
  actividadActual: Activity | null
  puertoCrucero: Activity | null
  onDismiss: () => void
  onAceptarRecomendacion: (actividadId: string) => void
  onElegirOpcion: (opcion: 'A' | 'B' | 'C') => void
}

export function AlertOverlay({
  alertState,
  actividadActual,
  puertoCrucero,
  onDismiss,
  onAceptarRecomendacion,
  onElegirOpcion,
}: Props): React.ReactElement | null {
  if (alertState.dismissed || alertState.level === 0) return null

  switch (alertState.level) {
    case 1:
      return <AlertLevel1 onDismiss={onDismiss} />

    case 2:
      return (
        <AlertLevel2
          retrasoMinutos={alertState.retrasoMinutos}
          onVerOpciones={() => onElegirOpcion('A')}
          onIgnorar={onDismiss}
        />
      )

    case 3:
      return (
        <AlertLevel3
          retrasoMinutos={alertState.retrasoMinutos}
          aiMessage={alertState.aiMessage}
          aiLoading={alertState.aiLoading}
          onAceptar={() => {
            if (alertState.aiMessage?.actividadRecomendarQuitar) {
              onAceptarRecomendacion(
                alertState.aiMessage.actividadRecomendarQuitar
              )
            }
            onDismiss()
          }}
          onRechazar={onDismiss}
        />
      )

    case 4:
      return (
        <AlertLevel4
          retrasoMinutos={alertState.retrasoMinutos}
          opciones={[
            {
              label: 'Reagendar actividad',
              sublabel: 'Busca el mejor hueco disponible',
              onPress: () => onElegirOpcion('A'),
            },
            {
              label: 'Saltar actividad',
              sublabel: 'Marcará esta actividad como perdida',
              onPress: () => onElegirOpcion('B'),
            },
            {
              label: 'Continuar igual',
              sublabel: 'Asumes el riesgo de llegar tarde',
              onPress: () => onElegirOpcion('C'),
            },
          ]}
        />
      )

    case 5: {
      if (!puertoCrucero) return null
      const minsRestantes =
        actividadActual?.tiempoEmbarqueMinutos ?? alertState.retrasoMinutos * -1

      return (
        <AlertLevel5
          puertoCruceroNombre={puertoCrucero.nombre}
          puertoCruceroLat={puertoCrucero.lat}
          puertoCruceroLng={puertoCrucero.lng}
          minutosRestantes={minsRestantes}
          onActuar={onDismiss}
        />
      )
    }

    default:
      return null
  }
}
