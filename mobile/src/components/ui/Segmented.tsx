import { useEffect, useState } from 'react'
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useEstilos, useTheme, type Tema } from '../../theme'
import { Txt } from './Txt'
import { useReduceMotion } from './useReduceMotion'
import type { LucideIcon } from './iconos'

export interface OpcionSegmented<T extends string> {
  value: T
  label: string
  accessibilityLabel?: string
  icon?: LucideIcon
  disabled?: boolean
}

interface Props<T extends string> {
  options: readonly OpcionSegmented<T>[]
  value: T
  onValueChange: (v: T) => void
  label: string
  size?: 'md' | 'sm'
  fullWidth?: boolean
  style?: StyleProp<ViewStyle>
}

interface Caja {
  x: number
  w: number
}

/**
 * Control segmentado (§5.3): pista `surface2` y un thumb que se desliza con
 * spring firme (500/38). Se comporta como un radiogroup.
 */
export function Segmented<T extends string>({
  options,
  value,
  onValueChange,
  label,
  size = 'md',
  fullWidth = false,
  style,
}: Props<T>): React.ReactElement {
  const { colors } = useTheme()
  const styles = useEstilos(crearEstilos)
  const reducir = useReduceMotion()
  const [cajas, setCajas] = useState<Record<string, Caja>>({})
  const [x] = useState(() => new Animated.Value(0))
  const [w] = useState(() => new Animated.Value(0))
  const [colocado, setColocado] = useState(false)
  const actual = cajas[value]

  useEffect(() => {
    if (!actual) return
    if (!colocado || reducir) {
      x.setValue(actual.x)
      w.setValue(actual.w)
      return
    }
    Animated.parallel([
      Animated.spring(x, {
        toValue: actual.x,
        stiffness: 500,
        damping: 38,
        mass: 1,
        useNativeDriver: false,
      }),
      Animated.spring(w, {
        toValue: actual.w,
        stiffness: 500,
        damping: 38,
        mass: 1,
        useNativeDriver: false,
      }),
    ]).start()
  }, [actual, colocado, reducir, x, w])

  const medir = (v: string) => (e: LayoutChangeEvent) => {
    const { x: cx, width } = e.nativeEvent.layout
    setCajas((prev) => {
      const previo = prev[v]
      if (previo && previo.x === cx && previo.w === width) return prev
      return { ...prev, [v]: { x: cx, w: width } }
    })
    if (v === value) setColocado(true)
  }

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.pista, fullWidth ? styles.pistaFull : null, style]}
    >
      {actual ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.thumb, { left: x, width: w }]}
        />
      ) : null}
      {options.map((o) => {
        const sel = o.value === value
        const Icono = o.icon
        return (
          <Pressable
            key={o.value}
            onLayout={medir(o.value)}
            onPress={() => onValueChange(o.value)}
            disabled={o.disabled ?? false}
            accessibilityRole="radio"
            accessibilityLabel={o.accessibilityLabel ?? o.label}
            accessibilityState={{
              checked: sel,
              disabled: o.disabled ?? false,
            }}
            style={[
              styles.item,
              size === 'sm' ? styles.itemSm : null,
              fullWidth ? styles.itemFull : null,
            ]}
          >
            {Icono ? (
              <Icono
                size={16}
                color={sel ? colors.fg : colors.fgMuted}
                strokeWidth={1.75}
                accessible={false}
              />
            ) : null}
            <Txt
              variant="label"
              color={sel ? 'fg' : 'fgMuted'}
              maxFontSizeMultiplier={1.3}
              numberOfLines={1}
              style={[styles.texto, size === 'sm' ? styles.textoSm : null]}
            >
              {o.label}
            </Txt>
          </Pressable>
        )
      })}
    </View>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    pista: {
      flexDirection: 'row',
      alignSelf: 'flex-start',
      backgroundColor: t.colors.surface2,
      borderRadius: 999,
      padding: 4,
    },
    pistaFull: { alignSelf: 'stretch' },
    thumb: {
      position: 'absolute',
      top: 4,
      bottom: 4,
      borderRadius: 999,
      backgroundColor: t.isDark ? t.colors.surfaceRaised : t.colors.surface,
      // En Android `elevation` dibuja el thumb POR ENCIMA de las etiquetas
      // (hermanas sin elevación): sin elevación y con filete fino en su lugar.
      borderWidth: t.isDark || Platform.OS === 'android' ? 1 : 0,
      borderColor: t.colors.border,
      shadowColor: t.elevation.elev.shadowColor,
      shadowOpacity: t.isDark ? 0 : 0.08,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 0,
    },
    item: {
      minHeight: 44,
      paddingHorizontal: 16,
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    itemSm: { minHeight: 32, paddingHorizontal: 10 },
    itemFull: { flex: 1, paddingHorizontal: 8 },
    texto: { fontSize: 14 },
    textoSm: { fontSize: 13 },
  })
