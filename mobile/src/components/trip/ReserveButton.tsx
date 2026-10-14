import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { config } from '../../config'
import { BackendError, postJSON } from '../../lib/api/http'
import { conTope } from '../ui/conTope'
import { Button } from '../ui/Button'
import { Txt } from '../ui/Txt'
import { Ticket } from '../ui/iconos'
import { formatCurrency } from '../ui/formato'

interface Props {
  tripId: string
  style?: React.ComponentProps<typeof Button>['style']
}

interface RespuestaReserva {
  url?: string
  deposito?: { importe: number; moneda: string }
}

/** Mensaje amable desde un BackendError del checkout (nunca códigos técnicos). */
function mensajeCheckout(e: unknown): string {
  if (e instanceof BackendError) {
    const d = e.data
    const mensaje = d?.['mensaje']
    if (typeof mensaje === 'string' && mensaje.trim()) return mensaje
    if (d?.['code'] === 'reservations_disabled') {
      return 'Las reservas con depósito aún no están disponibles.'
    }
    if (e.message.includes(' ')) return e.message
  }
  return 'No pudimos abrir el pago ahora mismo. Inténtalo más tarde.'
}

/**
 * «Reservar con depósito (15 %)» (§6.5): POST /api/stripe/checkout con el
 * Bearer de la sesión → abre Stripe en el navegador seguro de la app. Solo se
 * muestra si las reservas están activas en esta build
 * (EXPO_PUBLIC_RESERVAS_ENABLED=true → `config.reservasActivas`).
 */
export function ReserveButton({
  tripId,
  style,
}: Props): React.ReactElement | null {
  const [abriendo, setAbriendo] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  if (!config.reservasActivas) return null

  const reservar = async (): Promise<void> => {
    setAbriendo(true)
    setMensaje(null)
    try {
      // Sin respuesta en 30 s se deja de esperar (mensaje amable abajo).
      const r = await conTope(
        postJSON<RespuestaReserva>('/api/stripe/checkout', {
          mode: 'reservation',
          tripId,
        }),
        30_000,
        'sin respuesta'
      )
      if (!r.url) throw new Error('sin url')
      if (r.deposito) {
        setMensaje(
          `Depósito: ${formatCurrency(r.deposito.importe, r.deposito.moneda, { decimales: true })}`
        )
      }
      await WebBrowser.openAuthSessionAsync(r.url, 'wayio://reserva')
    } catch (e) {
      setMensaje(mensajeCheckout(e))
    } finally {
      setAbriendo(false)
    }
  }

  return (
    <View style={styles.wrap}>
      <Button
        title="Reservar con depósito (15 %)"
        variant="tinta"
        size="lg"
        fullWidth
        icon={Ticket}
        loading={abriendo}
        loadingText="Abriendo el pago…"
        onPress={() => void reservar()}
        {...(style ? { style } : {})}
      />
      {mensaje ? (
        <Txt
          variant="caption"
          color="fgMuted"
          style={styles.mensaje}
          accessibilityLiveRegion="polite"
        >
          {mensaje}
        </Txt>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16 },
  mensaje: { marginTop: 8, textAlign: 'center' },
})
