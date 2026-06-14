import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { ScreenHeader } from '../components/ui/ScreenHeader'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { config } from '../config'
import { colors, radius } from '../theme'
import { PLANS, PRO_FEATURES, GROUP_FEATURES } from '../constants/pricing'

export function PaywallScreen(): React.ReactElement {
  const { tier } = useAuth()

  const openCheckout = async (): Promise<void> => {
    if (!config.webUrl) return
    await WebBrowser.openBrowserAsync(`${config.webUrl}/precios`)
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Wayio Pro" subtitle={`Plan actual: ${tier}`} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Desbloquea todo Wayio</Text>
        <Text style={styles.sub}>
          Alertas con IA, reoptimización en vivo, modo offline y más.
        </Text>

        <View style={styles.featureBox}>
          <Text style={styles.featureTitle}>Pro Viajero</Text>
          {PRO_FEATURES.map((f) => (
            <Text key={f} style={styles.feature}>
              ✓ {f}
            </Text>
          ))}
        </View>

        <View style={styles.featureBox}>
          <Text style={styles.featureTitle}>Pro Grupo</Text>
          {GROUP_FEATURES.map((f) => (
            <Text key={f} style={styles.feature}>
              ✓ {f}
            </Text>
          ))}
        </View>

        {PLANS.map((p) => (
          <View
            key={p.id}
            style={[styles.planCard, p.destacado && styles.planCardHot]}
          >
            {p.destacado ? (
              <View style={styles.hotPill}>
                <Text style={styles.hotText}>MÁS POPULAR</Text>
              </View>
            ) : null}
            <Text style={styles.planName}>{p.nombre}</Text>
            <Text style={styles.planPrice}>${p.precio}</Text>
            <Text style={styles.planPeriod}>{p.periodo}</Text>
          </View>
        ))}

        <Button
          title="Continuar al pago"
          size="lg"
          onPress={() => void openCheckout()}
          style={styles.cta}
        />
        <Text style={styles.note}>
          El pago se completa en wayio.app con tu sesión iniciada.
        </Text>
        <View style={styles.bottom} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20 },
  heading: { fontSize: 22, fontWeight: '800', color: colors.text },
  sub: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 6,
    marginBottom: 18,
  },
  featureBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  feature: { fontSize: 14, color: colors.textMuted, lineHeight: 24 },
  planCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  planCardHot: { borderColor: colors.indigo },
  hotPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.indigo,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 8,
  },
  hotText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  planName: { fontSize: 16, fontWeight: '700', color: colors.text },
  planPrice: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4,
  },
  planPeriod: { fontSize: 13, color: colors.textMuted },
  cta: { marginTop: 8 },
  note: {
    fontSize: 12,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 10,
  },
  bottom: { height: 30 },
})
