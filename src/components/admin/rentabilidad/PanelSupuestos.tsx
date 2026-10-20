'use client'

import { useId } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, Plus, RotateCcw, Trash2 } from 'lucide-react'
import type { AccionConCupo } from '@/constants/planes'
import { CUPO_GRATIS, NOMBRE_PLAN } from '@/constants/planes'
import type { PlanKey } from '@/constants/pricing'
import { Button, IconButton } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Segmented } from '@/components/ui/Segmented'
import { Select } from '@/components/ui/Select'
import { fijosMensuales, PLANES_CALCULO } from '@/lib/rentabilidad/calculo'
import {
  CANALES_COBRO,
  ESCENARIOS_IA,
  MODELOS_ESCENARIO,
  NOMBRE_CANAL,
  type ComisionCanal,
  type CostoFijo,
  type DatosRentabilidad,
  type EscenarioIa,
  type FuenteCosto,
  type Periodicidad,
  type PerfilUso,
  type Referencias,
  type Supuestos,
  type UsoPorUsuario,
} from '@/lib/rentabilidad/tipos'
import { cn } from '@/lib/utils/cn'
import { formatNumero } from '@/lib/utils/formatters'
import { usd } from '../etiquetas'
import { CampoNumero } from './CampoNumero'

/**
 * Supuestos editables de la calculadora (docs/DISENO.md §6.12, patrón de
 * SettingsPanel): todo cambia el resultado al momento; «Guardar» los deja en
 * la tabla privada admin_private_settings. Cada grupo se pliega.
 */

const NOMBRE_ESCENARIO_CORTO: Record<EscenarioIa, string> = {
  opus: 'Opus',
  sonnet: 'Sonnet',
  haiku: 'Haiku',
  groq: 'Groq',
}

const NOMBRE_PERIODICIDAD: Record<Periodicidad, string> = {
  mes: 'al mes',
  anio: 'al año',
  unico: 'una vez',
}

const NOMBRE_CUPO: Record<AccionConCupo, string> = {
  generar: 'Viajes',
  ajustar: 'Ajustes',
  analizar: 'Fotos o videos',
}

function Grupo({
  titulo,
  abierto = false,
  children,
}: {
  titulo: string
  abierto?: boolean
  children: ReactNode
}) {
  return (
    <details
      open={abierto}
      className="group/grupo border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm text-[15px] font-semibold text-fg [&::-webkit-details-marker]:hidden">
        {titulo}
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.75}
          className="size-4 shrink-0 text-fg-muted transition-transform duration-(--dur-fast) group-open/grupo:rotate-180"
        />
      </summary>
      <div className="mt-4 space-y-4">{children}</div>
    </details>
  )
}

function hayUsoReal(uso: UsoPorUsuario): boolean {
  return uso.porTier.pago.usuarios + uso.porTier.gratis.usuarios > 0
}

export function PanelSupuestos({
  s,
  onCambio,
  datos,
  referencias,
  usoDisponible,
  hayCambios,
  guardando,
  onGuardar,
  onRestablecer,
  version,
}: {
  s: Supuestos
  onCambio: (s: Supuestos, rehacerCampos?: boolean) => void
  datos: DatosRentabilidad
  referencias: Referencias
  usoDisponible: UsoPorUsuario
  hayCambios: boolean
  guardando: boolean
  onGuardar: () => void
  onRestablecer: () => void
  /** Cambia al restablecer: los campos se vuelven a montar con su valor. */
  version: number
}) {
  const id = useId()
  const sinTabla = datos.supuestos.estado === 'sin_tabla'
  const realDisponible = hayUsoReal(usoDisponible)
  const canal = s.comisiones[s.canal]
  const poner = <K extends keyof Supuestos>(clave: K, valor: Supuestos[K]) =>
    onCambio({ ...s, [clave]: valor })
  const ponerComision = (clave: keyof ComisionCanal, valor: number) =>
    poner('comisiones', {
      ...s.comisiones,
      [s.canal]: { ...canal, [clave]: valor },
    })
  const ponerFijo = (i: number, cambio: Partial<CostoFijo>) =>
    poner(
      'costosFijos',
      s.costosFijos.map((c, j) => (j === i ? { ...c, ...cambio } : c))
    )

  const activosReales = datos.periodos['30d'].activos.total
  const sus = datos.suscriptores
  const totalReales =
    PLANES_CALCULO.reduce((t, p) => t + sus.recurrentes[p], 0) +
    sus.pasesVigentes
  const mezclaReal = (): Record<PlanKey, number> =>
    Object.fromEntries(
      PLANES_CALCULO.map((p) => [
        p,
        Number(
          (
            ((sus.recurrentes[p] +
              (p === 'pro_por_viaje' ? sus.pasesVigentes : 0)) /
              Math.max(1, totalReales)) *
            100
          ).toFixed(1)
        ),
      ])
    ) as Record<PlanKey, number>
  const sumaMezcla = PLANES_CALCULO.reduce((t, p) => t + s.mezcla[p], 0)

  const agregarFijo = () => {
    let n = 1
    while (s.costosFijos.some((c) => c.id === `extra-${n}`)) n += 1
    onCambio(
      {
        ...s,
        costosFijos: [
          ...s.costosFijos,
          {
            id: `extra-${n}`,
            nombre: 'Otro costo',
            monto: 0,
            periodicidad: 'mes',
          },
        ],
      },
      true
    )
  }

  return (
    <Card as="section" aria-labelledby={`${id}-titulo`} className="p-5 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`${id}-titulo`} className="text-title text-fg">
            Supuestos
          </h2>
          <p className="mt-0.5 text-caption text-fg-muted">
            {datos.supuestos.estado === 'guardados'
              ? 'Guardados en la tabla privada del panel.'
              : 'Valores por defecto del informe.'}{' '}
            Todo recalcula al momento.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<RotateCcw />}
            onClick={onRestablecer}
          >
            Restablecer
          </Button>
          <Button
            type="button"
            variant="tinta"
            size="sm"
            disabled={!hayCambios || sinTabla}
            loading={guardando}
            loadingText="Guardando…"
            onClick={onGuardar}
          >
            Guardar
          </Button>
        </div>
      </div>
      {hayCambios ? (
        <p className="mt-2 text-caption text-fg-muted" role="status">
          Cambios sin guardar
        </p>
      ) : null}
      {sinTabla ? (
        <Callout tone="warning" className="mt-4">
          Para guardar, aplica la migración
          20261017130000_cupos_y_rentabilidad.sql (tabla
          admin_private_settings). Mientras tanto puedes simular sin guardar.
        </Callout>
      ) : null}

      <div key={version} className="mt-5">
        <Grupo titulo="Cobro" abierto>
          <Select
            fieldSize="md"
            label="Canal de cobro principal (web)"
            value={s.canal}
            onChange={(e) => {
              const valor = CANALES_COBRO.find((c) => c === e.target.value)
              if (valor) onCambio({ ...s, canal: valor }, true)
            }}
            options={CANALES_COBRO.map((c) => ({
              value: c,
              label: NOMBRE_CANAL[c],
            }))}
            hint={referencias.notasCanal[s.canal]}
          />
          <CampoNumero
            label="Cobros por Apple o Google"
            valor={s.ventasTiendasPct}
            onCambio={(v) => poner('ventasTiendasPct', v)}
            max={100}
            sufijo="%"
            hint="La app móvil aún no vende con compras integradas."
          />
          <details className="rounded-control bg-surface-2 px-3.5 py-3">
            <summary className="cursor-pointer text-body-s font-medium text-fg">
              Comisión de {NOMBRE_CANAL[s.canal]} y de las tiendas
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <CampoNumero
                label="Por cobro"
                valor={canal.pct}
                onCambio={(v) => ponerComision('pct', v)}
                max={50}
                sufijo="%"
              />
              <CampoNumero
                label="Fijo por cobro"
                valor={canal.fijo}
                onCambio={(v) => ponerComision('fijo', v)}
                max={20}
                sufijo="US$"
              />
              <CampoNumero
                label="Extra suscripción"
                valor={canal.pctRecurrente}
                onCambio={(v) => ponerComision('pctRecurrente', v)}
                max={20}
                sufijo="%"
              />
              <CampoNumero
                label="Pagos al banco al mes"
                valor={canal.retirosMes}
                onCambio={(v) => ponerComision('retirosMes', v)}
                max={31}
                entero
              />
              <CampoNumero
                label="Retiro mínimo"
                valor={canal.retiroMinimo}
                onCambio={(v) => ponerComision('retiroMinimo', v)}
                max={1000}
                sufijo="US$"
              />
              <CampoNumero
                label="Retiro"
                valor={canal.retiroPct}
                onCambio={(v) => ponerComision('retiroPct', v)}
                max={20}
                sufijo="%"
              />
              <CampoNumero
                label="Comisión de las tiendas"
                valor={s.comisionTiendaPct}
                onCambio={(v) => poner('comisionTiendaPct', v)}
                max={50}
                sufijo="%"
                className="col-span-2"
              />
            </div>
          </details>
        </Grupo>

        <Grupo titulo="Usuarios y planes" abierto>
          <CampoNumero
            label="Usuarios activos al mes (proyección)"
            valor={s.usuariosActivos}
            onCambio={(v) => poner('usuariosActivos', v)}
            max={10_000_000}
            entero
            hint={`Reales en los últimos 30 días: ${formatNumero(activosReales)} (aprox.).`}
          />
          {activosReales > 0 && activosReales !== s.usuariosActivos ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() =>
                onCambio({ ...s, usuariosActivos: activosReales }, true)
              }
            >
              Usar los reales ({formatNumero(activosReales)})
            </Button>
          ) : null}
          <CampoNumero
            label="Conversión a pago"
            valor={s.conversionPct}
            onCambio={(v) => poner('conversionPct', v)}
            max={100}
            sufijo="%"
            hint="% de los usuarios activos que pagan. El informe supone 3 %."
          />
          <fieldset className="space-y-3">
            <legend className="text-body-s font-medium text-fg">
              Mezcla de planes de los que pagan
            </legend>
            <div className="grid grid-cols-2 gap-3">
              {PLANES_CALCULO.map((p) => (
                <CampoNumero
                  key={p}
                  label={
                    p === 'pro_grupo'
                      ? `${NOMBRE_PLAN[p]} (oculto)`
                      : NOMBRE_PLAN[p]
                  }
                  valor={s.mezcla[p]}
                  onCambio={(v) => poner('mezcla', { ...s.mezcla, [p]: v })}
                  max={100}
                  sufijo="%"
                />
              ))}
            </div>
            <p
              className={cn(
                'text-caption',
                Math.abs(sumaMezcla - 100) > 0.5
                  ? 'text-warning-fg'
                  : 'text-fg-muted'
              )}
            >
              Suma {formatNumero(sumaMezcla, 1)} %
              {Math.abs(sumaMezcla - 100) > 0.5
                ? ': se reparte en proporción.'
                : '.'}
            </p>
            {totalReales > 0 ? (
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => onCambio({ ...s, mezcla: mezclaReal() }, true)}
              >
                Usar la mezcla real ({formatNumero(totalReales)} de pago)
              </Button>
            ) : null}
          </fieldset>
        </Grupo>

        <Grupo titulo="Inteligencia artificial" abierto>
          <div>
            <p
              id={`${id}-modelo`}
              className="mb-2 text-body-s font-medium text-fg"
            >
              Modelo del itinerario y los ajustes
            </p>
            <Segmented
              labelledBy={`${id}-modelo`}
              options={ESCENARIOS_IA.map((e) => ({
                value: e,
                label: NOMBRE_ESCENARIO_CORTO[e],
                ariaLabel: MODELOS_ESCENARIO[e].nombre,
              }))}
              value={s.escenario}
              onValueChange={(v) => poner('escenario', v)}
              fullWidth
            />
            <p className="mt-1.5 text-caption text-fg-muted">
              Producción usa hoy{' '}
              <code className="font-mono text-[12px]">
                {datos.modeloActual.principal}
              </code>
              . Las tareas rápidas siguen con Haiku (en Groq, con gpt-oss).
            </p>
          </div>
          <Select
            fieldSize="md"
            label="Perfil de uso"
            value={s.perfil}
            onChange={(e) => {
              const valor = (
                ['real', 'real_p90', 'tipico', 'intenso'] as const
              ).find((p) => p === e.target.value)
              if (valor) poner('perfil', valor satisfies PerfilUso)
            }}
            options={[
              {
                value: 'real',
                label: 'Real: media por usuario',
                disabled: !realDisponible,
              },
              {
                value: 'real_p90',
                label: 'Real: p90 (los que más usan)',
                disabled: !realDisponible,
              },
              { value: 'tipico', label: 'Típico del informe' },
              { value: 'intenso', label: 'Intenso del informe' },
            ]}
            hint={
              realDisponible
                ? `Datos de ${usoDisponible.fuente === 'usage_counters' ? 'usage_counters' : 'ai_logs (aprox.)'}: ${usoDisponible.etiqueta}.`
                : 'Aún no hay uso real: típico = 2 viajes y 3 ajustes al mes; intenso = 8 y 10.'
            }
          />
          <div>
            <p
              id={`${id}-fuente`}
              className="mb-2 text-body-s font-medium text-fg"
            >
              Costo por acción
            </p>
            <Segmented
              labelledBy={`${id}-fuente`}
              options={[
                { value: 'real', label: 'Datos reales' },
                { value: 'informe', label: 'Informe' },
              ]}
              value={s.fuenteCosto}
              onValueChange={(v: FuenteCosto) => poner('fuenteCosto', v)}
              fullWidth
            />
            <p className="mt-1.5 text-caption text-fg-muted">
              Real cuando el periodo tiene al menos{' '}
              {referencias.minAccionesReales} acciones de ese tipo; si no, el
              del informe.
            </p>
          </div>
          <fieldset>
            <legend className="mb-2 text-body-s font-medium text-fg">
              Cupo gratis a simular (al mes)
            </legend>
            <div className="grid grid-cols-3 gap-3">
              {(['generar', 'ajustar', 'analizar'] as const).map((a) => (
                <CampoNumero
                  key={a}
                  label={NOMBRE_CUPO[a]}
                  valor={s.cupo[a]}
                  onCambio={(v) => poner('cupo', { ...s.cupo, [a]: v })}
                  max={1000}
                  entero
                />
              ))}
            </div>
            <p className="mt-1.5 text-caption text-fg-muted">
              Hoy: {CUPO_GRATIS.generar} viajes, {CUPO_GRATIS.ajustar} ajustes y{' '}
              {CUPO_GRATIS.analizar} fotos o videos.
            </p>
          </fieldset>
        </Grupo>

        <Grupo titulo={`Costos fijos · ${usd(fijosMensuales(s))} al mes`}>
          <ul className="space-y-4">
            {s.costosFijos.map((c, i) => (
              <li key={c.id} className="space-y-2">
                <Input
                  fieldSize="md"
                  aria-label="Nombre del costo"
                  value={c.nombre}
                  maxLength={60}
                  onChange={(e) => ponerFijo(i, { nombre: e.target.value })}
                  error={c.nombre.trim() ? undefined : 'Ponle un nombre'}
                />
                <div className="flex items-start gap-2">
                  <CampoNumero
                    label={`Monto de ${c.nombre}`}
                    etiquetaOculta
                    valor={c.monto}
                    onCambio={(v) => ponerFijo(i, { monto: v })}
                    max={100_000}
                    sufijo="US$"
                    className="min-w-0 flex-1"
                  />
                  <Select
                    fieldSize="md"
                    aria-label={`Periodicidad de ${c.nombre}`}
                    value={c.periodicidad}
                    onChange={(e) => {
                      const valor = (['mes', 'anio', 'unico'] as const).find(
                        (p) => p === e.target.value
                      )
                      if (valor) ponerFijo(i, { periodicidad: valor })
                    }}
                    options={(['mes', 'anio', 'unico'] as const).map((p) => ({
                      value: p,
                      label: NOMBRE_PERIODICIDAD[p],
                    }))}
                    containerClassName="w-32 shrink-0"
                  />
                  <IconButton
                    label={`Quitar ${c.nombre}`}
                    className="shrink-0"
                    onClick={() =>
                      onCambio(
                        {
                          ...s,
                          costosFijos: s.costosFijos.filter((_, j) => j !== i),
                        },
                        true
                      )
                    }
                  >
                    <Trash2 strokeWidth={1.75} />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Plus />}
              onClick={agregarFijo}
              disabled={s.costosFijos.length >= 40}
            >
              Añadir costo
            </Button>
            <p className="text-caption text-fg-muted">
              Lo anual y lo único se reparten en 12 meses.
            </p>
          </div>
        </Grupo>

        <Grupo titulo="Otros ingresos, margen e impuestos">
          <CampoNumero
            label="Afiliados por usuario activo al mes"
            valor={s.afiliadosPorUsuario}
            onCambio={(v) => poner('afiliadosPorUsuario', v)}
            max={1000}
            sufijo="US$"
            hint="Opcional. Ej.: un hotel de US$450 deja US$18–24.75 de comisión."
          />
          <CampoNumero
            label="Margen objetivo sobre el precio"
            valor={s.margenObjetivoPct}
            onCambio={(v) => poner('margenObjetivoPct', v)}
            max={95}
            sufijo="%"
            hint="Para el precio mínimo de cada plan."
          />
          <p className="text-caption font-semibold text-warning-fg">
            Impuestos: confirmar con contador
          </p>
          <CampoNumero
            label="Impuesto sobre ventas (ITBIS, si aplica)"
            valor={s.impuestoVentasPct}
            onCambio={(v) => poner('impuestoVentasPct', v)}
            max={50}
            sufijo="%"
            hint="Sobre los ingresos netos. Puede ser 0 si es exportación de servicios."
          />
          <CampoNumero
            label="Retención por pagos al exterior (Ley 30-26)"
            valor={s.retencionExteriorPct}
            onCambio={(v) => poner('retencionExteriorPct', v)}
            max={50}
            sufijo="%"
            hint="Sobre lo que pagas a Vercel, Supabase, Anthropic… (15 % según terceros)."
          />
          <CampoNumero
            label="ISR sobre la ganancia"
            valor={s.isrPct}
            onCambio={(v) => poner('isrPct', v)}
            max={50}
            sufijo="%"
            hint="Exento hasta RD$416,220 al año en 2026; luego 15/20/25 %."
          />
        </Grupo>
      </div>
    </Card>
  )
}
