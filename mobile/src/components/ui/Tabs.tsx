import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useEstilos, useTheme, type Tema } from '../../theme'
import { Txt } from './Txt'
import type { LucideIcon } from './iconos'

export interface OpcionTab<T extends string> {
  value: T
  label: string
  count?: number
  icon?: LucideIcon
}

/**
 * Pestañas en línea (§5.7): seleccionada en tinta con indicador inferior de
 * 2 px. Se desplazan en horizontal si no caben.
 */
export function Tabs<T extends string>({
  options,
  value,
  onValueChange,
  label,
  style,
}: {
  options: readonly OpcionTab<T>[]
  value: T
  onValueChange: (v: T) => void
  label: string
  style?: StyleProp<ViewStyle>
}): React.ReactElement {
  const { colors } = useTheme()
  const styles = useEstilos(crearEstilos)
  return (
    <View style={[styles.barra, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.lista}
        accessibilityRole="tablist"
        accessibilityLabel={label}
      >
        {options.map((o) => {
          const sel = o.value === value
          const Icono = o.icon
          return (
            <Pressable
              key={o.value}
              onPress={() => onValueChange(o.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={
                o.count !== undefined ? `${o.label}, ${o.count}` : o.label
              }
              style={[styles.tab, sel ? styles.tabSel : null]}
            >
              {Icono ? (
                <Icono
                  size={18}
                  color={sel ? colors.fg : colors.fgMuted}
                  strokeWidth={1.75}
                  accessible={false}
                />
              ) : null}
              <Txt
                variant="label"
                color={sel ? 'fg' : 'fgMuted'}
                maxFontSizeMultiplier={1.3}
              >
                {o.label}
              </Txt>
              {o.count !== undefined && o.count > 0 ? (
                <View style={styles.contador}>
                  <Txt variant="caption" color="fgMuted" tnum>
                    {o.count}
                  </Txt>
                </View>
              ) : null}
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    barra: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    lista: { paddingHorizontal: 16, gap: 24 },
    tab: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabSel: { borderBottomColor: t.colors.fg },
    contador: {
      minWidth: 22,
      paddingHorizontal: 6,
      borderRadius: 4,
      backgroundColor: t.colors.surface2,
      alignItems: 'center',
    },
  })
