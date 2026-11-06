import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import MapboxGL from '@rnmapbox/maps'
import { config } from '../../config'
import { colorDia, useEstilos, useTheme, type Tema } from '../../theme'
import { Txt } from '../../components/ui/Txt'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { Anchor, Maximize, Navigation, X } from '../../components/ui/iconos'
import { formatCurrency, formatHora12 } from '../../components/ui/formato'
import { useReduceMotion } from '../../components/ui/useReduceMotion'
import { useRutasReales } from '../../hooks/useRutasReales'
import { limitesDe, type Posicion } from '../geofencing/geodesia'
import { abrirComoLlegar } from '../geofencing/navegacion'
import { CapasRuta } from './CapasRuta'
import { CreditoRutas } from './CreditoRutas'
import { tieneCoords } from './rutas'
import { featuresRutas } from './trazo'
import type { PlanningActivity } from '../../types/planning'
import {
  ALTO_MAPA_ITINERARIO,
  type MapaItinerarioProps,
} from '../../components/trip/MapaItinerario'

// Solo se carga con token (lo comprueba MapaItinerario); repetirlo no daña.
if (config.mapboxToken) void MapboxGL.setAccessToken(config.mapboxToken)

interface Parada {
  /** `${indiceDia}:${id}`: un mismo id puede repetirse en dos días. */
  clave: string
  /** Índice del día (0…). */
  dia: number
  /** Número del día que ve el usuario (PlanningDay.numero). */
  numeroDia: number
  /** Orden de la parada dentro del día (1…), solo las que tienen lugar. */
  orden: number
  actividad: PlanningActivity
  puerto: boolean
}

/**
 * Parte nativa de MapaItinerario (necesita @rnmapbox/maps; se carga en
 * diferido). Mapa en línea dentro de la ficha del viaje: un dedo sigue
 * desplazando la pantalla (el mapa no se arrastra) y con dos dedos se acerca,
 * como los gestos cooperativos de la web en pantallas táctiles.
 */
export function MapaItinerarioNativo({
  dias,
  diaElegido = null,
  moneda = 'USD',
  alto = ALTO_MAPA_ITINERARIO,
  isCrucero,
  style,
}: MapaItinerarioProps): React.ReactElement {
  const { colors, days, isDark } = useTheme()
  const styles = useEstilos(crearEstilos)
  const reducir = useReduceMotion()
  const camara = useRef<React.ComponentRef<typeof MapboxGL.Camera>>(null)
  const [listo, setListo] = useState(false)
  const [seleccion, setSeleccion] = useState<string | null>(null)

  const enfocado = useMemo(() => {
    if (diaElegido === null || diaElegido === 'todo') return null
    const i = dias.findIndex((d) => d.numero === diaElegido)
    return i >= 0 ? i : null
  }, [dias, diaElegido])

  const crucero = useMemo(
    () =>
      isCrucero ??
      dias.some((d) => d.actividades.some((a) => a.puertoCrucero === true)),
    [dias, isCrucero]
  )

  // Paradas con lugar de cada día, en el orden del itinerario (como la web).
  const paradas = useMemo(
    () => dias.map((d) => d.actividades.filter(tieneCoords)),
    [dias]
  )

  const colorDeDia = useCallback(
    (i: number) => colorDia(days, dias[i]?.numero ?? i + 1),
    [days, dias]
  )

  const rutasReales = useRutasReales(paradas, crucero)
  const rutas = useMemo(
    () =>
      featuresRutas(paradas, {
        colorDeDia,
        enfocado,
        crucero,
        rutas: rutasReales,
      }),
    [paradas, colorDeDia, enfocado, crucero, rutasReales]
  )

  const lista = useMemo<Parada[]>(
    () =>
      paradas.flatMap((acts, d) =>
        acts.map((a, k) => ({
          clave: `${d}:${a.id}`,
          dia: d,
          numeroDia: dias[d]?.numero ?? d + 1,
          orden: k + 1,
          actividad: a,
          puerto: crucero && a.puertoCrucero === true,
        }))
      ),
    [paradas, dias, crucero]
  )

  const marcadores = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => {
    const atenuado = (p: Parada): boolean =>
      enfocado !== null && enfocado !== p.dia
    return {
      type: 'FeatureCollection',
      features: lista
        .filter((p) => !p.puerto)
        // Los del día enfocado, encima de los demás.
        .sort((a, b) => Number(!atenuado(a)) - Number(!atenuado(b)))
        .map((p) => ({
          type: 'Feature',
          id: p.clave,
          properties: {
            clave: p.clave,
            numero: String(p.orden),
            color: colorDeDia(p.dia),
            activo: enfocado === p.dia ? 1 : 0,
            atenuado: atenuado(p) ? 1 : 0,
          },
          geometry: {
            type: 'Point',
            coordinates: [p.actividad.lng, p.actividad.lat],
          },
        })),
    }
  }, [lista, colorDeDia, enfocado])

  const puertos = useMemo(() => lista.filter((p) => p.puerto), [lista])

  // ── Encuadre del día (o del viaje). Movimiento reducido: sin animación ────
  const encuadrar = useCallback(
    (instantaneo: boolean) => {
      const todos = paradas.flat()
      const delDia = enfocado === null ? todos : (paradas[enfocado] ?? [])
      const puntos: Posicion[] = (delDia.length > 0 ? delDia : todos).map(
        (a) => [a.lng, a.lat]
      )
      const caja = limitesDe(puntos)
      if (!caja) return
      const animationDuration = instantaneo || reducir ? 0 : 900
      const ancho = caja.ne[0] - caja.sw[0]
      const altoCaja = caja.ne[1] - caja.sw[1]
      // Como el maxZoom 16 de la web: un casco histórico no se ve diminuto ni
      // una sola parada se acerca de más.
      if (puntos.length === 1 || (ancho < 0.003 && altoCaja < 0.003)) {
        camara.current?.setCamera({
          centerCoordinate: [
            (caja.ne[0] + caja.sw[0]) / 2,
            (caja.ne[1] + caja.sw[1]) / 2,
          ],
          zoomLevel: puntos.length === 1 ? 15 : 16,
          animationDuration,
        })
        return
      }
      const margen = Math.max(24, Math.min(60, Math.round(alto / 5)))
      camara.current?.fitBounds(caja.ne, caja.sw, margen, animationDuration)
    },
    [paradas, enfocado, reducir, alto]
  )

  // Al cargar, sin animación; al cambiar de día, tras el chip (160 ms).
  const vistaInicial = useRef(false)
  useEffect(() => {
    if (!listo) return
    const inicial = !vistaInicial.current
    const t = setTimeout(
      () => {
        vistaInicial.current = true
        encuadrar(inicial)
      },
      inicial ? 0 : 160
    )
    return () => clearTimeout(t)
  }, [listo, encuadrar])

  const elegida = useMemo(
    () =>
      seleccion ? (lista.find((p) => p.clave === seleccion) ?? null) : null,
    [seleccion, lista]
  )

  const primero = paradas.flat()[0]
  const centro: Posicion = primero
    ? [primero.lng, primero.lat]
    : [-69.9312, 18.4742]
  const numeroEnfocado = enfocado === null ? null : dias[enfocado]?.numero

  return (
    <View style={[styles.contenedor, { height: alto }, style]}>
      <MapboxGL.MapView
        style={styles.mapa}
        styleURL={isDark ? MapboxGL.StyleURL.Dark : MapboxGL.StyleURL.Light}
        scrollEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        logoEnabled
        onDidFinishLoadingMap={() => setListo(true)}
        accessibilityLabel={
          numeroEnfocado
            ? `Mapa del día ${numeroEnfocado} con ${paradas[enfocado ?? 0]?.length ?? 0} paradas`
            : `Mapa del viaje con ${lista.length} lugares`
        }
      >
        <MapboxGL.Camera
          ref={camara}
          defaultSettings={{ centerCoordinate: centro, zoomLevel: 12 }}
          maxZoomLevel={18}
        />

        <CapasRuta
          rutas={rutas}
          diaActivo={enfocado}
          reducirMovimiento={reducir}
          casing={colors.mapCasing}
        />

        <MapboxGL.ShapeSource
          id="itinerario-marcadores"
          shape={marcadores}
          onPress={(e) => {
            const clave: unknown = e.features[0]?.properties?.['clave']
            if (typeof clave === 'string') setSeleccion(clave)
          }}
        >
          <MapboxGL.CircleLayer
            id="itinerario-marcadores-circulo"
            style={{
              circleRadius: ['case', ['==', ['get', 'activo'], 1], 15, 13],
              circleColor: ['get', 'color'],
              circleStrokeColor: colors.mapCasing,
              circleStrokeWidth: 2,
              circleOpacity: ['case', ['==', ['get', 'atenuado'], 1], 0.4, 1],
              circleStrokeOpacity: [
                'case',
                ['==', ['get', 'atenuado'], 1],
                0.4,
                1,
              ],
            }}
          />
          <MapboxGL.SymbolLayer
            id="itinerario-marcadores-numero"
            style={{
              textField: ['get', 'numero'],
              textSize: 12,
              textColor: colors.dayNumeral,
              textAllowOverlap: true,
              textIgnorePlacement: true,
              textOpacity: ['case', ['==', ['get', 'atenuado'], 1], 0.5, 1],
            }}
          />
        </MapboxGL.ShapeSource>

        {puertos.map((p) => (
          <MapboxGL.MarkerView
            key={p.clave}
            coordinate={[p.actividad.lng, p.actividad.lat]}
            allowOverlap
          >
            <Pressable
              onPress={() => setSeleccion(p.clave)}
              accessibilityRole="button"
              accessibilityLabel={`Día ${p.numeroDia}, puerto: ${p.actividad.nombre}`}
              style={[
                styles.puerto,
                enfocado !== null && enfocado !== p.dia
                  ? styles.atenuado
                  : null,
              ]}
            >
              <Anchor
                size={14}
                color={colors.fgInverse}
                strokeWidth={2}
                accessible={false}
              />
            </Pressable>
          </MapboxGL.MarkerView>
        ))}
      </MapboxGL.MapView>

      <CreditoRutas style={styles.creditos} />

      <IconButton
        label="Ajustar vista"
        icon={Maximize}
        onPress={() => encuadrar(false)}
        variant="soft"
        size="sm"
        style={styles.control}
      />

      {elegida ? (
        <Ficha
          parada={elegida}
          moneda={moneda}
          onCerrar={() => setSeleccion(null)}
        />
      ) : null}
    </View>
  )
}

/** Ficha de la parada elegida (como el popup de la web, sin HTML). */
function Ficha({
  parada,
  moneda,
  onCerrar,
}: {
  parada: Parada
  moneda: string
  onCerrar: () => void
}): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const a = parada.actividad
  const horas = [formatHora12(a.horaInicio), formatHora12(a.horaFin)]
    .filter(Boolean)
    .join(' – ')
  const meta = [
    horas,
    a.precioEstimado > 0 ? formatCurrency(a.precioEstimado, moneda) : '',
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <View style={styles.ficha} accessibilityLiveRegion="polite">
      <View style={styles.fichaCabecera}>
        <View style={styles.flex}>
          <Txt variant="overline" color="fgMuted">
            {`Día ${String(parada.numeroDia).padStart(2, '0')} · Parada ${parada.orden}`}
          </Txt>
          <Txt variant="title" numberOfLines={2}>
            {a.nombre}
          </Txt>
          {meta ? (
            <Txt variant="caption" color="fgMuted" tnum numberOfLines={1}>
              {meta}
            </Txt>
          ) : null}
        </View>
        <IconButton
          label="Cerrar ficha"
          icon={X}
          size="sm"
          onPress={onCerrar}
        />
      </View>
      <Button
        title="Cómo llegar"
        icon={Navigation}
        variant="tinta"
        size="sm"
        onPress={() => abrirComoLlegar(a.lat, a.lng, a.nombre)}
      />
    </View>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    contenedor: {
      borderRadius: t.radius.card,
      overflow: 'hidden',
      backgroundColor: t.colors.surface2,
    },
    mapa: { flex: 1 },
    creditos: {
      position: 'absolute',
      top: t.space[2],
      left: t.space[2],
    },
    control: {
      position: 'absolute',
      top: t.space[2],
      right: t.space[2],
      borderRadius: t.radius.control,
      backgroundColor: t.colors.surfaceRaised,
      ...(t.isDark ? {} : t.elevation.elev),
    },
    puerto: {
      width: 26,
      height: 26,
      borderRadius: 8,
      backgroundColor: t.colors.surfaceInverse,
      borderWidth: 2,
      borderColor: t.colors.mapCasing,
      alignItems: 'center',
      justifyContent: 'center',
    },
    atenuado: { opacity: 0.4 },
    ficha: {
      position: 'absolute',
      left: t.space[2],
      right: t.space[2],
      bottom: t.space[2],
      backgroundColor: t.colors.surfaceRaised,
      borderRadius: t.radius.control,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: t.space[3],
      gap: t.space[2],
      ...(t.isDark ? {} : t.elevation.float),
    },
    fichaCabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    flex: { flex: 1 },
  })
