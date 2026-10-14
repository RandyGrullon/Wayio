import 'server-only'
import { cache } from 'react'
import { leerViajeCompartido } from '@/app/api/shared/_lib/compartido'
import type { Trip } from '@/types/trip'

/**
 * Lectura pública del viaje compartido para el Server Component, los
 * metadatos y la imagen OG: la misma lógica que GET /api/shared/[id] (RPC
 * get_shared_trip con la anon key; nunca grupo_link ni user_id), memoizada
 * por petición con React.cache.
 */

export type ViajeCompartido =
  | {
      estado: 'ok'
      trip: Trip
      destino: string
      fechaInicio: string
      fechaFin: string
    }
  | { estado: 'no_encontrado' }
  | { estado: 'no_disponible' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const obtenerCompartido = cache(
  async (id: string): Promise<ViajeCompartido> => {
    if (!UUID.test(id)) return { estado: 'no_encontrado' }
    try {
      const r = await leerViajeCompartido(id)
      if (r === 'no_disponible') return { estado: 'no_disponible' }
      if (!r || !Array.isArray(r.data?.dias)) return { estado: 'no_encontrado' }
      return {
        estado: 'ok',
        trip: r.data,
        destino: (r.destino ?? r.data.destino ?? '').trim() || 'Tu destino',
        fechaInicio: r.fecha_inicio ?? r.data.fechaInicio,
        fechaFin: r.fecha_fin ?? r.data.fechaFin,
      }
    } catch {
      return { estado: 'no_disponible' }
    }
  }
)
