'use client'

import { useState } from 'react'
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Pencil,
  Check,
  X,
} from 'lucide-react'
import type { Day } from '@/types/trip'
import type { Activity, ActivityType } from '@/types/activity'
import { ActivityItem } from './ActivityItem'

const TIPOS: ActivityType[] = [
  'actividad',
  'museo',
  'restaurante',
  'templo',
  'parque',
  'barrio',
  'playa',
  'traslado',
]

interface EditableDaysProps {
  dias: Day[]
  editing: boolean
  onChange: (dias: Day[]) => void
}

function nuevaActividad(): Activity {
  return {
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `act-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    nombre: '',
    descripcion: '',
    horaInicio: '09:00',
    horaFin: '10:00',
    duracionMinutos: 60,
    tipo: 'actividad',
    direccion: '',
    lat: 0,
    lng: 0,
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

/** Minutos entre dos horas "HH:MM"; 0 si no se pueden parsear o es negativo. */
function minutosEntre(inicio: string, fin: string): number {
  const a = /^(\d{1,2}):(\d{2})$/.exec(inicio)
  const b = /^(\d{1,2}):(\d{2})$/.exec(fin)
  if (!a || !b) return 0
  const min =
    Number(b[1]) * 60 + Number(b[2]) - (Number(a[1]) * 60 + Number(a[2]))
  return min > 0 ? min : 0
}

// Clona los días de forma inmutable hasta el nivel de actividades.
function clonar(dias: Day[]): Day[] {
  return dias.map((d) => ({ ...d, actividades: [...d.actividades] }))
}

export function EditableDays({ dias, editing, onChange }: EditableDaysProps) {
  // id de la actividad cuyo formulario inline está abierto, y su borrador.
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Activity | null>(null)

  const abrirEdicion = (act: Activity) => {
    setEditId(act.id)
    setDraft({ ...act })
  }

  const cancelar = () => {
    setEditId(null)
    setDraft(null)
  }

  const guardarDraft = () => {
    if (!draft) return
    const conDuracion: Activity = {
      ...draft,
      nombre: draft.nombre.trim() || 'Actividad sin nombre',
      duracionMinutos:
        minutosEntre(draft.horaInicio, draft.horaFin) || draft.duracionMinutos,
    }
    onChange(
      dias.map((d) => ({
        ...d,
        actividades: d.actividades.map((a) =>
          a.id === conDuracion.id ? conDuracion : a
        ),
      }))
    )
    cancelar()
  }

  const borrar = (dayIdx: number, actId: string) => {
    const copy = clonar(dias)
    const day = copy[dayIdx]
    if (!day) return
    day.actividades = day.actividades.filter((a) => a.id !== actId)
    onChange(copy)
    if (editId === actId) cancelar()
  }

  // dir: -1 sube, +1 baja. En los extremos mueve al día anterior/siguiente.
  const mover = (dayIdx: number, actIdx: number, dir: -1 | 1) => {
    const copy = clonar(dias)
    const day = copy[dayIdx]
    if (!day) return
    const acts = day.actividades
    const actual = acts[actIdx]
    if (actual === undefined) return
    const target = actIdx + dir

    if (target >= 0 && target < acts.length) {
      const otra = acts[target]
      if (otra === undefined) return
      acts[actIdx] = otra
      acts[target] = actual
    } else if (dir === -1 && dayIdx > 0) {
      const anterior = copy[dayIdx - 1]
      if (!anterior) return
      acts.splice(actIdx, 1)
      anterior.actividades.push(actual)
    } else if (dir === 1 && dayIdx < copy.length - 1) {
      const siguiente = copy[dayIdx + 1]
      if (!siguiente) return
      acts.splice(actIdx, 1)
      siguiente.actividades.unshift(actual)
    } else {
      return // ya está en el extremo del viaje
    }
    onChange(copy)
  }

  const anadir = (dayIdx: number) => {
    const copy = clonar(dias)
    const day = copy[dayIdx]
    if (!day) return
    const act = nuevaActividad()
    day.actividades.push(act)
    onChange(copy)
    abrirEdicion(act)
  }

  return (
    <div className="flex flex-col gap-4">
      {dias.map((dia, dayIdx) => (
        <div
          key={dia.numero}
          className="overflow-hidden rounded-3xl border border-border bg-surface shadow-[var(--shadow-soft)]"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="grad-brand flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white">
                {dia.numero}
              </span>
              <div>
                <h2 className="font-bold text-fg">{dia.titulo}</h2>
                <p className="text-xs text-fg-subtle">{dia.ciudad}</p>
              </div>
            </div>
            <span className="rounded-full bg-surface-muted px-3 py-1 text-sm font-semibold text-fg-muted">
              ${dia.presupuestoDia}
            </span>
          </div>

          <div className="divide-y divide-border">
            {dia.actividades.length === 0 ? (
              <p className="px-5 py-4 text-sm text-fg-subtle">
                Sin actividades este día.
              </p>
            ) : null}

            {dia.actividades.map((act, actIdx) =>
              editing && editId === act.id && draft ? (
                <ActivityForm
                  key={act.id}
                  draft={draft}
                  onDraftChange={setDraft}
                  onSave={guardarDraft}
                  onCancel={cancelar}
                />
              ) : (
                <div key={act.id} className="flex items-stretch">
                  <div className="flex-1">
                    <ActivityItem activity={act} />
                  </div>
                  {editing ? (
                    <div className="flex flex-col items-center justify-center gap-1 border-l border-border px-2 py-2">
                      <button
                        type="button"
                        aria-label="Subir actividad"
                        title="Subir"
                        onClick={() => mover(dayIdx, actIdx, -1)}
                        className="rounded-lg p-1.5 text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Editar actividad"
                        title="Editar"
                        onClick={() => abrirEdicion(act)}
                        className="rounded-lg p-1.5 text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Borrar actividad"
                        title="Borrar"
                        onClick={() => borrar(dayIdx, act.id)}
                        className="rounded-lg p-1.5 text-coral-500 transition-colors hover:bg-coral-50 dark:hover:bg-coral-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Bajar actividad"
                        title="Bajar"
                        onClick={() => mover(dayIdx, actIdx, 1)}
                        className="rounded-lg p-1.5 text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
              )
            )}
          </div>

          {editing ? (
            <div className="border-t border-border px-5 py-3">
              <button
                type="button"
                onClick={() => anadir(dayIdx)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border-strong px-3 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
              >
                <Plus className="h-4 w-4" /> Añadir actividad
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

interface ActivityFormProps {
  draft: Activity
  onDraftChange: (act: Activity) => void
  onSave: () => void
  onCancel: () => void
}

function ActivityForm({
  draft,
  onDraftChange,
  onSave,
  onCancel,
}: ActivityFormProps) {
  const set = <K extends keyof Activity>(key: K, value: Activity[K]) =>
    onDraftChange({ ...draft, [key]: value })

  const inputCls =
    'w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-brand-400'

  return (
    <div className="flex flex-col gap-3 bg-surface-muted/50 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted sm:col-span-2">
          Nombre
          <input
            className={inputCls}
            value={draft.nombre}
            placeholder="Nombre de la actividad"
            onChange={(e) => set('nombre', e.target.value)}
            autoFocus
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted sm:col-span-2">
          Dirección
          <input
            className={inputCls}
            value={draft.direccion}
            placeholder="Dirección o lugar"
            onChange={(e) => set('direccion', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted">
          Hora inicio
          <input
            type="time"
            className={inputCls}
            value={draft.horaInicio}
            onChange={(e) => set('horaInicio', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted">
          Hora fin
          <input
            type="time"
            className={inputCls}
            value={draft.horaFin}
            onChange={(e) => set('horaFin', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted">
          Tipo
          <select
            className={inputCls}
            value={draft.tipo}
            onChange={(e) => set('tipo', e.target.value as ActivityType)}
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted">
          Precio estimado ($)
          <input
            type="number"
            min={0}
            className={inputCls}
            value={draft.precioEstimado}
            onChange={(e) => set('precioEstimado', Number(e.target.value) || 0)}
          />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-muted"
        >
          <X className="h-4 w-4" /> Cancelar
        </button>
        <button
          type="button"
          onClick={onSave}
          className="grad-brand inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-white"
        >
          <Check className="h-4 w-4" /> Guardar
        </button>
      </div>
    </div>
  )
}
