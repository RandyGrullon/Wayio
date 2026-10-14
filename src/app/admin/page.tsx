import type { Metadata } from 'next'
import { BarChart } from '@/components/admin/BarChart'
import { BarraApilada } from '@/components/admin/BarraApilada'
import { Encabezado, TituloBloque } from '@/components/admin/Encabezado'
import { SelectorRango } from '@/components/admin/SelectorRango'
import { StatCard, variacion } from '@/components/admin/StatCard'
import { usd, usdPreciso } from '@/components/admin/etiquetas'
import { Card } from '@/components/ui/Card'
import { RANGOS_PANEL } from '@/lib/admin/queries'
import type { RangoPanel } from '@/lib/admin/queries'
import { formatNumero } from '@/lib/utils/formatters'
import { exigirAdmin } from './_lib/acceso'
import { datosPanel } from './_lib/datos'
import { param } from './_lib/listas'
import type { ParamsBusqueda } from './_lib/listas'

export const metadata: Metadata = { title: 'Panel · Admin' }

const RANGO_POR_DEFECTO: RangoPanel = 30

/** ?rango=7|30|90; cualquier otro valor vuelve al periodo por defecto. */
function leerRango(sp: ParamsBusqueda): RangoPanel {
  const n = Number(param(sp, 'rango'))
  return RANGOS_PANEL.find((r) => r === n) ?? RANGO_POR_DEFECTO
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<ParamsBusqueda>
}) {
  if (!(await exigirAdmin())) return null
  const rango = leerRango(await searchParams)
  const m = await datosPanel(rango)

  const periodo = `${rango} días`
  const vsPrevio = `vs. ${periodo} previos`
  const deltaUsuarios = variacion(m.newUsersPeriodo, m.newUsersPeriodoPrevio)
  const deltaViajes = variacion(m.tripsPeriodo, m.tripsPeriodoPrevio)

  return (
    <div className="space-y-8">
      <Encabezado
        titulo="Panel"
        descripcion="Cómo va Wayio en la web y en la app (comparten este backend)."
        acciones={
          <SelectorRango
            basePath="/admin"
            valor={rango}
            opciones={RANGOS_PANEL}
            porDefecto={RANGO_POR_DEFECTO}
          />
        }
      />

      <section aria-labelledby="kpi-titulo" className="space-y-4">
        <h2 id="kpi-titulo" className="sr-only">
          Indicadores de los últimos {periodo}
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            principal
            label="Ingreso mensual (MRR)"
            value={usd(m.mrr)}
            caption={`ARR estimado: ${usd(m.mrr * 12)} · solo suscripciones cobradas`}
          />
          <StatCard
            label="Usuarios"
            value={formatNumero(m.totalUsers)}
            delta={
              deltaUsuarios === null
                ? null
                : { porcentaje: deltaUsuarios, periodo: vsPrevio }
            }
            serie={m.signupSeries.map((p) => p.value)}
            caption={
              rango === 7
                ? `+${formatNumero(m.newUsersHoy)} hoy`
                : `+${formatNumero(m.newUsersHoy)} hoy · +${formatNumero(m.newUsers7d)} en 7 días`
            }
          />
          <StatCard
            label="Viajes"
            value={formatNumero(m.totalTrips)}
            delta={
              deltaViajes === null
                ? null
                : { porcentaje: deltaViajes, periodo: vsPrevio }
            }
            serie={m.tripSeries.map((p) => p.value)}
            caption={`+${formatNumero(m.tripsPeriodo)} en ${periodo}`}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Suscripciones activas"
            value={formatNumero(m.activeSubs)}
            caption="Planes de pago, incluidos los concedidos"
          />
          <StatCard
            label={`Nuevos (${periodo})`}
            value={formatNumero(m.newUsersPeriodo)}
            caption="Cuentas registradas"
          />
          <StatCard
            label={`Llamadas IA (${periodo})`}
            value={formatNumero(m.aiCallsPeriodo)}
            caption={`${formatNumero(m.aiTokensPeriodo)} tokens`}
          />
          <StatCard
            label={`Costo IA (${periodo})`}
            value={usdPreciso(m.aiCostPeriodo)}
            caption={
              m.aiCallsPeriodo > 0
                ? `${usdPreciso(m.aiCostPeriodo / m.aiCallsPeriodo)} por llamada`
                : 'Sin llamadas en el periodo'
            }
          />
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card
          as="section"
          aria-labelledby="graf-registros"
          className="p-5 md:p-6"
        >
          <TituloBloque id="graf-registros">Registros por día</TituloBloque>
          <p className="mt-0.5 text-caption text-fg-muted">
            Últimos {periodo} · hora de República Dominicana
          </p>
          <BarChart
            className="mt-6"
            data={m.signupSeries}
            titulo={`Registros por día, últimos ${periodo}`}
            unidad={{ uno: 'registro', varios: 'registros' }}
          />
        </Card>
        <Card as="section" aria-labelledby="graf-viajes" className="p-5 md:p-6">
          <TituloBloque id="graf-viajes">Viajes creados por día</TituloBloque>
          <p className="mt-0.5 text-caption text-fg-muted">
            Últimos {periodo} · hora de República Dominicana
          </p>
          <BarChart
            className="mt-6"
            data={m.tripSeries}
            titulo={`Viajes creados por día, últimos ${periodo}`}
            unidad={{ uno: 'viaje', varios: 'viajes' }}
          />
        </Card>
      </div>

      <Card as="section" aria-labelledby="graf-paquetes" className="p-5 md:p-6">
        <TituloBloque id="graf-paquetes">Viajes por paquete</TituloBloque>
        <p className="mt-0.5 text-caption text-fg-muted">
          Todos los viajes guardados
        </p>
        <BarraApilada
          className="mt-5"
          unidad="viajes"
          segmentos={[
            {
              clave: 'basico',
              label: 'Básico',
              valor: m.tripsByPackage.basico,
            },
            {
              clave: 'confort',
              label: 'Confort',
              valor: m.tripsByPackage.confort,
            },
            {
              clave: 'premium',
              label: 'Premium',
              valor: m.tripsByPackage.premium,
            },
          ]}
        />
      </Card>
    </div>
  )
}
