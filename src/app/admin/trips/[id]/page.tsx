import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTripDetail } from '@/lib/admin/queries'
import {
  setTripEstado,
  deleteTrip,
  deleteMessage,
  deleteExpense,
} from '@/lib/admin/actions'
import { SelectAction } from '@/components/admin/SelectAction'
import { ActionButton } from '@/components/admin/ActionButton'
import { Badge } from '@/components/ui/Badge'

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { trip, ownerEmail, members, messages, expenses, votes } =
    await getTripDetail(id)
  if (!trip) notFound()
  const data = trip.data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/trips"
            className="text-sm text-blue-600 hover:underline"
          >
            ← Viajes
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            {data.destino}
          </h1>
          <p className="text-sm text-gray-500">
            {data.dias.length} días · ${data.presupuestoTotal} · dueño:{' '}
            {ownerEmail ?? '—'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SelectAction
            value={trip.estado}
            options={[
              { value: 'planificando', label: 'planificando' },
              { value: 'en_viaje', label: 'en_viaje' },
              { value: 'completado', label: 'completado' },
            ]}
            action={setTripEstado.bind(null, id)}
          />
          <ActionButton
            action={deleteTrip.bind(null, id)}
            label="Eliminar viaje"
            variant="danger"
            confirm="¿Eliminar este viaje?"
          />
        </div>
      </div>

      <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
        {data.resumenViaje}
      </p>

      {/* Itinerario */}
      <div className="space-y-3">
        {data.dias.map((dia) => (
          <div
            key={dia.numero}
            className="rounded-xl border border-gray-200 bg-white"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
              <h3 className="font-semibold text-gray-900">
                Día {dia.numero}: {dia.titulo}
              </h3>
              <span className="text-xs text-gray-400">
                ${dia.presupuestoDia}
              </span>
            </div>
            <ul className="divide-y divide-gray-50">
              {dia.actividades.map((act) => (
                <li
                  key={act.id}
                  className="flex items-center justify-between px-4 py-2 text-sm"
                >
                  <span className="text-gray-700">
                    <span className="text-gray-400">
                      {act.horaInicio}–{act.horaFin}
                    </span>{' '}
                    {act.nombre}
                  </span>
                  <span className="text-xs text-gray-400">{act.tipo}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Grupo */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            Miembros ({members.length})
          </h2>
          {members.length ? (
            <ul className="space-y-1 text-sm">
              {members.map((m) => (
                <li key={m.id} className="flex justify-between">
                  <span className="text-gray-700">{m.nombre}</span>
                  <span className="text-xs text-gray-400">
                    {m.ultima_ubicacion
                      ? new Date(m.ultima_ubicacion).toLocaleString()
                      : 'sin ubicación'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">Sin miembros.</p>
          )}
          <p className="mt-3 text-xs text-gray-400">
            Votos registrados: {votes.length}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            Gastos ({expenses.length})
          </h2>
          {expenses.length ? (
            <ul className="space-y-1 text-sm">
              {expenses.map((e) => (
                <li key={e.id} className="flex items-center justify-between">
                  <span className="text-gray-700">
                    {e.concepto}{' '}
                    <span className="text-xs text-gray-400">
                      · {e.nombre_pagador}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium">${e.monto}</span>
                    <ActionButton
                      action={deleteExpense.bind(null, e.id)}
                      label="✕"
                      variant="danger"
                    />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">Sin gastos.</p>
          )}
        </div>
      </div>

      {/* Chat */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">
          Chat del grupo ({messages.length})
        </h2>
        {messages.length ? (
          <ul className="space-y-1">
            {messages.map((msg) => (
              <li
                key={msg.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="text-gray-700">
                  <span className="font-medium">{msg.nombre_usuario}:</span>{' '}
                  {msg.mensaje}
                  {msg.tipo !== 'mensaje' ? (
                    <Badge variant="warning" className="ml-2">
                      {msg.tipo}
                    </Badge>
                  ) : null}
                </span>
                <ActionButton
                  action={deleteMessage.bind(null, msg.id)}
                  label="✕"
                  variant="danger"
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">Sin mensajes.</p>
        )}
      </div>
    </div>
  )
}
