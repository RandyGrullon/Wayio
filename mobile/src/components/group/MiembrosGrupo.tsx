import { lazy, Suspense, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Switch, View } from 'react-native'
import { ErrorBoundary } from '../ErrorBoundary'
import {
  Avatar,
  Badge,
  Callout,
  ConfirmDialog,
  EmptyState,
  Skeleton,
  Txt,
  indiceDesdeId,
} from '../ui'
import { MapPin } from '../ui/iconos'
import { config } from '../../config'
import { useEstilos, useTheme, type Tema } from '../../theme'
import type { PlanningDay, TripMemberRow } from '../../types/planning'
import { cuandoUbicacion } from './formatoUbicacion'
import type { MiembroMapa } from './MapaGrupo'
import type { CompartirUbicacion } from './useCompartirUbicacion'

// Lazy: el módulo nativo de Mapbox solo se evalúa al abrir esta pestaña y con
// token (en Expo Go no existe y el ErrorBoundary deja solo la lista).
const MapaGrupo = lazy(() =>
  import('./MapaGrupo').then((m) => ({ default: m.MapaGrupo }))
)

const ALTO_MAPA = 240

function enMapa(lat: number | null, lng: number | null): boolean {
  return (
    lat !== null &&
    lng !== null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  )
}

/**
 * Pestaña Miembros de la sala (§6.8), como la columna de la web (GroupRoom +
 * MiembrosPanel): mapa del grupo con la última ubicación de cada miembro,
 * lista con «Ubicación actualizada 10:42 a. m.» o «Sin ubicación», badge «Tú»
 * y el switch «Compartir mi ubicación» con consentimiento explícito.
 *
 * El estado de la ubicación llega de la Sala (useCompartirUbicacion): esta
 * pestaña se desmonta al cambiar a Chat y eso no debe apagar el GPS. Sin token
 * de Mapbox o sin el módulo nativo no hay mapa: queda la lista.
 */
export function MiembrosGrupo({
  members,
  userId,
  ubicacion,
  dias,
  destino,
}: {
  members: TripMemberRow[]
  userId: string
  ubicacion: CompartirUbicacion
  dias: readonly PlanningDay[]
  destino: string
}): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const { colors } = useTheme()
  const [pidiendo, setPidiendo] = useState(false)
  const activo =
    ubicacion.estado === 'activa' || ubicacion.estado === 'activando'

  // Avatares-pin con la última ubicación compartida.
  const miembrosMapa = useMemo<MiembroMapa[]>(
    () =>
      members.flatMap((m) =>
        m.lat_actual !== null &&
        m.lng_actual !== null &&
        enMapa(m.lat_actual, m.lng_actual)
          ? [
              {
                id: m.user_id,
                nombre: m.user_id === userId ? `${m.nombre} (tú)` : m.nombre,
                lat: m.lat_actual,
                lng: m.lng_actual,
                indice: indiceDesdeId(m.user_id),
                ultimaUbicacion: m.ultima_ubicacion,
              },
            ]
          : []
      ),
    [members, userId]
  )

  const hayLugares = useMemo(
    () => dias.some((d) => d.actividades.some((a) => enMapa(a.lat, a.lng))),
    [dias]
  )
  const conMapa =
    Boolean(config.mapboxToken) && (hayLugares || miembrosMapa.length > 0)

  if (members.length === 0) {
    return (
      <EmptyState
        title="Aún no hay miembros"
        description="Invita a tus acompañantes con el enlace del grupo."
      />
    )
  }

  const alternar = (valor: boolean): void => {
    if (valor) setPidiendo(true)
    else ubicacion.detener()
  }

  const descripcion =
    ubicacion.estado === 'activando'
      ? 'Activando…'
      : ubicacion.estado === 'activa'
        ? 'Ubicación activa mientras tengas la sala abierta.'
        : 'El grupo verá dónde estás mientras tengas la sala abierta.'

  return (
    <View style={styles.flex}>
      {conMapa ? (
        <ErrorBoundary fallback={null}>
          <View style={styles.mapaCaja}>
            <Suspense
              fallback={<Skeleton width="100%" height={ALTO_MAPA} radius={0} />}
            >
              <MapaGrupo
                dias={dias}
                miembros={miembrosMapa}
                etiqueta={`Mapa del grupo: ${destino}`}
              />
            </Suspense>
          </View>
        </ErrorBoundary>
      ) : null}

      <ScrollView contentContainerStyle={styles.lista}>
        {members.map((m) => (
          <View key={m.id} style={styles.miembro}>
            <Avatar
              nombre={m.nombre}
              indice={indiceDesdeId(m.user_id)}
              size={40}
              decorativo
            />
            <View style={styles.flex}>
              <Txt variant="label" numberOfLines={1}>
                {m.nombre}
              </Txt>
              {m.ultima_ubicacion ? (
                <View style={styles.cuando}>
                  <MapPin
                    size={14}
                    color={colors.fgMuted}
                    strokeWidth={1.75}
                    accessible={false}
                  />
                  <Txt variant="caption" color="fgMuted" tnum>
                    {`Ubicación actualizada ${cuandoUbicacion(m.ultima_ubicacion)}`}
                  </Txt>
                </View>
              ) : (
                <Txt variant="caption" color="fgMuted">
                  Sin ubicación
                </Txt>
              )}
            </View>
            {m.user_id === userId ? <Badge label="Tú" variant="brand" /> : null}
          </View>
        ))}

        <View style={styles.compartir}>
          <View style={styles.compartirFila}>
            <View style={styles.flex}>
              <Txt variant="label">Compartir mi ubicación</Txt>
              <Txt variant="caption" color="fgMuted">
                {descripcion}
              </Txt>
            </View>
            <Switch
              value={activo}
              onValueChange={alternar}
              accessibilityLabel="Compartir mi ubicación"
              accessibilityHint={descripcion}
              trackColor={{ false: colors.borderStrong, true: colors.accent }}
              thumbColor={colors.surface}
              ios_backgroundColor={colors.borderStrong}
            />
          </View>
          {ubicacion.error ? (
            <Callout
              tone={ubicacion.estado === 'denegada' ? 'warning' : 'info'}
              {...(ubicacion.solucion ? { action: ubicacion.solucion } : {})}
              style={styles.aviso}
            >
              {ubicacion.error}
            </Callout>
          ) : null}
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={pidiendo}
        onClose={() => setPidiendo(false)}
        onConfirm={() => ubicacion.iniciar()}
        tone="neutral"
        title="¿Compartir tu ubicación con el grupo?"
        description="Los miembros de esta sala verán dónde estás y a qué hora se actualizó, mientras tengas la sala abierta. Puedes apagarlo cuando quieras; al salir de la sala deja de compartirse y con la app en segundo plano se pausa."
        confirmLabel="Compartir ubicación"
        cancelLabel="Ahora no"
      />
    </View>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    flex: { flex: 1 },
    mapaCaja: {
      height: ALTO_MAPA,
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: t.radius.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      overflow: 'hidden',
    },
    lista: { padding: 16, paddingBottom: 48 },
    miembro: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    cuando: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    compartir: {
      marginTop: 16,
      padding: 16,
      borderRadius: t.radius.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    compartirFila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    aviso: { marginTop: 12 },
  })
