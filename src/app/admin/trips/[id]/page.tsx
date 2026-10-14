import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Globe, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react'
import { AccionesFila } from '@/components/admin/AccionesFila'
import { ActionButton } from '@/components/admin/ActionButton'
import { DataTable } from '@/components/admin/DataTable'
import type { Columna } from '@/components/admin/DataTable'
import { Dato, Datos } from '@/components/admin/Datos'
import { DetalleCabecera } from '@/components/admin/DetalleCabecera'
import { TituloBloque } from '@/components/admin/Encabezado'
import { PestanasDetalle } from '@/components/admin/PestanasDetalle'
import { SelectAction } from '@/components/admin/SelectAction'
import { FilaPeligro, ZonaPeligro } from '@/components/admin/ZonaPeligro'
import {
  ETIQUETA_PAQUETE,
  ETIQUETA_TIPO_ACTIVIDAD,
  cantidad,
  etiqueta,
  fecha,
  fechaHora,
} from '@/components/admin/etiquetas'
import { Avatar, indiceDesdeId } from '@/components/ui/Avatar'
import { BADGE_VIAJE, Badge, EstadoBadge } from '@/components/ui/Badge'
import type { BadgeVariant } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { diaClases } from '@/constants/mapColors'
import {
  deleteExpense,
  deleteMessage,
  deleteTrip,
  setTripEstado,
} from '@/lib/admin/actions'
import { cn } from '@/lib/utils/cn'
import {
  formatCurrency,
  formatDias,
  formatHaceTiempo,
  formatHora12,
  formatNumero,
  formatRangoFechas,
  formatViajeros,
} from '@/lib/utils/formatters'
import type { GroupExpenseRow } from '@/types/database'
import type { Activity } from '@/types/activity'
import { exigirAdmin } from '../../_lib/acceso'
import { datosViaje } from '../../_lib/datos'
import { param } from '../../_lib/listas'
import type { ParamsBusqueda } from '../../_lib/listas'

export const metadata: Metadata = { title: 'Detalle de viaje · Admin' }

const ESTADO_ACTIVIDAD: Partial<
  Record<Activity['estado'], { label: string; variant: BadgeVariant }>
> = {
  en_curso: { label: 'En curso', variant: 'info' },
  completada: { label: 'Hecha', variant: 'success' },
  perdida: { label: 'Perdida', variant: 'warning' },
  recuperada: { label: 'Recuperada', variant: 'info' },
}

const TIPO_MENSAJE: Record<string, { label: string; variant: BadgeVariant }> = {
  sistema: { label: 'Sistema', variant: 'default' },
  alerta: { label: 'Alerta', variant: 'warning' },
}

export default async function TripDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<ParamsBusqueda>
}) {
  if (!(await exigirAdmin())) return null
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const { trip, ownerEmail, members, messages, expenses, votes } =
    await datosViaje(id)
  if (!trip) notFound()

  const data = trip.data
  const moneda = data.moneda ?? 'USD'
  const dias = data.dias ?? []
  const dinero = (n: number) => formatCurrency(n, moneda)
  const pago = (n: number) => formatCurrency(n, moneda, { decimales: true })
  const destino = data.destino || 'Viaje sin destino'
  const totalGastos = expenses.reduce((s, e) => s + Number(e.monto), 0)
  const votosSi = votes.filter((v) => v.voto).length

  const ficha = (
    <Card as="section" aria-labelledby="ficha-viaje">
      <TituloBloque id="ficha-viaje">Ficha</TituloBloque>
      <Datos className="mt-4">
        <Dato etiqueta="Dueño">
          {ownerEmail ? (
            <Link
              href={`/admin/users/${trip.user_id}`}
              className="text-accent underline decoration-1 underline-offset-[3px] hover:text-accent-hover"
            >
              {ownerEmail}
            </Link>
          ) : (
            '—'
          )}
        </Dato>
        <Dato etiqueta="Origen">{data.origen || '—'}</Dato>
        <Dato etiqueta="Presupuesto total">
          <span className="tnum">{dinero(data.presupuestoTotal ?? 0)}</span>
        </Dato>
        <Dato etiqueta="Por persona">
          <span className="tnum">
            {dinero(data.presupuestoPorPersona ?? 0)}
          </span>
        </Dato>
        {data.vueloEstimadoPorPersona ? (
          <Dato etiqueta="Vuelo estimado por persona">
            <span className="tnum">{dinero(data.vueloEstimadoPorPersona)}</span>
          </Dato>
        ) : null}
        <Dato etiqueta="Vista pública">
          {trip.is_public ? 'Compartida' : 'Privada'}
        </Dato>
        <Dato etiqueta="Creado">{fechaHora(trip.created_at)}</Dato>
        <Dato etiqueta="Actualizado">{fechaHora(trip.updated_at)}</Dato>
      </Datos>
      <SelectAction
        className="mt-5"
        label="Estado del viaje"
        value={trip.estado}
        options={['planificando', 'en_viaje', 'completado'].map((e) => ({
          value: e,
          label: BADGE_VIAJE[e]?.label ?? e,
        }))}
        action={setTripEstado.bind(null, id)}
        confirmTitulo="¿Cambiar el estado a {valor}?"
        confirmDescripcion="El cambio se verá en la web y en la app de todo el grupo."
        confirmar="Cambiar estado"
        exito="Estado actualizado"
        error="No se pudo cambiar el estado"
      />
    </Card>
  )

  const itinerario = (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="space-y-4">
        {data.resumenViaje ? (
          <p className="max-w-prose text-body text-fg-muted">
            {data.resumenViaje}
          </p>
        ) : null}
        {dias.length === 0 ? (
          <EmptyState title="Este viaje no tiene días" />
        ) : (
          dias.map((dia, i) => (
            <Card
              as="section"
              key={dia.numero}
              aria-labelledby={`dia-${dia.numero}`}
              className="p-0 md:p-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'size-2.5 shrink-0 rounded-full',
                      diaClases(i).bg
                    )}
                  />
                  <div className="min-w-0">
                    <p className="kicker">
                      Día {String(dia.numero).padStart(2, '0')}
                      {dia.ciudad ? ` · ${dia.ciudad}` : ''}
                    </p>
                    <h3 id={`dia-${dia.numero}`} className="text-title text-fg">
                      {dia.titulo}
                    </h3>
                  </div>
                </div>
                <span className="text-body-s text-fg-muted tnum">
                  {dinero(dia.presupuestoDia ?? 0)}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {(dia.actividades ?? []).map((act) => {
                  const est = ESTADO_ACTIVIDAD[act.estado]
                  return (
                    <li
                      key={act.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-[14px]"
                    >
                      <span className="w-40 shrink-0 text-fg-muted tnum">
                        {formatHora12(act.horaInicio)}
                        {act.horaFin ? ` – ${formatHora12(act.horaFin)}` : ''}
                      </span>
                      <span className="min-w-0 flex-1 font-medium text-fg">
                        {act.nombre}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-caption text-fg-muted">
                          {etiqueta(ETIQUETA_TIPO_ACTIVIDAD, act.tipo)}
                        </span>
                        {act.precioEstimado > 0 ? (
                          <span className="text-caption text-fg-muted tnum">
                            {dinero(act.precioEstimado)}
                          </span>
                        ) : null}
                        {est ? (
                          <Badge variant={est.variant}>{est.label}</Badge>
                        ) : null}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Card>
          ))
        )}
      </div>
      {ficha}
    </div>
  )

  const miembros =
    members.length === 0 ? (
      <EmptyState
        title="Nadie se ha unido todavía"
        description="Cuando el dueño comparta el enlace del grupo, los miembros aparecerán aquí."
      />
    ) : (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <Card
          as="section"
          aria-labelledby="lista-miembros"
          className="p-0 md:p-0"
        >
          <h2 id="lista-miembros" className="sr-only">
            Miembros
          </h2>
          <ul className="divide-y divide-border">
            {members.map((mb) => (
              <li key={mb.id} className="flex items-center gap-3 px-5 py-3.5">
                <Avatar
                  name={mb.nombre}
                  index={indiceDesdeId(mb.user_id)}
                  decorative
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[15px] font-medium text-fg">
                    <span className="truncate">{mb.nombre}</span>
                    {mb.user_id === trip.user_id ? (
                      <Badge variant="laton">Dueño</Badge>
                    ) : null}
                  </p>
                  <p className="text-caption text-fg-muted">
                    Se unió el {fecha(mb.joined_at)}
                  </p>
                </div>
                <p className="shrink-0 text-right text-caption text-fg-muted">
                  {mb.ultima_ubicacion
                    ? `Ubicación ${formatHaceTiempo(mb.ultima_ubicacion)}`
                    : 'Sin ubicación compartida'}
                </p>
              </li>
            ))}
          </ul>
        </Card>
        <Card as="section" aria-labelledby="votos">
          <TituloBloque id="votos">Votos</TituloBloque>
          <p className="mt-1 text-body-s text-fg-muted">
            {cantidad(votes.length, 'voto registrado', 'votos registrados')}
          </p>
          <ul className="mt-4 space-y-2 text-[14px]">
            <li className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-fg">
                <ThumbsUp
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4 text-fg-muted"
                />
                A favor
              </span>
              <span className="tnum">{formatNumero(votosSi)}</span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-fg">
                <ThumbsDown
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4 text-fg-muted"
                />
                En contra
              </span>
              <span className="tnum">
                {formatNumero(votes.length - votosSi)}
              </span>
            </li>
          </ul>
        </Card>
      </div>
    )

  const chat =
    messages.length === 0 ? (
      <EmptyState title="Nadie ha escrito todavía" />
    ) : (
      <Card as="section" aria-labelledby="chat-grupo" className="p-0 md:p-0">
        <h2 id="chat-grupo" className="sr-only">
          Chat del grupo
        </h2>
        <ul className="divide-y divide-border">
          {messages.map((msg) => {
            const tipo = TIPO_MENSAJE[msg.tipo]
            return (
              <li key={msg.id} className="flex items-start gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[14px] font-semibold text-fg">
                      {msg.nombre_usuario}
                    </span>
                    <span className="text-caption text-fg-subtle">
                      {fechaHora(msg.created_at)}
                    </span>
                    {tipo ? (
                      <Badge variant={tipo.variant}>{tipo.label}</Badge>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-body-s break-words text-fg">
                    {msg.mensaje}
                  </p>
                </div>
                <AccionesFila
                  etiqueta={`Acciones del mensaje de ${msg.nombre_usuario}`}
                  acciones={[
                    {
                      tipo: 'accion',
                      clave: 'borrar',
                      label: 'Borrar mensaje',
                      icono: 'borrar',
                      peligro: true,
                      action: deleteMessage.bind(null, msg.id),
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
              </li>
            )
          })}
        </ul>
      </Card>
    )

  const columnasGastos: readonly Columna<GroupExpenseRow>[] = [
    {
      id: 'concepto',
      encabezado: 'Concepto',
      tarjeta: 'titulo',
      celda: (e) => <span className="font-medium">{e.concepto}</span>,
    },
    {
      id: 'pago',
      encabezado: 'Pagó',
      tarjeta: 'meta',
      celda: (e) => e.nombre_pagador,
    },
    {
      id: 'monto',
      encabezado: 'Monto',
      alinear: 'fin',
      tarjeta: 'meta',
      celda: (e) => pago(Number(e.monto)),
    },
    {
      id: 'fecha',
      encabezado: 'Fecha',
      className: 'whitespace-nowrap text-fg-muted',
      celda: (e) => fecha(e.created_at),
    },
  ]

  const gastos = (
    <DataTable
      etiqueta="Gastos del grupo"
      densidad={false}
      cabecera={
        <span className="tnum">
          {cantidad(expenses.length, 'gasto', 'gastos')} · Total{' '}
          {pago(totalGastos)}
        </span>
      }
      columnas={columnasGastos}
      filas={expenses}
      clave={(e) => e.id}
      acciones={(e) => (
        <AccionesFila
          etiqueta={`Acciones del gasto ${e.concepto}`}
          acciones={[
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
      vacio={<EmptyState title="Sin gastos todavía" />}
    />
  )

  return (
    <div className="space-y-8">
      <DetalleCabecera
        volver={{ href: '/admin/trips', label: 'Viajes' }}
        kicker="Viaje"
        titulo={destino}
        subtitulo={[
          formatRangoFechas(data.fechaInicio, data.fechaFin),
          formatDias(dias.length),
          formatViajeros(data.personas ?? 1),
          `Paquete ${etiqueta(ETIQUETA_PAQUETE, trip.paquete)}`,
        ]
          .filter(Boolean)
          .join(' · ')}
        id={trip.id}
        estado={
          <>
            <EstadoBadge tipo="viaje" estado={trip.estado} />
            {trip.is_public ? (
              <Badge variant="info">
                <Globe aria-hidden="true" />
                Compartido
              </Badge>
            ) : null}
          </>
        }
      />

      <PestanasDetalle
        etiqueta="Secciones del viaje"
        inicial={param(sp, 'tab')}
        pestanas={[
          {
            valor: 'itinerario',
            label: 'Itinerario',
            count: dias.length,
            contenido: itinerario,
          },
          {
            valor: 'miembros',
            label: 'Miembros',
            count: members.length,
            contenido: miembros,
          },
          {
            valor: 'chat',
            label: 'Chat',
            count: messages.length,
            contenido: chat,
          },
          {
            valor: 'gastos',
            label: 'Gastos',
            count: expenses.length,
            contenido: gastos,
          },
        ]}
      />

      <ZonaPeligro descripcion="Lo que borres aquí desaparece para el dueño y todo su grupo.">
        <FilaPeligro
          titulo="Eliminar el viaje"
          descripcion="Borra el itinerario y su grupo: miembros, chat, votos y gastos. No se puede deshacer."
        >
          <ActionButton
            action={deleteTrip.bind(null, id)}
            label="Eliminar viaje"
            icon={<Trash2 />}
            variant="danger-outline"
            confirm={{
              titulo: '¿Eliminar este viaje?',
              descripcion:
                'Se borran el itinerario y todo su grupo. Esta acción no se puede deshacer.',
              confirmar: 'Eliminar viaje',
              cargando: 'Eliminando…',
              escribir: destino,
            }}
            exito="Viaje eliminado"
            error="No se pudo eliminar el viaje"
            redirigirA="/admin/trips"
          />
        </FilaPeligro>
      </ZonaPeligro>
    </div>
  )
}
