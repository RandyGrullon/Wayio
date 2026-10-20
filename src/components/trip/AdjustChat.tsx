'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Compass, LogIn, Pencil, Send, Undo2 } from 'lucide-react'
import type { Trip } from '@/types/trip'
import { Button, ButtonLink, Spinner } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Textarea } from '@/components/ui/Textarea'
import { esAuthRequired, hayLogin, urlLogin } from '@/lib/auth/irALogin'
import { cn } from '@/lib/utils/cn'
import {
  MENSAJE_TOPE_DIARIO,
  RUTA_PLANES,
  esCupoAgotado,
  esTopeDiario,
  segundosDeEspera,
  textoCupoAgotado,
  textoEspera,
} from './limitesIA'

export interface MensajeAjuste {
  id: string
  rol: 'viajero' | 'wayio'
  texto: string
  /** Respuesta de error (no cambió el itinerario). */
  error?: boolean
  /** El ajuste no está disponible: se ofrece editar a mano. */
  manual?: boolean
  /** La sesión se cerró (401): se ofrece iniciar sesión. */
  login?: boolean
  /** Se agotó el cupo del mes (402 cupo_agotado): se ofrece «Ver planes». */
  planes?: boolean
}

interface AdjustChatProps {
  trip: Trip
  /** Ajuste aplicado: el viaje nuevo y el resumen de la IA. */
  onAdjusted: (trip: Trip, resumenCambios: string) => void
  /** Historial (vive fuera para no perderse al cerrar el panel). */
  historial?: MensajeAjuste[]
  onMensaje?: (mensaje: MensajeAjuste) => void
  puedeDeshacer?: boolean
  onDeshacer?: () => void
  /** Si la IA no está disponible, cambiar a la edición manual. */
  onEditarManual?: () => void
  /**
   * Ruta a la que volver tras iniciar sesión (401). Por defecto el paso
   * itinerario del planificador, que guarda el viaje en sessionStorage.
   */
  loginRedirect?: string
  className?: string
}

interface RespuestaAjuste {
  trip?: Trip
  resumenCambios?: string
  error?: string
  code?: string
  motivo?: string
  retryAfter?: number
}

const SUGERENCIAS = [
  'Hazlo más relajado',
  'Añade un día de playa',
  'Más barato',
  'Más actividades culturales',
  'Menos traslados',
] as const

const MAX_INSTRUCCION = 500

let contador = 0
const idMensaje = () => `ajuste-${Date.now().toString(36)}-${(contador += 1)}`

/**
 * Conversación «Ajustar con IA» (docs/DISENO.md §6.5): sugerencias, historial
 * (burbujas propias en tinta, respuestas en superficie con el resumen del
 * cambio) y «Deshacer último ajuste». POST /api/adjust { trip, instruccion }.
 * Con el cupo del mes agotado (402 cupo_agotado) muestra el mensaje del
 * servidor con «Ver planes» y deja la edición a mano.
 */
export function AdjustChat({
  trip,
  onAdjusted,
  historial: historialExterno,
  onMensaje,
  puedeDeshacer = false,
  onDeshacer,
  onEditarManual,
  loginRedirect = '/planificar?paso=itinerario',
  className,
}: AdjustChatProps) {
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(false)
  const [historialLocal, setHistorialLocal] = useState<MensajeAjuste[]>([])
  const historial = historialExterno ?? historialLocal
  const finRef = useRef<HTMLDivElement | null>(null)

  const agregar = (m: MensajeAjuste) => {
    if (onMensaje) onMensaje(m)
    else setHistorialLocal((h) => [...h, m])
  }

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'nearest' })
  }, [historial.length, cargando])

  const enviar = async (instruccion: string) => {
    const limpia = instruccion.trim().slice(0, MAX_INSTRUCCION)
    if (limpia.length < 2 || cargando) return
    agregar({ id: idMensaje(), rol: 'viajero', texto: limpia })
    setTexto('')
    setCargando(true)
    try {
      const res = await fetch('/api/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip, instruccion: limpia }),
      })
      const data = (await res.json().catch(() => ({}))) as RespuestaAjuste
      if (res.ok && data.trip) {
        const resumen =
          data.resumenCambios?.trim() || 'Listo, ajusté tu itinerario.'
        onAdjusted(data.trip, resumen)
        agregar({ id: idMensaje(), rol: 'wayio', texto: resumen })
        return
      }
      // Sin sesión (401): el itinerario sigue en sessionStorage y el login
      // vuelve aquí. Sin Supabase no hay login: queda la edición a mano.
      if (esAuthRequired(res.status, data)) {
        const conLogin = hayLogin()
        agregar({
          id: idMensaje(),
          rol: 'wayio',
          error: true,
          ...(conLogin ? { login: true } : { manual: true }),
          texto: conLogin
            ? 'Inicia sesión para ajustar tu viaje con IA. Tu itinerario te espera aquí.'
            : 'Ajustar con IA no está disponible ahora mismo. Puedes editar tu itinerario a mano.',
        })
        return
      }
      // Cupo del plan Gratis agotado: reintentar no sirve hasta que se
      // renueve; se ofrecen los planes y la edición a mano.
      if (res.status === 402 || esCupoAgotado(data)) {
        agregar({
          id: idMensaje(),
          rol: 'wayio',
          error: true,
          manual: true,
          planes: true,
          texto: textoCupoAgotado(data, 'ajustar'),
        })
        return
      }
      // Tope diario de Wayio: el servidor responde 503 ia_no_disponible
      // (motivo tope_diario) y se ofrece editar a mano; un 429 con ese code
      // se trata igual por si acaso.
      if (esTopeDiario(data)) {
        agregar({
          id: idMensaje(),
          rol: 'wayio',
          error: true,
          manual: true,
          texto: data.error ?? MENSAJE_TOPE_DIARIO,
        })
        return
      }
      if (res.status === 429) {
        const espera = segundosDeEspera(data, res)
        agregar({
          id: idMensaje(),
          rol: 'wayio',
          error: true,
          texto: espera
            ? `Hiciste muchos ajustes seguidos. Podrás volver a intentarlo ${textoEspera(espera)}.`
            : (data.error ??
              'Hiciste muchos ajustes seguidos. Espera un momento.'),
        })
        return
      }
      agregar({
        id: idMensaje(),
        rol: 'wayio',
        error: true,
        manual: data.code === 'ia_no_disponible',
        texto:
          data.error ?? 'No pudimos ajustar el itinerario. Inténtalo de nuevo.',
      })
    } catch {
      agregar({
        id: idMensaje(),
        rol: 'wayio',
        error: true,
        texto: 'No pudimos ajustar el itinerario. Revisa tu conexión.',
      })
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className={cn('flex min-h-0 flex-col gap-4', className)}>
      <div>
        <p className="text-label text-fg">Ideas rápidas</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SUGERENCIAS.map((s) => (
            <Chip
              key={s}
              size="sm"
              disabled={cargando}
              onClick={() => void enviar(s)}
            >
              {s}
            </Chip>
          ))}
        </div>
      </div>

      {historial.length > 0 || cargando ? (
        <div
          role="log"
          aria-live="polite"
          aria-label="Historial de ajustes"
          className="flex flex-col gap-3"
        >
          {historial.map((m) =>
            m.rol === 'viajero' ? (
              <p
                key={m.id}
                className="ml-8 self-end rounded-[16px_16px_4px_16px] bg-surface-inverse px-4 py-2.5 text-body-s text-fg-inverse dark:bg-tinta-800 dark:text-fg"
              >
                <span className="sr-only">Tú: </span>
                {m.texto}
              </p>
            ) : (
              <div
                key={m.id}
                className={cn(
                  'mr-8 self-start rounded-[16px_16px_16px_4px] border px-4 py-2.5 text-body-s',
                  // El cupo agotado no es un fallo: aviso informativo.
                  m.planes
                    ? 'border-info/30 bg-info-bg text-info-fg'
                    : m.error
                      ? 'border-danger/30 bg-danger-bg text-danger-fg'
                      : 'border-border bg-surface text-fg'
                )}
              >
                <p className="flex gap-2">
                  <Compass
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span>
                    <span className="sr-only">Wayio: </span>
                    {m.texto}
                  </span>
                </p>
                {m.planes || (m.manual && onEditarManual) ? (
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                    {m.planes ? (
                      <ButtonLink
                        href={RUTA_PLANES}
                        variant="link"
                        size="sm"
                        iconEnd={<ArrowRight />}
                      >
                        Ver planes
                      </ButtonLink>
                    ) : null}
                    {m.manual && onEditarManual ? (
                      <Button
                        variant="link"
                        size="sm"
                        icon={<Pencil />}
                        onClick={onEditarManual}
                      >
                        Editar a mano
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {m.login ? (
                  <ButtonLink
                    href={urlLogin(loginRedirect)}
                    variant="link"
                    size="sm"
                    icon={<LogIn />}
                    className="mt-1.5"
                  >
                    Iniciar sesión
                  </ButtonLink>
                ) : null}
              </div>
            )
          )}
          {cargando ? (
            <p className="mr-8 inline-flex items-center gap-2 self-start rounded-[16px_16px_16px_4px] border border-border bg-surface px-4 py-2.5 text-body-s text-fg-muted">
              <Spinner />
              Ajustando tu viaje… puede tardar unos segundos.
            </p>
          ) : null}
          <div ref={finRef} />
        </div>
      ) : null}

      {puedeDeshacer && onDeshacer ? (
        <Button
          variant="outline"
          size="sm"
          icon={<Undo2 />}
          className="self-start"
          disabled={cargando}
          onClick={onDeshacer}
        >
          Deshacer último ajuste
        </Button>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void enviar(texto)
        }}
        className="flex flex-col gap-3"
      >
        <Textarea
          label="¿Qué quieres cambiar?"
          value={texto}
          maxLength={MAX_INSTRUCCION}
          disabled={cargando}
          placeholder="Ej.: añade un mercado local el día 2 y baja el presupuesto"
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault()
              void enviar(texto)
            }
          }}
        />
        <Button
          type="submit"
          icon={<Send />}
          loading={cargando}
          loadingText="Ajustando…"
          disabled={texto.trim().length < 2}
          className="self-end"
        >
          Ajustar
        </Button>
      </form>
    </div>
  )
}
