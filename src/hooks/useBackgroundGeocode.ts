'use client'

import { useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Trip } from '@/types/trip'

interface Faltante {
  actId: string
  nombre: string
  ciudad: string
}

/** /api/geocode acepta como máximo 10 lugares por petición. */
const LOTE = 10
const MAX_LUGARES = 40

/**
 * Completa en segundo plano las coordenadas de las actividades que el servidor
 * no verificó (coordsVerificadas !== true), para que el mapa y el "Llegar"
 * apunten al lugar real y no a la estimación de la IA.
 *
 * - Va por lotes y mezcla cada resultado con setTrip funcional, así que no
 *   pierde nada aunque el usuario edite el viaje mientras tanto.
 * - Se ejecuta una vez por id de viaje (se reintenta si falla).
 * Best-effort: si falla, el itinerario sigue siendo válido.
 */
export function useBackgroundGeocode(
  trip: Trip | null,
  setTrip: Dispatch<SetStateAction<Trip | null>>
): void {
  const hechoRef = useRef<string | null>(null)
  const tripRef = useRef(trip)
  // Último trip disponible para el efecto sin re-ejecutarlo en cada edición.
  useEffect(() => {
    tripRef.current = trip
  })
  const tripId = trip?.id ?? null

  useEffect(() => {
    const actual = tripRef.current
    if (!actual || !tripId || hechoRef.current === tripId) return

    const faltantes: Faltante[] = []
    for (const dia of actual.dias) {
      for (const act of dia.actividades) {
        if (
          act.tipo !== 'traslado' &&
          !act.coordsVerificadas &&
          act.nombre.trim() &&
          !/check-?in|check-?out/i.test(act.nombre)
        ) {
          faltantes.push({
            actId: act.id,
            nombre: act.nombre,
            ciudad: dia.ciudad,
          })
        }
      }
    }
    if (faltantes.length === 0) {
      hechoRef.current = tripId
      return
    }

    const controller = new AbortController()
    void (async () => {
      try {
        const pendientes = faltantes.slice(0, MAX_LUGARES)
        for (let i = 0; i < pendientes.length; i += LOTE) {
          const lote = pendientes.slice(i, i + LOTE)
          const res = await fetch('/api/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: lote.map((f) => ({ nombre: f.nombre, ciudad: f.ciudad })),
            }),
            signal: controller.signal,
          })
          if (!res.ok) return
          const { results } = (await res.json()) as {
            results: ({ lat: number; lng: number } | null)[]
          }
          const coords = new Map<string, { lat: number; lng: number }>()
          lote.forEach((f, j) => {
            const r = results[j]
            if (r && Number.isFinite(r.lat) && Number.isFinite(r.lng)) {
              coords.set(f.actId, r)
            }
          })
          if (coords.size > 0) {
            setTrip((prev) =>
              prev
                ? {
                    ...prev,
                    dias: prev.dias.map((d) => ({
                      ...d,
                      actividades: d.actividades.map((a) => {
                        const c = coords.get(a.id)
                        return c ? { ...a, ...c, coordsVerificadas: true } : a
                      }),
                    })),
                  }
                : prev
            )
          }
        }
        hechoRef.current = tripId
      } catch {
        // Background best-effort: ignoramos errores (y la cancelación).
      }
    })()

    return () => controller.abort()
  }, [tripId, setTrip])
}
