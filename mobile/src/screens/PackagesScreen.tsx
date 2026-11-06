import { useRef, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import {
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  Pantalla,
  ScreenHeader,
  Segmented,
  Txt,
  useToast,
} from '../components/ui'
import {
  META_PAQUETE,
  PackageCard,
  distintas,
} from '../components/trip/PackageCard'
import { WeatherStrip } from '../components/trip/WeatherStrip'
import { ArrowRight, RefreshCw } from '../components/ui/iconos'
import {
  contarNoches,
  formatCurrency,
  formatNoches,
  formatRangoFechas,
  formatViajeros,
  monedaDe,
} from '../components/ui/formato'
import { useAuth } from '../context/AuthContext'
import { useMantenimiento } from '../hooks/useConfigRemota'
import { useNavigation } from '../navigation/NavigationContext'
import { createTrip } from '../lib/trips/repository'
import { useEstilos, type Tema } from '../theme'
import type { GenerateResult, Paquete, PlanningTrip } from '../types/planning'
import type { FormularioViaje } from './crear/formulario'
import { useTrazado } from './crear/useTrazado'
import { LoadingScreen } from './LoadingScreen'

const ORDER: Paquete[] = ['basico', 'confort', 'premium']
const SEPARACION = 12

/** Aviso de «Otra versión» (el de la web: /precios, preguntas frecuentes). */
const AVISO_OTRA_VERSION =
  '«Otra versión» le pide a la IA un viaje completo nuevo, así que cuenta como uno de tus viajes del mes. Si la IA falla y no te entrega el viaje, no se descuenta; los itinerarios de ejemplo tampoco cuentan.'

/**
 * Versiones (§6.4, móvil): segmented de nivel, tarjetas con snap al 88 % y
 * barra inferior con «Guardar y ver itinerario». Seleccionar no navega.
 * Tras guardar se reinicia la pila (Inicio → Viaje) para no duplicar el viaje
 * al volver atrás (M15).
 *
 * «Otra versión» (y «Reintentar» del ejemplo) vuelve a trazar el mismo
 * formulario con `noCache`, como la web (PlannerFlow: `trazar(formData,
 * true)`), con la misma pantalla de carga y los mismos errores que el
 * planificador (`useTrazado`). En Gratis pide confirmación con el aviso de
 * que cuenta como un viaje del cupo. Las versiones nuevas sustituyen a estas
 * en la pila: atrás sigue llevando al formulario.
 */
export function PackagesScreen({
  result,
  form,
}: {
  result: GenerateResult
  form: FormularioViaje
}): React.ReactElement {
  const { reset, goBack, replace, navigate } = useNavigation()
  const { tier } = useAuth()
  const mantenimiento = useMantenimiento()
  const toast = useToast()
  const styles = useEstilos(crearEstilos)
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const scrollRef = useRef<ScrollView>(null)
  const [elegido, setElegido] = useState<Paquete>(form.paquete ?? 'confort')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmarOtra, setConfirmarOtra] = useState(false)
  /** «Otra versión» se topó con el mantenimiento: aviso sobre las versiones. */
  const [avisoMantenimiento, setAvisoMantenimiento] = useState(false)

  const { trazado, trazar, reintentar, cancelar, cerrar } = useTrazado({
    // Las versiones nuevas sustituyen a estas (atrás → formulario).
    onListo: (nuevo, payload) =>
      replace({ name: 'packages', result: nuevo, form: payload }),
    onMantenimiento: () => setAvisoMantenimiento(true),
  })

  const otraVersion = (): void => {
    setConfirmarOtra(false)
    setError(null)
    setAvisoMantenimiento(false)
    void trazar(form, { noCache: true })
  }

  /** «Otra versión»: en Gratis gasta un viaje del cupo, así que se avisa antes. */
  const pedirOtraVersion = (): void => {
    if (tier === 'free') setConfirmarOtra(true)
    else otraVersion()
  }

  const anchoTarjeta = Math.round(Math.min(420, width * 0.88))
  const paso = anchoTarjeta + SEPARACION
  const moneda = monedaDe(result.confort, result.moneda ?? form.moneda)
  const destino = result.confort.destino || form.destino
  const noches = contarNoches(form.fechaInicio, form.fechaFin)

  const irA = (p: Paquete, animar = true): void => {
    setElegido(p)
    scrollRef.current?.scrollTo({
      x: ORDER.indexOf(p) * paso,
      animated: animar,
    })
  }

  const alSoltar = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const i = Math.round(e.nativeEvent.contentOffset.x / paso)
    const p = ORDER[Math.min(ORDER.length - 1, Math.max(0, i))]
    if (p && p !== elegido) setElegido(p)
  }

  const guardar = async (): Promise<void> => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const base = result[elegido]
      const trip: PlanningTrip = {
        ...base,
        paquete: elegido,
        ...(result.moneda && !base.moneda ? { moneda: result.moneda } : {}),
      }
      const row = await createTrip(trip)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined
      )
      toast.success('Viaje guardado')
      // Reinicia la pila: volver atrás ya no lleva a las versiones (M15).
      reset([{ name: 'home' }, { name: 'trip', tripId: row.id }])
    } catch (e) {
      setSaving(false)
      setError(
        e instanceof Error
          ? e.message
          : 'No pudimos guardar el viaje. Inténtalo de nuevo.'
      )
    }
  }

  const resumen = [
    destino,
    formatRangoFechas(form.fechaInicio, form.fechaFin),
    formatViajeros(form.personas),
    formatCurrency(form.presupuesto, form.moneda),
  ].filter(Boolean)

  const viajeElegido = result[elegido]

  // Trazando otra versión: la pantalla de carga del planificador. Si falla,
  // el error se muestra aquí encima de estas versiones (que siguen valiendo
  // y se pueden guardar), no en la pantalla de carga, que no tiene salida a
  // ellas.
  if (trazado && !trazado.error) {
    const destinoTrazado = trazado.form.destinoSorpresa
      ? 'Destino sorpresa'
      : trazado.form.destino
    return (
      <LoadingScreen
        kicker={`Otra versión · ${destinoTrazado} · ${formatRangoFechas(trazado.form.fechaInicio, trazado.form.fechaFin)}`}
        fase={trazado.fase}
        label={trazado.label}
        inicio={trazado.inicio}
        error={null}
        // Cancelar (o atrás) vuelve a estas versiones.
        onCancel={cancelar}
        onRetry={reintentar}
        onEdit={goBack}
      />
    )
  }
  const falloOtra = trazado?.error ? trazado : null

  return (
    <Pantalla edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Versiones"
        subtitle={destino}
        backLabel="Editar datos"
      />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 110 + insets.bottom },
        ]}
      >
        <View style={styles.margen}>
          <Txt variant="overline" color="fgMuted">
            3 versiones{noches > 0 ? ` · ${formatNoches(noches)}` : ''}
          </Txt>
          <Txt variant="h1" style={styles.h1}>
            Elige cómo quieres vivirlo
          </Txt>
          <View style={styles.resumen}>
            {resumen.map((r) => (
              <Badge key={r} label={r} />
            ))}
          </View>

          {falloOtra ? (
            <Callout
              tone={falloOtra.cupoAgotado ? 'info' : 'danger'}
              title={
                falloOtra.cupoAgotado
                  ? 'Llegaste al límite de este mes'
                  : result.demo
                    ? 'No pudimos trazar tu viaje'
                    : 'No pudimos trazar otra versión'
              }
              // Cupo agotado (402): «Ver planes», sin reintento (fallaría igual).
              action={
                falloOtra.cupoAgotado
                  ? {
                      label: 'Ver planes',
                      onPress: () => navigate({ name: 'paywall' }),
                    }
                  : { label: 'Reintentar', onPress: reintentar }
              }
              onDismiss={cerrar}
              style={styles.bloque}
            >
              {falloOtra.error}
            </Callout>
          ) : null}

          {avisoMantenimiento && mantenimiento.activo ? (
            <Callout
              tone="warning"
              title="No podemos trazar viajes ahora"
              onDismiss={() => setAvisoMantenimiento(false)}
              style={styles.bloque}
            >
              {`${mantenimiento.mensaje} Estas versiones siguen aquí: puedes guardarlas.`}
            </Callout>
          ) : null}

          {result.demo ? (
            <Callout
              tone="warning"
              title="Te mostramos un ejemplo"
              // Como la web (PasoVersiones): vuelve a trazar sin caché. El
              // ejemplo no gastó cupo; si ahora sale bien, cuenta como el viaje.
              // Con el cupo agotado no se ofrece (daría el mismo 402).
              {...(falloOtra?.cupoAgotado
                ? {}
                : { action: { label: 'Reintentar', onPress: otraVersion } })}
              style={styles.bloque}
            >
              No pudimos trazar tu plan ahora mismo: estas versiones son de
              muestra y no corresponden a tu destino.
            </Callout>
          ) : null}

          {result.weather ? (
            <View style={styles.bloque}>
              <WeatherStrip weather={result.weather} destino={destino} />
            </View>
          ) : null}

          <Segmented<Paquete>
            label="Versión"
            fullWidth
            value={elegido}
            onValueChange={(p) => irA(p)}
            options={ORDER.map((p) => ({
              value: p,
              label: META_PAQUETE[p].label,
            }))}
            style={styles.bloque}
          />

          {error ? (
            <Callout tone="danger" style={styles.bloque}>
              {error}
            </Callout>
          ) : null}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={paso}
          decelerationRate="fast"
          disableIntervalMomentum
          onMomentumScrollEnd={alSoltar}
          contentContainerStyle={styles.carrusel}
          accessibilityRole="radiogroup"
          accessibilityLabel="Versiones del viaje"
          onLayout={() => {
            if (elegido !== 'basico') irA(elegido, false)
          }}
        >
          {ORDER.map((p) => (
            <PackageCard
              key={p}
              paquete={p}
              trip={result[p]}
              moneda={moneda}
              selected={elegido === p}
              onSelect={() => irA(p)}
              presupuesto={form.presupuesto}
              referencia={result.basico}
              distinta={distintas(
                result[p],
                p === 'confort' ? result.basico : result.confort
              )}
              ancho={anchoTarjeta}
            />
          ))}
        </ScrollView>

        {!result.demo ? (
          <View style={[styles.margen, styles.otra]}>
            <Txt variant="bodyS" color="fgMuted">
              ¿Ninguna te convence? La IA puede trazarte un viaje nuevo con los
              mismos datos.
            </Txt>
            <Button
              title="Otra versión"
              variant="outline"
              icon={RefreshCw}
              // Con el cupo agotado volvería a dar el mismo 402.
              disabled={saving || falloOtra?.cupoAgotado === true}
              {...(tier === 'free'
                ? { accessibilityHint: 'Cuenta como uno de tus viajes del mes' }
                : {})}
              onPress={pedirOtraVersion}
              style={styles.botonOtra}
            />
          </View>
        ) : null}
      </ScrollView>

      <ConfirmDialog
        visible={confirmarOtra}
        onClose={() => setConfirmarOtra(false)}
        onConfirm={otraVersion}
        title="¿Trazar otra versión?"
        description={AVISO_OTRA_VERSION}
        confirmLabel="Trazar otra versión"
        tone="neutral"
      />

      <View
        style={[styles.barra, { paddingBottom: Math.max(12, insets.bottom) }]}
      >
        <View style={styles.flex}>
          <Txt variant="label" numberOfLines={1}>
            {META_PAQUETE[elegido].label}
          </Txt>
          <Txt variant="caption" color="fgMuted" tnum numberOfLines={1}>
            {formatCurrency(viajeElegido.presupuestoTotal, moneda)} · sin vuelo
          </Txt>
        </View>
        <Button
          title="Guardar y ver"
          accessibilityLabel={`Guardar y ver el itinerario ${META_PAQUETE[elegido].label}`}
          iconEnd={ArrowRight}
          size="lg"
          loading={saving}
          loadingText="Guardando…"
          onPress={() => void guardar()}
        />
      </View>
    </Pantalla>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    flex: { flex: 1 },
    scroll: { paddingTop: 16 },
    margen: { paddingHorizontal: 16 },
    h1: { marginTop: 4 },
    resumen: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
    bloque: { marginTop: 16 },
    carrusel: { paddingHorizontal: 16, paddingTop: 16 },
    otra: { marginTop: 24 },
    botonOtra: { marginTop: 12, alignSelf: 'flex-start' },
    barra: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      minHeight: t.control.bottomBar,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: t.colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
  })
