import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useEstilos, useTheme, type Tema } from '../../theme'
import { Txt } from '../ui/Txt'
import { Button } from '../ui/Button'
import { Card, CardKicker } from '../ui/Card'
import { Compass } from '../ui/iconos'
import { Hoja } from './piezas'
import type { AlertMessage } from '../../types/alert'

interface Props {
  retrasoMinutos: number
  actividadNombre?: string | null
  aiMessage: AlertMessage | null
  aiLoading: boolean
  /** Nombre de la actividad que la IA propone quitar (ya validada). */
  recomendadaNombre: string | null
  onAceptar: () => void
  onVerOpciones: () => void
  onRechazar: () => void
}

/** Nivel 3: hoja con la sugerencia de la IA (Compass, nunca Sparkles). */
export function AlertLevel3({
  retrasoMinutos,
  actividadNombre,
  aiMessage,
  aiLoading,
  recomendadaNombre,
  onAceptar,
  onVerOpciones,
  onRechazar,
}: Props): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const { colors } = useTheme()
  const hayRecomendacion =
    !aiLoading && aiMessage?.actividadRecomendarQuitar && recomendadaNombre

  return (
    <Hoja
      visible
      alerta
      onClose={onRechazar}
      kicker="Sugerencia con IA"
      kickerIcon={Compass}
      titulo={`${retrasoMinutos} min de retraso`}
      acciones={
        <>
          {hayRecomendacion ? (
            <Button
              title={`Quitar ${recomendadaNombre} de hoy`}
              variant="tinta"
              size="lg"
              fullWidth
              onPress={onAceptar}
            />
          ) : (
            <Button
              title="Mover a otro día"
              variant="tinta"
              size="lg"
              fullWidth
              onPress={onVerOpciones}
            />
          )}
          <Button
            title="Seguir con mi plan"
            variant="ghost"
            size="lg"
            fullWidth
            onPress={onRechazar}
          />
        </>
      }
    >
      {actividadNombre ? (
        <Txt variant="bodyS" color="fgMuted">
          Vas tarde a {actividadNombre}.
        </Txt>
      ) : null}

      {aiLoading || !aiMessage ? (
        <View
          style={styles.cargando}
          accessible
          accessibilityLabel="Buscando una alternativa"
          accessibilityState={{ busy: true }}
        >
          <ActivityIndicator color={colors.fg} />
          <Txt variant="bodyS" color="fgMuted">
            Buscando una alternativa para el resto del día…
          </Txt>
        </View>
      ) : (
        <>
          <Txt variant="body" accessibilityLiveRegion="polite">
            {aiMessage.mensajeAmigable}
          </Txt>

          {hayRecomendacion ? (
            <Card variant="nota" style={styles.nota}>
              <CardKicker color="brassText">Recomendación</CardKicker>
              <Txt variant="label">
                Quitar {recomendadaNombre} te ahorra {aiMessage.tiempoQueAhorra}{' '}
                min
              </Txt>
              {aiMessage.razonSimple ? (
                <Txt variant="bodyS" color="fgMuted">
                  {aiMessage.razonSimple}
                </Txt>
              ) : null}
            </Card>
          ) : null}

          {aiMessage.alternativa ? (
            <Txt variant="bodyS" color="fgMuted">
              {aiMessage.alternativa}
            </Txt>
          ) : null}
        </>
      )}
    </Hoja>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    cargando: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.space[3],
      paddingVertical: t.space[4],
    },
    nota: { gap: t.space[1], padding: t.space[4] },
  })
