import { useState } from 'react'
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import Camera from 'lucide-react-native/icons/camera'
import ImageUp from 'lucide-react-native/icons/image-up'
import {
  Badge,
  Button,
  Callout,
  Card,
  CardKicker,
  Input,
  Pantalla,
  ScreenHeader,
  Segmented,
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
  analyzeImage,
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
import {
  elegirFoto,
  MENSAJE_FOTO_PESADA,
  type FotoLista,
  type OrigenFoto,
} from './crear/foto'
import { useEstilos, useTheme, type Tema } from '../theme'

const PLATAFORMAS =
  /(tiktok\.com|instagram\.com|youtube\.com|youtu\.be|vimeo\.com|facebook\.com|fb\.watch)/i

type Modo = 'video' | 'foto'

const OPCIONES_MODO = [
  { value: 'video', label: 'Enlace de video', icon: Link2 },
  { value: 'foto', label: 'Foto del lugar', icon: ImageUp },
] as const

interface ErrorAnalisis {
  mensaje: string
  /**
   * El análisis de video está apagado o Wayio agotó la IA del día: aviso
   * informativo y la alternativa de escribir el destino.
   */
  desactivado: boolean
  /** El análisis de videos está apagado: se ofrece subir una foto. */
  ofrecerFoto: boolean
  sesion: boolean
  /** Cupo de fotos o videos del mes agotado (402): «Ver planes». */
  planes: boolean
}

/** Error de POST /api/analyze-video (video o foto) → aviso para la pantalla. */
function errorDeAnalisis(e: unknown, fuente: Modo): ErrorAnalisis {
  // Cupo del mes agotado (402; fotos y videos comparten cupo): el texto del
  // servidor y «Ver planes», sin reintentar.
  const cupo = cupoAgotadoDe(datosDeLimite(e))
  if (cupo) {
    return {
      mensaje: cupo.mensaje,
      desactivado: false,
      ofrecerFoto: false,
      sesion: false,
      planes: true,
    }
  }
  const backend = e instanceof BackendError ? e : null
  const code = backend?.data?.['code'] ?? null
  // Sin worker de video (o sin sus herramientas) la foto sigue funcionando.
  const videoApagado =
    fuente === 'video' &&
    (code === 'video_desactivado' || code === 'herramientas')
  // Tope diario de IA: mismo aviso informativo que con el video apagado,
  // pero con el texto del servidor («vuelve mañana»); la foto también usa la
  // IA, así que solo queda escribir el destino.
  const tope = backend ? esTopeDiario(backend.serverCode, backend.data) : false
  const limite = backend
    ? mensajeDeLimite(
        {
          status: backend.status,
          code: backend.serverCode,
          data: backend.data,
          retryAfter: backend.retryAfter,
          mensaje: backend.message,
        },
        'Analizaste varios videos o fotos seguidos.'
      )
    : null
  // 413: el cuerpo no cupo (el de Vercel llega sin JSON ni texto propio).
  const pesada = fuente === 'foto' && backend?.status === 413
  return {
    mensaje: videoApagado
      ? 'El análisis de videos no está disponible por ahora. Puedes subir una foto del lugar o escribir el destino.'
      : pesada
        ? MENSAJE_FOTO_PESADA
        : (limite ??
          (e instanceof Error && e.message
            ? e.message
            : fuente === 'video'
              ? 'No pudimos analizar el video. Inténtalo de nuevo.'
              : 'No pudimos analizar la foto. Inténtalo de nuevo.')),
    desactivado: videoApagado || tope,
    ofrecerFoto: videoApagado,
    sesion: backend?.code === 'auth',
    planes: false,
  }
}

/**
 * «Desde un video o una foto» (móvil, como el diálogo de la web
 * RecreateTrip): pega el enlace de un video de viaje o elige una foto del
 * lugar (galería o cámara), la IA detecta el destino y los lugares, y prellena
 * un viaje nuevo con ellos. Contempla resultados de ejemplo, parciales y sin
 * destino reconocido; con el video apagado ofrece la foto, y con el cupo del
 * mes agotado (402), «Ver planes».
 */
export function RecreateTripScreen(): React.ReactElement {
  const { navigate } = useNavigation()
  const { colors } = useTheme()
  const estilos = useEstilos(crearEstilos)
  const [modo, setModo] = useState<Modo>('video')
  const [url, setUrl] = useState('')
  const [foto, setFoto] = useState<FotoLista | null>(null)
  const [eligiendo, setEligiendo] = useState<OrigenFoto | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ErrorAnalisis | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [result, setResult] = useState<{
    data: VideoAnalysisResult
    fuente: Modo
  } | null>(null)

  const limpio = url.trim()
  const pareceEnlace =
    limpio.length > 8 &&
    (/^https?:\/\/\S+$/i.test(limpio) || PLATAFORMAS.test(limpio))
  // Con el cupo agotado, analizar otra vez daría el mismo 402 (como la web).
  const sinCupo = error?.planes === true

  const cambiarModo = (m: Modo): void => {
    if (loading || m === modo) return
    setModo(m)
    setAviso(null)
    setError(null)
    setResult(null)
  }

  const tomarFoto = async (origen: OrigenFoto): Promise<void> => {
    if (loading || eligiendo) return
    setEligiendo(origen)
    setAviso(null)
    try {
      const r = await elegirFoto(origen)
      if (r.tipo === 'cancelada') return
      if (r.tipo === 'error') {
        setAviso(r.mensaje)
        return
      }
      setFoto(r.foto)
      setResult(null)
      // Un error de la foto anterior ya no aplica (el cupo agotado, sí).
      setError((e) => (e?.planes ? e : null))
    } finally {
      setEligiendo(null)
    }
  }

  const handleAnalyze = async (): Promise<void> => {
    if (loading || sinCupo) return
    const fuente = modo
    if (fuente === 'video') {
      if (!pareceEnlace) {
        setAviso('Pega el enlace completo del video (TikTok, Reels, YouTube…).')
        return
      }
    } else if (!foto) {
      setAviso('Elige una foto del lugar.')
      return
    }
    setAviso(null)
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data =
        fuente === 'foto' && foto
          ? await analyzeImage(foto.base64, foto.mediaType)
          : await analyzeVideoUrl(limpio)
      setResult({ data, fuente })
    } catch (e) {
      setError(errorDeAnalisis(e, fuente))
    } finally {
      setLoading(false)
    }
  }

  const datos = result?.data ?? null
  const lugares = datos?.lugares.map((p) => p.lugar).filter(Boolean) ?? []
  const destino = datos?.destinoSugerido.trim() ?? ''
  const deFoto = result?.fuente === 'foto'

  return (
    <Pantalla edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Desde un video o una foto"
        kicker="Recrear un viaje"
      />
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
            Pega el enlace de un video o sube una foto del lugar, y Wayio
            reconoce el destino y los lugares para trazarte uno parecido.
          </Txt>

          <Segmented<Modo>
            label="Qué quieres analizar"
            fullWidth
            value={modo}
            onValueChange={cambiarModo}
            options={OPCIONES_MODO.map((o) => ({
              ...o,
              disabled: loading,
            }))}
            style={styles.campo}
          />

          {modo === 'video' ? (
            <>
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
                disabled={loading}
                containerStyle={styles.bloque}
              />

              <Button
                title="Analizar video"
                icon={Clapperboard}
                size="lg"
                fullWidth
                loading={loading}
                loadingText="Analizando…"
                disabled={limpio.length === 0 || sinCupo}
                onPress={() => void handleAnalyze()}
              />
            </>
          ) : (
            <View style={styles.bloque}>
              <Txt variant="label">Foto del lugar</Txt>
              <View style={estilos.foto}>
                {foto ? (
                  <Image
                    source={{ uri: foto.uri }}
                    style={estilos.miniatura}
                    accessibilityIgnoresInvertColors
                    accessible
                    accessibilityLabel="Foto elegida"
                  />
                ) : (
                  <View style={[estilos.miniatura, estilos.sinFoto]}>
                    <ImageUp color={colors.fgSubtle} size={24} />
                  </View>
                )}
                <Txt
                  variant="bodyS"
                  color={foto ? 'fg' : 'fgMuted'}
                  numberOfLines={2}
                  style={styles.flex}
                >
                  {foto
                    ? (foto.nombre ?? 'Foto elegida')
                    : 'Ninguna foto elegida'}
                </Txt>
              </View>
              <View style={styles.botonesFoto}>
                <Button
                  title={foto ? 'Cambiar foto' : 'Elegir foto'}
                  variant="outline"
                  icon={ImageUp}
                  loading={eligiendo === 'galeria'}
                  loadingText="Abriendo…"
                  disabled={loading || eligiendo !== null}
                  onPress={() => void tomarFoto('galeria')}
                />
                <Button
                  title="Tomar foto"
                  variant="outline"
                  icon={Camera}
                  loading={eligiendo === 'camara'}
                  loadingText="Abriendo…"
                  disabled={loading || eligiendo !== null}
                  onPress={() => void tomarFoto('camara')}
                />
              </View>
              <Txt variant="caption" color="fgMuted" style={styles.hint}>
                JPG, PNG o WebP. La comprimimos antes de enviarla.
              </Txt>
              {aviso ? (
                <Callout tone="danger" style={styles.bloque}>
                  {aviso}
                </Callout>
              ) : null}

              <Button
                title="Analizar foto"
                icon={ImageUp}
                size="lg"
                fullWidth
                loading={loading}
                loadingText="Analizando…"
                disabled={!foto || sinCupo || eligiendo !== null}
                onPress={() => void handleAnalyze()}
                style={styles.bloque}
              />
            </View>
          )}

          {loading ? (
            <View style={styles.cargando} accessibilityLiveRegion="polite">
              <ActivityIndicator color={colors.fg} />
              <Txt variant="bodyS" color="fgMuted" style={styles.flex}>
                {modo === 'video'
                  ? 'La IA está mirando el video. Puede tardar un par de minutos.'
                  : 'La IA está mirando la foto…'}
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
              {error.ofrecerFoto ? (
                <Button
                  title="Subir una foto"
                  variant="outline"
                  icon={ImageUp}
                  onPress={() => cambiarModo('foto')}
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

          {datos ? (
            <View style={styles.bloque} accessibilityLiveRegion="polite">
              {datos.demo ? (
                <Callout
                  tone="warning"
                  title="Resultado de ejemplo"
                  style={styles.aviso}
                >
                  {`El análisis con IA no está disponible ahora: esto es una muestra, no lo que sale en tu ${deFoto ? 'foto' : 'video'}.`}
                </Callout>
              ) : null}
              {datos.parcial ? (
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
                  {datos.resumen ? (
                    <Txt variant="bodyS" color="fgMuted" style={styles.resumen}>
                      {datos.resumen}
                    </Txt>
                  ) : null}
                  {lugares.length > 0 ? (
                    <View style={styles.lugares}>
                      {datos.lugares.map((p, i) => (
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
                    {deFoto
                      ? 'Prueba con otra foto o escribe tú el destino.'
                      : 'Prueba con otro video o escribe tú el destino.'}
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

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    foto: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 8,
    },
    miniatura: {
      width: 64,
      height: 64,
      borderRadius: t.radius.control,
      backgroundColor: t.colors.surface2,
    },
    sinFoto: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.colors.border,
    },
  })

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
  botonesFoto: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  hint: { marginTop: 8 },
})
