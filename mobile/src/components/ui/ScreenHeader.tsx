import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { useEstilos, type Tema } from '../../theme'
import { useNavigation } from '../../navigation/NavigationContext'
import { IconButton } from './IconButton'
import { Txt } from './Txt'
import { ChevronLeft } from './iconos'

interface Props {
  title: string
  subtitle?: string
  /** Overline sobre el título («SALA DEL GRUPO»). */
  kicker?: string
  right?: ReactNode
  /** Acción del botón atrás (por defecto, volver en la pila). */
  onBack?: () => void
  /** Etiqueta accesible del botón atrás. */
  backLabel?: string
}

/**
 * Cabecera de las pantallas internas (56 de alto): «‹ Volver», título en
 * Newsreader y acciones a la derecha. Hairline inferior.
 */
export function ScreenHeader({
  title,
  subtitle,
  kicker,
  right,
  onBack,
  backLabel = 'Volver',
}: Props): React.ReactElement {
  const { canGoBack, goBack } = useNavigation()
  const styles = useEstilos(crearEstilos)
  const volver = onBack ?? (canGoBack ? goBack : null)

  return (
    <View style={styles.header}>
      {volver ? (
        <IconButton
          label={backLabel}
          icon={ChevronLeft}
          onPress={volver}
          style={styles.back}
        />
      ) : (
        <View style={styles.sinBack} />
      )}
      <View style={styles.titulos}>
        {kicker ? (
          <Txt variant="overline" color="fgMuted" numberOfLines={1}>
            {kicker}
          </Txt>
        ) : null}
        <Txt variant="h3" numberOfLines={1}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="caption" color="fgMuted" numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 56,
      paddingHorizontal: 8,
      paddingVertical: 6,
      gap: 4,
      backgroundColor: t.colors.bg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    back: { marginRight: 2 },
    sinBack: { width: 8 },
    titulos: { flex: 1, justifyContent: 'center' },
    right: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginLeft: 4,
    },
  })
