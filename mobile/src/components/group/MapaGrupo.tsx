import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import MapboxGL from '@rnmapbox/maps'
import { config } from '../../config'
import { colorDia, useEstilos, useTheme, type Tema } from '../../theme'
import { Avatar } from '../ui/Avatar'
import { IconButton } from '../ui/IconButton'
import { Txt } from '../ui/Txt'
import { Maximize, Users, X } from '../ui/iconos'
import { limitesDe, type Posicion } from '../../lib/geofencing/geodesia'
import type { PlanningActivity, PlanningDay } from '../../types/planning'
import { cuandoUbicacion } from './formatoUbicacion'

// Mismo token que el mapa en vivo (EXPO_PUBLIC_MAPBOX_TOKEN). Este módulo solo
// se carga en diferido y con token (MiembrosGrupo); sin él no se evalúa.
if (config.mapboxToken) void MapboxGL.setAccessToken(config.mapboxToken)

/** Miembro con su última ubicación compartida. */
export interface MiembroMapa {
  /** user_id del miembro. */
  id: string
  /** Nombre visible («Ana (tú)» para el usuario actual). */
  nombre: string
  lat: number
  lng: number
  /** Índice estable (indiceDesdeId): fija su color, igual que en la lista. */
  indice: number
  ultimaUbicacion: string | null
}

interface Props {
  dias: readonly PlanningDay[]
  miembros: readonly MiembroMapa[]
  /** Nombre accesible del mapa. */
  etiqueta: string
}

const AVATAR = 30

function tieneCoords(a: Pick<PlanningActivity, 'lat' | 'lng'>): boolean {
  return (
    Number.isFinite(a.lat) &&
    Number.isFinite(a.lng) &&
    !(a.lat === 0 && a.lng === 0)
  )
}

/**
 * Mapa de la sala del grupo (§6.8), como el TripMap de la web en GroupRoom:
 * la ruta de cada día con sus paradas numeradas y un avatar-pin con las
 * iniciales de cada miembro en su última ubicación compartida. Al tocar un
 * pin se ve su nombre y la hora. Necesita la app completa (no Expo Go) y el
 * token de Mapbox: quien lo usa lo carga en diferido y con ErrorBoundary.
 */
export function MapaGrupo({
  dias,
  miembros,
  etiqueta,
}: Props): React.ReactElement {
  const { colors, days, isDark } = useTheme()
  const styles = useEstilos(crearEstilos)
  const camara = useRef<React.ComponentRef<typeof MapboxGL.Camera>>(null)
  const [seleccion, setSeleccion] = useState<string | null>(null)

  const paradas = useMemo(
    () =>
      dias.map((d) => ({
        numero: d.numero,
        color: colorDia(days, d.numero),
        actividades: d.actividades.filter(tieneCoords),
      })),
    [dias, days]
  )

  const rutas = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString>>(
    () => ({
      type: 'FeatureCollection',
      features: paradas
        .filter((d) => d.actividades.length > 1)
        .map((d) => ({
          type: 'Feature',
          id: `ruta-${d.numero}`,
          properties: { color: d.color },
          geometry: {
            type: 'LineString',
            coordinates: d.actividades.map((a): Posicion => [a.lng, a.lat]),
          },
        })),
    }),
    [paradas]
  )

  const marcadores = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: 'FeatureCollection',
      features: paradas.flatMap((d) =>
        d.actividades.map((a, i) => ({
          type: 'Feature' as const,
          id: `${d.numero}-${a.id}`,
          properties: { numero: String(i + 1), color: d.color },
          geometry: { type: 'Point' as const, coordinates: [a.lng, a.lat] },
        }))
      ),
    }),
    [paradas]
  )

  const puntosViaje = useMemo<Posicion[]>(
    () =>
      paradas.flatMap((d) =>
        d.actividades.map((a): Posicion => [a.lng, a.lat])
      ),
    [paradas]
  )
  const puntosGrupo = useMemo<Posicion[]>(
    () => miembros.map((m): Posicion => [m.lng, m.lat]),
    [miembros]
  )

  const encuadrar = useCallback((puntos: Posicion[]) => {
    const caja = limitesDe(puntos)
    if (!caja) return
    if (puntos.length === 1) {
      camara.current?.setCamera({
        centerCoordinate: caja.ne,
        zoomLevel: 15,
        animationDuration: 600,
      })
      return
    }
    camara.current?.fitBounds(caja.ne, caja.sw, 48, 600)
  }, [])

  // Como la web: se encuadra el viaje; sin paradas con lugar, el grupo.
  const ajustarVista = useCallback(() => {
    encuadrar(puntosViaje.length > 0 ? puntosViaje : puntosGrupo)
  }, [encuadrar, puntosViaje, puntosGrupo])

  const verGrupo = useCallback(() => {
    encuadrar(puntosGrupo)
  }, [encuadrar, puntosGrupo])

  // Encuadre inicial (una vez, no con cada posición que llega). La función se
  // lee de un ref para que una posición nueva en esos 300 ms no cancele el
  // temporizador, y «encuadrado» se marca solo cuando de verdad se encuadra.
  const ajustarVistaRef = useRef(ajustarVista)
  useEffect(() => {
    ajustarVistaRef.current = ajustarVista
  }, [ajustarVista])
  const encuadrado = useRef(false)
  const hayPuntos = puntosViaje.length > 0 || puntosGrupo.length > 0
  useEffect(() => {
    if (encuadrado.current || !hayPuntos) return
    const t = setTimeout(() => {
      encuadrado.current = true
      ajustarVistaRef.current()
    }, 300)
    return () => clearTimeout(t)
  }, [hayPuntos])

  const elegido = seleccion
    ? (miembros.find((m) => m.id === seleccion) ?? null)
    : null

  const inicio = puntosViaje[0] ?? puntosGrupo[0]
  const centro: Posicion = inicio ?? [-69.9312, 18.4742]

  return (
    <View style={styles.contenedor}>
      <MapboxGL.MapView
        style={styles.mapa}
        styleURL={isDark ? MapboxGL.StyleURL.Dark : MapboxGL.StyleURL.Light}
        compassEnabled
        scaleBarEnabled={false}
        logoEnabled
        accessibilityLabel={etiqueta}
      >
        <MapboxGL.Camera
          ref={camara}
          defaultSettings={{ centerCoordinate: centro, zoomLevel: 12 }}
          maxZoomLevel={18}
        />

        {rutas.features.length > 0 ? (
          <MapboxGL.ShapeSource id="grupo-rutas" shape={rutas}>
            <MapboxGL.LineLayer
              id="grupo-rutas-casing"
              style={{
                lineColor: colors.mapCasing,
                lineWidth: 6,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <MapboxGL.LineLayer
              id="grupo-rutas-linea"
              style={{
                lineColor: ['get', 'color'],
                lineWidth: 3.5,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </MapboxGL.ShapeSource>
        ) : null}

        {marcadores.features.length > 0 ? (
          <MapboxGL.ShapeSource id="grupo-paradas" shape={marcadores}>
            <MapboxGL.CircleLayer
              id="grupo-paradas-circulo"
              style={{
                circleRadius: 12,
                circleColor: ['get', 'color'],
                circleStrokeColor: colors.mapCasing,
                circleStrokeWidth: 2,
              }}
            />
            <MapboxGL.SymbolLayer
              id="grupo-paradas-numero"
              style={{
                textField: ['get', 'numero'],
                textSize: 11,
                textColor: colors.dayNumeral,
                textAllowOverlap: true,
                textIgnorePlacement: true,
              }}
            />
          </MapboxGL.ShapeSource>
        ) : null}

        {miembros.map((m) => {
          const color = colorDia(days, (m.indice % 10) + 1)
          return (
            <MapboxGL.MarkerView
              key={m.id}
              coordinate={[m.lng, m.lat]}
              anchor={{ x: 0.5, y: 1 }}
              allowOverlap
            >
              <Pressable
                onPress={() => setSeleccion(m.id)}
                accessibilityRole="button"
                accessibilityLabel={`${m.nombre}, última ubicación`}
                accessibilityHint="Muestra a qué hora se actualizó"
                hitSlop={6}
                style={styles.pin}
              >
                <Avatar
                  nombre={m.nombre}
                  indice={m.indice}
                  size={AVATAR}
                  decorativo
                  borde={colors.mapCasing}
                />
                <View
                  style={[styles.punta, { backgroundColor: color }]}
                  accessible={false}
                />
              </Pressable>
            </MapboxGL.MarkerView>
          )
        })}
      </MapboxGL.MapView>

      <View style={styles.controles}>
        {puntosViaje.length > 0 ? (
          <IconButton
            label="Ajustar vista al viaje"
            icon={Maximize}
            onPress={ajustarVista}
            variant="soft"
            style={styles.control}
          />
        ) : null}
        {puntosGrupo.length > 0 ? (
          <IconButton
            label="Ver al grupo en el mapa"
            icon={Users}
            onPress={verGrupo}
            variant="soft"
            style={styles.control}
          />
        ) : null}
      </View>

      {elegido ? (
        <View style={styles.popup} accessibilityLiveRegion="polite">
          <Avatar nombre={elegido.nombre} indice={elegido.indice} decorativo />
          <View style={styles.flex}>
            <Txt variant="label" numberOfLines={1}>
              {elegido.nombre}
            </Txt>
            <Txt variant="caption" color="fgMuted" tnum>
              {elegido.ultimaUbicacion
                ? `Ubicación actualizada ${cuandoUbicacion(elegido.ultimaUbicacion)}`
                : 'Última ubicación compartida'}
            </Txt>
          </View>
          <IconButton
            label="Cerrar"
            icon={X}
            size="sm"
            onPress={() => setSeleccion(null)}
          />
        </View>
      ) : null}
    </View>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    contenedor: { flex: 1, backgroundColor: t.colors.surface2 },
    mapa: { flex: 1 },
    flex: { flex: 1 },
    pin: { alignItems: 'center' },
    punta: {
      width: 8,
      height: 8,
      marginTop: -5,
      transform: [{ rotate: '45deg' }],
      borderRightWidth: 2,
      borderBottomWidth: 2,
      borderColor: t.colors.mapCasing,
    },
    controles: {
      position: 'absolute',
      top: t.space[2],
      right: t.space[2],
      gap: t.space[2],
    },
    control: {
      width: 40,
      height: 40,
      borderRadius: t.radius.control,
      backgroundColor: t.colors.surfaceRaised,
      ...(t.isDark ? {} : t.elevation.elev),
    },
    popup: {
      position: 'absolute',
      left: t.space[2],
      right: t.space[2],
      bottom: t.space[2],
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.space[3],
      backgroundColor: t.colors.surfaceRaised,
      borderRadius: t.radius.control,
      borderWidth: 1,
      borderColor: t.colors.border,
      paddingVertical: 10,
      paddingHorizontal: 12,
      ...(t.isDark ? {} : t.elevation.float),
    },
  })
