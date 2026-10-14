import { Pressable, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useEstilos, useTheme, type Tema } from '../../../theme'
import { Txt } from '../../ui/Txt'
import { CalendarDays, MapIcon, Sun, type LucideIcon } from '../../ui/iconos'

export type PestanaVivo = 'hoy' | 'mapa' | 'dias'

const PESTANAS: readonly {
  id: PestanaVivo
  label: string
  icon: LucideIcon
}[] = [
  { id: 'hoy', label: 'Hoy', icon: Sun },
  { id: 'mapa', label: 'Mapa', icon: MapIcon },
  { id: 'dias', label: 'Días', icon: CalendarDays },
]

interface Props {
  activa: PestanaVivo
  onCambiar: (p: PestanaVivo) => void
}

/**
 * Barra inferior (§6.6): icono 22, etiqueta 12 semibold. Activo en tinta con
 * indicador superior de 2 px; inactivo en fg-muted. Sin sheet arrastrable
 * sobre el mapa.
 */
export function BarraInferior({
  activa,
  onCambiar,
}: Props): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const { colors } = useTheme()
  return (
    <SafeAreaView edges={['bottom']} style={styles.contenedor}>
      <View style={styles.barra} accessibilityRole="tablist">
        {PESTANAS.map((p) => {
          const seleccionada = p.id === activa
          const Icono = p.icon
          const color = seleccionada ? colors.fg : colors.fgMuted
          return (
            <Pressable
              key={p.id}
              onPress={() => onCambiar(p.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: seleccionada }}
              accessibilityLabel={p.label}
              style={({ pressed }) => [
                styles.item,
                pressed ? styles.pulsado : null,
              ]}
            >
              <View
                style={[
                  styles.indicador,
                  seleccionada ? { backgroundColor: colors.fg } : null,
                ]}
              />
              <Icono
                size={22}
                color={color}
                strokeWidth={seleccionada ? 2 : 1.75}
                accessible={false}
              />
              <Txt
                variant="caption"
                maxFontSizeMultiplier={1.2}
                style={[styles.etiqueta, { color }]}
              >
                {p.label}
              </Txt>
            </Pressable>
          )
        })}
      </View>
    </SafeAreaView>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    contenedor: {
      backgroundColor: t.isDark ? t.colors.surface : t.colors.surfaceRaised,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
    },
    barra: { flexDirection: 'row', height: t.control.bottomBar },
    item: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    pulsado: { backgroundColor: t.colors.surface2 },
    indicador: {
      position: 'absolute',
      top: 0,
      left: '28%',
      right: '28%',
      height: 2,
      borderRadius: 1,
      backgroundColor: 'transparent',
    },
    etiqueta: { fontSize: 12, fontFamily: t.fonts.sansSemiBold },
  })
