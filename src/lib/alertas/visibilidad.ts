/**
 * Regreso a la página tras una ausencia larga (pestaña oculta o teléfono
 * bloqueado). Mientras tanto el navegador no vigila: al volver, el modo en
 * vivo espera una lectura nueva del GPS y vuelve a vigilar desde ese momento,
 * en vez de avisar de «200 min tarde» por cosas que quizá ya hiciste.
 *
 * Almacén externo para useSyncExternalStore: el valor se lee en el mismo
 * render que el reloj de la pantalla (useAhora también escucha
 * visibilitychange), así nunca se evalúa con lo de antes de irse.
 */

/** Ausencia a partir de la cual, al volver, se vigila de nuevo desde cero. */
export const AUSENCIA_LARGA_MS = 2 * 60_000

let ocultaDesde = 0
let regreso = 0
const oyentes = new Set<() => void>()

function alCambiarVisibilidad(): void {
  const ahora = Date.now()
  if (document.visibilityState === 'hidden') {
    if (ocultaDesde === 0) ocultaDesde = ahora
    return
  }
  const larga = ocultaDesde > 0 && ahora - ocultaDesde >= AUSENCIA_LARGA_MS
  ocultaDesde = 0
  if (!larga) return
  regreso = ahora
  for (const aviso of oyentes) aviso()
}

export function suscribirRegreso(aviso: () => void): () => void {
  if (oyentes.size === 0) {
    document.addEventListener('visibilitychange', alCambiarVisibilidad)
    if (document.visibilityState === 'hidden' && ocultaDesde === 0) {
      ocultaDesde = Date.now()
    }
  }
  oyentes.add(aviso)
  return () => {
    oyentes.delete(aviso)
    if (oyentes.size === 0) {
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
    }
  }
}

/** ms del último regreso tras una ausencia larga (0 si no hubo). */
export const leerRegreso = (): number => regreso
export const regresoEnServidor = (): number => 0
