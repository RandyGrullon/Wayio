import { useEffect } from 'react'
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useEstilos, useTheme, type Tema } from '../../theme'
import { Txt } from '../ui/Txt'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  SkipForward,
  type LucideIcon,
} from '../ui/iconos'
import { useReduceMotion } from '../ui/useReduceMotion'

export type OpcionAlerta = 'A' | 'B' | 'C'

interface Props {
  retrasoMinutos: number
  actividadNombre?: string | null
  onElegir: (opcion: OpcionAlerta) => void
}

interface Opcion {
  id: OpcionAlerta
  icon: LucideIcon
  titulo: string
  detalle: string
}

const OPCIONES: readonly Opcion[] = [
  {
    id: 'A',
    icon: CalendarDays,
    titulo: 'Mover a otro día',
    detalle: 'Buscamos el mejor hueco libre de tu itinerario.',
  },
  {
    id: 'B',
    icon: SkipForward,
    titulo: 'Saltar actividad',
    detalle: 'La quitamos de hoy y la guardamos para tu próxima visita.',
  },
  {
    id: 'C',
    icon: ArrowRight,
    titulo: 'Seguir igual',
    detalle: 'Sin cambios: llegarás más tarde.',
  },
]

/**
 * Nivel 4: pantalla completa para decidir. «Atrás» equivale a «Seguir igual»
 * (no se queda nadie atrapado).
 */
export function AlertLevel4({
  retrasoMinutos,
  actividadNombre,
  onElegir,
}: Props): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const { colors } = useTheme()
  const reducir = useReduceMotion()
  const titulo = actividadNombre
    ? `Vas ${retrasoMinutos} min tarde a ${actividadNombre}`
    : `Llevas ${retrasoMinutos} min de retraso`

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${titulo}. Elige cómo seguir.`)
  }, [titulo])

  return (
    <Modal
      visible
      animationType={reducir ? 'fade' : 'slide'}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => onElegir('C')}
    >
      <SafeAreaView style={styles.pantalla} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.contenido}
          accessibilityViewIsModal
        >
          <View style={styles.cabecera} accessibilityRole="alert">
            <View style={styles.icono}>
              <AlertTriangle
                size={28}
                color={colors.warningFg}
                strokeWidth={1.75}
                accessible={false}
              />
            </View>
            <Txt variant="overline" color="warningFg">
              Urgente
            </Txt>
            <Txt variant="h1" center>
              {titulo}
            </Txt>
            <Txt variant="body" color="fgMuted" center>
              Elige cómo seguir con el resto del día.
            </Txt>
          </View>

          <View style={styles.opciones}>
            {OPCIONES.map((o, i) => {
              const Icono = o.icon
              const principal = i === 0
              return (
                <Pressable
                  key={o.id}
                  onPress={() => onElegir(o.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${o.titulo}. ${o.detalle}`}
                  style={({ pressed }) => [
                    styles.opcion,
                    principal ? styles.opcionPrincipal : null,
                    pressed ? styles.pulsada : null,
                  ]}
                >
                  <Icono
                    size={22}
                    color={principal ? colors.fgInverse : colors.fg}
                    strokeWidth={1.75}
                    accessible={false}
                  />
                  <View style={styles.opcionTextos}>
                    <Txt variant="title" color={principal ? 'fgInverse' : 'fg'}>
                      {o.titulo}
                    </Txt>
                    <Txt
                      variant="caption"
                      color={principal ? 'fgInverse' : 'fgMuted'}
                    >
                      {o.detalle}
                    </Txt>
                  </View>
                </Pressable>
              )
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    pantalla: { flex: 1, backgroundColor: t.colors.bg },
    contenido: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: t.space[6],
      gap: t.space[8],
    },
    cabecera: { alignItems: 'center', gap: t.space[2] },
    icono: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: t.colors.warningBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: t.space[2],
    },
    opciones: { gap: t.space[3] },
    opcion: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.space[4],
      minHeight: 72,
      padding: t.space[4],
      borderRadius: t.radius.card,
      borderWidth: 1,
      borderColor: t.colors.borderStrong,
      backgroundColor: t.colors.surface,
    },
    opcionPrincipal: {
      backgroundColor: t.colors.surfaceInverse,
      borderColor: t.colors.surfaceInverse,
    },
    opcionTextos: { flex: 1, gap: 2 },
    pulsada: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  })
