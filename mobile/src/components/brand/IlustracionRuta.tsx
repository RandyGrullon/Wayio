import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg'
import { useTheme } from '../../theme'

/**
 * Ilustración de línea para estados vacíos (§5.10): ruta punteada en `rule`
 * que termina en el punto (variante `punto`) o que se corta y acaba en un
 * sello de latón «?» (variante `pregunta`, para errores y 404).
 */
export function IlustracionRuta({
  variante = 'punto',
  size = 96,
}: {
  variante?: 'punto' | 'pregunta'
  size?: number
}): React.ReactElement {
  const { colors, fonts } = useTheme()
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <G
        fill="none"
        stroke={colors.rule}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Circle cx={16} cy={70} r={5} />
        {variante === 'punto' ? (
          <Path
            d="M20 66 C34 50 30 36 46 40 S62 62 74 34"
            strokeDasharray="0.1 6"
            strokeWidth={3}
          />
        ) : (
          <Path
            d="M20 66 C34 50 30 36 46 40 S56 52 60 46"
            strokeDasharray="0.1 6"
            strokeWidth={3}
          />
        )}
      </G>
      {variante === 'punto' ? (
        <Circle cx={76} cy={26} r={7} fill={colors.primary} />
      ) : (
        <G rotation={-8} origin="74, 30">
          <Rect
            x={60}
            y={16}
            width={28}
            height={28}
            rx={4}
            fill="none"
            stroke={colors.brass}
            strokeWidth={2}
          />
          <SvgText
            x={74}
            y={37}
            fontSize={20}
            fontFamily={fonts.displayBold}
            fill={colors.brass}
            textAnchor="middle"
          >
            ?
          </SvgText>
        </G>
      )}
    </Svg>
  )
}
