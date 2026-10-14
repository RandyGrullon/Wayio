'use client'

import { useState } from 'react'
import type { DragEvent, KeyboardEvent } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import type { Day, Trip } from '@/types/trip'
import type { Activity, ActivityType } from '@/types/activity'
import { Button, IconButton, buttonClasses } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { ConfirmDialog } from '@/components/ui/Modal'
import { cn } from '@/lib/utils/cn'
import { ActivityItem } from './ActivityItem'
import { DayChapter } from './DayChapter'
import {
  TIPOS_ACTIVIDAD,
  TIPO_LABEL,
  ciudadDelDia,
  minutosEntre,
} from './tripUtils'

export interface EditableDaysProps {
  dias: Day[]
  /** Modo edición: controles de 44 px, editor en línea y «Listo». */
  editing: boolean
  onChange: (dias: Day[]) => void
  /** Moneda del viaje (importes y editor). */
  moneda?: string
  /** Datos del viaje: fechas de los capítulos, ciudad y analítica. */
  trip?: Pick<Trip, 'fechaInicio' | 'destino' | 'id'>
  /** Prefijo de los ids de los capítulos (anclas de los chips de día). */
  idPrefijo?: string
  resaltados?: ReadonlySet<string>
  claveResaltado?: number
  /** «Listo»: sale del modo edición (con confirmación si hay un borrador). */
  onTerminar?: () => void
  /** Actividades nuevas o con nombre/dirección cambiados (geocodificar). */
  onActividadesEditadas?: (ids: string[]) => void
  /** Entrada de las actividades con whileInView. */
  animar?: boolean
}

/** Id del botón «Listo» del aviso de edición (lo usa la barra de acciones). */
export const ID_LISTO_EDICION = 'wy-edicion-listo'

const TRIP_VACIO: Pick<Trip, 'fechaInicio' | 'destino' | 'id'> = {
  fechaInicio: '',
  destino: '',
  id: '',
}

function nuevoId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function nuevaActividad(): Activity {
  return {
    id: nuevoId(),
    nombre: '',
    descripcion: '',
    horaInicio: '09:00',
    horaFin: '10:00',
    duracionMinutos: 60,
    tipo: 'actividad',
    direccion: '',
    lat: 0,
    lng: 0,
    coordsVerificadas: false,
    radioGeofencingMetros: 150,
    precioEstimado: 0,
    reservaRequerida: false,
    reservaPagada: false,
    mejorHoraVisita: '',
    consejos: [],
    tiempoHastaSiguiente: 0,
    estado: 'pendiente',
    esPerdida: false,
  }
}

function clonar(dias: Day[]): Day[] {
  return dias.map((d) => ({ ...d, actividades: [...d.actividades] }))
}

/** Busca una actividad por id: [día, índice]. */
function ubicar(dias: Day[], id: string): [number, number] | null {
  for (let d = 0; d < dias.length; d++) {
    const i = dias[d]?.actividades.findIndex((a) => a.id === id) ?? -1
    if (i >= 0) return [d, i]
  }
  return null
}

/**
 * Itinerario por capítulos con modo edición (docs/DISENO.md §6.5):
 * - Aviso sticky «Modo edición · Listo».
 * - Por actividad: asa (arrastrar o flechas del teclado), subir, bajar,
 *   editar y borrar (con confirmación). Controles de 44 px.
 * - Editor en línea en una Card; cancelar una actividad nueva la elimina.
 * - «Listo» con un borrador abierto pide confirmación.
 * Fuera del modo edición pinta los capítulos de solo lectura.
 */
export function EditableDays({
  dias,
  editing,
  onChange,
  moneda = 'USD',
  trip = TRIP_VACIO,
  idPrefijo = 'dia',
  resaltados,
  claveResaltado = 0,
  onTerminar,
  onActividadesEditadas,
  animar = false,
}: EditableDaysProps) {
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Activity | null>(null)
  const [nuevaIdAbierta, setNuevaIdAbierta] = useState<string | null>(null)
  const [errorNombre, setErrorNombre] = useState<string | undefined>()
  const [porBorrar, setPorBorrar] = useState<{
    dia: number
    act: Activity
  } | null>(null)
  const [confirmarSalida, setConfirmarSalida] = useState(false)
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const [anuncio, setAnuncio] = useState('')

  const enfocarAsa = (id: string) => {
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-asa="${CSS.escape(id)}"]`)
        ?.focus()
    })
  }

  /**
   * Devuelve el foco a un control cercano cuando el que lo tenía desaparece
   * (borrar una actividad, cerrar el editor). Solo actúa si el foco quedó en
   * <body>: no le quita el foco a un diálogo que lo esté devolviendo.
   */
  const recolocarFoco = (selectores: string[], retrasoMs = 0) => {
    window.setTimeout(() => {
      const activo = document.activeElement
      if (activo && activo !== document.body) return
      for (const s of selectores) {
        const el = document.querySelector<HTMLElement>(s)
        if (el) {
          el.focus()
          return
        }
      }
    }, retrasoMs)
  }
  const selectorAsa = (id: string) => `[data-asa="${CSS.escape(id)}"]`
  const selectorAnadir = (dayIdx: number) => `[data-anadir="${dayIdx}"]`

  const anunciar = (copia: Day[], id: string) => {
    const pos = ubicar(copia, id)
    const act = pos ? copia[pos[0]]?.actividades[pos[1]] : undefined
    if (pos && act) {
      setAnuncio(
        `${act.nombre || 'Actividad'}: día ${pos[0] + 1}, posición ${pos[1] + 1}.`
      )
    }
  }

  const abrirEdicion = (act: Activity) => {
    setEditId(act.id)
    setDraft({ ...act })
    setErrorNombre(undefined)
  }

  const cerrarEditor = () => {
    setEditId(null)
    setDraft(null)
    setNuevaIdAbierta(null)
    setErrorNombre(undefined)
  }

  /** Cancelar: si la actividad era nueva, se elimina. */
  const cancelar = () => {
    const id = editId
    const pos = id ? ubicar(dias, id) : null
    if (nuevaIdAbierta) {
      onChange(
        dias.map((d) => ({
          ...d,
          actividades: d.actividades.filter((a) => a.id !== nuevaIdAbierta),
        }))
      )
    }
    cerrarEditor()
    if (id && pos) {
      recolocarFoco(
        nuevaIdAbierta === id
          ? [selectorAnadir(pos[0])]
          : [selectorAsa(id), selectorAnadir(pos[0])]
      )
    }
  }

  const guardarDraft = () => {
    if (!draft) return
    const nombre = draft.nombre.trim()
    if (!nombre) {
      setErrorNombre('Ponle un nombre a la actividad.')
      return
    }
    const original = dias
      .flatMap((d) => d.actividades)
      .find((a) => a.id === draft.id)
    const direccion = (draft.direccion ?? '').trim()
    const cambioLugar =
      !original ||
      original.nombre.trim() !== nombre ||
      (original.direccion ?? '').trim() !== direccion
    const final: Activity = {
      ...draft,
      nombre,
      direccion,
      duracionMinutos:
        minutosEntre(draft.horaInicio, draft.horaFin) || draft.duracionMinutos,
      ...(cambioLugar ? { coordsVerificadas: false } : {}),
    }
    onChange(
      dias.map((d) => ({
        ...d,
        actividades: d.actividades.map((a) => (a.id === final.id ? final : a)),
      }))
    )
    if (cambioLugar) onActividadesEditadas?.([final.id])
    cerrarEditor()
    recolocarFoco([selectorAsa(final.id)])
  }

  const borrar = (dayIdx: number, actId: string) => {
    const copia = clonar(dias)
    const day = copia[dayIdx]
    if (!day) return
    const indice = day.actividades.findIndex((a) => a.id === actId)
    day.actividades = day.actividades.filter((a) => a.id !== actId)
    onChange(copia)
    if (editId === actId) cerrarEditor()
    setAnuncio('Actividad borrada.')
    // El botón «Borrar» desaparece: el foco pasa a la actividad vecina (o a
    // «Añadir actividad») cuando el diálogo de confirmación termina de cerrar.
    const vecina = day.actividades[Math.min(indice, day.actividades.length - 1)]
    recolocarFoco(
      [...(vecina ? [selectorAsa(vecina.id)] : []), selectorAnadir(dayIdx)],
      400
    )
  }

  // dir: -1 sube, +1 baja. En los extremos pasa al día anterior/siguiente.
  const mover = (dayIdx: number, actIdx: number, dir: -1 | 1): boolean => {
    const copia = clonar(dias)
    const day = copia[dayIdx]
    const actual = day?.actividades[actIdx]
    if (!day || !actual) return false
    const destino = actIdx + dir
    if (destino >= 0 && destino < day.actividades.length) {
      const otra = day.actividades[destino]
      if (!otra) return false
      day.actividades[actIdx] = otra
      day.actividades[destino] = actual
    } else if (dir === -1 && dayIdx > 0) {
      const anterior = copia[dayIdx - 1]
      if (!anterior) return false
      day.actividades.splice(actIdx, 1)
      anterior.actividades.push(actual)
    } else if (dir === 1 && dayIdx < copia.length - 1) {
      const siguiente = copia[dayIdx + 1]
      if (!siguiente) return false
      day.actividades.splice(actIdx, 1)
      siguiente.actividades.unshift(actual)
    } else {
      return false
    }
    onChange(copia)
    anunciar(copia, actual.id)
    return true
  }

  /** Arrastrar y soltar: coloca `id` antes de `antesDeId` (o al final del día). */
  const soltar = (id: string, dayIdx: number, antesDeId: string | null) => {
    if (id === antesDeId) return
    const copia = clonar(dias)
    const origen = ubicar(copia, id)
    if (!origen) return
    const [dO, iO] = origen
    const act = copia[dO]?.actividades[iO]
    if (!act) return
    copia[dO]?.actividades.splice(iO, 1)
    const destino = copia[dayIdx]
    if (!destino) return
    const i = antesDeId
      ? destino.actividades.findIndex((a) => a.id === antesDeId)
      : -1
    if (i >= 0) destino.actividades.splice(i, 0, act)
    else destino.actividades.push(act)
    onChange(copia)
    anunciar(copia, id)
  }

  const anadir = (dayIdx: number) => {
    const copia = clonar(dias)
    const day = copia[dayIdx]
    if (!day) return
    const act = nuevaActividad()
    const ultima = day.actividades[day.actividades.length - 1]
    if (ultima?.horaFin) {
      act.horaInicio = ultima.horaFin
      const [h = '10', mm = '00'] = ultima.horaFin.split(':')
      act.horaFin = `${String(Math.min(23, Number(h) + 1)).padStart(2, '0')}:${mm}`
    }
    day.actividades.push(act)
    onChange(copia)
    abrirEdicion(act)
    setNuevaIdAbierta(act.id)
  }

  const terminar = () => {
    if (draft) {
      setConfirmarSalida(true)
      return
    }
    onTerminar?.()
  }

  const onAsaKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    dayIdx: number,
    actIdx: number,
    id: string
  ) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    if (mover(dayIdx, actIdx, e.key === 'ArrowUp' ? -1 : 1)) enfocarAsa(id)
  }

  const permitirSoltar = (e: DragEvent) => {
    if (!arrastrando) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-14">
        {dias.map((dia, dayIdx) => (
          <DayChapter
            key={`${dia.numero}-${dayIdx}`}
            dia={dia}
            indice={dayIdx}
            trip={trip}
            moneda={moneda}
            idPrefijo={idPrefijo}
            claveResaltado={claveResaltado}
            animar={animar}
            {...(resaltados ? { resaltados } : {})}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-14">
      {onTerminar ? (
        <Callout
          tone="info"
          title="Modo edición"
          className="sticky top-[118px] z-(--z-sticky) shadow-elev md:top-[126px]"
          action={
            <Button
              id={ID_LISTO_EDICION}
              variant="tinta"
              size="sm"
              icon={<Check />}
              onClick={terminar}
            >
              Listo
            </Button>
          }
        >
          Reordena, edita o borra actividades. Arrastra el asa o usa las flechas
          del teclado para moverlas.
        </Callout>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {anuncio}
      </p>

      {dias.map((dia, dayIdx) => {
        const total = dia.actividades.length
        return (
          <DayChapter
            key={`${dia.numero}-${dayIdx}`}
            dia={dia}
            indice={dayIdx}
            trip={trip}
            moneda={moneda}
            idPrefijo={idPrefijo}
            modo="lectura"
            pie={
              <div
                className="mt-4"
                onDragOver={permitirSoltar}
                onDrop={(e) => {
                  e.preventDefault()
                  if (arrastrando) soltar(arrastrando, dayIdx, null)
                  setArrastrando(null)
                }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Plus />}
                  onClick={() => anadir(dayIdx)}
                  disabled={Boolean(draft)}
                  data-anadir={dayIdx}
                >
                  Añadir actividad al día {dayIdx + 1}
                </Button>
              </div>
            }
          >
            {total === 0 ? (
              <p className="mt-6 text-body-s text-fg-subtle">
                Sin actividades este día.
              </p>
            ) : (
              <ol
                className="mt-6"
                aria-label={`Actividades del día ${dayIdx + 1}`}
              >
                {dia.actividades.map((act, actIdx) => {
                  const ultimaDelViaje =
                    dayIdx === dias.length - 1 && actIdx === total - 1
                  const primeraDelViaje = dayIdx === 0 && actIdx === 0
                  if (editId === act.id && draft) {
                    return (
                      <li key={act.id} className="pb-6">
                        <ActivityForm
                          draft={draft}
                          moneda={moneda}
                          nueva={nuevaIdAbierta === act.id}
                          errorNombre={errorNombre}
                          onDraftChange={(a) => {
                            setDraft(a)
                            if (errorNombre && a.nombre.trim())
                              setErrorNombre(undefined)
                          }}
                          onSave={guardarDraft}
                          onCancel={cancelar}
                        />
                      </li>
                    )
                  }
                  return (
                    <li
                      key={act.id}
                      onDragOver={permitirSoltar}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (arrastrando) soltar(arrastrando, dayIdx, act.id)
                        setArrastrando(null)
                      }}
                      className={cn(
                        'rounded-control transition-opacity duration-(--dur-fast)',
                        arrastrando === act.id && 'opacity-50'
                      )}
                    >
                      <ActivityItem
                        as="div"
                        activity={act}
                        dia={dayIdx}
                        orden={actIdx + 1}
                        moneda={moneda}
                        ciudad={ciudadDelDia(dia, trip)}
                        modo="lectura"
                        ultima={actIdx === total - 1}
                        pie={
                          <div
                            role="group"
                            aria-label={`Editar ${act.nombre || 'actividad'}`}
                            className="mt-3 -ml-2 flex flex-wrap items-center gap-1"
                          >
                            <button
                              type="button"
                              data-asa={act.id}
                              draggable
                              aria-label={`Mover ${act.nombre || 'actividad'}. Usa las flechas arriba y abajo.`}
                              title="Arrastra o usa las flechas para mover"
                              onKeyDown={(e) =>
                                onAsaKeyDown(e, dayIdx, actIdx, act.id)
                              }
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = 'move'
                                e.dataTransfer.setData('text/plain', act.id)
                                setArrastrando(act.id)
                              }}
                              onDragEnd={() => setArrastrando(null)}
                              className={cn(
                                buttonClasses({
                                  variant: 'ghost',
                                  size: 'icon',
                                }),
                                'cursor-grab active:cursor-grabbing'
                              )}
                            >
                              <GripVertical
                                aria-hidden="true"
                                strokeWidth={1.75}
                              />
                            </button>
                            <IconButton
                              label={`Subir ${act.nombre || 'actividad'}`}
                              disabled={primeraDelViaje}
                              onClick={() => mover(dayIdx, actIdx, -1)}
                            >
                              <ArrowUp />
                            </IconButton>
                            <IconButton
                              label={`Bajar ${act.nombre || 'actividad'}`}
                              disabled={ultimaDelViaje}
                              onClick={() => mover(dayIdx, actIdx, 1)}
                            >
                              <ArrowDown />
                            </IconButton>
                            <IconButton
                              label={`Editar ${act.nombre || 'actividad'}`}
                              disabled={Boolean(draft)}
                              onClick={() => abrirEdicion(act)}
                            >
                              <Pencil />
                            </IconButton>
                            <IconButton
                              label={`Borrar ${act.nombre || 'actividad'}`}
                              className="text-danger hover:bg-danger-bg"
                              onClick={() => setPorBorrar({ dia: dayIdx, act })}
                            >
                              <Trash2 />
                            </IconButton>
                          </div>
                        }
                      />
                    </li>
                  )
                })}
              </ol>
            )}
          </DayChapter>
        )
      })}

      <ConfirmDialog
        open={porBorrar !== null}
        onClose={() => setPorBorrar(null)}
        title="¿Borrar esta actividad?"
        description={
          porBorrar
            ? `«${porBorrar.act.nombre || 'Actividad sin nombre'}» se quitará del día ${porBorrar.dia + 1}.`
            : undefined
        }
        confirmLabel="Borrar actividad"
        onConfirm={() => {
          if (porBorrar) borrar(porBorrar.dia, porBorrar.act.id)
        }}
      />

      <ConfirmDialog
        open={confirmarSalida}
        onClose={() => setConfirmarSalida(false)}
        tone="neutral"
        title="¿Descartar los cambios sin guardar?"
        description="Tienes una actividad abierta en el editor. Si sales ahora, se pierden esos cambios."
        confirmLabel="Descartar y salir"
        cancelLabel="Seguir editando"
        onConfirm={() => {
          cancelar()
          onTerminar?.()
        }}
      />
    </div>
  )
}

interface ActivityFormProps {
  draft: Activity
  moneda: string
  nueva: boolean
  errorNombre?: string | undefined
  onDraftChange: (act: Activity) => void
  onSave: () => void
  onCancel: () => void
}

function ActivityForm({
  draft,
  moneda,
  nueva,
  errorNombre,
  onDraftChange,
  onSave,
  onCancel,
}: ActivityFormProps) {
  const set = <K extends keyof Activity>(key: K, value: Activity[K]) =>
    onDraftChange({ ...draft, [key]: value })

  return (
    <Card
      as="form"
      variant="elevated"
      className="flex flex-col gap-4"
      aria-label={nueva ? 'Nueva actividad' : `Editar ${draft.nombre}`}
      onSubmit={(e) => {
        e.preventDefault()
        onSave()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onCancel()
        }
      }}
    >
      <p className="font-display text-h3 text-fg">
        {nueva ? 'Nueva actividad' : 'Editar actividad'}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Nombre"
          fieldSize="md"
          value={draft.nombre}
          placeholder="Ej.: Museo del Oro"
          onChange={(e) => set('nombre', e.target.value)}
          error={errorNombre}
          containerClassName="sm:col-span-2"
          autoFocus
          maxLength={160}
        />
        <Input
          label="Dirección o lugar"
          optional
          fieldSize="md"
          value={draft.direccion ?? ''}
          placeholder="Calle, barrio o punto de referencia"
          onChange={(e) => set('direccion', e.target.value)}
          containerClassName="sm:col-span-2"
          maxLength={200}
        />
        <Input
          label="Empieza"
          type="time"
          fieldSize="md"
          value={draft.horaInicio}
          onChange={(e) => set('horaInicio', e.target.value)}
        />
        <Input
          label="Termina"
          type="time"
          fieldSize="md"
          value={draft.horaFin}
          onChange={(e) => set('horaFin', e.target.value)}
        />
        <Select
          label="Tipo"
          fieldSize="md"
          value={draft.tipo}
          onChange={(e) => set('tipo', e.target.value as ActivityType)}
          options={TIPOS_ACTIVIDAD.map((t) => ({
            value: t,
            label: TIPO_LABEL[t],
          }))}
        />
        <Input
          label={`Precio estimado (${moneda})`}
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          fieldSize="md"
          className="tnum"
          value={
            Number.isFinite(draft.precioEstimado) ? draft.precioEstimado : 0
          }
          onChange={(e) =>
            set('precioEstimado', Math.max(0, Number(e.target.value) || 0))
          }
        />
        <Textarea
          label="Descripción"
          optional
          value={draft.descripcion ?? ''}
          maxLength={600}
          onChange={(e) => set('descripcion', e.target.value)}
          containerClassName="sm:col-span-2"
        />
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>
          {nueva ? 'Descartar' : 'Cancelar'}
        </Button>
        <Button type="submit" variant="tinta" icon={<Check />}>
          Guardar actividad
        </Button>
      </div>
    </Card>
  )
}
