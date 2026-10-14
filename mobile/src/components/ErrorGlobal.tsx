import { StyleSheet, View } from 'react-native'
import { Logo } from './brand/Logo'
import { IlustracionRuta } from './brand/IlustracionRuta'
import { Button } from './ui/Button'
import { Pantalla } from './ui/Pantalla'
import { Txt } from './ui/Txt'
import { RefreshCw } from './ui/iconos'

/**
 * Pantalla de error global (M18): la muestra el ErrorBoundary de App.tsx si
 * algo falla al pintar. Sin detalles técnicos; un solo botón para reintentar.
 */
export function ErrorGlobal({
  onRetry,
}: {
  onRetry: () => void
}): React.ReactElement {
  return (
    <Pantalla edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.cabecera}>
        <Logo height={26} title="Wayio" />
      </View>
      <View style={styles.centro}>
        <IlustracionRuta variante="pregunta" size={120} />
        <Txt variant="displayL" center style={styles.titulo}>
          Algo se torció en el camino
        </Txt>
        <Txt variant="body" color="fgMuted" center style={styles.texto}>
          No es culpa tuya. Vuelve a intentarlo; tus viajes guardados siguen a
          salvo.
        </Txt>
        <Button
          title="Reintentar"
          icon={RefreshCw}
          size="lg"
          onPress={onRetry}
          style={styles.boton}
        />
      </View>
    </Pantalla>
  )
}

const styles = StyleSheet.create({
  cabecera: { paddingHorizontal: 16, paddingVertical: 15 },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 56,
  },
  titulo: { marginTop: 24, maxWidth: 340 },
  texto: { marginTop: 12, maxWidth: 340 },
  boton: { marginTop: 28, alignSelf: 'center' },
})
