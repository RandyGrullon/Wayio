import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Ban, Bot, ShieldCheck, Trash2, Undo2 } from 'lucide-react'
import { ActionButton } from '@/components/admin/ActionButton'
import { CopiarTexto } from '@/components/admin/CopiarTexto'
import { DataTable } from '@/components/admin/DataTable'
import type { Columna } from '@/components/admin/DataTable'
import { Dato, Datos } from '@/components/admin/Datos'
import { DetalleCabecera } from '@/components/admin/DetalleCabecera'
import { TituloBloque } from '@/components/admin/Encabezado'
import { PestanasDetalle } from '@/components/admin/PestanasDetalle'
import { SelectAction } from '@/components/admin/SelectAction'
import { StatCard } from '@/components/admin/StatCard'
import { FilaPeligro, ZonaPeligro } from '@/components/admin/ZonaPeligro'
import {
  ETIQUETA_NIVEL,
  ETIQUETA_PAQUETE,
  ETIQUETA_PROVEEDOR_IA,
  ETIQUETA_ROL,
  OPCIONES_PLAN,
  cantidad,
  etiqueta,
  fecha,
  fechaHora,
  nombrePlan,
  origenSuscripcion,
  usdPreciso,
} from '@/components/admin/etiquetas'
import { Badge, EstadoBadge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  deleteUserAccount,
  grantPlan,
  revokePlan,
  setUserBanned,
  setUserRole,
} from '@/lib/admin/actions'
import type { UserAiUsage, UserTripSummary } from '@/lib/admin/queries'
import { formatNumero, formatPorcentaje } from '@/lib/utils/formatters'
import { exigirAdmin } from '../../_lib/acceso'
import { datosUsuario } from '../../_lib/datos'
import { param } from '../../_lib/listas'
import type { ParamsBusqueda } from '../../_lib/listas'

export const metadata: Metadata = { title: 'Detalle de usuario · Admin' }

type IaPorModelo = UserAiUsage['byModel'][number]

const COLUMNAS_IA: readonly Columna<IaPorModelo>[] = [
  {
    id: 'modelo',
    encabezado: 'Modelo',
    tarjeta: 'titulo',
    celda: (m) => (
      <span className="block min-w-0">
        <code className="block truncate font-mono text-[13px] text-fg">
          {m.model}
        </code>
        <span className="block text-caption text-fg-muted">
          {etiqueta(ETIQUETA_PROVEEDOR_IA, m.provider)}
        </span>
      </span>
    ),
  },
  {
    id: 'llamadas',
    encabezado: 'Llamadas',
    alinear: 'fin',
    tarjeta: 'meta',
    celda: (m) => formatNumero(m.calls),
    celdaTarjeta: (m) => cantidad(m.calls, 'llamada', 'llamadas'),
  },
  {
    id: 'tokens',
    encabezado: 'Tokens',
    alinear: 'fin',
    tarjeta: 'meta',
    celda: (m) => formatNumero(m.tokens),
    celdaTarjeta: (m) => `${formatNumero(m.tokens)} tokens`,
  },
  {
    id: 'costo',
    encabezado: 'Costo',
    alinear: 'fin',
    tarjeta: 'meta',
    celda: (m) => usdPreciso(m.cost),
  },
]

const COLUMNAS_VIAJES: readonly Columna<UserTripSummary>[] = [
  {
    id: 'destino',
    encabezado: 'Destino',
    tarjeta: 'titulo',
    celda: (t) => <span className="font-medium">{t.destino}</span>,
  },
  {
    id: 'paquete',
    encabezado: 'Paquete',
    tarjeta: 'meta',
    celda: (t) => etiqueta(ETIQUETA_PAQUETE, t.paquete),
  },
  {
    id: 'estado',
    encabezado: 'Estado',
    tarjeta: 'meta',
    celda: (t) => <EstadoBadge tipo="viaje" estado={t.estado} />,
  },
  {
    id: 'creado',
    encabezado: 'Creado',
    tarjeta: 'meta',
    className: 'whitespace-nowrap text-fg-muted',
    celda: (t) => fecha(t.created_at),
  },
]

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<ParamsBusqueda>
}) {
  const sesion = await exigirAdmin()
  if (!sesion) return null
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const { profile, subscription, trips, referral, ai } = await datosUsuario(id)
  if (!profile) notFound()

  const propia = profile.id === sesion.userId
  const nombre = profile.full_name?.trim()
  const titulo = nombre || profile.email || 'Usuario sin email'
  const planId = subscription?.plan_id ?? 'free'
  const origen = subscription ? origenSuscripcion(subscription) : null
  const avisoPropia = propia ? (
    <Callout tone="info">
      Es tu propia cuenta: no puedes cambiar su rol, banearla ni eliminarla
      desde aquí.
    </Callout>
  ) : null

  const resumen = (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card as="section" aria-labelledby="ficha-cuenta">
        <TituloBloque id="ficha-cuenta">Cuenta</TituloBloque>
        <Datos className="mt-4">
          <Dato etiqueta="Email">{profile.email ?? '—'}</Dato>
          <Dato etiqueta="Nombre">{nombre || '—'}</Dato>
          <Dato etiqueta="Registro">{fechaHora(profile.created_at)}</Dato>
          <Dato etiqueta="Última actualización">
            {fechaHora(profile.updated_at)}
          </Dato>
          <Dato etiqueta="Viajes guardados">{formatNumero(trips.length)}</Dato>
        </Datos>
        <SelectAction
          className="mt-5"
          label="Rol"
          value={profile.role}
          options={[
            { value: 'user', label: 'Usuario' },
            { value: 'admin', label: 'Admin' },
          ]}
          action={setUserRole.bind(null, id)}
          disabled={propia}
          {...(propia ? { hint: 'No puedes cambiar tu propio rol.' } : {})}
          confirmTitulo="¿Cambiar el rol a {valor}?"
          confirmDescripcion="Un admin tiene acceso completo a este panel: usuarios, pagos y ajustes."
          confirmar="Cambiar rol"
          exito="Rol actualizado"
          error="No se pudo cambiar el rol"
        />
      </Card>

      <Card as="section" aria-labelledby="ficha-plan">
        <TituloBloque id="ficha-plan">Plan</TituloBloque>
        <Datos className="mt-4">
          <Dato etiqueta="Plan">{nombrePlan(planId)}</Dato>
          <Dato etiqueta="Estado">
            {subscription ? (
              <EstadoBadge tipo="suscripcion" estado={subscription.status} />
            ) : (
              'Sin suscripción'
            )}
          </Dato>
          {origen ? (
            <Dato etiqueta="Origen">
              <Badge variant={origen.variant}>{origen.label}</Badge>
            </Dato>
          ) : null}
        </Datos>
        <SelectAction
          className="mt-5"
          label="Cambiar plan"
          hint="Concederlo a mano no genera cobro ni suma al MRR."
          value={planId}
          options={OPCIONES_PLAN}
          action={grantPlan.bind(null, id)}
          confirmTitulo="¿Pasar a {valor}?"
          confirmDescripcion="El plan queda concedido a mano, sin cobro en Stripe y sin fecha de fin hasta que lo revoques."
          confirmar="Cambiar plan"
          exito="Plan actualizado"
          error="No se pudo cambiar el plan"
        />
      </Card>
    </div>
  )

  const viajes = (
    <DataTable
      etiqueta={`Viajes de ${titulo}`}
      densidad={false}
      columnas={COLUMNAS_VIAJES}
      filas={trips}
      clave={(t) => t.id}
      href={(t) => `/admin/trips/${t.id}`}
      etiquetaEnlace={(t) => `Ver el viaje a ${t.destino}`}
      vacio={
        <EmptyState
          title="Aún no tiene viajes guardados"
          description="Los viajes que guarde en la web o en la app aparecerán aquí."
        />
      }
    />
  )

  const suscripcion = subscription ? (
    <Card
      as="section"
      aria-labelledby="ficha-suscripcion"
      className="max-w-2xl"
    >
      <TituloBloque
        id="ficha-suscripcion"
        acciones={
          <ActionButton
            action={revokePlan.bind(null, id)}
            label="Revocar plan"
            icon={<Undo2 />}
            disabled={planId === 'free'}
            confirm={{
              titulo: '¿Revocar el plan?',
              descripcion:
                'Pasará al plan Gratis. Si paga con Stripe, primero se cancela el cobro allí.',
              confirmar: 'Revocar plan',
              cargando: 'Revocando…',
            }}
            exito="Plan revocado"
            error="No se pudo revocar el plan"
          />
        }
      >
        Suscripción
      </TituloBloque>
      <Datos className="mt-4">
        <Dato etiqueta="Plan">{nombrePlan(subscription.plan_id)}</Dato>
        <Dato etiqueta="Nivel">
          {etiqueta(ETIQUETA_NIVEL, subscription.tier)}
        </Dato>
        <Dato etiqueta="Estado">
          <EstadoBadge tipo="suscripcion" estado={subscription.status} />
        </Dato>
        {origen ? (
          <Dato etiqueta="Origen">
            <Badge variant={origen.variant}>{origen.label}</Badge>
          </Dato>
        ) : null}
        <Dato etiqueta="Cliente de Stripe">
          {subscription.stripe_customer_id ? (
            <CopiarTexto valor={subscription.stripe_customer_id} />
          ) : (
            '—'
          )}
        </Dato>
        <Dato etiqueta="Suscripción de Stripe">
          {subscription.stripe_subscription_id ? (
            <CopiarTexto valor={subscription.stripe_subscription_id} />
          ) : (
            '—'
          )}
        </Dato>
        <Dato etiqueta="Fin del periodo">
          {subscription.current_period_end
            ? fecha(subscription.current_period_end)
            : 'Sin fecha de fin'}
        </Dato>
        <Dato etiqueta="Cancela al final del periodo">
          {subscription.cancel_at_period_end ? 'Sí' : 'No'}
        </Dato>
        <Dato etiqueta="Alta">{fecha(subscription.created_at)}</Dato>
      </Datos>
    </Card>
  ) : (
    <EmptyState
      illustration="sello"
      title="Sin suscripción"
      description="Está en el plan Gratis. Puedes concederle un plan desde Resumen."
    />
  )

  const referidos = referral ? (
    <Card as="section" aria-labelledby="ficha-referidos" className="max-w-2xl">
      <TituloBloque id="ficha-referidos">Código de referido</TituloBloque>
      <Datos className="mt-4">
        <Dato etiqueta="Código">
          <CopiarTexto
            valor={referral.code}
            etiqueta="Copiar código"
            aviso="Código copiado"
          />
        </Dato>
        <Dato etiqueta="Conversiones">
          {formatNumero(referral.conversions)}
        </Dato>
        <Dato etiqueta="Creado">{fecha(referral.created_at)}</Dato>
      </Datos>
    </Card>
  ) : (
    <EmptyState
      illustration="sello"
      title="Aún no tiene código de referido"
      description="El código se crea cuando la persona abre su sección de referidos."
    />
  )

  const exitoIa = ai.successRate * 100
  const ia =
    ai.calls === 0 ? (
      <EmptyState
        icon={Bot}
        title={`Sin uso de IA en los últimos ${ai.days} días`}
        description="Cuando trace, ajuste o valide un viaje en la web o en la app, sus llamadas aparecerán aquí."
        action={
          <ButtonLink href="/admin/ai" variant="outline">
            Ver uso de IA de la plataforma
          </ButtonLink>
        }
      />
    ) : (
      <div className="space-y-6">
        <p className="text-body-s text-fg-muted">
          Últimos {ai.days} días · última llamada el {fechaHora(ai.lastCallAt)}
        </p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Llamadas" value={formatNumero(ai.calls)} />
          <StatCard
            label="Éxito"
            value={formatPorcentaje(exitoIa, 1)}
            tone={exitoIa >= 95 ? 'neutral' : 'danger'}
            caption={
              exitoIa >= 95 ? 'Dentro de lo esperado' : 'Por debajo del 95 %'
            }
          />
          <StatCard label="Tokens" value={formatNumero(ai.tokens)} />
          <StatCard
            label="Costo"
            value={usdPreciso(ai.cost)}
            caption={`${usdPreciso(ai.cost / ai.calls)} por llamada`}
          />
        </div>
        <section aria-labelledby="ia-usuario-modelo" className="space-y-3">
          <TituloBloque
            id="ia-usuario-modelo"
            acciones={
              <ButtonLink href="/admin/ai" variant="link" size="sm">
                Ver toda la plataforma
              </ButtonLink>
            }
          >
            Por modelo
          </TituloBloque>
          <DataTable
            etiqueta={`Uso de IA de ${titulo} por modelo`}
            densidad={false}
            columnas={COLUMNAS_IA}
            filas={ai.byModel}
            clave={(m) => m.model}
          />
        </section>
      </div>
    )

  return (
    <div className="space-y-8">
      <DetalleCabecera
        volver={{ href: '/admin/users', label: 'Usuarios' }}
        titulo={titulo}
        subtitulo={nombre && profile.email ? profile.email : undefined}
        id={profile.id}
        estado={
          <>
            <Badge variant={profile.role === 'admin' ? 'brand' : 'default'}>
              {profile.role === 'admin' ? (
                <ShieldCheck aria-hidden="true" />
              ) : null}
              {etiqueta(ETIQUETA_ROL, profile.role)}
            </Badge>
            {profile.is_banned ? (
              <Badge variant="error">
                <Ban aria-hidden="true" />
                Baneada
              </Badge>
            ) : (
              <Badge variant="success">Activa</Badge>
            )}
          </>
        }
      />

      {avisoPropia}

      <PestanasDetalle
        etiqueta="Secciones de la ficha"
        inicial={param(sp, 'tab')}
        pestanas={[
          { valor: 'resumen', label: 'Resumen', contenido: resumen },
          {
            valor: 'viajes',
            label: 'Viajes',
            count: trips.length,
            contenido: viajes,
          },
          {
            valor: 'suscripcion',
            label: 'Suscripción',
            contenido: suscripcion,
          },
          { valor: 'referidos', label: 'Referidos', contenido: referidos },
          { valor: 'ia', label: 'IA', count: ai.calls, contenido: ia },
        ]}
      />

      <ZonaPeligro descripcion="Afectan al acceso de la persona y a sus datos.">
        <FilaPeligro
          titulo={profile.is_banned ? 'Quitar el ban' : 'Banear la cuenta'}
          descripcion={
            profile.is_banned
              ? 'Podrá volver a iniciar sesión en la web y en la app.'
              : 'No podrá iniciar sesión en la web ni en la app hasta que le quites el ban.'
          }
        >
          <ActionButton
            action={setUserBanned.bind(null, id, !profile.is_banned)}
            label={profile.is_banned ? 'Quitar ban' : 'Banear'}
            icon={<Ban />}
            variant={profile.is_banned ? 'outline' : 'danger-outline'}
            disabled={propia}
            confirm={
              profile.is_banned
                ? {
                    titulo: '¿Quitar el ban?',
                    descripcion: 'Podrá volver a iniciar sesión.',
                    confirmar: 'Quitar ban',
                    tono: 'neutral',
                  }
                : {
                    titulo: '¿Banear esta cuenta?',
                    descripcion:
                      'No podrá iniciar sesión en la web ni en la app hasta que le quites el ban.',
                    confirmar: 'Banear cuenta',
                    cargando: 'Baneando…',
                  }
            }
            exito={profile.is_banned ? 'Ban retirado' : 'Cuenta baneada'}
            error={
              profile.is_banned
                ? 'No se pudo quitar el ban'
                : 'No se pudo banear la cuenta'
            }
          />
        </FilaPeligro>
        <FilaPeligro
          titulo="Eliminar la cuenta"
          descripcion="Borra la cuenta y todos sus datos: viajes, grupos, suscripción y referidos. No se puede deshacer."
        >
          <ActionButton
            action={deleteUserAccount.bind(null, id)}
            label="Eliminar cuenta"
            icon={<Trash2 />}
            variant="danger-outline"
            disabled={propia}
            confirm={{
              titulo: '¿Eliminar esta cuenta?',
              descripcion:
                'Se borran la cuenta y todos sus datos. Esta acción no se puede deshacer.',
              confirmar: 'Eliminar cuenta',
              cargando: 'Eliminando…',
              escribir: profile.email ?? profile.id,
            }}
            exito="Cuenta eliminada"
            error="No se pudo eliminar la cuenta"
            redirigirA="/admin/users"
          />
        </FilaPeligro>
      </ZonaPeligro>
    </div>
  )
}
