import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import {
  Button,
  Callout,
  Card,
  CardKicker,
  EmptyState,
  Pantalla,
  ScreenHeader,
  SelloInfo,
  Skeleton,
  SkeletonRegion,
  Txt,
  useToast,
} from '../components/ui'
import { DayCard } from '../components/trip/DayCard'
import { PostalArte } from '../components/brand/PostalArte'
import { ArrowRight, CalendarDays, Copy, Users } from '../components/ui/iconos'
import {
  formatCurrency,
  formatDias,
  formatNumero,
  formatRangoFechas,
  formatViajeros,
  monedaDe,
} from '../components/ui/formato'
import {
  copiarAMisViajes,
  leerViajeCompartido,
  type ViajeCompartido,
} from '../lib/api/compartido'
import { useNavigation } from '../navigation/NavigationContext'
import { useEstilos, useTheme, type Tema } from '../theme'

const PAQUETE: Record<string, string> = {
  basico: 'Básico',
  confort: 'Confort',
  premium: 'Premium',
}

type Estado = ViajeCompartido | { estado: 'cargando' }

/**
 * Vista pública de un viaje (versión móvil de /viaje-compartido/[id], §6.7):
 * portada, franja de datos, «Antes de ir», días de solo lectura y notas de
 * ruta, con la banda «Hazlo tuyo»: «Copiar a mis viajes» crea una copia propia
 * y abre el viaje; «Planificar el mío» lleva al formulario. Se abre con
 * wayio://viaje-compartido/<id> (Enlaces.tsx). El mapa de la web no está:
 * en la app el mapa necesita el módulo nativo de Mapbox (modo en vivo).
 */
export function ViajeCompartidoScreen({
  id,
}: {
  id: string
}): React.ReactElement {
  const { navigate, reset } = useNavigation()
  const toast = useToast()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const styles = useEstilos(crearEstilos)
  const [estado, setEstado] = useState<Estado>({ estado: 'cargando' })
  const [recarga, setRecarga] = useState(0)
  const [copiando, setCopiando] = useState(false)

  useEffect(() => {
    let vivo = true
    void leerViajeCompartido(id).then((r) => {
      if (vivo) setEstado(r)
    })
    return () => {
      vivo = false
    }
  }, [id, recarga])

  const reintentar = (): void => {
    setEstado({ estado: 'cargando' })
    setRecarga((n) => n + 1)
  }

  const planificar = (): void => navigate({ name: 'create' })

  if (estado.estado === 'cargando') {
    return (
      <Pantalla>
        <ScreenHeader title="Viaje compartido" />
        <SkeletonRegion label="Cargando el viaje compartido">
          <View style={styles.margen}>
            <Skeleton width="45%" height={12} style={styles.hueco} />
            <Skeleton width="80%" height={34} style={styles.hueco} />
            <Skeleton width="60%" height={14} style={styles.hueco} />
            {[0, 1, 2].map((k) => (
              <Skeleton
                key={k}
                width="100%"
                height={72}
                style={styles.huecoGrande}
              />
            ))}
          </View>
        </SkeletonRegion>
      </Pantalla>
    )
  }

  if (estado.estado === 'no_encontrado') {
    return (
      <Pantalla>
        <ScreenHeader title="Viaje compartido" />
        <EmptyState
          title="Este viaje ya no se comparte"
          description="O el enlace está roto. Pide a quien te lo envió que vuelva a compartirlo, o traza tu propio viaje."
          action={{
            label: 'Planificar el mío',
            icon: ArrowRight,
            onPress: planificar,
          }}
        />
      </Pantalla>
    )
  }

  if (estado.estado === 'no_disponible') {
    return (
      <Pantalla>
        <ScreenHeader title="Viaje compartido" />
        <EmptyState
          ilustracion="error"
          title="La vista compartida no está disponible ahora"
          description={estado.mensaje}
          action={{ label: 'Reintentar', onPress: reintentar }}
        />
      </Pantalla>
    )
  }

  const { trip, destino, fechaInicio, fechaFin } = estado
  const moneda = monedaDe(trip)
  const rango = formatRangoFechas(fechaInicio, fechaFin)
  const actividades = trip.dias.reduce((n, d) => n + d.actividades.length, 0)
  const datos = [
    { etiqueta: 'Días', valor: formatNumero(trip.dias.length) },
    { etiqueta: 'Viajeros', valor: formatNumero(trip.personas) },
    { etiqueta: 'Actividades', valor: formatNumero(actividades) },
    {
      etiqueta: 'Gasto en destino',
      valor: formatCurrency(trip.presupuestoTotal, moneda),
    },
  ]

  const copiar = async (): Promise<void> => {
    if (copiando) return
    setCopiando(true)
    try {
      const nuevoId = await copiarAMisViajes(trip)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined
      )
      toast.success('Viaje copiado a tus viajes')
      // Como al guardar un viaje nuevo: volver atrás lleva a Inicio, no a
      // la vista compartida (así no se copia dos veces sin querer).
      reset([{ name: 'home' }, { name: 'trip', tripId: nuevoId }])
    } catch (e) {
      setCopiando(false)
      // Texto del servidor (p. ej. 400 «Este viaje tiene datos que no
      // pudimos guardar…») o el de red; nunca un código técnico.
      toast.error(
        e instanceof Error && e.message.includes(' ')
          ? e.message
          : 'No pudimos copiar el viaje. Inténtalo de nuevo.'
      )
    }
  }

  return (
    <Pantalla>
      <ScreenHeader
        title={destino}
        subtitle={rango}
        kicker="Viaje compartido"
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>
        {/* Portada */}
        <View style={styles.margen}>
          <Txt variant="overline" color="fgMuted" style={styles.hueco}>
            Un plan compartido · {PAQUETE[trip.paquete] ?? 'Confort'} ·{' '}
            {formatDias(trip.dias.length)}
          </Txt>
          <Txt variant="displayL" italic style={styles.h1}>
            {destino}
          </Txt>
          <View style={styles.meta}>
            {rango ? (
              <View style={styles.metaItem}>
                <CalendarDays
                  size={16}
                  color={colors.fgMuted}
                  strokeWidth={1.75}
                />
                <Txt variant="bodyS" color="fgMuted">
                  {rango}
                </Txt>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <Users size={16} color={colors.fgMuted} strokeWidth={1.75} />
              <Txt variant="bodyS" color="fgMuted">
                {formatViajeros(trip.personas)}
              </Txt>
            </View>
          </View>
          <View style={styles.sellos}>
            <SelloInfo tone="laton">Solo lectura</SelloInfo>
          </View>
          {trip.resumenViaje ? (
            <Txt variant="body" color="fgMuted" style={styles.resumen}>
              {trip.resumenViaje}
            </Txt>
          ) : null}
          <PostalArte semilla={destino} alto={140} style={styles.postal} />
        </View>

        {/* Franja de datos */}
        <View style={[styles.franja, { borderColor: colors.border }]}>
          {datos.map((c, i) => (
            <View
              key={c.etiqueta}
              style={[
                styles.dato,
                { borderColor: colors.border },
                i % 2 === 0 ? styles.datoIzq : null,
                i < 2 ? styles.datoArriba : null,
              ]}
              accessible
              accessibilityLabel={`${c.etiqueta}: ${c.valor}`}
            >
              <Txt variant="overline" color="fgMuted">
                {c.etiqueta}
              </Txt>
              <Txt variant="num" tnum style={styles.datoValor}>
                {c.valor}
              </Txt>
            </View>
          ))}
        </View>

        {/* Días de solo lectura */}
        <View style={styles.margen}>
          {trip.advertencias.length > 0 ? (
            <Callout
              tone="warning"
              title="Antes de ir"
              style={styles.huecoGrande}
            >
              <View style={styles.lista}>
                {trip.advertencias.map((a) => (
                  <Txt key={a} variant="bodyS" color="warningFg">
                    · {a}
                  </Txt>
                ))}
              </View>
            </Callout>
          ) : null}

          {trip.dias.map((d, i) => (
            <DayCard
              key={`${d.numero}-${i}`}
              day={d}
              fechaInicio={fechaInicio}
              moneda={moneda}
              destino={destino}
              modo="lectura"
            />
          ))}

          {trip.consejos.length > 0 ? (
            <Card variant="nota" style={styles.huecoGrande}>
              <CardKicker color="brassText">Notas de ruta</CardKicker>
              <View style={styles.lista}>
                {trip.consejos.map((c) => (
                  <Txt key={c} variant="bodyS">
                    · {c}
                  </Txt>
                ))}
              </View>
            </Card>
          ) : null}
        </View>

        {/* Hazlo tuyo */}
        <View style={styles.margen}>
          <Card variant="elevated" style={styles.hazloTuyo}>
            <Txt variant="h2">¿Te gusta este plan? Hazlo tuyo</Txt>
            <Txt variant="bodyS" color="fgMuted" style={styles.hueco}>
              Cópialo a tus viajes para editarlo, o traza el tuyo desde cero con
              tus fechas y tu presupuesto.
            </Txt>
            <Button
              title="Copiar a mis viajes"
              size="lg"
              fullWidth
              icon={Copy}
              loading={copiando}
              loadingText="Copiando…"
              onPress={() => void copiar()}
              style={styles.huecoGrande}
            />
            <Button
              title="Planificar el mío"
              variant="outline"
              size="lg"
              fullWidth
              iconEnd={ArrowRight}
              disabled={copiando}
              onPress={planificar}
              style={styles.botonBanda}
            />
          </Card>
        </View>
      </ScrollView>
    </Pantalla>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    margen: { paddingHorizontal: 16 },
    hueco: { marginTop: 8 },
    huecoGrande: { marginTop: 20 },
    h1: { marginTop: 6 },
    meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 10 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sellos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    resumen: { marginTop: 14 },
    postal: { marginTop: 20, borderRadius: t.radius.card, overflow: 'hidden' },
    franja: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 24,
      marginHorizontal: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    dato: { width: '50%', paddingVertical: 16, paddingHorizontal: 12 },
    datoIzq: {
      paddingLeft: 0,
      borderRightWidth: StyleSheet.hairlineWidth,
    },
    datoArriba: { borderBottomWidth: StyleSheet.hairlineWidth },
    datoValor: { marginTop: 6 },
    lista: { gap: 6, marginTop: 6 },
    hazloTuyo: { marginTop: 40 },
    botonBanda: { marginTop: 10 },
  })
