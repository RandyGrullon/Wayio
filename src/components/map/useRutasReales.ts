'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Day } from '@/types/trip'
import type { Activity } from '@/types/activity'

/**
 * Rutas reales por calles entre las paradas de cada día (POST /api/ruta).
 *
 * Devuelve un mapa clave-de-tramo → geometría y modo. Mientras llegan (o si
 * el servicio falla) el mapa dibuja arcos provisionales. Las rutas se guardan
 * en memoria y en sessionStorage para no pedirlas otra vez al cambiar de día,
 * de tema o al volver a la página.
 *
 * Con Geoapify (WAYIO_GEO_PROVEEDOR = 'geoapify') cada tramo cuesta un
 * crédito: con `enPausa` (la geocodificación de fondo aún mueve paradas) no
 * se piden rutas, porque los tramos con las coordenadas de la IA se tirarían
 * y se volverían a cobrar en cuanto llegasen las verificadas. Con OSRM, que
 * es gratis, se piden como siempre.
 */

export type ModoTramo = 'pie' | 'auto' | 'directo'

export interface RutaTramo {
  coords: [number, number][]
  modo: ModoTramo
  /** Metros y segundos de la ruta real (o estimados). */
  distancia: number
  duracion: number
}

interface TramoPedido {
  clave: string
  desde: [number, number]
  hasta: [number, number]
  modo?: ModoTramo
}

// v2: con Geoapify cambian las geometrías; se ignoran las guardadas con v1.
const CLAVE_SESION = 'wayio:rutas:v2'
const CLAVE_SESION_ANTIGUA = 'wayio:rutas:v1'
const MAX_EN_SESION = 400
const POR_PETICION = 60

/** Lo fija next.config.ts al compilar; nunca expone la clave. */
const RUTAS_DE_PAGO = process.env.WAYIO_GEO_PROVEEDOR === 'geoapify'

const memoria = new Map<string, RutaTramo>()
let sesionCargada = false

function cargarSesion(): void {
  if (sesionCargada || typeof window === 'undefined') return
  sesionCargada = true
  try {
    window.sessionStorage.removeItem(CLAVE_SESION_ANTIGUA)
    const raw = window.sessionStorage.getItem(CLAVE_SESION)
    if (!raw) return
    const datos = JSON.parse(raw) as Record<string, RutaTramo>
    for (const [k, v] of Object.entries(datos)) memoria.set(k, v)
  } catch {
    // sessionStorage no disponible o datos corruptos: se ignoran.
  }
}

function guardarSesion(): void {
  try {
    const entradas = [...memoria.entries()].slice(-MAX_EN_SESION)
    window.sessionStorage.setItem(
      CLAVE_SESION,
      JSON.stringify(Object.fromEntries(entradas))
    )
  } catch {
    // Cuota llena o modo privado: la caché en memoria basta.
  }
}

const tieneCoords = (a: Pick<Activity, 'lat' | 'lng'>): boolean =>
  Number.isFinite(a.lat) &&
  Number.isFinite(a.lng) &&
  !(a.lat === 0 && a.lng === 0)

const fmt = (n: number): string => n.toFixed(5)

/** Clave estable de un tramo (coordenadas redondeadas a ~1 m + modo forzado). */
export function claveTramo(
  a: Pick<Activity, 'lat' | 'lng'>,
  b: Pick<Activity, 'lat' | 'lng'>,
  modo?: ModoTramo
): string {
  return `${fmt(a.lng)},${fmt(a.lat)}>${fmt(b.lng)},${fmt(b.lat)}${modo ? `|${modo}` : ''}`
}

/** ¿El tramo va por mar (escala de crucero)? Entonces no hay calles. */
export function modoForzado(
  a: Activity,
  b: Activity,
  crucero: boolean
): ModoTramo | undefined {
  return crucero && (a.puertoCrucero || b.puertoCrucero) ? 'directo' : undefined
}

function tramosDe(dias: Day[], crucero: boolean): TramoPedido[] {
  const tramos: TramoPedido[] = []
  for (const dia of dias) {
    const pts = dia.actividades.filter(tieneCoords)
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      if (!a || !b) continue
      const modo = modoForzado(a, b, crucero)
      tramos.push({
        clave: claveTramo(a, b, modo),
        desde: [a.lng, a.lat],
        hasta: [b.lng, b.lat],
        ...(modo ? { modo } : {}),
      })
    }
  }
  return tramos
}

export function useRutasReales(
  dias: Day[],
  crucero: boolean,
  enPausa = false
): ReadonlyMap<string, RutaTramo> {
  const tramos = useMemo(() => tramosDe(dias, crucero), [dias, crucero])
  const firma = useMemo(() => tramos.map((t) => t.clave).join(';'), [tramos])
  const [version, setVersion] = useState(0)
  const esperar = enPausa && RUTAS_DE_PAGO

  useEffect(() => {
    cargarSesion()
    if (esperar) return
    const faltan = tramos.filter((t) => !memoria.has(t.clave))
    if (faltan.length === 0) return
    const control = new AbortController()
    void (async () => {
      for (let i = 0; i < faltan.length; i += POR_PETICION) {
        const lote = faltan.slice(i, i + POR_PETICION)
        try {
          const res = await fetch('/api/ruta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tramos: lote.map((t) => ({
                desde: t.desde,
                hasta: t.hasta,
                ...(t.modo ? { modo: t.modo } : {}),
              })),
            }),
            signal: control.signal,
          })
          if (!res.ok) return
          const { tramos: rutas } = (await res.json()) as {
            tramos: Array<RutaTramo & { fuente?: string }>
          }
          lote.forEach((t, k) => {
            const r = rutas[k]
            if (r && Array.isArray(r.coords) && r.coords.length >= 2) {
              memoria.set(t.clave, {
                coords: r.coords,
                modo: r.modo,
                distancia: r.distancia,
                duracion: r.duracion,
              })
            }
          })
          guardarSesion()
          if (!control.signal.aborted) setVersion((v) => v + 1)
        } catch {
          return // cancelado o sin red: quedan los arcos provisionales
        }
      }
    })()
    return () => control.abort()
    // `tramos` cambia con `firma`; la firma evita peticiones por re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, esperar])

  return useMemo(() => {
    void version
    // Solo afecta a los datos del mapa (no al HTML), así que leer la caché de
    // la sesión durante el render no provoca desajustes de hidratación.
    cargarSesion()
    const salida = new Map<string, RutaTramo>()
    for (const t of tramos) {
      const r = memoria.get(t.clave)
      if (r) salida.set(t.clave, r)
    }
    return salida
  }, [tramos, version])
}
