import { View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle, G, Path, Rect } from 'react-native-svg'
import { useTheme } from '../../theme'

/** Número pseudoaleatorio estable (0..1) a partir de una semilla. */
function aleatorio(semilla: string, n: number): number {
  let h = 2166136261
  const s = `${semilla}:${n}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

/**
 * Arte de postal generativo (§5.4 `postal`): horizonte, sol de latón, mar en
 * líneas y una ruta punteada hacia una isla. Sin texto encima y sin magenta
 * (el punto rosa de la composición es el del logo). Misma semilla, mismo
 * dibujo. Decorativo.
 */
export function PostalArte({
  semilla = 'wayio',
  alto = 120,
  style,
}: {
  semilla?: string
  alto?: number
  style?: StyleProp<ViewStyle>
}): React.ReactElement {
  const { colors, days, isDark } = useTheme()
  const r = (n: number): number => aleatorio(semilla, n)
  const solX = 230 + r(1) * 50
  const solY = 30 + r(2) * 16
  const isla = 170 + r(3) * 60
  const horizonte = 68
  const tierra = days[1] ?? colors.accent
  const montana = days[5] ?? colors.accent

  return (
    <View
      style={[{ height: alto, overflow: 'hidden' }, style]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 320 120"
        preserveAspectRatio="xMidYMid slice"
      >
        <Rect width="320" height="120" fill={colors.surface2} />
        {/* Retícula tenue */}
        <G stroke={colors.rule} strokeWidth={0.6} opacity={0.6}>
          {[40, 120, 200, 280].map((x) => (
            <Path key={`m${x}`} d={`M${x} 0 V120`} />
          ))}
          {[30, 90].map((y) => (
            <Path key={`p${y}`} d={`M0 ${y} H320`} />
          ))}
        </G>
        {/* Sol de latón */}
        <Circle cx={solX} cy={solY} r={16} fill={colors.brass} opacity={0.85} />
        {/* Montañas e isla */}
        <Path
          d={`M${isla - 70} ${horizonte} L${isla - 30} ${horizonte - 26} L${isla - 6} ${horizonte - 12} L${isla + 22} ${horizonte - 34} L${isla + 64} ${horizonte} Z`}
          fill={montana}
          opacity={isDark ? 0.85 : 0.9}
        />
        <Path
          d={`M${isla - 30} ${horizonte} Q${isla} ${horizonte - 10} ${isla + 34} ${horizonte} Z`}
          fill={tierra}
        />
        {/* Mar */}
        <Rect
          x="0"
          y={horizonte}
          width="320"
          height={120 - horizonte}
          fill={colors.accentSoft}
        />
        <G
          fill="none"
          stroke={colors.accent}
          strokeWidth={1.2}
          strokeLinecap="round"
          opacity={0.7}
        >
          {[80, 92, 104].map((y, i) => (
            <Path
              key={y}
              d={`M${10 + i * 14} ${y} q10 -5 20 0 t20 0 t20 0 M${170 - i * 10} ${y + 4} q10 -5 20 0 t20 0`}
            />
          ))}
        </G>
        {/* Ruta punteada desde el origen (aro) hacia la isla */}
        <G fill="none" stroke={colors.fg} strokeLinecap="round">
          <Circle cx={36} cy={98} r={4} strokeWidth={2} />
          <Path
            d={`M41 95 C 80 70, 110 108, ${isla - 20} ${horizonte + 6}`}
            strokeWidth={2}
            strokeDasharray="0.1 6"
          />
        </G>
      </Svg>
    </View>
  )
}
