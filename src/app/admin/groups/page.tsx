import type { Metadata } from 'next'
import { AccionesFila } from '@/components/admin/AccionesFila'
import { DataTable } from '@/components/admin/DataTable'
import type { Columna } from '@/components/admin/DataTable'
import { Encabezado, TituloBloque } from '@/components/admin/Encabezado'
import { StatCard } from '@/components/admin/StatCard'
import { cantidad, fechaHora } from '@/components/admin/etiquetas'
import { Badge } from '@/components/ui/Badge'
import type { BadgeVariant } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { deleteExpense, deleteMessage } from '@/lib/admin/actions'
import type { ModerationExpense } from '@/lib/admin/queries'
import { formatCurrency, formatNumero } from '@/lib/utils/formatters'
import type { GroupMessageRow } from '@/types/database'
import { exigirAdmin } from '../_lib/acceso'
import { datosModeracion } from '../_lib/datos'

export const metadata: Metadata = { title: 'Grupos · Admin' }

const TIPO: Record<string, { label: string; variant: BadgeVariant }> = {
  mensaje: { label: 'Mensaje', variant: 'default' },
  sistema: { label: 'Sistema', variant: 'info' },
  alerta: { label: 'Alerta', variant: 'warning' },
}

const COLUMNAS_MENSAJES: readonly Columna<GroupMessageRow>[] = [
  {
    id: 'mensaje',
    encabezado: 'Mensaje',
    tarjeta: 'titulo',
    className: 'min-w-[280px] max-w-[520px]',
    celda: (m) => (
      <span className="block min-w-0">
        <span className="block text-caption font-semibold text-fg-muted">
          {m.nombre_usuario}
        </span>
        <span className="line-clamp-2 block break-words text-fg">
          {m.mensaje}
        </span>
      </span>
    ),
  },
  {
    id: 'tipo',
    encabezado: 'Tipo',
    tarjeta: 'meta',
    celda: (m) => {
      const t = TIPO[m.tipo] ?? TIPO['mensaje']
      return t ? <Badge variant={t.variant}>{t.label}</Badge> : null
    },
  },
  {
    id: 'fecha',
    encabezado: 'Fecha',
    tarjeta: 'meta',
    className: 'whitespace-nowrap text-fg-muted',
    celda: (m) => fechaHora(m.created_at),
  },
]

const COLUMNAS_GASTOS: readonly Columna<ModerationExpense>[] = [
  {
    id: 'concepto',
    encabezado: 'Concepto',
    tarjeta: 'titulo',
    className: 'min-w-[220px]',
    celda: (e) => (
      <span className="block min-w-0">
        <span className="block truncate font-medium text-fg">{e.concepto}</span>
        <span className="block truncate text-caption text-fg-muted">
          Pagó {e.nombre_pagador}
          {e.destino ? ` · ${e.destino}` : ''}
        </span>
      </span>
    ),
  },
  {
    id: 'monto',
    encabezado: 'Monto',
    alinear: 'fin',
    tarjeta: 'meta',
    className: 'whitespace-nowrap',
    // En la moneda del viaje del gasto («US$22.50», «RD$10,944.00»).
    celda: (e) =>
      formatCurrency(Number(e.monto), e.moneda, { decimales: true }),
  },
  {
    id: 'fecha',
    encabezado: 'Fecha',
    tarjeta: 'meta',
    className: 'whitespace-nowrap text-fg-muted',
    celda: (e) => fechaHora(e.created_at),
  },
]

export default async function GroupsPage() {
  if (!(await exigirAdmin())) return null
  const { messages, expenses, groupCount } = await datosModeracion()

  return (
    <div className="space-y-8">
      <Encabezado
        titulo="Grupos"
        descripcion="Moderación de los viajes en grupo: mensajes y gastos recientes de todos los grupos."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label="Grupos activos"
          value={formatNumero(groupCount)}
          caption="Viajes con 2 o más miembros"
        />
        <StatCard
          label="Mensajes recientes"
          value={formatNumero(messages.length)}
          caption="Últimos 100"
        />
        <StatCard
          label="Gastos recientes"
          value={formatNumero(expenses.length)}
          caption="Últimos 50"
        />
      </div>

      <section aria-labelledby="mod-mensajes" className="space-y-3">
        <TituloBloque id="mod-mensajes">Mensajes recientes</TituloBloque>
        <DataTable
          etiqueta="Mensajes recientes de los grupos"
          cabecera={cantidad(messages.length, 'mensaje', 'mensajes')}
          columnas={COLUMNAS_MENSAJES}
          filas={messages}
          clave={(m) => m.id}
          href={(m) => `/admin/trips/${m.trip_id}?tab=chat`}
          etiquetaEnlace={(m) =>
            `Ver el chat del viaje del mensaje de ${m.nombre_usuario}`
          }
          acciones={(m) => (
            <AccionesFila
              etiqueta={`Acciones del mensaje de ${m.nombre_usuario}`}
              acciones={[
                {
                  tipo: 'enlace',
                  clave: 'viaje',
                  label: 'Ver viaje',
                  href: `/admin/trips/${m.trip_id}?tab=chat`,
                  icono: 'viaje',
                },
                {
                  tipo: 'accion',
                  clave: 'borrar',
                  label: 'Borrar mensaje',
                  icono: 'borrar',
                  peligro: true,
                  action: deleteMessage.bind(null, m.id),
                  confirm: {
                    titulo: '¿Borrar este mensaje?',
                    descripcion: 'Desaparece del chat para todo el grupo.',
                    confirmar: 'Borrar mensaje',
                    cargando: 'Borrando…',
                  },
                  exito: 'Mensaje borrado',
                  error: 'No se pudo borrar el mensaje',
                },
              ]}
            />
          )}
          vacio={
            <EmptyState
              title="Nadie ha escrito todavía"
              description="Los mensajes de los grupos aparecerán aquí."
            />
          }
        />
      </section>

      <section aria-labelledby="mod-gastos" className="space-y-3">
        <TituloBloque id="mod-gastos">Gastos recientes</TituloBloque>
        <DataTable
          etiqueta="Gastos recientes de los grupos"
          cabecera={cantidad(expenses.length, 'gasto', 'gastos')}
          columnas={COLUMNAS_GASTOS}
          filas={expenses}
          clave={(e) => e.id}
          href={(e) => `/admin/trips/${e.trip_id}?tab=gastos`}
          etiquetaEnlace={(e) => `Ver los gastos del viaje de «${e.concepto}»`}
          acciones={(e) => (
            <AccionesFila
              etiqueta={`Acciones del gasto ${e.concepto}`}
              acciones={[
                {
                  tipo: 'enlace',
                  clave: 'viaje',
                  label: 'Ver viaje',
                  href: `/admin/trips/${e.trip_id}?tab=gastos`,
                  icono: 'viaje',
                },
                {
                  tipo: 'accion',
                  clave: 'borrar',
                  label: 'Borrar gasto',
                  icono: 'borrar',
                  peligro: true,
                  action: deleteExpense.bind(null, e.id),
                  confirm: {
                    titulo: '¿Borrar este gasto?',
                    descripcion: `«${e.concepto}» deja de contar en las cuentas del grupo.`,
                    confirmar: 'Borrar gasto',
                    cargando: 'Borrando…',
                  },
                  exito: 'Gasto borrado',
                  error: 'No se pudo borrar el gasto',
                },
              ]}
            />
          )}
          vacio={
            <EmptyState
              title="Sin gastos todavía"
              description="Los gastos compartidos de los grupos aparecerán aquí."
            />
          }
        />
      </section>
    </div>
  )
}
