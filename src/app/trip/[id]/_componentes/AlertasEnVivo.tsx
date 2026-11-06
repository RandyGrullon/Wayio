'use client'

import { useEffect, useId, useRef } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Clock,
  Compass,
  SkipForward,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Activity } from '@/types/activity'
import type { UserLocation } from '@/types/geofencing'
import type { Day } from '@/types/trip'
import { RUTA_PLANES } from '@/components/trip/limitesIA'
import { Button, ButtonLink, IconButton, Spinner } from '@/components/ui/Button'
import { Modal, Sheet } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useAlertasViaje } from '@/hooks/useAlertasViaje'
import type { AlertaRetraso } from '@/hooks/useAlertasViaje'
import { usePro } from '@/hooks/usePro'
import type { MensajeAlerta } from '@/lib/alertas/mensaje'
import { cn } from '@/lib/utils/cn'

export interface AlertasEnVivoProps {
  /** Id del viaje (el de la ruta). */
  tripId: string
  /** Día de HOY (solo durante el viaje); sin él no se hace nada. */
  dia: Day | null | undefined
  /** Posición del GPS solo con la ubicación activa; sin ella no se hace nada. */
  ubicacion: UserLocation | null | undefined
  /** Reloj de la pantalla en vivo (useAhora). */
  ahora: Date | null
  esCrucero?: boolean
  /**
   * true mientras otra hoja ocupa la pantalla (embarque, reagendar): las
   * alertas que bloquean (niveles 3 y 4) esperan a que se cierre.
   */
  pausada?: boolean
  /** «Mover a otro día» (abre «Me la perdí»). Sin él no se ofrece. */
  onMover?: ((actividad: Activity) => void) | undefined
  /**
   * Quita la actividad de hoy y la deja para la próxima visita. Si devuelve
   * false (no se pudo guardar) no se muestra el aviso de éxito.
   */
  onSaltar?:
    | ((actividad: Activity) => boolean | void | Promise<boolean | void>)
    | undefined
}

/** Como mucho, este número de toasts de llegada de una misma lectura. */
const MAX_TOASTS_LLEGADA = 2

/**
 * Avisos al llegar y alertas de demora del viaje en vivo (la versión web del
 * modo en vivo de la app), solo con la página abierta y el GPS activo:
 *
 * - Llegada o salida de una parada → toast «Llegaste a…» / «Terminaste…».
 * - Nivel 1 (1-15 min tarde) → toast discreto, una sola vez.
 * - Nivel 2 (16-30) → tarjeta que no bloquea: «Mover a otro día» o «Seguir
 *   igual».
 * - Nivel 3 (31-50) → hoja con la sugerencia (con IA en Pro; si falla, un
 *   texto fijo) y, si propone quitar algo de hoy, el botón para hacerlo.
 * - Nivel 4 (más de 50) → diálogo para decidir: mover, saltar o seguir igual.
 *   Cerrarlo equivale a «Seguir igual».
 * - El embarque del crucero (nivel 5) lo sigue pintando VistaViaje.
 */
export function AlertasEnVivo({
  tripId,
  dia,
  ubicacion,
  ahora,
  esCrucero = false,
  pausada = false,
  onMover,
  onSaltar,
}: AlertasEnVivoProps) {
  const { toast, success } = useToast()
  const { activo, alerta, mensaje, recomendada, eventos, descartar, omitir } =
    useAlertasViaje({
      tripId,
      actividades: dia?.actividades,
      ubicacion,
      ahora,
      esCrucero,
    })

  // Llegadas y salidas: cada una, un solo toast.
  const ultimoVisto = useRef(0)
  useEffect(() => {
    const nuevos = eventos
      .filter((e) => e.seq > ultimoVisto.current)
      .sort((a, b) => a.seq - b.seq)
    const ultimo = nuevos.at(-1)
    if (!ultimo) return
    ultimoVisto.current = ultimo.seq
    for (const e of nuevos.slice(-MAX_TOASTS_LLEGADA)) {
      if (e.tipo === 'llegada') success(`Llegaste a ${e.nombre}`)
      else toast({ message: `Terminaste ${e.nombre}` })
    }
  }, [eventos, success, toast])

  // Nivel 1: toast discreto, una vez (se da por cerrado al mostrarlo).
  const avisados = useRef(new Set<string>())
  useEffect(() => {
    if (!alerta || alerta.nivel !== 1) return
    if (avisados.current.has(alerta.clave)) return
    avisados.current.add(alerta.clave)
    toast({
      message: 'Vas un poco justo de tiempo',
      description: `${alerta.retrasoMinutos} min tarde para ${alerta.actividad.nombre}. Sin prisa: aún llegas.`,
      duration: 8000,
    })
    descartar(alerta.clave)
  }, [alerta, descartar, toast])

  if (!activo) return null

  const mover = (a: AlertaRetraso) => {
    descartar(a.clave)
    // En el nivel 4 la decisión es final: no se vuelve a preguntar.
    if (a.nivel === 4) omitir(a.actividad.id)
    onMover?.(a.actividad)
  }

  const quitar = (a: AlertaRetraso, actividad: Activity) => {
    if (!onSaltar) return
    descartar(a.clave)
    if (a.nivel === 4) omitir(a.actividad.id)
    void Promise.resolve(onSaltar(actividad))
      .then((ok) => {
        if (ok === false) return
        success(
          `Quitamos ${actividad.nombre} de hoy. Quedó en «Para tu próxima visita».`
        )
      })
      .catch(() => undefined)
  }

  const seguirIgual = (a: AlertaRetraso) => {
    descartar(a.clave)
    if (a.nivel === 4) omitir(a.actividad.id)
  }

  const nivel = alerta?.nivel ?? 0

  return (
    <>
      {/* Anuncio para lectores de pantalla, sin los minutos (que cambian
          cada minuto y repetirían el aviso). Los niveles 3 y 4 son diálogos
          y se anuncian al abrirse; el 1 va en un toast. */}
      <p className="sr-only" aria-live="polite">
        {alerta && nivel === 2
          ? `Vas tarde a ${alerta.actividad.nombre}. Puede que no llegues a todo hoy.`
          : ''}
      </p>

      {alerta && nivel === 2 ? (
        <TarjetaRetraso
          key={alerta.clave}
          alerta={alerta}
          onMover={onMover ? () => mover(alerta) : undefined}
          onSeguir={() => seguirIgual(alerta)}
        />
      ) : null}

      {alerta && nivel === 3 ? (
        <HojaSugerencia
          key={alerta.clave}
          open={!pausada}
          alerta={alerta}
          mensaje={mensaje}
          recomendada={onSaltar ? recomendada : null}
          onQuitar={(act) => quitar(alerta, act)}
          onMover={onMover ? () => mover(alerta) : undefined}
          onSeguir={() => seguirIgual(alerta)}
        />
      ) : null}

      {alerta && nivel === 4 ? (
        <DialogoUrgente
          key={alerta.clave}
          open={!pausada}
          alerta={alerta}
          onMover={onMover ? () => mover(alerta) : undefined}
          onSaltar={
            onSaltar ? () => quitar(alerta, alerta.actividad) : undefined
          }
          onSeguir={() => seguirIgual(alerta)}
        />
      ) : null}
    </>
  )
}

// ─── Nivel 2: tarjeta que no bloquea ───────────────────────────────────────

function TarjetaRetraso({
  alerta,
  onMover,
  onSeguir,
}: {
  alerta: AlertaRetraso
  onMover?: (() => void) | undefined
  onSeguir: () => void
}) {
  const id = useId()
  const { actividad, retrasoMinutos } = alerta
  return (
    <div
      className={cn(
        'fixed inset-x-4 top-[calc(var(--spacing-header-sm)+0.75rem)] z-(--z-dropdown)',
        'md:top-auto md:right-auto md:bottom-6 md:left-6 md:w-[400px]'
      )}
      data-print="hide"
    >
      <div
        role="group"
        aria-labelledby={id}
        className="animate-rise rounded-card border border-border bg-surface p-5 shadow-card"
      >
        <div className="flex items-start gap-3">
          <Clock
            aria-hidden="true"
            strokeWidth={1.75}
            className="mt-0.5 size-5 shrink-0 text-warning"
          />
          <div className="min-w-0 flex-1">
            <p id={id} className="text-title text-fg tnum">
              Llevas {retrasoMinutos} min de retraso
            </p>
            <p className="mt-1 text-body-s text-fg-muted">
              {onMover
                ? `Puede que no llegues a todo hoy. ¿Movemos ${actividad.nombre} o sigues igual?`
                : `Vas tarde a ${actividad.nombre}. Puede que no llegues a todo hoy.`}
            </p>
          </div>
          <IconButton
            label="Cerrar aviso"
            size="icon-sm"
            className="-mt-1.5 -mr-2"
            onClick={onSeguir}
          >
            <X />
          </IconButton>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onSeguir}>
            Seguir igual
          </Button>
          {onMover ? (
            <Button
              variant="tinta"
              size="sm"
              icon={<CalendarDays />}
              onClick={onMover}
            >
              Mover a otro día
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─── Nivel 3: sugerencia (IA en Pro, texto fijo de respaldo) ──────────────

function HojaSugerencia({
  open,
  alerta,
  mensaje,
  recomendada,
  onQuitar,
  onMover,
  onSeguir,
}: {
  open: boolean
  alerta: AlertaRetraso
  mensaje: MensajeAlerta | null
  recomendada: Activity | null
  onQuitar: (actividad: Activity) => void
  onMover?: (() => void) | undefined
  onSeguir: () => void
}) {
  const cargando = mensaje === null
  const conIA = mensaje?.fuente === 'ia'
  const quitar = !cargando ? recomendada : null
  const ahorra = mensaje?.tiempoQueAhorra ?? 0

  return (
    <Sheet
      open={open}
      onClose={onSeguir}
      title={
        <span className="inline-flex items-center gap-2.5 tnum">
          <Clock
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-6 shrink-0 text-warning"
          />
          {alerta.retrasoMinutos} min de retraso
        </span>
      }
      className="mx-auto max-w-[560px] sm:mb-4 sm:rounded-sheet"
      footer={
        <>
          <Button variant="ghost" onClick={onSeguir}>
            Seguir con mi plan
          </Button>
          {quitar ? (
            <Button
              variant="primary"
              onClick={() => onQuitar(quitar)}
              aria-label={`Quitar de hoy: ${quitar.nombre}`}
              data-autofocus
            >
              Quitar de hoy
            </Button>
          ) : onMover ? (
            <Button
              variant="primary"
              icon={<CalendarDays />}
              onClick={onMover}
              data-autofocus
            >
              Mover a otro día
            </Button>
          ) : null}
        </>
      }
    >
      <p className="kicker inline-flex items-center gap-2">
        <Compass
          aria-hidden="true"
          strokeWidth={1.75}
          className="size-4 shrink-0"
        />
        {conIA ? 'Sugerencia con IA' : 'Sugerencia'}
      </p>
      <p className="mt-2 text-body-s text-fg-muted">
        Vas tarde a {alerta.actividad.nombre}.
      </p>

      <div className="mt-4" aria-live="polite" aria-busy={cargando}>
        {cargando ? (
          <p className="inline-flex items-center gap-3 text-body-s text-fg-muted">
            <Spinner className="size-5" />
            Buscando una alternativa para el resto del día…
          </p>
        ) : (
          <>
            <p className="text-body text-fg">{mensaje.mensajeAmigable}</p>
            {quitar ? (
              <div className="mt-4 rounded-card border border-border bg-surface-2 p-4">
                <p className="kicker">Recomendación</p>
                <p className="mt-1 text-title text-fg">
                  Quitar {quitar.nombre}
                  {ahorra > 0 ? ` te ahorra ${ahorra} min` : ' de hoy'}
                </p>
                {mensaje.razonSimple ? (
                  <p className="mt-1 text-body-s text-fg-muted">
                    {mensaje.razonSimple}
                  </p>
                ) : null}
              </div>
            ) : null}
            {mensaje.alternativa ? (
              <p className="mt-3 text-body-s text-fg-muted">
                {mensaje.alternativa}
              </p>
            ) : null}
            {conIA ? null : <AvisoPro />}
          </>
        )}
      </div>
    </Sheet>
  )
}

/** En Gratis el mensaje no es de la IA: se dice y se enlaza a los planes. */
function AvisoPro() {
  const { tier, loading } = usePro()
  if (loading || tier !== 'free') return null
  return (
    <p className="mt-3 flex flex-wrap items-baseline gap-x-2 text-body-s text-fg-muted">
      Con Pro, la IA analiza el resto de tu día y te propone qué mover.
      <ButtonLink
        href={RUTA_PLANES}
        variant="link"
        size="sm"
        iconEnd={<ArrowRight />}
      >
        Ver planes
      </ButtonLink>
    </p>
  )
}

// ─── Nivel 4: decidir ─────────────────────────────────────────────────────

interface Opcion {
  id: string
  icono: LucideIcon
  titulo: string
  detalle: string
  accion: () => void
}

function DialogoUrgente({
  open,
  alerta,
  onMover,
  onSaltar,
  onSeguir,
}: {
  open: boolean
  alerta: AlertaRetraso
  onMover?: (() => void) | undefined
  onSaltar?: (() => void) | undefined
  onSeguir: () => void
}) {
  const { actividad, retrasoMinutos } = alerta
  const opciones: Opcion[] = [
    ...(onMover
      ? [
          {
            id: 'mover',
            icono: CalendarDays,
            titulo: 'Mover a otro día',
            detalle: 'Buscamos un hueco libre en tu itinerario.',
            accion: onMover,
          },
        ]
      : []),
    ...(onSaltar
      ? [
          {
            id: 'saltar',
            icono: SkipForward,
            titulo: 'Saltar actividad',
            detalle:
              'La quitamos de hoy y la guardamos para tu próxima visita.',
            accion: onSaltar,
          },
        ]
      : []),
    {
      id: 'seguir',
      icono: ArrowRight,
      titulo: 'Seguir igual',
      detalle: 'Sin cambios: llegarás más tarde.',
      accion: onSeguir,
    },
  ]

  return (
    <Modal
      open={open}
      onClose={onSeguir}
      title={
        <span className="inline-flex items-center gap-2.5 tnum">
          <AlertTriangle
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-6 shrink-0 text-warning"
          />
          Vas {retrasoMinutos} min tarde a {actividad.nombre}
        </span>
      }
      description="Elige cómo seguir con el resto del día."
      className="mx-auto max-w-[560px] sm:mb-4 sm:rounded-sheet"
    >
      <p className="kicker text-warning-fg">Urgente</p>
      <ul className="mt-3 flex flex-col gap-3">
        {opciones.map((o, i) => {
          const Icono = o.icono
          const principal = i === 0
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={o.accion}
                data-autofocus={principal || undefined}
                className={cn(
                  'flex min-h-18 w-full items-center gap-4 rounded-card border p-4 text-left',
                  'transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  principal
                    ? 'border-surface-inverse bg-surface-inverse text-fg-inverse hover:bg-surface-inverse-hover'
                    : 'border-border-strong bg-surface text-fg hover:bg-surface-2'
                )}
              >
                <Icono
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-[22px] shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-title">{o.titulo}</span>
                  <span
                    className={cn(
                      'block text-caption',
                      principal ? 'opacity-80' : 'text-fg-muted'
                    )}
                  >
                    {o.detalle}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
