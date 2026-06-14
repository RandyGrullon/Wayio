'use client'

import { useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Trip } from '@/types/trip'

interface Faltante {
  actId: string
  nombre: string
  ciudad: string
}

/**
 * Rellena en background las coordenadas de las actividades que la IA no ancló.
 *
 * /api/generate solo geocodifica las primeras ~6 actividades inline (para no
 * bloquear la respuesta con el rate-limit de Nominatim). Este hook detecta el
 * resto —las que quedaron en lat/lng 0— y las geocodifica tras mostrar el
 * resultado, mezclando las coords en el trip mostrado para que aparezcan en el
 * mapa. Best-effort: si falla, el itinerario sigue siendo válido.
 */
export function useBackgroundGeocode(
  trip: Trip | null,
  setTrip: Dispatch<SetStateAction<Trip | null>>
): void {
  // Evita re-geocodificar el mismo viaje en cada render.
  const hechoRef = useRef<string | null>(null)

  useEffect(() => {
    if (!trip) return
    if (hechoRef.current === trip.id) return

    const faltantes: Faltante[] = []
    for (const dia of trip.dias) {
      for (const act of dia.actividades) {
        if (
          act.tipo !== 'traslado' &&
          act.nombre.trim() &&
          act.lat === 0 &&
          act.lng === 0
        ) {
          faltantes.push({
            actId: act.id,
            nombre: act.nombre,
            ciudad: dia.ciudad,
          })
        }
      }
    }

    hechoRef.current = trip.id
    if (faltantes.length === 0) return

    let cancelado = false
    void (async () => {
      try {
        const res = await fetch('/api/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: faltantes.map((f) => ({
              nombre: f.nombre,
              ciudad: f.ciudad,
            })),
          }),
        })
        if (!res.ok || cancelado) return

        const { results } = (await res.json()) as {
          results: ({ lat: number; lng: number } | null)[]
        }
        if (cancelado) return

        const coords = new Map<string, { lat: number; lng: number }>()
        faltantes.forEach((f, i) => {
          const r = results[i]
          if (r) coords.set(f.actId, r)
        })
        if (coords.size === 0) return

        setTrip((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            dias: prev.dias.map((d) => ({
              ...d,
              actividades: d.actividades.map((a) => {
                const c = coords.get(a.id)
                return c ? { ...a, ...c } : a
              }),
            })),
          }
        })
      } catch {
        // Background best-effort: ignoramos errores.
      }
    })()

    return () => {
      cancelado = true
    }
  }, [trip, setTrip])
}
