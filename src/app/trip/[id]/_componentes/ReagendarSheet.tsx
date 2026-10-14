'use client'

import { useState } from 'react'
import { CalendarClock, Search } from 'lucide-react'
import type { Activity } from '@/types/activity'
import { Button, Spinner } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { ChipGroup } from '@/components/ui/Chip'
import { Sheet } from '@/components/ui/Modal'
import { formatHora12 } from '@/lib/utils/formatters'
import { horaDeMinutos, minutosDeHora } from '@/components/trip/tripUtils'
import type {
  HuecoLibre,
  PropuestaReagenda,
  ResultadoReagenda,
} from '@/hooks/useTrip'

type Paso =
  | { tipo: 'confirmar' }
  | { tipo: 'buscando' }
  | { tipo: 'propuesta'; propuesta: PropuestaReagenda }
  | { tipo: 'manual'; mensaje: string; huecos: HuecoLibre[] }
  | { tipo: 'error'; mensaje: string }

interface ReagendarSheetProps {
  actividad: Activity | null
  /** Día (1-based) donde está la actividad. */
  diaActual: number
  tripId: string | null
  onClose: () => void
  /** Marca la actividad como perdida (y la guarda). */
  marcarPerdida: (activityId: string) => Promise<void>
  /** Pide una nueva hora a /api/reschedule (useTrip().rescheduleActivity). */
  reagendar: (activityId: string, reason: string) => Promise<ResultadoReagenda>
  /** Aplica el cambio: mueve la actividad al día y la hora elegidos. */
  aceptar: (propuesta: PropuestaReagenda) => Promise<boolean>
}

const MOTIVOS = [
  { value: 'tarde', label: 'Llegué tarde' },
  { value: 'cerrado', label: 'Estaba cerrado' },
  { value: 'planes', label: 'Cambio de planes' },
  { value: 'otro', label: 'Otro motivo' },
] as const

const MOTIVO_OTRO = 'El viajero la perdió o no pudo asistir.'

const TEXTO_MOTIVO: Record<string, string> = {
  tarde: 'El viajero llegó tarde y se la perdió.',
  cerrado: 'El lugar estaba cerrado.',
  planes: 'El viajero cambió de planes.',
  otro: MOTIVO_OTRO,
}

function rango(h: HuecoLibre): string {
  return `Día ${h.dia} · ${formatHora12(h.desde)} – ${formatHora12(h.hasta)}`
}

/**
 * «Me la perdí» en 3 pasos (docs/DISENO.md §6.6): «¿Te la perdiste?» →
 * «Buscando nueva hora…» → sugerencia con «Aceptar» y «Descartar». Usa el
 * contrato nuevo de /api/reschedule (día destino, nota y huecos) a través de
 * useTrip. Si la IA no está disponible, ofrece mover la actividad a uno de
 * los huecos libres.
 */
export function ReagendarSheet(props: ReagendarSheetProps) {
  return (
    <Sheet
      open={props.actividad !== null}
      onClose={props.onClose}
      title="Reagendar actividad"
      className="mx-auto max-w-[560px] sm:mb-4 sm:rounded-sheet"
    >
      {props.actividad ? (
        <Pasos
          key={props.actividad.id}
          {...props}
          actividad={props.actividad}
        />
      ) : null}
    </Sheet>
  )
}

function Pasos({
  actividad,
  diaActual,
  tripId,
  onClose,
  marcarPerdida,
  reagendar,
  aceptar,
}: ReagendarSheetProps & { actividad: Activity }) {
  const [paso, setPaso] = useState<Paso>({ tipo: 'confirmar' })
  const [motivo, setMotivo] = useState<string>('tarde')
  const [hueco, setHueco] = useState<string>('')
  const [aplicando, setAplicando] = useState(false)

  const buscar = async () => {
    if (!tripId) {
      setPaso({
        tipo: 'error',
        mensaje: 'Este viaje todavía no está guardado en tu cuenta.',
      })
      return
    }
    setPaso({ tipo: 'buscando' })
    await marcarPerdida(actividad.id)
    const r = await reagendar(actividad.id, TEXTO_MOTIVO[motivo] ?? MOTIVO_OTRO)
    if (r.ok) {
      setPaso({
        tipo: 'propuesta',
        propuesta: {
          activity: r.activity,
          dia: r.dia,
          diaOriginal: r.diaOriginal,
          nota: r.nota,
        },
      })
      return
    }
    const { huecos } = r
    if (huecos.length > 0) {
      setHueco(`${huecos[0]?.dia}-${huecos[0]?.desde}`)
      setPaso({
        tipo: 'manual',
        mensaje:
          r.error ??
          'La sugerencia automática no está disponible. Elige un hueco libre.',
        huecos,
      })
      return
    }
    setPaso({
      tipo: 'error',
      mensaje:
        r.code === 'network'
          ? 'No pudimos buscar una nueva hora. Revisa tu conexión e inténtalo de nuevo.'
          : r.code === 'sin_huecos'
            ? (r.error ??
              'No quedan huecos libres en tu viaje. La guardamos en «Para tu próxima visita».')
            : (r.error ??
              'No pudimos buscar una nueva hora. Inténtalo de nuevo.'),
    })
  }

  const aplicar = async (propuesta: PropuestaReagenda) => {
    setAplicando(true)
    const ok = await aceptar(propuesta)
    setAplicando(false)
    if (ok) onClose()
  }

  const moverAHueco = (huecos: HuecoLibre[]) => {
    const elegido = huecos.find((h) => `${h.dia}-${h.desde}` === hueco)
    if (!elegido) return
    const ini = minutosDeHora(elegido.desde) ?? 9 * 60
    const max = minutosDeHora(elegido.hasta) ?? ini + 60
    const fin = Math.min(
      max,
      ini + Math.max(15, actividad.duracionMinutos || 60)
    )
    void aplicar({
      activity: {
        ...actividad,
        horaInicio: horaDeMinutos(ini),
        horaFin: horaDeMinutos(fin),
        duracionMinutos: fin - ini,
      },
      dia: elegido.dia,
      diaOriginal: diaActual,
      nota: '',
    })
  }

  if (paso.tipo === 'confirmar') {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <p className="kicker">Paso 1 de 3</p>
          <p className="mt-2 font-display text-h3 text-fg">¿Te la perdiste?</p>
          <p className="mt-2 text-body-s text-fg-muted">
            Marcaremos «{actividad.nombre}» como perdida y buscaremos un hueco
            libre en tu viaje.
          </p>
        </div>
        <ChipGroup
          label="Qué pasó"
          options={MOTIVOS.map((m) => ({ value: m.value, label: m.label }))}
          value={motivo}
          onValueChange={(v) => setMotivo(typeof v === 'string' ? v : 'otro')}
          size="sm"
        />
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button icon={<Search />} onClick={() => void buscar()}>
            Buscar nueva hora
          </Button>
        </div>
      </div>
    )
  }

  if (paso.tipo === 'buscando') {
    return (
      <div role="status" className="flex flex-col items-start gap-3 py-2">
        <p className="kicker">Paso 2 de 3</p>
        <p className="inline-flex items-center gap-3 font-display text-h3 text-fg">
          <Spinner className="size-5" />
          Buscando nueva hora…
        </p>
        <p className="text-body-s text-fg-muted">
          Revisamos los huecos libres de tu itinerario. Puede tardar unos
          segundos.
        </p>
      </div>
    )
  }

  if (paso.tipo === 'propuesta') {
    const { propuesta } = paso
    return (
      <div className="flex flex-col gap-5">
        <div>
          <p className="kicker">Paso 3 de 3</p>
          <p className="mt-2 font-display text-h3 text-fg">Te proponemos</p>
        </div>
        <div className="flex items-start gap-3 rounded-card border border-border bg-surface p-4">
          <CalendarClock
            aria-hidden="true"
            strokeWidth={1.75}
            className="mt-0.5 size-5 shrink-0 text-accent"
          />
          <div>
            <p className="text-title text-fg">{actividad.nombre}</p>
            <p className="mt-1 text-body-s text-fg-muted tnum">
              Día {propuesta.dia} ·{' '}
              {formatHora12(propuesta.activity.horaInicio)} –{' '}
              {formatHora12(propuesta.activity.horaFin)}
            </p>
            {propuesta.nota ? (
              <p className="mt-2 text-body-s text-fg-muted">{propuesta.nota}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={aplicando}>
            Descartar
          </Button>
          <Button
            loading={aplicando}
            loadingText="Guardando…"
            onClick={() => void aplicar(propuesta)}
          >
            Aceptar
          </Button>
        </div>
      </div>
    )
  }

  if (paso.tipo === 'manual') {
    const { huecos } = paso
    return (
      <div className="flex flex-col gap-5">
        <div>
          <p className="kicker">Paso 3 de 3</p>
          <p className="mt-2 font-display text-h3 text-fg">Elige un hueco</p>
          <p className="mt-2 text-body-s text-fg-muted">{paso.mensaje}</p>
        </div>
        <ChipGroup
          label="Huecos libres"
          options={huecos.slice(0, 8).map((h) => ({
            value: `${h.dia}-${h.desde}`,
            label: rango(h),
          }))}
          value={hueco}
          onValueChange={(v) => setHueco(typeof v === 'string' ? v : '')}
          size="sm"
        />
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={aplicando}>
            Dejar como perdida
          </Button>
          <Button
            loading={aplicando}
            loadingText="Guardando…"
            disabled={!hueco}
            onClick={() => moverAHueco(huecos)}
          >
            Mover aquí
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <Callout tone="warning" title="No encontramos una nueva hora">
        {paso.mensaje}
      </Callout>
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
        <Button variant="tinta" onClick={() => void buscar()}>
          Reintentar
        </Button>
      </div>
    </div>
  )
}
