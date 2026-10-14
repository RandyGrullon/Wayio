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
import { ArrowRight } from '../components/ui/iconos'
import {
  contarNoches,
  formatCurrency,
  formatNoches,
  formatRangoFechas,
  formatViajeros,
  monedaDe,
} from '../components/ui/formato'
import { useNavigation } from '../navigation/NavigationContext'
import { createTrip } from '../lib/trips/repository'
import { useEstilos, type Tema } from '../theme'
import type { GenerateResult, Paquete, PlanningTrip } from '../types/planning'
import type { FormularioViaje } from './crear/formulario'

const ORDER: Paquete[] = ['basico', 'confort', 'premium']
const SEPARACION = 12

/**
 * Versiones (§6.4, móvil): segmented de nivel, tarjetas con snap al 88 % y
 * barra inferior con «Guardar y ver itinerario». Seleccionar no navega.
 * Tras guardar se reinicia la pila (Inicio → Viaje) para no duplicar el viaje
 * al volver atrás (M15).
 */
export function PackagesScreen({
  result,
  form,
}: {
  result: GenerateResult
  form: FormularioViaje
}): React.ReactElement {
  const { reset, goBack } = useNavigation()
  const toast = useToast()
  const styles = useEstilos(crearEstilos)
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const scrollRef = useRef<ScrollView>(null)
  const [elegido, setElegido] = useState<Paquete>(form.paquete ?? 'confort')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

          {result.demo ? (
            <Callout
              tone="warning"
              title="Te mostramos un ejemplo"
              action={{ label: 'Volver a intentarlo', onPress: goBack }}
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
      </ScrollView>

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
