import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { Button } from '../ui/Button'
import { config } from '../../config'
import { colors } from '../../theme'

interface Props {
  tripId: string
  style?: React.ComponentProps<typeof Button>['style']
}

/**
 * Reservations need the user's authenticated web session (the Stripe checkout
 * route reads the Supabase cookie), so — like the paywall — we open the web trip
 * page where the in-page "Reservar ahora" button runs the checkout. When no
 * `WEB_URL` is configured we surface a hint instead of a dead button.
 */
export function ReserveButton({ tripId, style }: Props): React.ReactElement {
  const [opening, setOpening] = useState(false)

  if (!config.webUrl) {
    return (
      <View style={styles.hintBox}>
        <Text style={styles.hint}>
          Reservas disponibles en la web (configura WEB_URL).
        </Text>
      </View>
    )
  }

  const openReserve = async (): Promise<void> => {
    setOpening(true)
    try {
      await WebBrowser.openBrowserAsync(`${config.webUrl}/trip/${tripId}`)
    } finally {
      setOpening(false)
    }
  }

  return (
    <Button
      title="💳 Reservar ahora"
      loading={opening}
      onPress={() => void openReserve()}
      {...(style ? { style } : {})}
    />
  )
}

const styles = StyleSheet.create({
  hintBox: { paddingVertical: 8 },
  hint: { fontSize: 12, color: colors.textFaint, textAlign: 'center' },
})
