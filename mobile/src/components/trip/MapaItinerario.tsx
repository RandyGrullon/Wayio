import { lazy, Suspense, useMemo } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { config } from '../../config'
import { useEstilos, type Tema } from '../../theme'
import { ErrorBoundary } from '../ErrorBoundary'
import { Skeleton } from '../ui/Skeleton'
import { Txt } from '../ui/Txt'
import { tieneCoords } from '../../lib/mapa/rutas'
import type { PlanningDay } from '../../types/planning'

export interface MapaItinerarioProps {
  /** Días del viaje guardado (los mismos `PlanningDay` que pinta DayCard). */
  dias: readonly PlanningDay[]
  /**
   * Día elegido en los chips: su `numero` (1…), o 'todo' / null para el viaje
   * completo. Los demás días se ven atenuados y, al cambiar de día, su ruta se
   * traza en 600 ms (sin animación con «reducir movimiento»).
   */
  diaElegido?: number | 'todo' | null
  /** Moneda del viaje para el precio de la ficha (por defecto USD). */
  moneda?: string
  /** Alto fijo del mapa en px (por defecto 260). */
  alto?: number
  /**
   * Fuerza el modo crucero (tramos por mar sin calles). Por defecto se deduce
   * de las actividades con `puertoCrucero`.
   */
  isCrucero?: boolean
  /** Márgenes o posición del bloque (el alto lo fija `alto`). */
  style?: StyleProp<ViewStyle>
}

/** Alto por defecto del mapa del itinerario. */
export const ALTO_MAPA_ITINERARIO = 260

// Diferido: el módulo nativo de Mapbox solo se evalúa si hay token; en Expo Go
// (sin módulo nativo) falla la carga y el ErrorBoundary no pinta nada.
const MapaNativo = lazy(() =>
  import('../../lib/mapa/MapaItinerarioNativo').then((m) => ({
    default: m.MapaItinerarioNativo,
  }))
)

/**
 * Mapa del viaje guardado: pines numerados por día, rutas reales por calles
 * (POST /api/ruta, con caché por tramo) y trazo animado del día elegido, como
 * el mapa de la web en /trip/[id]. Autocontenido y de alto fijo.
 *
 * Sin coordenadas, sin EXPO_PUBLIC_MAPBOX_TOKEN o sin el módulo nativo (Expo
 * Go) no ocupa sitio: no renderiza nada (en desarrollo, una nota discreta).
 */
export function MapaItinerario(
  props: MapaItinerarioProps
): React.ReactElement | null {
  const { dias, alto = ALTO_MAPA_ITINERARIO, style } = props
  const styles = useEstilos(crearEstilos)
  const hayCoords = useMemo(
    () => dias.some((d) => d.actividades.some(tieneCoords)),
    [dias]
  )
  if (!hayCoords) return null

  const nota = (texto: string): React.ReactElement | null =>
    __DEV__ ? (
      <View style={[styles.nota, style]}>
        <Txt variant="caption" color="fgSubtle">
          {texto}
        </Txt>
      </View>
    ) : null

  if (!config.mapboxToken) {
    return nota(
      'Solo desarrollo: el mapa del itinerario necesita EXPO_PUBLIC_MAPBOX_TOKEN (token público pk.*).'
    )
  }

  return (
    <ErrorBoundary
      fallback={nota(
        'Solo desarrollo: el mapa del itinerario necesita un development build (no Expo Go).'
      )}
    >
      <Suspense
        fallback={
          <SkeletonMapa alto={alto} style={style} radio={styles.radio} />
        }
      >
        <MapaNativo {...props} />
      </Suspense>
    </ErrorBoundary>
  )
}

function SkeletonMapa({
  alto,
  style,
  radio,
}: {
  alto: number
  style: StyleProp<ViewStyle>
  radio: { borderRadius: number }
}): React.ReactElement {
  return (
    <View
      style={style}
      accessible
      accessibilityLabel="Cargando el mapa…"
      accessibilityLiveRegion="polite"
    >
      <Skeleton height={alto} radius={radio.borderRadius} />
    </View>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    nota: {
      paddingVertical: t.space[2],
      paddingHorizontal: t.space[3],
      borderRadius: t.radius.control,
      backgroundColor: t.colors.surface2,
    },
    radio: { borderRadius: t.radius.card },
  })
