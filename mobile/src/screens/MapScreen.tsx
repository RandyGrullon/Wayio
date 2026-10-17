import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Linking, Pressable, StyleSheet, View } from 'react-native'
import MapboxGL from '@rnmapbox/maps'
import { config } from '../config'
import { colorDia, useEstilos, useTheme, type Tema } from '../theme'
import { GeofenceCircles } from '../components/GeofenceCircle'
import { Txt } from '../components/ui/Txt'
import { Button } from '../components/ui/Button'
import { IconButton } from '../components/ui/IconButton'
import {
  Anchor,
  LocateFixed,
  Maximize,
  Navigation,
  X,
} from '../components/ui/iconos'
import { formatCurrency, formatHora12 } from '../components/ui/formato'
import {
  anilloGeodesico,
  limitesDe,
  type Posicion,
} from '../lib/geofencing/geodesia'
import { ordenarPorHora } from '../lib/geofencing/fechas'
import { abrirComoLlegar } from '../lib/geofencing/navegacion'
import type { UserLocation } from '../types/geofencing'
import type { Activity, ActivityEvaluation } from '../types/activity'
import type { Moneda } from '../types/trip'

// El token sale de la configuración central (EXPO_PUBLIC_MAPBOX_TOKEN). La
// pantalla en vivo no carga este módulo si falta: muestra un aviso.
if (config.mapboxToken) void MapboxGL.setAccessToken(config.mapboxToken)

export interface FocoMapa {
  id: string
  lat: number
  lng: number
}

interface Props {
  activities: ActivityEvaluation[]
  userLocation: UserLocation | null
  isCrucero: boolean | undefined
  /** Día de hoy (0-based): se resalta y los demás se atenúan. */
  diaActivo: number | null
  /** Lugar a enseñar (p. ej. el puerto desde la alerta de embarque). */
  foco?: FocoMapa | null
  /** Próxima actividad: tramo en vivo desde tu posición. */
  siguiente?: Activity | null
  /** Moneda del viaje para el precio del popup (§10.3). */
  moneda?: Moneda
}

const conCoords = (a: Activity): boolean => a.lat !== 0 || a.lng !== 0

/**
 * Mapa en vivo (§10): ruta por día con casing, geocercas con su radio real,
 * marcadores numerados por día, punto GPS con su precisión y el siguiente
 * tramo. Necesita la app completa (no Expo Go) y el token de Mapbox.
 */
export function MapScreen({
  activities,
  userLocation,
  isCrucero,
  diaActivo,
  foco = null,
  siguiente = null,
  moneda = 'USD',
}: Props): React.ReactElement {
  const tema = useTheme()
  const { colors, days, isDark } = tema
  const styles = useEstilos(crearEstilos)
  const camara = useRef<React.ComponentRef<typeof MapboxGL.Camera>>(null)
  const [seleccion, setSeleccion] = useState<string | null>(null)

  const colorDeDia = useCallback(
    (diaIndex: number) => colorDia(days, diaIndex + 1),
    [days]
  )

  const conLugar = useMemo(() => activities.filter(conCoords), [activities])

  const rutas = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString>>(() => {
    const porDia = new Map<number, Activity[]>()
    for (const a of conLugar) {
      const lista = porDia.get(a.diaIndex) ?? []
      lista.push(a)
      porDia.set(a.diaIndex, lista)
    }
    return {
      type: 'FeatureCollection',
      features: [...porDia.entries()]
        .map(([dia, lista]) => ({
          dia,
          coords: ordenarPorHora(lista).map((a): Posicion => [a.lng, a.lat]),
        }))
        .filter((r) => r.coords.length > 1)
        .map((r) => ({
          type: 'Feature',
          id: `ruta-${r.dia}`,
          properties: {
            color: colorDeDia(r.dia),
            activo: diaActivo === null || r.dia === diaActivo ? 1 : 0,
          },
          geometry: { type: 'LineString', coordinates: r.coords },
        })),
    }
  }, [conLugar, colorDeDia, diaActivo])

  const marcadores = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => {
    const numeroEnDia = new Map<string, number>()
    const porDia = new Map<number, Activity[]>()
    for (const a of conLugar) {
      const lista = porDia.get(a.diaIndex) ?? []
      lista.push(a)
      porDia.set(a.diaIndex, lista)
    }
    for (const lista of porDia.values()) {
      ordenarPorHora(lista).forEach((a, i) => numeroEnDia.set(a.id, i + 1))
    }
    return {
      type: 'FeatureCollection',
      features: conLugar
        .filter((a) => a.puertoCrucero !== true)
        .map((a) => ({
          type: 'Feature',
          id: a.id,
          properties: {
            id: a.id,
            numero: String(numeroEnDia.get(a.id) ?? ''),
            color: colorDeDia(a.diaIndex),
            activo: diaActivo === null || a.diaIndex === diaActivo ? 1 : 0,
            hecho: a.estado === 'completada' || a.estado === 'perdida' ? 1 : 0,
          },
          geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
        })),
    }
  }, [conLugar, colorDeDia, diaActivo])

  const puertos = useMemo(
    () => conLugar.filter((a) => a.puertoCrucero === true),
    [conLugar]
  )

  const precision = useMemo<GeoJSON.Feature<GeoJSON.Polygon> | null>(() => {
    if (!userLocation || userLocation.accuracy <= 0) return null
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          anilloGeodesico(
            userLocation.lat,
            userLocation.lng,
            Math.min(userLocation.accuracy, 500),
            48
          ),
        ],
      },
    }
  }, [userLocation])

  const tramo = useMemo<GeoJSON.Feature<GeoJSON.LineString> | null>(() => {
    if (!userLocation || !siguiente || !conCoords(siguiente)) return null
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [userLocation.lng, userLocation.lat],
          [siguiente.lng, siguiente.lat],
        ],
      },
    }
  }, [userLocation, siguiente])

  const ajustarVista = useCallback(() => {
    const deHoy =
      diaActivo === null
        ? conLugar
        : conLugar.filter((a) => a.diaIndex === diaActivo)
    const puntos: Posicion[] = (deHoy.length > 0 ? deHoy : conLugar).map(
      (a) => [a.lng, a.lat]
    )
    if (userLocation) puntos.push([userLocation.lng, userLocation.lat])
    const caja = limitesDe(puntos)
    if (!caja) return
    if (puntos.length === 1) {
      camara.current?.setCamera({
        centerCoordinate: caja.ne,
        zoomLevel: 14,
        animationDuration: 600,
      })
      return
    }
    camara.current?.fitBounds(caja.ne, caja.sw, 60, 600)
  }, [conLugar, diaActivo, userLocation])

  const irAMi = useCallback(() => {
    if (!userLocation) return
    camara.current?.setCamera({
      centerCoordinate: [userLocation.lng, userLocation.lat],
      zoomLevel: 15,
      animationDuration: 600,
    })
  }, [userLocation])

  // Encuadre inicial y cada vez que cambia el foco (no en cada posición).
  const encuadrado = useRef(false)
  useEffect(() => {
    if (foco) {
      camara.current?.setCamera({
        centerCoordinate: [foco.lng, foco.lat],
        zoomLevel: 15,
        animationDuration: 900,
      })
      return
    }
    if (encuadrado.current || conLugar.length === 0) return
    encuadrado.current = true
    const t = setTimeout(ajustarVista, 300)
    return () => clearTimeout(t)
  }, [foco, conLugar.length, ajustarVista])

  const elegida = useMemo(
    () =>
      seleccion ? (activities.find((a) => a.id === seleccion) ?? null) : null,
    [seleccion, activities]
  )

  const centro: Posicion = foco
    ? [foco.lng, foco.lat]
    : userLocation
      ? [userLocation.lng, userLocation.lat]
      : conLugar[0]
        ? [conLugar[0].lng, conLugar[0].lat]
        : [-69.9312, 18.4742]

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        style={styles.map}
        styleURL={isDark ? MapboxGL.StyleURL.Dark : MapboxGL.StyleURL.Light}
        compassEnabled
        scaleBarEnabled={false}
        logoEnabled
        accessibilityLabel={`Mapa del viaje con ${conLugar.length} lugares`}
      >
        <MapboxGL.Camera
          ref={camara}
          defaultSettings={{ centerCoordinate: centro, zoomLevel: 13 }}
          maxZoomLevel={18}
        />

        {rutas.features.length > 0 ? (
          <MapboxGL.ShapeSource id="rutas" shape={rutas}>
            <MapboxGL.LineLayer
              id="rutas-casing"
              style={{
                lineColor: colors.mapCasing,
                lineWidth: ['case', ['==', ['get', 'activo'], 1], 7, 6],
                lineOpacity: ['case', ['==', ['get', 'activo'], 1], 1, 0.3],
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <MapboxGL.LineLayer
              id="rutas-linea"
              style={{
                lineColor: ['get', 'color'],
                lineWidth:
                  isCrucero === true
                    ? 2.5
                    : ['case', ['==', ['get', 'activo'], 1], 4.5, 3.5],
                lineOpacity: ['case', ['==', ['get', 'activo'], 1], 1, 0.3],
                lineCap: 'round',
                lineJoin: 'round',
                ...(isCrucero === true ? { lineDasharray: [2, 2] } : {}),
              }}
            />
          </MapboxGL.ShapeSource>
        ) : null}

        <GeofenceCircles
          activities={activities}
          colorDeDia={colorDeDia}
          diaActivo={diaActivo}
        />

        {tramo ? (
          <MapboxGL.ShapeSource id="tramo-en-vivo" shape={tramo}>
            <MapboxGL.LineLayer
              id="tramo-en-vivo-linea"
              style={{
                lineColor: colors.gps,
                lineWidth: 4,
                lineDasharray: [1.5, 1.5],
                lineCap: 'round',
              }}
            />
          </MapboxGL.ShapeSource>
        ) : null}

        {marcadores.features.length > 0 ? (
          <MapboxGL.ShapeSource
            id="marcadores"
            shape={marcadores}
            onPress={(e) => {
              const id: unknown = e.features[0]?.properties?.['id']
              if (typeof id === 'string') setSeleccion(id)
            }}
          >
            <MapboxGL.CircleLayer
              id="marcadores-circulo"
              style={{
                circleRadius: ['case', ['==', ['get', 'activo'], 1], 16, 14],
                circleColor: ['get', 'color'],
                circleStrokeColor: colors.mapCasing,
                circleStrokeWidth: 2,
                circleOpacity: [
                  'case',
                  ['==', ['get', 'activo'], 0],
                  0.4,
                  ['==', ['get', 'hecho'], 1],
                  0.55,
                  1,
                ],
                circleStrokeOpacity: [
                  'case',
                  ['==', ['get', 'activo'], 1],
                  1,
                  0.4,
                ],
              }}
            />
            <MapboxGL.SymbolLayer
              id="marcadores-numero"
              style={{
                textField: ['get', 'numero'],
                textSize: 13,
                textColor: colors.dayNumeral,
                textAllowOverlap: true,
                textIgnorePlacement: true,
                textOpacity: ['case', ['==', ['get', 'activo'], 1], 1, 0.5],
              }}
            />
          </MapboxGL.ShapeSource>
        ) : null}

        {puertos.map((p) => (
          <MapboxGL.MarkerView
            key={p.id}
            coordinate={[p.lng, p.lat]}
            allowOverlap
          >
            <View
              style={styles.puerto}
              accessible
              accessibilityLabel={`Puerto: ${p.nombre}`}
            >
              <Anchor
                size={16}
                color={colors.fgInverse}
                strokeWidth={2}
                accessible={false}
              />
            </View>
          </MapboxGL.MarkerView>
        ))}

        {precision ? (
          <MapboxGL.ShapeSource id="gps-precision" shape={precision}>
            <MapboxGL.FillLayer
              id="gps-precision-relleno"
              style={{ fillColor: colors.gps, fillOpacity: 0.1 }}
            />
            <MapboxGL.LineLayer
              id="gps-precision-borde"
              style={{ lineColor: colors.gps, lineOpacity: 0.35, lineWidth: 1 }}
            />
          </MapboxGL.ShapeSource>
        ) : null}

        {userLocation ? (
          <MapboxGL.ShapeSource
            id="gps-punto"
            shape={{
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Point',
                coordinates: [userLocation.lng, userLocation.lat],
              },
            }}
          >
            <MapboxGL.CircleLayer
              id="gps-punto-circulo"
              style={{
                circleRadius: 7,
                circleColor: colors.gps,
                circleStrokeColor: colors.gpsRing,
                circleStrokeWidth: 3,
              }}
            />
          </MapboxGL.ShapeSource>
        ) : null}
      </MapboxGL.MapView>

      {config.creditosGeoapify ? (
        // Las coordenadas de los lugares vienen de Geoapify (backend): su plan
        // Free exige este enlace junto al mapa. El de OpenStreetMap ya va en
        // los créditos de Mapbox (botón «i»).
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Powered by Geoapify. Abre geoapify.com"
          onPress={() => {
            Linking.openURL('https://www.geoapify.com/').catch(() => undefined)
          }}
          hitSlop={8}
          style={styles.creditos}
        >
          <Txt variant="caption" color="fgMuted">
            Powered by Geoapify
          </Txt>
        </Pressable>
      ) : null}

      <View style={styles.controles}>
        <IconButton
          label="Ajustar vista al día"
          icon={Maximize}
          onPress={ajustarVista}
          variant="soft"
          style={styles.control}
        />
        {userLocation ? (
          <IconButton
            label="Ir a mi ubicación"
            icon={LocateFixed}
            onPress={irAMi}
            variant="soft"
            style={styles.control}
          />
        ) : null}
      </View>

      {elegida ? (
        <View style={styles.popup} accessibilityLiveRegion="polite">
          <View style={styles.popupCabecera}>
            <View style={styles.flex}>
              <Txt variant="overline" color="fgMuted">
                Día {elegida.diaIndex + 1}
                {elegida.horaInicio
                  ? ` · ${formatHora12(elegida.horaInicio)}`
                  : ''}
              </Txt>
              <Txt variant="title">{elegida.nombre}</Txt>
              {elegida.precio !== undefined && elegida.precio > 0 ? (
                <Txt variant="caption" color="fgMuted" tnum>
                  {`Estimado ${formatCurrency(elegida.precio, moneda)}`}
                </Txt>
              ) : null}
            </View>
            <IconButton
              label="Cerrar"
              icon={X}
              size="sm"
              onPress={() => setSeleccion(null)}
            />
          </View>
          <Button
            title="Cómo llegar"
            icon={Navigation}
            variant="tinta"
            size="sm"
            onPress={() =>
              abrirComoLlegar(elegida.lat, elegida.lng, elegida.nombre)
            }
          />
        </View>
      ) : null}
    </View>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.surface2 },
    map: { flex: 1 },
    creditos: {
      position: 'absolute',
      top: t.space[3],
      left: t.space[3],
      paddingHorizontal: t.space[2],
      paddingVertical: 2,
      borderRadius: t.radius.control,
      backgroundColor: t.colors.surfaceRaised,
      opacity: 0.9,
    },
    controles: {
      position: 'absolute',
      top: t.space[3],
      right: t.space[3],
      gap: t.space[2],
    },
    control: {
      width: 40,
      height: 40,
      borderRadius: t.radius.control,
      backgroundColor: t.colors.surfaceRaised,
      ...(t.isDark ? {} : t.elevation.elev),
    },
    puerto: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: t.colors.surfaceInverse,
      borderWidth: 2,
      borderColor: t.colors.mapCasing,
      alignItems: 'center',
      justifyContent: 'center',
    },
    popup: {
      position: 'absolute',
      left: t.space[3],
      right: t.space[3],
      bottom: t.space[3],
      backgroundColor: t.colors.surfaceRaised,
      borderRadius: t.radius.control,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: 14,
      gap: t.space[3],
      maxWidth: 420,
      ...(t.isDark ? {} : t.elevation.float),
    },
    popupCabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    flex: { flex: 1 },
  })
