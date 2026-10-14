import { StyleSheet, View } from 'react-native'
import { useEstilos, useTheme, type Tema } from '../../theme'
import { Txt } from '../ui/Txt'
import { Button } from '../ui/Button'
import { MapPin, Ship } from '../ui/iconos'
import { formatHora12 } from '../ui/formato'
import { Hoja } from './piezas'

interface Props {
  puertoNombre: string
  /** Hora 'HH:MM' a la que hay que estar en el puerto. */
  hora: string
  minutosRestantes: number
  onVerPuerto: () => void
  onOcultarHoy: () => void
}

/**
 * Nivel 5 (solo cruceros): alerta de embarque en una hoja con role="alert".
 * Se compara fecha y hora; tras «Ocultar por hoy» no vuelve a salir.
 */
export function AlertLevel5({
  puertoNombre,
  hora,
  minutosRestantes,
  onVerPuerto,
  onOcultarHoy,
}: Props): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const { colors } = useTheme()
  const horaTexto = formatHora12(hora)
  const titulo = `Regresa al barco antes de las ${horaTexto}`

  return (
    <Hoja
      visible
      alerta
      onClose={onOcultarHoy}
      kicker="Embarque"
      kickerIcon={Ship}
      titulo={titulo}
      acciones={
        <>
          <Button
            title="Ver puerto en el mapa"
            icon={MapPin}
            variant="tinta"
            size="lg"
            fullWidth
            onPress={onVerPuerto}
          />
          <Button
            title="Ocultar por hoy"
            variant="ghost"
            size="lg"
            fullWidth
            onPress={onOcultarHoy}
          />
        </>
      }
    >
      <View style={styles.fila}>
        <View style={styles.icono}>
          <Ship
            size={26}
            color={colors.fg}
            strokeWidth={1.75}
            accessible={false}
          />
        </View>
        <View style={styles.textos}>
          <Txt variant="numXL" tnum>
            {minutosRestantes} min
          </Txt>
          <Txt variant="bodyS" color="fgMuted">
            para llegar a {puertoNombre}
          </Txt>
        </View>
      </View>
      <Txt variant="bodyS" color="fgMuted">
        El barco no espera. Sal ya hacia el puerto con margen.
      </Txt>
    </Hoja>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    fila: { flexDirection: 'row', alignItems: 'center', gap: t.space[4] },
    icono: {
      width: 56,
      height: 56,
      borderRadius: t.radius.control,
      backgroundColor: t.colors.surface2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textos: { flex: 1 },
  })
