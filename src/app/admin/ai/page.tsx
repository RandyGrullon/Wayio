import type { Metadata } from 'next'
import { CheckCircle2, XCircle } from 'lucide-react'
import { BarChart } from '@/components/admin/BarChart'
import { DataTable } from '@/components/admin/DataTable'
import type { Columna } from '@/components/admin/DataTable'
import { Encabezado, TituloBloque } from '@/components/admin/Encabezado'
import { StatCard } from '@/components/admin/StatCard'
import {
  ETIQUETA_PROVEEDOR_IA,
  cantidad,
  etiqueta,
  fechaHora,
  usdPreciso,
} from '@/components/admin/etiquetas'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import type { AiUsageStats } from '@/lib/admin/queries'
import { formatNumero, formatPorcentaje } from '@/lib/utils/formatters'
import type { AiLogRow } from '@/types/admin'
import { exigirAdmin } from '../_lib/acceso'
import { datosIa } from '../_lib/datos'

export const metadata: Metadata = { title: 'Uso de IA · Admin' }

const DIAS = 30

type PorProveedor = AiUsageStats['byProvider'][number]
type PorModelo = AiUsageStats['byModel'][number]

function segundos(ms: number): string {
  return ms >= 1000
    ? `${formatNumero(ms / 1000, 1)} s`
    : `${formatNumero(ms)} ms`
}

const COLUMNAS_PROVEEDOR: readonly Columna<PorProveedor>[] = [
  {
    id: 'proveedor',
    encabezado: 'Proveedor',
    tarjeta: 'titulo',
    celda: (p) => (
      <span className="font-medium">
        {etiqueta(ETIQUETA_PROVEEDOR_IA, p.provider)}
      </span>
    ),
  },
  {
    id: 'llamadas',
    encabezado: 'Llamadas',
    alinear: 'fin',
    tarjeta: 'meta',
    celda: (p) => formatNumero(p.calls),
    celdaTarjeta: (p) => cantidad(p.calls, 'llamada', 'llamadas'),
  },
  {
    id: 'tokens',
    encabezado: 'Tokens',
    alinear: 'fin',
    tarjeta: 'meta',
    celda: (p) => formatNumero(p.tokens),
    celdaTarjeta: (p) => `${formatNumero(p.tokens)} tokens`,
  },
  {
    id: 'costo',
    encabezado: 'Costo',
    alinear: 'fin',
    tarjeta: 'meta',
    celda: (p) => usdPreciso(p.cost),
  },
]

const COLUMNAS_MODELO: readonly Columna<PorModelo>[] = [
  {
    id: 'modelo',
    encabezado: 'Modelo',
    tarjeta: 'titulo',
    celda: (m) => (
      <code className="font-mono text-[13px] text-fg">{m.model}</code>
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

const COLUMNAS_RECIENTES: readonly Columna<AiLogRow>[] = [
  {
    id: 'cuando',
    encabezado: 'Cuándo',
    tarjeta: 'titulo',
    className: 'whitespace-nowrap',
    celda: (l) => fechaHora(l.created_at),
  },
  {
    id: 'modelo',
    encabezado: 'Modelo',
    tarjeta: 'meta',
    celda: (l) => (
      <span className="block min-w-0">
        <code className="block truncate font-mono text-[13px] text-fg">
          {l.model}
        </code>
        <span className="block text-caption text-fg-muted">
          {etiqueta(ETIQUETA_PROVEEDOR_IA, l.provider)}
          {l.endpoint ? ` · ${l.endpoint}` : ''}
        </span>
      </span>
    ),
  },
  {
    id: 'tokens',
    encabezado: 'Tokens',
    alinear: 'fin',
    celda: (l) => formatNumero(l.total_tokens),
  },
  {
    id: 'costo',
    encabezado: 'Costo',
    alinear: 'fin',
    tarjeta: 'meta',
    celda: (l) => usdPreciso(Number(l.cost_usd)),
  },
  {
    id: 'latencia',
    encabezado: 'Latencia',
    alinear: 'fin',
    celda: (l) => segundos(l.latency_ms),
  },
  {
    id: 'estado',
    encabezado: 'Estado',
    tarjeta: 'meta',
    celda: (l) =>
      l.success ? (
        <Badge variant="success">
          <CheckCircle2 aria-hidden="true" />
          Correcta
        </Badge>
      ) : (
        <Badge variant="error" title={l.error ?? undefined}>
          <XCircle aria-hidden="true" />
          Error
        </Badge>
      ),
  },
]

export default async function AiUsagePage() {
  if (!(await exigirAdmin())) return null
  const s = await datosIa(DIAS)
  const hayLlamadas = s.totalCalls > 0
  const exito = s.successRate * 100

  return (
    <div className="space-y-8">
      <Encabezado
        titulo="Uso de IA"
        descripcion="Cada generación, ajuste o validación de la web y de la app queda registrada con sus tokens, costo y latencia. Últimos 30 días."
      />

      {/* 5 columnas solo con sitio (xl): junto al sidebar, a 1024 px, cada
          tarjeta se quedaría en ~90 px de contenido. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Llamadas" value={formatNumero(s.totalCalls)} />
        <StatCard
          label="Costo"
          value={usdPreciso(s.totalCost)}
          caption={
            hayLlamadas
              ? `${usdPreciso(s.totalCost / s.totalCalls)} por llamada`
              : undefined
          }
        />
        <StatCard label="Tokens" value={formatNumero(s.totalTokens)} />
        <StatCard
          label="Éxito"
          value={hayLlamadas ? formatPorcentaje(exito, 1) : '—'}
          tone={!hayLlamadas ? 'neutral' : exito >= 95 ? 'neutral' : 'danger'}
          caption={
            !hayLlamadas
              ? 'Sin llamadas en el periodo'
              : exito >= 95
                ? 'Dentro de lo esperado'
                : 'Por debajo del 95 %'
          }
        />
        <StatCard
          label="Latencia media"
          value={hayLlamadas ? segundos(s.avgLatency) : '—'}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <Card as="section" aria-labelledby="graf-costo" className="p-5 md:p-6">
        <TituloBloque id="graf-costo">Costo diario</TituloBloque>
        <p className="mt-0.5 text-caption text-fg-muted">
          En dólares, últimos 30 días
        </p>
        <BarChart
          className="mt-6"
          data={s.series}
          formato="usd"
          titulo="Costo diario de IA en dólares, últimos 30 días"
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="ia-proveedor" className="space-y-3">
          <TituloBloque id="ia-proveedor">Por proveedor</TituloBloque>
          <DataTable
            etiqueta="Uso de IA por proveedor"
            densidad={false}
            columnas={COLUMNAS_PROVEEDOR}
            filas={s.byProvider}
            clave={(p) => p.provider}
            vacio={
              <EmptyState
                illustration="ninguna"
                title="Sin datos"
                className="py-8"
              />
            }
          />
        </section>
        <section aria-labelledby="ia-modelo" className="space-y-3">
          <TituloBloque id="ia-modelo">Por modelo</TituloBloque>
          <DataTable
            etiqueta="Uso de IA por modelo"
            densidad={false}
            columnas={COLUMNAS_MODELO}
            filas={s.byModel}
            clave={(m) => m.model}
            vacio={
              <EmptyState
                illustration="ninguna"
                title="Sin datos"
                className="py-8"
              />
            }
          />
        </section>
      </div>

      <section aria-labelledby="ia-recientes" className="space-y-3">
        <TituloBloque id="ia-recientes">Llamadas recientes</TituloBloque>
        <DataTable
          etiqueta="Llamadas de IA recientes"
          cabecera={
            <span className="tnum">
              Últimas {formatNumero(s.recent.length)}
            </span>
          }
          columnas={COLUMNAS_RECIENTES}
          filas={s.recent}
          clave={(l) => l.id}
          vacio={
            <EmptyState
              title="Aún no hay registros de IA"
              description="Cuando alguien trace un viaje, la llamada aparecerá aquí."
            />
          }
        />
      </section>
    </div>
  )
}
