/**
 * Trazado del viaje con las fases reales del SSE (spec §6.3), compartido por
 * el planificador (CreateTripScreen) y «Otra versión» en las versiones
 * (PackagesScreen), para que ambos manejen igual los errores:
 *
 * - Cupo del mes agotado (402 cupo_agotado): el texto del servidor y «Ver
 *   planes», sin reintento (generarViaje no lo repite ni cae a POST
 *   /api/generate).
 * - Límite de la cuenta (429) con espera: cuánto falta; tope diario de IA: el
 *   texto del servidor (ver `mensajeDeFallo`).
 * - Modo mantenimiento (/api/config): ni se llama a la IA; si el servidor
 *   responde 503 code 'mantenimiento' a mitad, se marca y se avisa igual.
 * - 400 con errores por campo: a `onCampos` (el formulario los pinta); sin
 *   él, se muestran como error del trazado.
 *
 * «Otra versión» traza con `noCache` (se salta la caché del servidor, como
 * la web) y «Reintentar» lo conserva: sin él, el reintento podría devolver
 * el mismo viaje de la caché.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  esMantenimiento,
  marcarMantenimiento,
  useMantenimiento,
} from '../../hooks/useConfigRemota'
import {
  cupoAgotadoDe,
  datosDeLimite,
  mensajeDeLimite,
} from '../../lib/api/limites'
import {
  ErrorGeneracion,
  MENSAJE_GENERICO,
  type Fase,
} from '../../lib/api/stream'
import type { GenerateResult } from '../../types/planning'
import {
  aPayload,
  erroresDelServidor,
  type ErroresFormulario,
  type FormularioViaje,
} from './formulario'
import { generarViaje } from './generar'

/**
 * Texto del error de trazado. Tope diario de IA → el del servidor; límite de
 * la cuenta (429) con espera → cuánto falta («Vuelve a intentarlo en 40
 * min.» o «… en 3 horas.»), para no gastar reintentos en balde.
 */
export function mensajeDeFallo(e: unknown): string {
  if (!(e instanceof Error) || !e.message) return MENSAJE_GENERICO
  if (e instanceof ErrorGeneracion) {
    const limite = mensajeDeLimite(
      {
        status: e.status,
        code: e.code,
        data: e.data,
        retryAfter: e.retryAfter,
        mensaje: e.message,
      },
      'Has trazado varios viajes seguidos.'
    )
    if (limite) return limite
  }
  return e.message
}

export interface Trazado {
  /** Formulario tal cual lo dio la pantalla (antes de `aPayload`). */
  form: FormularioViaje
  /** «Otra versión»: se salta la caché (y «Reintentar» lo conserva). */
  noCache: boolean
  fase: Fase | null
  label: string
  inicio: number
  error: string | null
  /** El error es el cupo del mes agotado: «Ver planes», sin reintento. */
  cupoAgotado: boolean
}

interface Opciones {
  /** Llegaron las 3 versiones; `payload` es el formulario enviado. */
  onListo: (result: GenerateResult, payload: FormularioViaje) => void
  /** 400 con errores por campo (si se omite, se muestran como error). */
  onCampos?: ((campos: ErroresFormulario) => void) | undefined
  /** Mantenimiento: no se llamó a la IA o el servidor respondió 503. */
  onMantenimiento: () => void
}

export interface UsoTrazado {
  /** null = no hay trazado en curso ni error que mostrar. */
  trazado: Trazado | null
  trazar: (
    form: FormularioViaje,
    opciones?: { noCache?: boolean }
  ) => Promise<void>
  /** «Reintentar» tras un error, con el mismo `noCache`. */
  reintentar: () => void
  /** Aborta la petición en curso y cierra la pantalla de carga. */
  cancelar: () => void
  /** Cierra la pantalla de carga (p. ej. «Editar datos» tras un error). */
  cerrar: () => void
}

export function useTrazado({
  onListo,
  onCampos,
  onMantenimiento,
}: Opciones): UsoTrazado {
  const enMantenimiento = useMantenimiento().activo
  const [trazado, setTrazado] = useState<Trazado | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Los callbacks cambian en cada render; `trazar` usa siempre los últimos.
  const callbacks = useRef<Opciones>({ onListo, onCampos, onMantenimiento })
  useEffect(() => {
    callbacks.current = { onListo, onCampos, onMantenimiento }
  })

  useEffect(() => () => abortRef.current?.abort(), [])

  const trazar = useCallback(
    async (
      form: FormularioViaje,
      { noCache = false }: { noCache?: boolean } = {}
    ): Promise<void> => {
      abortRef.current?.abort()
      // Mantenimiento: ni se intenta (el servidor respondería 503).
      if (enMantenimiento) {
        setTrazado(null)
        callbacks.current.onMantenimiento()
        return
      }
      const control = new AbortController()
      abortRef.current = control
      const payload = aPayload(form)
      setTrazado({
        form,
        noCache,
        fase: null,
        label: 'Preparando tu viaje…',
        inicio: Date.now(),
        error: null,
        cupoAgotado: false,
      })
      try {
        const result = await generarViaje(payload, {
          signal: control.signal,
          noCache,
          onProgress: (e) =>
            setTrazado((t) =>
              t ? { ...t, fase: e.fase, label: e.label || t.label } : t
            ),
        })
        if (control.signal.aborted) return
        abortRef.current = null
        setTrazado(null)
        callbacks.current.onListo(result, payload)
      } catch (e) {
        if (control.signal.aborted) return
        if (e instanceof ErrorGeneracion && e.cancelado) return
        abortRef.current = null
        const campos =
          e instanceof ErrorGeneracion ? erroresDelServidor(e.data) : {}
        const alFormulario = callbacks.current.onCampos
        if (alFormulario && Object.keys(campos).length > 0) {
          // Errores de validación del servidor: de vuelta al formulario.
          setTrazado(null)
          alFormulario(campos)
          return
        }
        // Mantenimiento activado después de la última lectura (503): aviso
        // con el mensaje del servidor, sin reintentar.
        if (e instanceof ErrorGeneracion && esMantenimiento(e.status, e.code)) {
          marcarMantenimiento(e.message)
          setTrazado(null)
          callbacks.current.onMantenimiento()
          return
        }
        // Cupo del mes agotado (402): el texto del servidor y «Ver planes».
        // generarViaje ya no lo repite ni cae a POST /api/generate.
        const cupo = cupoAgotadoDe(datosDeLimite(e))
        setTrazado((t) =>
          t
            ? {
                ...t,
                error: cupo ? cupo.mensaje : mensajeDeFallo(e),
                cupoAgotado: cupo !== null,
              }
            : t
        )
      }
    },
    [enMantenimiento]
  )

  const reintentar = useCallback((): void => {
    if (!trazado) return
    void trazar(trazado.form, { noCache: trazado.noCache })
  }, [trazado, trazar])

  const cancelar = useCallback((): void => {
    abortRef.current?.abort()
    abortRef.current = null
    setTrazado(null)
  }, [])

  const cerrar = useCallback((): void => setTrazado(null), [])

  return { trazado, trazar, reintentar, cancelar, cerrar }
}
