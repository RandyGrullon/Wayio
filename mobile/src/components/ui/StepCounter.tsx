import { StyleSheet, View } from 'react-native'
import { useTheme } from '../../theme'
import { Txt } from './Txt'
import { IconButton } from './IconButton'
import { Minus, Plus } from './iconos'

interface Props {
  value: number
  onChange: (n: number) => void
  label: string
  min?: number
  max?: number
  /** Texto tras el número («viajeros»). */
  unidad?: (n: number) => string
  labelQuitar?: string
  labelAnadir?: string
}

/**
 * Stepper [−] valor [+] (§5.2). Nunca produce NaN y respeta el rango. El valor
 * es «ajustable» para los lectores de pantalla (deslizar arriba/abajo).
 */
export function StepCounter({
  value,
  onChange,
  label,
  min = 1,
  max = 20,
  unidad,
  labelQuitar = 'Quitar viajero',
  labelAnadir = 'Añadir viajero',
}: Props): React.ReactElement {
  const { colors } = useTheme()
  const seguro = Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : min
  const poner = (n: number): void => onChange(Math.min(max, Math.max(min, n)))
  const texto = unidad ? unidad(seguro) : String(seguro)

  return (
    <View>
      <Txt variant="label" style={styles.label} accessible={false}>
        {label}
      </Txt>
      <View style={styles.fila}>
        <IconButton
          label={labelQuitar}
          icon={Minus}
          variant="outline"
          disabled={seguro <= min}
          onPress={() => poner(seguro - 1)}
        />
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ min, max, now: seguro, text: texto }}
          accessibilityActions={[
            { name: 'increment', label: labelAnadir },
            { name: 'decrement', label: labelQuitar },
          ]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'increment') poner(seguro + 1)
            if (e.nativeEvent.actionName === 'decrement') poner(seguro - 1)
          }}
          style={[styles.valor, { borderColor: colors.border }]}
        >
          <Txt variant="title" tnum style={styles.numero}>
            {seguro}
          </Txt>
          {unidad ? (
            <Txt variant="caption" color="fgMuted">
              {texto.replace(String(seguro), '').trim()}
            </Txt>
          ) : null}
        </View>
        <IconButton
          label={labelAnadir}
          icon={Plus}
          variant="outline"
          disabled={seguro >= max}
          onPress={() => poner(seguro + 1)}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  label: { marginBottom: 6 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  valor: {
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  numero: { fontSize: 20, lineHeight: 24 },
})
