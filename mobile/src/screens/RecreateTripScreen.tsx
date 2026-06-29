import { useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native'
import { ScreenHeader } from '../components/ui/ScreenHeader'
import { Button } from '../components/ui/Button'
import { useNavigation } from '../navigation/NavigationContext'
import { analyzeVideoUrl, type VideoAnalysisResult } from '../lib/api/backend'
import { colors, radius } from '../theme'

/**
 * Mobile counterpart of the web "Desde un video": paste a travel video link
 * (TikTok / Reels / YouTube), the AI detects the destination, and we pre-fill a
 * new trip with it. Uses `/api/analyze-video` (degrades to a demo result with no
 * AI key).
 */
export function RecreateTripScreen(): React.ReactElement {
  const { navigate } = useNavigation()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<VideoAnalysisResult | null>(null)

  const looksLikeUrl = /^https?:\/\/\S+$/i.test(url.trim())

  const handleAnalyze = async (): Promise<void> => {
    if (!looksLikeUrl) {
      setError('Pega un enlace válido (https://…)')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await analyzeVideoUrl(url.trim())
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo analizar el video')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Desde un video"
        subtitle="Recrea un viaje que viste en redes"
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.label}>Enlace del video</Text>
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="https://www.tiktok.com/@.../video/..."
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
        />
        <Text style={styles.hint}>
          Funciona con TikTok, Instagram Reels o YouTube.
        </Text>

        <Button
          title={loading ? 'Analizando…' : 'Analizar video'}
          onPress={() => void handleAnalyze()}
          loading={loading}
          disabled={!looksLikeUrl || loading}
          size="lg"
          style={styles.analyzeBtn}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>La IA está mirando el video…</Text>
          </View>
        ) : null}

        {result ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultLabel}>Destino detectado</Text>
            <Text style={styles.resultDest}>{result.destinoSugerido}</Text>
            {result.resumen ? (
              <Text style={styles.resultSummary}>{result.resumen}</Text>
            ) : null}

            {result.lugares.length > 0 ? (
              <View style={styles.places}>
                {result.lugares.map((p, i) => (
                  <View key={`${p.lugar}-${i}`} style={styles.placeChip}>
                    <Text style={styles.placeText}>
                      {p.lugar}
                      {p.pais ? `, ${p.pais}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Button
              title={`Planificar viaje a ${result.destinoSugerido}`}
              onPress={() =>
                navigate({
                  name: 'create',
                  initialDestino: result.destinoSugerido,
                })
              }
              size="lg"
              style={styles.planBtn}
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
  },
  hint: { fontSize: 12, color: colors.textFaint, marginTop: 8 },
  analyzeBtn: { marginTop: 16 },
  error: {
    backgroundColor: colors.redBg,
    color: colors.red,
    padding: 12,
    borderRadius: 10,
    marginTop: 14,
    fontSize: 13,
  },
  loadingBox: { alignItems: 'center', marginTop: 24, gap: 10 },
  loadingText: { fontSize: 13, color: colors.textMuted },
  resultBox: {
    marginTop: 20,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textFaint,
    textTransform: 'uppercase',
  },
  resultDest: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4,
  },
  resultSummary: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: 8,
  },
  places: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  placeChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  placeText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  planBtn: { marginTop: 16 },
})
