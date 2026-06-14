import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getUserDetail } from '@/lib/admin/queries'
import {
  setUserRole,
  setUserBanned,
  grantPlan,
  revokePlan,
  deleteUserAccount,
} from '@/lib/admin/actions'
import { SelectAction } from '@/components/admin/SelectAction'
import { ActionButton } from '@/components/admin/ActionButton'
import { Badge } from '@/components/ui/Badge'
import { PLANS } from '@/constants/pricing'

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { profile, subscription, trips, referral } = await getUserDetail(id)
  if (!profile) notFound()

  const planOptions = [
    { value: 'free', label: 'Free' },
    ...Object.values(PLANS).map((p) => ({ value: p.id, label: p.nombre })),
  ]

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/users"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Usuarios
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">
          {profile.full_name ?? profile.email ?? 'Usuario'}
        </h1>
        <p className="text-sm text-gray-500">{profile.email}</p>
        <p className="text-xs text-gray-400">
          ID: {profile.id} · Registro:{' '}
          {new Date(profile.created_at).toLocaleString()}
        </p>
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Rol</span>
          <SelectAction
            value={profile.role}
            options={[
              { value: 'user', label: 'user' },
              { value: 'admin', label: 'admin' },
            ]}
            action={setUserRole.bind(null, id)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Plan</span>
          <SelectAction
            value={subscription?.plan_id ?? 'free'}
            options={planOptions}
            action={grantPlan.bind(null, id)}
          />
        </div>
        <ActionButton action={revokePlan.bind(null, id)} label="Revocar plan" />
        <ActionButton
          action={setUserBanned.bind(null, id, !profile.is_banned)}
          label={profile.is_banned ? 'Quitar ban' : 'Banear'}
          variant={profile.is_banned ? 'ghost' : 'danger'}
          confirm={
            profile.is_banned
              ? undefined
              : '¿Banear a este usuario? No podrá iniciar sesión.'
          }
        />
        <ActionButton
          action={deleteUserAccount.bind(null, id)}
          label="Eliminar cuenta"
          variant="danger"
          confirm="Esto elimina la cuenta y TODOS sus datos. ¿Continuar?"
        />
      </div>

      {/* Suscripción */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            Suscripción
          </h2>
          {subscription ? (
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Plan</dt>
                <dd className="font-medium">{subscription.plan_id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Tier</dt>
                <dd>
                  <Badge
                    variant={
                      subscription.tier === 'free' ? 'default' : 'success'
                    }
                  >
                    {subscription.tier}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Estado</dt>
                <dd className="font-medium">{subscription.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Stripe customer</dt>
                <dd className="text-xs text-gray-400">
                  {subscription.stripe_customer_id ?? '—'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-gray-400">Sin suscripción (free).</p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            Referidos
          </h2>
          {referral ? (
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Código</dt>
                <dd className="font-mono font-medium">{referral.code}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Conversiones</dt>
                <dd className="font-medium">{referral.conversions}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-gray-400">Sin código de referido.</p>
          )}
        </div>
      </div>

      {/* Viajes */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700">
          Viajes ({trips.length})
        </h2>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-50">
            {trips.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-gray-900">
                  {t.destino}
                </td>
                <td className="px-4 py-2 text-gray-500">{t.paquete}</td>
                <td className="px-4 py-2">
                  <Badge variant="default">{t.estado}</Badge>
                </td>
                <td className="px-4 py-2 text-gray-400">
                  {new Date(t.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/admin/trips/${t.id}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
            {trips.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-400">
                  Sin viajes.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
