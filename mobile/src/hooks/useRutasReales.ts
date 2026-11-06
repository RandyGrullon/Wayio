import { useEffect, useMemo, useSyncExternalStore } from 'react'
import {
  pedirRutas,
  rutaEnCache,
  suscribirRutas,
  tramosDe,
  versionRutas,
  type ParadaRuta,
  type RutaTramo,
} from '../lib/mapa/rutas'

/**
 * Rutas reales por calles entre las paradas de cada día (POST /api/ruta),
 * como useRutasReales de la web. `dias` son las paradas de cada día ya en el
 * orden del recorrido (las que no tienen coordenadas se ignoran).
 *
 * Devuelve clave-de-tramo → geometría y modo; mientras llegan (o si el
 * servicio falla) el mapa dibuja el respaldo. La caché la comparten todos los
 * mapas de la app (lib/mapa/rutas.ts), así que cambiar de día o de pantalla no
 * vuelve a gastar créditos de Geoapify.
 */
export function useRutasReales(
  dias: readonly (readonly ParadaRuta[])[],
  crucero: boolean
): ReadonlyMap<string, RutaTramo> {
  const tramos = useMemo(() => tramosDe(dias, crucero), [dias, crucero])
  const version = useSyncExternalStore(suscribirRutas, versionRutas)

  useEffect(() => {
    // También tras cada aviso de la caché (`version`): así, al acabar la pausa
    // tras un fallo (429, sin red, tiempo límite), se vuelve a pedir. Es barato:
    // pedirRutas no repite tramos en caché ni en camino, y en pausa no pide.
    void version
    void pedirRutas(tramos)
  }, [tramos, version])

  return useMemo(() => {
    void version
    const salida = new Map<string, RutaTramo>()
    for (const t of tramos) {
      const r = rutaEnCache(t.clave)
      if (r) salida.set(t.clave, r)
    }
    return salida
  }, [tramos, version])
}
