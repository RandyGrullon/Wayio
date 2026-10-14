import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native'
import { useAuth } from '../context/AuthContext'
import { useNavigation } from '../navigation/NavigationContext'
import { listTrips } from '../lib/trips/repository'
import { Logo } from '../components/brand/Logo'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Pantalla,
  Segmented,
  SelloInfo,
  Sheet,
  SkeletonRegion,
  SkeletonTarjeta,
  TextArea,
  Txt,
  indiceDesdeId,
  type BadgeVariant,
} from '../components/ui'
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clapperboard,
  CreditCard,
  LogOut,
  Monitor,
  Moon,
  Sun,
  Users,
} from '../components/ui/iconos'
import {
  diasHasta,
  formatCurrency,
  formatHaceTiempo,
  formatRangoFechas,
  formatViajeros,
  monedaDe,
} from '../components/ui/formato'
import { MAX_DESCRIPCION } from './crear/formulario'
import {
  useEstilos,
  useTheme,
  useThemePreference,
  type PreferenciaTema,
  type Tema,
} from '../theme'
import type { TripRow } from '../types/planning'

type Filtro = 'proximos' | 'en_curso' | 'pasados'

const ESTADO: Record<string, { label: string; variant: BadgeVariant }> = {
  planificando: { label: 'Planificando', variant: 'info' },
  en_viaje: { label: 'En viaje', variant: 'accent' },
  completado: { label: 'Completado', variant: 'success' },
  cancelado: { label: 'Cancelado', variant: 'default' },
}

const PAQUETE: Record<string, string> = {
  basico: 'Básico',
  confort: 'Confort',
  premium: 'Premium',
}

const SUGERENCIAS = [
  { label: 'Sorpréndeme', texto: 'Sorpréndeme con el destino.' },
  { label: 'Con niños', texto: 'Viajo con niños.' },
  { label: 'Fin de semana', texto: 'Es un fin de semana largo.' },
] as const

function filtroDe(row: TripRow): Filtro {
  const t = row.data
  if (row.estado === 'completado') return 'pasados'
  if (row.estado === 'en_viaje') return 'en_curso'
  if (diasHasta(t.fechaFin) < 0) return 'pasados'
  if (diasHasta(t.fechaInicio) <= 0) return 'en_curso'
  return 'proximos'
}

/**
 * Inicio (§6.1 + §6.11 en móvil): wordmark, portada con la caja de deseo
 * («Trazar mi viaje») y «Mis viajes» en tarjetas tipo boleto con filtros.
 */
export function HomeScreen(): React.ReactElement {
  const { user, tier, signOut } = useAuth()
  const { navigate } = useNavigation()
  const { colors } = useTheme()
  const styles = useEstilos(crearEstilos)
  const [trips, setTrips] = useState<TripRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deseo, setDeseo] = useState('')
  const [filtro, setFiltro] = useState<Filtro | null>(null)
  const [cuenta, setCuenta] = useState(false)

  const load = useCallback(async () => {
    try {
      setError(null)
      const rows = await listTrips()
      setTrips(rows)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No pudimos cargar tus viajes. Inténtalo de nuevo.'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      await load()
    })()
  }, [load])

  const nombre =
    (user?.user_metadata?.['full_name'] as string | undefined)?.trim() ||
    user?.email?.split('@')[0] ||
    'viajero'
  const primerNombre = nombre.split(/\s+/)[0] ?? nombre

  const conteo = useMemo(() => {
    const c: Record<Filtro, number> = { proximos: 0, en_curso: 0, pasados: 0 }
    for (const t of trips) c[filtroDe(t)] += 1
    return c
  }, [trips])

  const filtroEfectivo: Filtro =
    filtro ??
    (conteo.en_curso > 0
      ? 'en_curso'
      : conteo.proximos > 0
        ? 'proximos'
        : 'pasados')

  const visibles = useMemo(
    () => trips.filter((t) => filtroDe(t) === filtroEfectivo),
    [trips, filtroEfectivo]
  )

  const anadir = (texto: string): void => {
    setDeseo((d) =>
      (d.trim() ? `${d.trim()} ${texto}` : texto).slice(0, MAX_DESCRIPCION)
    )
  }

  const trazar = (): void => {
    const texto = deseo.trim()
    navigate(
      texto.length >= 3
        ? { name: 'create', descripcion: texto }
        : { name: 'create' }
    )
  }

  const cabecera = (
    <View>
      <View style={styles.portada}>
        <Txt variant="bodyS" color="fgMuted">
          Hola, {primerNombre}
        </Txt>
        <View style={styles.kicker}>
          <View style={[styles.filete, { backgroundColor: colors.brass }]} />
          <Txt variant="overline" color="fgMuted" style={styles.flex}>
            Planificador de viajes con IA · Hecho en RD
          </Txt>
        </View>
        <Txt variant="displayL" style={styles.h1}>
          Tu próximo viaje,{' '}
          <Txt variant="displayL" italic color="primary">
            trazado
          </Txt>{' '}
          día a día.
        </Txt>
        <Txt variant="body" color="fgMuted" style={styles.lead}>
          Cuéntanos qué imaginas. Wayio arma tres versiones con horarios, mapa y
          presupuesto. Tú eliges.
        </Txt>

        <Card variant="elevated" style={styles.deseo}>
          <TextArea
            label="Cuéntanos tu viaje ideal"
            hideLabel
            minHeight={88}
            placeholder="Ej.: 6 días en Cartagena con mi pareja, playa tranquila y buena comida, unos US$1,800"
            value={deseo}
            onChangeText={(t) => setDeseo(t.slice(0, MAX_DESCRIPCION))}
            maxLength={MAX_DESCRIPCION}
            containerStyle={styles.sinMargen}
          />
          <View style={styles.chips}>
            {SUGERENCIAS.map((s) => (
              <Chip
                key={s.label}
                label={s.label}
                role="button"
                size="sm"
                accessibilityHint="Añade esta idea a tu descripción"
                onPress={() => anadir(s.texto)}
              />
            ))}
          </View>
          <Button
            title="Trazar mi viaje"
            iconEnd={ArrowRight}
            size="lg"
            fullWidth
            onPress={trazar}
            style={styles.cta}
          />
        </Card>

        <View style={styles.alternativas}>
          <Button
            variant="link"
            title="Prefiero el formulario paso a paso"
            onPress={() => navigate({ name: 'create' })}
          />
          <Button
            variant="outline"
            title="Desde un video"
            icon={Clapperboard}
            onPress={() => navigate({ name: 'recreate' })}
          />
        </View>
        <Txt variant="caption" color="fgSubtle" style={styles.confianza}>
          Gratis para empezar · Sin tarjeta · 47 guías de destino
        </Txt>
      </View>

      <View style={styles.seccion}>
        <Txt variant="overline" color="fgMuted">
          Tu cuaderno de ruta
        </Txt>
        <Txt variant="h2" style={styles.h2}>
          Mis viajes
        </Txt>
        {!loading && !error && trips.length > 0 ? (
          <Segmented
            label="Filtrar viajes"
            fullWidth
            value={filtroEfectivo}
            onValueChange={setFiltro}
            options={[
              {
                value: 'proximos',
                label: `Próximos ${conteo.proximos}`,
                accessibilityLabel: `Próximos, ${conteo.proximos}`,
              },
              {
                value: 'en_curso',
                label: `En curso ${conteo.en_curso}`,
                accessibilityLabel: `En curso, ${conteo.en_curso}`,
              },
              {
                value: 'pasados',
                label: `Pasados ${conteo.pasados}`,
                accessibilityLabel: `Pasados, ${conteo.pasados}`,
              },
            ]}
            style={styles.filtros}
          />
        ) : null}
      </View>
    </View>
  )

  return (
    <Pantalla>
      <View style={styles.header}>
        <Logo height={26} title="Wayio" destinoIntro />
        <View style={styles.headerDer}>
          {tier !== 'free' ? (
            <Badge
              label={tier === 'grupo' ? 'Pro Grupo' : 'Pro'}
              variant="laton"
            />
          ) : (
            <Button
              title="Planes"
              variant="ghost"
              size="sm"
              icon={CreditCard}
              onPress={() => navigate({ name: 'paywall' })}
            />
          )}
          <Pressable
            onPress={() => setCuenta(true)}
            accessibilityRole="button"
            accessibilityLabel="Tu cuenta"
            hitSlop={6}
            style={styles.avatarBtn}
          >
            <Avatar
              nombre={nombre}
              indice={indiceDesdeId(user?.id ?? 'wayio')}
              decorativo
            />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={loading || error ? [] : visibles}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.lista}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              void load()
            }}
            tintColor={colors.fg}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          />
        }
        ListHeaderComponent={cabecera}
        ListEmptyComponent={
          loading ? (
            <SkeletonRegion label="Cargando tus viajes…">
              <SkeletonTarjeta />
              <SkeletonTarjeta />
            </SkeletonRegion>
          ) : error ? (
            <EmptyState
              ilustracion="error"
              title="No pudimos cargar tus viajes"
              description={error}
              action={{
                label: 'Reintentar',
                onPress: () => {
                  setLoading(true)
                  void load()
                },
              }}
            />
          ) : trips.length === 0 ? (
            <EmptyState
              title="Aún no tienes viajes guardados"
              description="Cuéntanos tu primer viaje arriba y lo trazamos en un minuto."
              action={{
                label: 'Trazar mi primer viaje',
                // El primario de la vista ya es «Trazar mi viaje».
                variant: 'outline',
                onPress: () => navigate({ name: 'create' }),
              }}
            />
          ) : (
            <Txt
              variant="bodyS"
              color="fgMuted"
              center
              style={styles.vacioFiltro}
            >
              No hay viajes en esta sección.
            </Txt>
          )
        }
        renderItem={({ item }) => (
          <TarjetaViaje
            row={item}
            propio={item.user_id === user?.id}
            onPress={() => navigate({ name: 'trip', tripId: item.id })}
          />
        )}
      />

      <Sheet
        visible={cuenta}
        onClose={() => setCuenta(false)}
        title="Tu cuenta"
        {...(user?.email ? { description: user.email } : {})}
      >
        <Apariencia />
        <Button
          title="Planes y suscripción"
          variant="outline"
          icon={CreditCard}
          fullWidth
          onPress={() => {
            setCuenta(false)
            navigate({ name: 'paywall' })
          }}
          style={styles.cuentaBtn}
        />
        <Button
          title="Cerrar sesión"
          variant="ghost"
          icon={LogOut}
          fullWidth
          onPress={() => {
            setCuenta(false)
            void signOut()
          }}
          style={styles.cuentaBtn}
        />
      </Sheet>
    </Pantalla>
  )
}

function Apariencia(): React.ReactElement {
  const { preferencia, setPreferencia } = useThemePreference()
  return (
    <View>
      <Txt variant="label" style={estilosFijos.aparienciaLabel}>
        Apariencia
      </Txt>
      <Segmented<PreferenciaTema>
        label="Apariencia"
        fullWidth
        value={preferencia}
        onValueChange={setPreferencia}
        options={[
          { value: 'system', label: 'Sistema', icon: Monitor },
          { value: 'light', label: 'Claro', icon: Sun },
          { value: 'dark', label: 'Oscuro', icon: Moon },
        ]}
      />
    </View>
  )
}

function TarjetaViaje({
  row,
  propio,
  onPress,
}: {
  row: TripRow
  propio: boolean
  onPress: () => void
}): React.ReactElement {
  const { colors } = useTheme()
  const t = row.data
  const estado = ESTADO[row.estado] ?? ESTADO['planificando']
  const moneda = monedaDe(t)
  const rango = formatRangoFechas(t.fechaInicio, t.fechaFin)
  const faltan = diasHasta(t.fechaInicio)

  return (
    <Card
      onPress={onPress}
      style={estilosFijos.tarjeta}
      accessibilityLabel={`${t.destino}. ${rango}. ${estado?.label ?? ''}`}
      accessibilityHint="Abre el itinerario"
    >
      <View style={estilosFijos.filaArriba}>
        <View style={estilosFijos.etiquetas}>
          {estado ? (
            <Badge label={estado.label} variant={estado.variant} />
          ) : null}
          {!propio ? (
            <SelloInfo tone="laton">Compartido contigo</SelloInfo>
          ) : null}
        </View>
        <ChevronRight
          size={20}
          color={colors.fgSubtle}
          strokeWidth={1.75}
          accessible={false}
        />
      </View>
      <Txt variant="h3" style={estilosFijos.destino} numberOfLines={2}>
        {t.destino}
      </Txt>
      <View style={estilosFijos.meta}>
        <View style={estilosFijos.metaItem}>
          <CalendarDays
            size={16}
            color={colors.fgMuted}
            strokeWidth={1.75}
            accessible={false}
          />
          <Txt variant="caption" color="fgMuted">
            {rango}
          </Txt>
        </View>
        <View style={estilosFijos.metaItem}>
          <Users
            size={16}
            color={colors.fgMuted}
            strokeWidth={1.75}
            accessible={false}
          />
          <Txt variant="caption" color="fgMuted">
            {formatViajeros(t.personas)}
          </Txt>
        </View>
      </View>
      <View style={estilosFijos.pie}>
        <Txt variant="caption" color="fgSubtle">
          {faltan > 0 && faltan <= 60
            ? `${PAQUETE[t.paquete] ?? ''} · ${faltan === 1 ? 'Falta 1 día' : `Faltan ${faltan} días`}`
            : `${PAQUETE[t.paquete] ?? ''} · Editado ${formatHaceTiempo(row.updated_at)}`}
        </Txt>
        <Txt variant="label" tnum>
          {formatCurrency(t.presupuestoTotal, moneda)}
        </Txt>
      </View>
    </Card>
  )
}

const estilosFijos = StyleSheet.create({
  aparienciaLabel: { marginBottom: 8 },
  tarjeta: { marginBottom: 12 },
  filaArriba: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1 },
  destino: { marginTop: 10 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pie: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    gap: 8,
  },
})

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    flex: { flex: 1 },
    header: {
      height: 56,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: t.colors.bg,
    },
    headerDer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    avatarBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lista: { paddingHorizontal: 16, paddingBottom: 48 },
    portada: { paddingTop: 8 },
    kicker: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 16,
    },
    filete: { width: 24, height: 1 },
    h1: { marginTop: 12 },
    lead: { marginTop: 12, maxWidth: 520 },
    deseo: { marginTop: 24, padding: 16, borderColor: t.colors.borderStrong },
    sinMargen: { marginBottom: 0 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    cta: { marginTop: 16 },
    alternativas: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 16,
    },
    confianza: { marginTop: 12 },
    seccion: {
      marginTop: 40,
      marginBottom: 16,
      paddingTop: 24,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    h2: { marginTop: 4 },
    filtros: { marginTop: 16 },
    vacioFiltro: { paddingVertical: 32 },
    cuentaBtn: { marginTop: 12 },
  })
