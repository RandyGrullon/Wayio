import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { EmptyState, Pantalla, ScreenHeader, Txt } from '../components/ui'
import { useNavigation } from '../navigation/NavigationContext'
import { joinTripByLink } from '../lib/trips/repository'
import { useTheme } from '../theme'

/**
 * Unirse a un grupo desde un enlace de invitación (wayio://group/<link>,
 * M09/DA-25). Valida el enlace en la BD (RPC join_trip) y abre la sala.
 */
export function JoinGroupScreen({
  link,
}: {
  link: string
}): React.ReactElement {
  const { replace, reset } = useNavigation()
  const { colors } = useTheme()
  const [error, setError] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vivo = true
    joinTripByLink(link)
      .then((tripId) => {
        if (vivo) replace({ name: 'group', tripId })
      })
      .catch((e: unknown) => {
        if (!vivo) return
        setError(
          e instanceof Error
            ? e.message
            : 'No pudimos unirte al grupo. Inténtalo de nuevo.'
        )
      })
    return () => {
      vivo = false
    }
  }, [link, replace, intento])

  return (
    <Pantalla>
      <ScreenHeader title="Unirse al grupo" />
      {error ? (
        <View>
          <EmptyState
            ilustracion="error"
            title="No pudimos abrir la invitación"
            description={error}
            action={{
              label: 'Reintentar',
              onPress: () => {
                setError(null)
                setIntento((n) => n + 1)
              },
            }}
          />
          <Txt
            variant="bodyS"
            color="accent"
            center
            accessibilityRole="link"
            onPress={() => reset({ name: 'home' })}
            style={styles.volver}
          >
            Volver al inicio
          </Txt>
        </View>
      ) : (
        <View style={styles.centro} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.fg} />
          <Txt variant="title" center style={styles.texto}>
            Uniéndote al grupo…
          </Txt>
          <Txt variant="bodyS" color="fgMuted" center>
            Comprobamos la invitación y abrimos la sala.
          </Txt>
        </View>
      )}
    </Pantalla>
  )
}

const styles = StyleSheet.create({
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 6,
  },
  texto: { marginTop: 12 },
  volver: { textDecorationLine: 'underline', paddingVertical: 12 },
})
