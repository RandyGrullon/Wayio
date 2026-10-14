import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import { useEstilos, useTheme, type Tema } from '../../../theme'
import { Txt } from '../../ui/Txt'
import { LocateFixed, LocateOff } from '../../ui/iconos'
import type { EstadoUbicacion } from '../../../hooks/useLocation'

interface Props {
  estado: EstadoUbicacion
  /** Posición simulada (solo desarrollo). */
  simulada?: boolean
  onPress: () => void
}

const TEXTO: Record<EstadoUbicacion, string> = {
  inactiva: 'Activar ubicación',
  activando: 'Activando…',
  activa: 'Ubicación activa',
  denegada: 'Permiso denegado · Cómo activarlo',
  apagada: 'Ubicación apagada · Activar',
  error: 'Reintentar ubicación',
}

const PISTA: Partial<Record<EstadoUbicacion, string>> = {
  inactiva: 'Detecta cuándo llegas a cada actividad de hoy',
  activa: 'Toca para apagar la ubicación',
  denegada: 'Abre los ajustes para permitir la ubicación',
  apagada: 'Abre los ajustes de ubicación del teléfono',
}

/**
 * Pill de GPS honesta (§6.6): «Ubicación activa» solo aparece tras recibir
 * la primera posición. El punto magenta es «estás aquí».
 */
export function PillGps({
  estado,
  simulada = false,
  onPress,
}: Props): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const { colors } = useTheme()
  const activa = estado === 'activa' || simulada
  const problema =
    !simulada &&
    (estado === 'denegada' || estado === 'apagada' || estado === 'error')
  const texto = simulada ? 'Ubicación simulada' : TEXTO[estado]
  const pista = simulada ? undefined : PISTA[estado]

  return (
    <Pressable
      onPress={onPress}
      disabled={estado === 'activando' && !simulada}
      accessibilityRole="button"
      accessibilityLabel={texto}
      {...(pista ? { accessibilityHint: pista } : {})}
      accessibilityState={{
        busy: estado === 'activando',
        disabled: estado === 'activando',
      }}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      style={({ pressed }) => [
        styles.pill,
        activa ? styles.activa : null,
        problema ? styles.problema : null,
        pressed ? styles.pulsada : null,
      ]}
    >
      {estado === 'activando' && !simulada ? (
        <ActivityIndicator size="small" color={colors.fg} />
      ) : activa ? (
        <View style={styles.punto} accessible={false} />
      ) : problema ? (
        <LocateOff
          size={16}
          color={colors.warningFg}
          strokeWidth={1.75}
          accessible={false}
        />
      ) : (
        <LocateFixed
          size={16}
          color={colors.fg}
          strokeWidth={1.75}
          accessible={false}
        />
      )}
      <Txt
        variant="caption"
        color={problema ? 'warningFg' : 'fg'}
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
        style={styles.texto}
      >
        {texto}
      </Txt>
    </Pressable>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: t.radius.pill,
      borderWidth: 1,
      borderColor: t.colors.borderStrong,
      backgroundColor: t.colors.surface,
      flexShrink: 1,
    },
    activa: { borderColor: t.colors.fg },
    problema: {
      borderColor: t.colors.warningFg,
      backgroundColor: t.colors.warningBg,
    },
    pulsada: { opacity: 0.85 },
    punto: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: t.colors.gps,
      borderWidth: 2,
      borderColor: t.colors.gpsRing,
    },
    texto: { flexShrink: 1, fontFamily: t.fonts.sansSemiBold },
  })
