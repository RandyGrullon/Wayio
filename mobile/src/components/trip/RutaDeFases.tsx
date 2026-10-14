import { useEffect, useState } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import Svg, { Line } from 'react-native-svg'
import { useTheme } from '../../theme'
import { Txt } from '../ui/Txt'
import { useReduceMotion } from '../ui/useReduceMotion'
import { Check, Compass, MapPin, Sun, X, type LucideIcon } from '../ui/iconos'

export type EstadoSello = 'pendiente' | 'activo' | 'hecho' | 'error'

export interface SelloFase {
  id: string
  titulo: string
  detalle?: string
  icono: LucideIcon
}

export const SELLOS_GENERACION: readonly SelloFase[] = [
  {
    id: 'contexto',
    titulo: 'Contexto',
    detalle: 'Clima y ubicación',
    icono: Sun,
  },
  {
    id: 'itinerario',
    titulo: 'Itinerario',
    detalle: 'La IA arma 3 versiones',
    icono: Compass,
  },
  {
    id: 'coords',
    titulo: 'Coordenadas',
    detalle: 'Ubicando lugares',
    icono: MapPin,
  },
  { id: 'listo', titulo: 'Listo', icono: Check },
]

const AnimatedLine = Animated.createAnimatedComponent(Line)

/** Tramo vertical entre sellos: sólido (hecho), punteado vivo (en curso) o tenue. */
function Tramo({
  estado,
}: {
  estado: 'hecho' | 'activo' | 'pendiente'
}): React.ReactElement {
  const { colors } = useTheme()
  const reducir = useReduceMotion()
  const [hormigas] = useState(() => new Animated.Value(0))

  useEffect(() => {
    if (estado !== 'activo' || reducir) {
      hormigas.setValue(0)
      return
    }
    // Progreso real en curso: el único bucle permitido (§1.3.7).
    const bucle = Animated.loop(
      Animated.timing(hormigas, {
        toValue: -10,
        duration: 600,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    )
    bucle.start()
    return () => bucle.stop()
  }, [estado, reducir, hormigas])

  return (
    <Svg width={4} height={32} style={styles.tramo}>
      <AnimatedLine
        x1={2}
        y1={0}
        x2={2}
        y2={32}
        stroke={
          estado === 'hecho'
            ? colors.fg
            : estado === 'activo'
              ? colors.primary
              : colors.rule
        }
        strokeWidth={2}
        strokeLinecap="round"
        {...(estado === 'hecho' ? {} : { strokeDasharray: '4 6' })}
        strokeDashoffset={estado === 'activo' ? hormigas : 0}
      />
    </Svg>
  )
}

/**
 * RutaDeFases (§6.3, vertical en móvil): cuatro sellos unidos por tramos.
 * El icono, el texto y el tramo salen de la MISMA fase real del SSE; no hay
 * temporizador. Pendiente: aro; activo: aro primario con punto; hecho:
 * relleno de tinta con Check; error: peligro con X.
 */
export function RutaDeFases({
  sellos = SELLOS_GENERACION,
  estados,
}: {
  sellos?: readonly SelloFase[]
  estados: readonly EstadoSello[]
}): React.ReactElement {
  const { colors } = useTheme()
  return (
    <View accessibilityRole="progressbar" style={styles.lista}>
      {sellos.map((s, i) => {
        const estado = estados[i] ?? 'pendiente'
        const siguiente = estados[i + 1] ?? 'pendiente'
        const Icono =
          estado === 'hecho' ? Check : estado === 'error' ? X : s.icono
        const anillo =
          estado === 'activo'
            ? colors.primary
            : estado === 'hecho'
              ? colors.fg
              : estado === 'error'
                ? colors.danger
                : colors.borderStrong
        const relleno =
          estado === 'hecho'
            ? colors.fg
            : estado === 'error'
              ? colors.dangerBg
              : colors.surface
        const tinta =
          estado === 'hecho'
            ? colors.fgInverse
            : estado === 'error'
              ? colors.danger
              : estado === 'activo'
                ? colors.primary
                : colors.fgSubtle
        const textoEstado =
          estado === 'hecho'
            ? 'hecho'
            : estado === 'activo'
              ? 'en curso'
              : estado === 'error'
                ? 'con error'
                : 'pendiente'
        return (
          <View key={s.id}>
            <View
              style={styles.fila}
              accessible
              accessibilityLabel={`${s.titulo}${s.detalle ? `, ${s.detalle}` : ''}: ${textoEstado}`}
            >
              <View
                style={[
                  styles.sello,
                  { borderColor: anillo, backgroundColor: relleno },
                ]}
              >
                <Icono
                  size={18}
                  color={tinta}
                  strokeWidth={2}
                  accessible={false}
                />
                {estado === 'activo' ? (
                  <View
                    style={[
                      styles.puntoVivo,
                      { backgroundColor: colors.primary },
                    ]}
                  />
                ) : null}
              </View>
              <View style={styles.textos}>
                <Txt
                  variant="label"
                  color={estado === 'pendiente' ? 'fgSubtle' : 'fg'}
                >
                  {s.titulo}
                </Txt>
                {s.detalle ? (
                  <Txt variant="caption" color="fgMuted">
                    {s.detalle}
                  </Txt>
                ) : null}
              </View>
            </View>
            {i < sellos.length - 1 ? (
              <Tramo
                estado={
                  estado === 'hecho' && siguiente === 'hecho'
                    ? 'hecho'
                    : estado === 'hecho' && siguiente === 'activo'
                      ? 'activo'
                      : estado === 'hecho'
                        ? 'hecho'
                        : 'pendiente'
                }
              />
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  lista: { gap: 0 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sello: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  puntoVivo: {
    position: 'absolute',
    right: -2,
    top: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  textos: { flex: 1 },
  tramo: { marginLeft: 18, marginVertical: 2 },
})
