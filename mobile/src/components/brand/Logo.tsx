import { useEffect, useRef } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle, G, Path } from 'react-native-svg'
import { useTheme } from '../../theme'
import { BRAND, ISOTIPO, WORDMARK } from './marks'
import { registrarDestinoIntro, useIntroActiva } from './introEstado'

type Variante = 'wordmark' | 'isotipo'
type Tono = 'color' | 'inverso' | 'mono'

interface Props {
  variant?: Variante
  /**
   * color: tinta + punto rosa (por defecto) · inverso: papel + punto
   * #F55A9A (solo sobre fondos oscuros en ambos temas) · mono: todo `color`.
   */
  tone?: Tono
  /** Alto en dp (el ancho sale de la proporción del dibujo). */
  height?: number
  /** Color del monocromo (token ya resuelto). */
  color?: string
  /** Etiqueta accesible; sin ella el logo es decorativo. */
  title?: string
  /** Es el destino del relevo de la intro (cabecera de Home / Auth). */
  destinoIntro?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * Logo de Wayio (§8): wordmark monolínea `wayio` con el punto de la i en Rosa
 * de Bayahíbe, o el isotipo (aro de origen → w → punto de destino). UN solo
 * punto magenta por composición; nunca isotipo junto al wordmark.
 */
export function Logo({
  variant = 'wordmark',
  tone = 'color',
  height = 26,
  color,
  title,
  destinoIntro = false,
  style,
}: Props): React.ReactElement {
  const { colors } = useTheme()
  const ref = useRef<View>(null)
  const introActiva = useIntroActiva()

  useEffect(() => {
    if (!destinoIntro) return
    return registrarDestinoIntro(
      () =>
        new Promise((resolve) => {
          const vista = ref.current
          if (!vista) {
            resolve(null)
            return
          }
          vista.measureInWindow((x, y, w, h) =>
            resolve(w > 0 && h > 0 ? { x, y, w, h } : null)
          )
        })
    )
  }, [destinoIntro])

  const trazo =
    tone === 'inverso'
      ? BRAND.papel
      : tone === 'mono'
        ? (color ?? colors.fg)
        : colors.fg
  // El punto es `primary`: #C21A66 en claro y #F55A9A en oscuro (§8.4).
  const punto =
    tone === 'inverso'
      ? BRAND.rosaOscuro
      : tone === 'mono'
        ? (color ?? colors.fg)
        : colors.primary

  const esWordmark = variant === 'wordmark'
  const ancho = esWordmark ? (height * WORDMARK.ancho) / WORDMARK.alto : height

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[
        { width: ancho, height },
        destinoIntro && introActiva ? { opacity: 0 } : null,
        style,
      ]}
      {...(title
        ? {
            accessible: true,
            accessibilityRole: 'image',
            accessibilityLabel: title,
          }
        : {
            accessible: false,
            importantForAccessibility: 'no-hide-descendants',
          })}
    >
      {esWordmark ? (
        <Svg width={ancho} height={height} viewBox={WORDMARK.viewBox}>
          <G
            fill="none"
            stroke={trazo}
            strokeWidth={WORDMARK.stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {Object.values(WORDMARK.paths).map((d) => (
              <Path key={d} d={d} />
            ))}
          </G>
          <Circle
            cx={WORDMARK.dot.cx}
            cy={WORDMARK.dot.cy}
            r={WORDMARK.dot.r}
            fill={punto}
          />
        </Svg>
      ) : (
        <Svg width={ancho} height={height} viewBox={ISOTIPO.viewBox}>
          <G
            fill="none"
            stroke={trazo}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d={ISOTIPO.route} strokeWidth={ISOTIPO.stroke} />
            <Circle
              cx={ISOTIPO.ring.cx}
              cy={ISOTIPO.ring.cy}
              r={ISOTIPO.ring.r}
              strokeWidth={ISOTIPO.ring.stroke}
            />
          </G>
          <Circle
            cx={ISOTIPO.dot.cx}
            cy={ISOTIPO.dot.cy}
            r={ISOTIPO.dot.r}
            fill={punto}
          />
        </Svg>
      )}
    </View>
  )
}
