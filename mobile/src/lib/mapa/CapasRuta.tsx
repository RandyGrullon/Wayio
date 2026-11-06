import { useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import MapboxGL, { type LineLayerStyle } from '@rnmapbox/maps'
import {
  easeTinta,
  OPACIDAD_GUIA,
  SIN_RUTAS,
  TRAZO_MS,
  trazoParcial,
  type RutasMapa,
} from './trazo'

/**
 * Capas de las rutas del día (necesitan el módulo nativo de Mapbox: solo se
 * importan desde módulos cargados en diferido).
 *
 * Mismos estilos que la web (TripMap.tsx): a pie con casing, traslados en
 * punteado y tramos por mar en discontinua. Al CAMBIAR a un día (no al montar
 * ni al volver a «Todos») su ruta queda atenuada y encima crece una copia de
 * sus tramos en 600 ms con la curva ease-tinta, de la primera parada a la
 * última (§7.4). Sin animación con «reducir movimiento» (§7.5) ni con la app
 * en segundo plano. Siempre montadas (aunque vacías) para que el orden de las
 * capas no cambie: las rutas quedan debajo de los marcadores.
 */
interface Props {
  rutas: RutasMapa
  /** Índice del día enfocado (dispara el trazo al cambiar) o null. */
  diaActivo: number | null
  reducirMovimiento: boolean
  /** Color del borde claro/oscuro bajo las líneas (colors.mapCasing). */
  casing: string
  /** Prefijo de los ids de fuentes y capas (único dentro del mapa). */
  idBase?: string
}

const ES_NORMAL = ['==', ['get', 'tipo'], 'normal'] as const
const ES_TRASLADO = ['==', ['get', 'tipo'], 'traslado'] as const
const ES_CRUCERO = ['==', ['get', 'tipo'], 'crucero'] as const
const ACTIVO = ['==', ['get', 'activo'], true] as const

export function CapasRuta({
  rutas,
  diaActivo,
  reducirMovimiento,
  casing,
  idBase = 'rutas',
}: Props): React.ReactElement {
  const [trazando, setTrazando] = useState(false)
  // Durante el trazo, la ruta del día activo baja a la opacidad de los demás.
  const opacidad: LineLayerStyle['lineOpacity'] = trazando
    ? ['case', ACTIVO, OPACIDAD_GUIA, ['get', 'opacidad']]
    : ['get', 'opacidad']
  const linea = { lineCap: 'round', lineJoin: 'round' } as const

  return (
    <>
      <MapboxGL.ShapeSource id={idBase} shape={rutas}>
        <MapboxGL.LineLayer
          id={`${idBase}-casing`}
          filter={ES_NORMAL}
          style={{
            ...linea,
            lineColor: casing,
            lineWidth: ['case', ACTIVO, 7.5, 6],
            lineOpacity: opacidad,
          }}
        />
        <MapboxGL.LineLayer
          id={`${idBase}-normal`}
          filter={ES_NORMAL}
          style={{
            ...linea,
            lineColor: ['get', 'color'],
            lineWidth: ['case', ACTIVO, 4.5, 3.5],
            lineOpacity: opacidad,
          }}
        />
        <MapboxGL.LineLayer
          id={`${idBase}-traslado`}
          filter={ES_TRASLADO}
          style={{
            ...linea,
            lineColor: ['get', 'color'],
            lineWidth: 3.5,
            lineDasharray: [0.1, 2],
            lineOpacity: opacidad,
          }}
        />
        <MapboxGL.LineLayer
          id={`${idBase}-crucero`}
          filter={ES_CRUCERO}
          style={{
            ...linea,
            lineColor: ['get', 'color'],
            lineWidth: 2.5,
            lineDasharray: [2, 2],
            lineOpacity: opacidad,
          }}
        />
      </MapboxGL.ShapeSource>
      <TrazoDia
        rutas={rutas}
        diaActivo={diaActivo}
        reducirMovimiento={reducirMovimiento}
        casing={casing}
        idBase={`${idBase}-trazo`}
        onTrazando={setTrazando}
      />
    </>
  )
}

/**
 * Copia de la ruta del día que crece fotograma a fotograma. Tiene su propio
 * estado para que solo ella se repinte durante los 600 ms (no el mapa).
 */
function TrazoDia({
  rutas,
  diaActivo,
  reducirMovimiento,
  casing,
  idBase,
  onTrazando,
}: {
  rutas: RutasMapa
  diaActivo: number | null
  reducirMovimiento: boolean
  casing: string
  idBase: string
  onTrazando: (activo: boolean) => void
}): React.ReactElement {
  const [trazo, setTrazo] = useState<RutasMapa>(SIN_RUTAS)
  // Copias para los fotogramas (la geometría puede llegar a mitad del trazo).
  const rutasRef = useRef(rutas)
  const onTrazandoRef = useRef(onTrazando)
  useEffect(() => {
    rutasRef.current = rutas
    onTrazandoRef.current = onTrazando
  })

  const previoRef = useRef<number | null | undefined>(undefined)
  useEffect(() => {
    const previo = previoRef.current
    previoRef.current = diaActivo
    if (
      previo === undefined ||
      diaActivo === null ||
      diaActivo === previo ||
      reducirMovimiento ||
      AppState.currentState !== 'active'
    ) {
      return
    }

    let raf = 0
    let inicio: number | null = null
    let terminado = false
    const terminar = (): void => {
      if (terminado) return
      terminado = true
      setTrazo(SIN_RUTAS)
      onTrazandoRef.current(false)
    }
    const fotograma = (ahora: number): void => {
      if (terminado) return
      inicio ??= ahora
      const t = Math.min(1, (ahora - inicio) / TRAZO_MS)
      setTrazo(trazoParcial(rutasRef.current, easeTinta(t)))
      if (t < 1) raf = requestAnimationFrame(fotograma)
      else terminar()
    }
    onTrazandoRef.current(true)
    raf = requestAnimationFrame(fotograma)
    // Red de seguridad: si los fotogramas se pausan (app en segundo plano a
    // mitad), la ruta no se queda atenuada.
    const seguro = setTimeout(terminar, TRAZO_MS + 400)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(seguro)
      terminar()
    }
  }, [diaActivo, reducirMovimiento])

  const linea = { lineCap: 'round', lineJoin: 'round' } as const
  return (
    <MapboxGL.ShapeSource id={idBase} shape={trazo}>
      <MapboxGL.LineLayer
        id={`${idBase}-casing`}
        filter={ES_NORMAL}
        style={{ ...linea, lineColor: casing, lineWidth: 7.5 }}
      />
      <MapboxGL.LineLayer
        id={`${idBase}-normal`}
        filter={ES_NORMAL}
        style={{ ...linea, lineColor: ['get', 'color'], lineWidth: 4.5 }}
      />
      <MapboxGL.LineLayer
        id={`${idBase}-traslado`}
        filter={ES_TRASLADO}
        style={{
          ...linea,
          lineColor: ['get', 'color'],
          lineWidth: 3.5,
          lineDasharray: [0.1, 2],
        }}
      />
      <MapboxGL.LineLayer
        id={`${idBase}-crucero`}
        filter={ES_CRUCERO}
        style={{
          ...linea,
          lineColor: ['get', 'color'],
          lineWidth: 2.5,
          lineDasharray: [2, 2],
        }}
      />
    </MapboxGL.ShapeSource>
  )
}
