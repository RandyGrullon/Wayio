import Link from 'next/link'
import { getModerationData } from '@/lib/admin/queries'
import { deleteMessage, deleteExpense } from '@/lib/admin/actions'
import { ActionButton } from '@/components/admin/ActionButton'
import { StatCard } from '@/components/admin/StatCard'
import { Badge } from '@/components/ui/Badge'

export default async function GroupsPage() {
  const { messages, expenses, groupCount } = await getModerationData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Grupos y moderación
        </h1>
        <p className="text-sm text-gray-500">
          Mensajes y gastos recientes de todos los viajes en grupo.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Grupos activos" value={groupCount} />
        <StatCard label="Mensajes (recientes)" value={messages.length} />
        <StatCard label="Gastos (recientes)" value={expenses.length} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700">
          Mensajes recientes
        </h2>
        <ul className="divide-y divide-gray-50">
          {messages.map((msg) => (
            <li
              key={msg.id}
              className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
            >
              <span className="min-w-0 text-gray-700">
                <span className="font-medium">{msg.nombre_usuario}:</span>{' '}
                {msg.mensaje}
                {msg.tipo !== 'mensaje' ? (
                  <Badge variant="warning" className="ml-2">
                    {msg.tipo}
                  </Badge>
                ) : null}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/admin/trips/${msg.trip_id}`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  viaje
                </Link>
                <ActionButton
                  action={deleteMessage.bind(null, msg.id)}
                  label="Borrar"
                  variant="danger"
                  confirm="¿Eliminar este mensaje?"
                />
              </span>
            </li>
          ))}
          {messages.length === 0 ? (
            <li className="px-4 py-8 text-center text-gray-400">
              Sin mensajes.
            </li>
          ) : null}
        </ul>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700">
          Gastos recientes
        </h2>
        <ul className="divide-y divide-gray-50">
          {expenses.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
            >
              <span className="text-gray-700">
                {e.concepto}{' '}
                <span className="text-xs text-gray-400">
                  · {e.nombre_pagador}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="font-medium">${e.monto}</span>
                <Link
                  href={`/admin/trips/${e.trip_id}`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  viaje
                </Link>
                <ActionButton
                  action={deleteExpense.bind(null, e.id)}
                  label="Borrar"
                  variant="danger"
                />
              </span>
            </li>
          ))}
          {expenses.length === 0 ? (
            <li className="px-4 py-8 text-center text-gray-400">Sin gastos.</li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}
