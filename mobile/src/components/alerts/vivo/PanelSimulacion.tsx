import { Pressable, StyleSheet, View } from 'react-native'
import { useEstilos, type Tema } from '../../../theme'
import { Txt } from '../../ui/Txt'
import { Button } from '../../ui/Button'
import { Card, CardKicker } from '../../ui/Card'
import { FlaskConical } from '../../ui/iconos'
import type { Activity } from '../../../types/activity'

interface Props {
  totalDias: number
  diaForzado: number | null
  actividades: Activity[]
  simulando: boolean
  onDia: (dia: number | null) => void
  onLlegar: (a: Activity) => void
  onUsarGps: () => void
}

/**
 * Solo desarrollo (__DEV__): simular el día y la llegada a una actividad
 * para probar geofencing y alertas en Expo Go sin moverse.
 */
export function PanelSimulacion({
  totalDias,
  diaForzado,
  actividades,
  simulando,
  onDia,
  onLlegar,
  onUsarGps,
}: Props): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const conLugar = actividades.filter((a) => a.lat !== 0 || a.lng !== 0)
  return (
    <Card variant="default" style={styles.panel}>
      <CardKicker icon={FlaskConical}>Solo desarrollo</CardKicker>
      <Txt variant="label">Simular día</Txt>
      <View style={styles.chips}>
        <Chip
          texto="Fecha real"
          activo={diaForzado === null}
          onPress={() => onDia(null)}
        />
        {Array.from({ length: totalDias }, (_, i) => (
          <Chip
            key={i}
            texto={`Día ${i + 1}`}
            activo={diaForzado === i}
            onPress={() => onDia(i)}
          />
        ))}
      </View>
      <Txt variant="label">Simular llegada</Txt>
      {conLugar.length === 0 ? (
        <Txt variant="caption" color="fgMuted">
          Las actividades de este día no tienen coordenadas.
        </Txt>
      ) : (
        <View style={styles.chips}>
          {conLugar.map((a) => (
            <Chip
              key={a.id}
              texto={a.nombre}
              activo={false}
              onPress={() => onLlegar(a)}
            />
          ))}
        </View>
      )}
      {simulando ? (
        <Button
          title="Usar GPS real"
          variant="link"
          size="sm"
          onPress={onUsarGps}
        />
      ) : null}
    </Card>
  )
}

function Chip({
  texto,
  activo,
  onPress,
}: {
  texto: string
  activo: boolean
  onPress: () => void
}): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      style={[styles.chip, activo ? styles.chipActivo : null]}
    >
      <Txt
        variant="caption"
        color={activo ? 'fgInverse' : 'fg'}
        numberOfLines={1}
      >
        {texto}
      </Txt>
    </Pressable>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    panel: { gap: t.space[2] },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2] },
    chip: {
      minHeight: 36,
      justifyContent: 'center',
      paddingHorizontal: 12,
      borderRadius: t.radius.pill,
      borderWidth: 1,
      borderColor: t.colors.borderStrong,
      maxWidth: 220,
    },
    chipActivo: {
      backgroundColor: t.colors.surfaceInverse,
      borderColor: t.colors.surfaceInverse,
    },
  })
