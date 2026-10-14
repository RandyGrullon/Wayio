import { StyleSheet, Text, View } from 'react-native'
import { colorDia, useTheme } from '../../theme'

export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  const a = partes[0]?.[0] ?? '?'
  const b = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : ''
  return `${a}${b}`.toUpperCase()
}

/** Índice estable (0…) a partir de un id, para el color del avatar. */
export function indiceDesdeId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * Avatar de miembro (§5.14): color del día (cíclico) con las iniciales en el
 * color numeral del tema (blanco sobre las bases, tinta sobre las luces).
 */
export function Avatar({
  nombre,
  indice,
  size = 32,
  decorativo = false,
  borde,
}: {
  nombre: string
  indice: number
  size?: number
  decorativo?: boolean
  /** Color del anillo (para pilas solapadas). */
  borde?: string
}): React.ReactElement {
  const { days, colors, fonts } = useTheme()
  return (
    <View
      {...(decorativo
        ? {
            accessible: false,
            importantForAccessibility: 'no-hide-descendants',
          }
        : {
            accessible: true,
            accessibilityRole: 'image',
            accessibilityLabel: nombre,
          })}
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colorDia(days, (indice % 10) + 1),
          borderColor: borde ?? 'transparent',
          borderWidth: borde ? 2 : 0,
        },
      ]}
    >
      <Text
        maxFontSizeMultiplier={1.2}
        style={{
          color: colors.dayNumeral,
          fontFamily: fonts.sansSemiBold,
          fontSize: Math.round(size * 0.4),
        }}
      >
        {iniciales(nombre)}
      </Text>
    </View>
  )
}

/** Pila de avatares solapados (máx. 5 y «+N»). */
export function AvatarStack({
  personas,
  max = 5,
  size = 32,
}: {
  personas: readonly { nombre: string; indice: number }[]
  max?: number
  size?: number
}): React.ReactElement {
  const { colors, fonts } = useTheme()
  const visibles = personas.slice(0, max)
  const resto = personas.length - visibles.length
  return (
    <View
      style={styles.pila}
      accessible
      accessibilityLabel={`${personas.length} ${personas.length === 1 ? 'viajero' : 'viajeros'}: ${personas.map((p) => p.nombre).join(', ')}`}
    >
      {visibles.map((p, i) => (
        <View key={`${p.nombre}-${i}`} style={i > 0 ? styles.solapa : null}>
          <Avatar
            nombre={p.nombre}
            indice={p.indice}
            size={size}
            decorativo
            borde={colors.bg}
          />
        </View>
      ))}
      {resto > 0 ? (
        <View
          style={[
            styles.avatar,
            styles.solapa,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: colors.surface2,
              borderColor: colors.bg,
              borderWidth: 2,
            },
          ]}
        >
          <Text
            style={{
              color: colors.fgMuted,
              fontFamily: fonts.sansSemiBold,
              fontSize: 12,
            }}
          >
            +{resto}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  pila: { flexDirection: 'row', alignItems: 'center' },
  solapa: { marginLeft: -8 },
})
