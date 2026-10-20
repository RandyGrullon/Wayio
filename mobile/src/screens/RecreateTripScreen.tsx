import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import {
  Badge,
  Button,
  Callout,
  Card,
  CardKicker,
  Input,
  Pantalla,
  ScreenHeader,
  Txt,
} from '../components/ui'
import {
  ArrowRight,
  Clapperboard,
  CreditCard,
  Link2,
  MapPin,
  PenLine,
} from '../components/ui/iconos'
import { useNavigation } from '../navigation/NavigationContext'
import {
  analyzeVideoUrl,
  BackendError,
  type VideoAnalysisResult,
} from '../lib/api/backend'
import {
  cupoAgotadoDe,
  datosDeLimite,
  esTopeDiario,
  mensajeDeLimite,
} from '../lib/api/limites'
import { useTheme } from '../theme'

const PLATAFORMAS =
  /(tiktok\.com|instagram\.com|youtube\.com|youtu\.be|vimeo\.com|facebook\.com|fb\.watch)/i

interface ErrorVideo {
  mensaje: string
  /**
   * El análisis de video está apagado o Wayio agotó la IA del día: aviso
   * informativo y la alternativa de escribir el destino.
   */
  desactivado: boolean
  sesion: boolean
  /** Cupo de fotos o videos del mes agotado (402): «Ver planes». */
  planes: boolean
}

/**
 * «Desde un video» (móvil): pega el enlace de un video de viaje, la IA
 * detecta el destino y los lugares, y prellena un viaje nuevo con ellos.
 * Contempla resultados de ejemplo, parciales y sin destino reconocido.
 */
export function RecreateTripScreen(): React.ReactElement {
  const { navigate } = useNavigation()
  const { colors } = useTheme()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ErrorVideo | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [result, setResult] = useState<VideoAnalysisResult | null>(null)

  const limpio = url.trim()
  const pareceEnlace =
    limpio.length > 8 &&
    (/^https?:\/\/\S+$/i.test(limpio) || PLATAFORMAS.test(limpio))

  const handleAnalyze = async (): Promise<void> => {
    if (!pareceEnlace) {
      setAviso('Pega el enlace completo del video (TikTok, Reels, YouTube…).')
      return
    }
    setAviso(null)
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      setResult(await analyzeVideoUrl(limpio))
    } catch (e) {
      // Cupo del mes agotado (402): el texto del servidor y «Ver planes», sin
      // reintentar.
      const cupo = cupoAgotadoDe(datosDeLimite(e))
      if (cupo) {
        setError({
          mensaje: cupo.mensaje,
          desactivado: false,
          sesion: false,
          planes: true,
        })
        return
      }
      const backend = e instanceof BackendError ? e : null
      const code = backend?.data?.['code'] ?? null
      const apagado = code === 'video_desactivado' || code === 'herramientas'
      // Tope diario de IA: mismo aviso informativo que con el video apagado,
      // pero con el texto del servidor («vuelve mañana»).
      const tope = backend
        ? esTopeDiario(backend.serverCode, backend.data)
        : false
      const limite = backend
        ? mensajeDeLimite(
            {
              status: backend.status,
              code: backend.serverCode,
              data: backend.data,
              retryAfter: backend.retryAfter,
              mensaje: backend.message,
            },
            'Analizaste varios videos seguidos.'
          )
        : null
      setError({
        // El mensaje del servidor ofrece «subir una foto», que la app aún no
        // tiene: aquí solo se propone escribir el destino.
        mensaje: apagado
          ? 'El análisis de videos no está disponible por ahora. Puedes escribir el destino y trazamos el viaje igual.'
          : (limite ??
            (e instanceof Error && e.message
              ? e.message
              : 'No pudimos analizar el video. Inténtalo de nuevo.')),
        desactivado: apagado || tope,
        sesion: backend?.code === 'auth',
        planes: false,
      })
    } finally {
      setLoading(false)
    }
  }

  const lugares = result?.lugares.map((p) => p.lugar).filter(Boolean) ?? []
  const destino = result?.destinoSugerido.trim() ?? ''

  return (
    <Pantalla edges={['top', 'left', 'right']}>
      <ScreenHeader title="Desde un video" kicker="Recrear un viaje" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Txt variant="displayL">¿Viste un viaje que te encantó?</Txt>
          <Txt variant="body" color="fgMuted" style={styles.lead}>
            Pega el enlace y Wayio reconoce el destino y los lugares para
            trazarte uno parecido.
          </Txt>

          <Input
            label="Enlace del video"
            icon={Link2}
            value={url}
            onChangeText={(t) => {
              setUrl(t)
              setAviso(null)
            }}
            placeholder="https://www.tiktok.com/@…/video/…"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            inputMode="url"
            returnKeyType="go"
            onSubmitEditing={() => void handleAnalyze()}
            hint="Funciona con TikTok, Instagram Reels, YouTube, Vimeo y Facebook."
            error={aviso}
            containerStyle={styles.campo}
          />

          <Button
            title="Analizar video"
            icon={Clapperboard}
            size="lg"
            fullWidth
            loading={loading}
            loadingText="Analizando…"
            disabled={limpio.length === 0}
            onPress={() => void handleAnalyze()}
          />

          {loading ? (
            <View style={styles.cargando} accessibilityLiveRegion="polite">
              <ActivityIndicator color={colors.fg} />
              <Txt variant="bodyS" color="fgMuted" style={styles.flex}>
                La IA está mirando el video. Puede tardar un par de minutos.
              </Txt>
            </View>
          ) : null}

          {error ? (
            <View style={styles.bloque}>
              <Callout
                tone={error.desactivado || error.planes ? 'info' : 'danger'}
              >
                {error.mensaje}
              </Callout>
              {error.planes ? (
                <Button
                  title="Ver planes"
                  icon={CreditCard}
                  onPress={() => navigate({ name: 'paywall' })}
                  style={styles.bloque}
                />
              ) : null}
              {error.desactivado || error.planes ? (
                <Button
                  title="Escribir el destino"
                  variant="outline"
                  icon={PenLine}
                  onPress={() => navigate({ name: 'create' })}
                  style={styles.bloque}
                />
              ) : null}
            </View>
          ) : null}

          {result ? (
            <View style={styles.bloque} accessibilityLiveRegion="polite">
              {result.demo ? (
                <Callout
                  tone="warning"
                  title="Resultado de ejemplo"
                  style={styles.aviso}
                >
                  El análisis con IA no está disponible ahora: esto es una
                  muestra, no lo que sale en tu video.
                </Callout>
              ) : null}
              {result.parcial ? (
                <Callout tone="info" style={styles.aviso}>
                  Analizamos solo una parte del video.
                </Callout>
              ) : null}

              {destino ? (
                <Card variant="elevated">
                  <CardKicker icon={MapPin}>Destino detectado</CardKicker>
                  <Txt variant="h1" italic style={styles.destino}>
                    {destino}
                  </Txt>
                  {result.resumen ? (
                    <Txt variant="bodyS" color="fgMuted" style={styles.resumen}>
                      {result.resumen}
                    </Txt>
                  ) : null}
                  {lugares.length > 0 ? (
                    <View style={styles.lugares}>
                      {result.lugares.map((p, i) => (
                        <Badge
                          key={`${p.lugar}-${i}`}
                          label={p.pais ? `${p.lugar}, ${p.pais}` : p.lugar}
                          variant="brand"
                        />
                      ))}
                    </View>
                  ) : null}
                  <Button
                    title={`Trazar viaje a ${destino}`}
                    iconEnd={ArrowRight}
                    size="lg"
                    fullWidth
                    variant="tinta"
                    onPress={() =>
                      navigate({
                        name: 'create',
                        initialDestino: destino,
                        ...(lugares.length > 0
                          ? { lugaresDeseados: lugares.slice(0, 30) }
                          : {}),
                      })
                    }
                    style={styles.bloque}
                  />
                </Card>
              ) : (
                <Card>
                  <Txt variant="h3">No reconocimos el lugar</Txt>
                  <Txt variant="bodyS" color="fgMuted" style={styles.resumen}>
                    Prueba con otro video o escribe tú el destino.
                  </Txt>
                  <Button
                    title="Escribir el destino"
                    variant="outline"
                    icon={PenLine}
                    onPress={() => navigate({ name: 'create' })}
                    style={styles.bloque}
                  />
                </Card>
              )}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Pantalla>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 48 },
  lead: { marginTop: 8 },
  campo: { marginTop: 24 },
  cargando: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  bloque: { marginTop: 16 },
  aviso: { marginBottom: 12 },
  destino: { marginTop: 6 },
  resumen: { marginTop: 8 },
  lugares: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
})
