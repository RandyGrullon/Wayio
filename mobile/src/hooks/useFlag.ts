import { useConfigRemota } from './useConfigRemota'

/**
 * ¿Está activo el feature flag `clave` (tabla feature_flags, plataforma
 * mobile o 'all')? Claves del seed (supabase/schema.sql): 'video_analysis',
 * 'group_trips', 'live_tracking', 'paywall' y 'surprise_destination'.
 *
 * Mientras /api/config no responde, si falla o si la clave no existe se
 * devuelve `porDefecto` (true: el seed los trae todos activos y un fallo de
 * red no debe esconder funciones). Para ocultar algo hasta confirmar, pasa
 * `false`.
 *
 * Ejemplo: `const conMuroDePago = useFlag('paywall')`.
 */
export function useFlag(clave: string, porDefecto = true): boolean {
  const flag = useConfigRemota().flags[clave]
  return flag ? flag.enabled : porDefecto
}
