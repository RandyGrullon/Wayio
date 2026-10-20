import { useId } from 'react'
import type { ReactNode } from 'react'
import { NOMBRE_PLAN } from '@/constants/planes'
import { PLANS } from '@/constants/pricing'
import { Badge } from '@/components/ui/Badge'
import { Callout } from '@/components/ui/Callout'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import type {
  Alerta,
  EconomiaPlan,
  FilaEscenario,
  Resultado,
} from '@/lib/rentabilidad/calculo'
import {
  ACCIONES_CUPO,
  GRUPOS_USUARIO,
  MODELOS_ESCENARIO,
  NOMBRE_CANAL,
  NOMBRE_FAMILIA,
  NOMBRE_GRUPO,
  type DatosRentabilidad,
  type FamiliaReal,
  type GrupoUsuario,
  type Referencias,
  type Supuestos,
  type TierUso,
} from '@/lib/rentabilidad/tipos'
import { cn } from '@/lib/utils/cn'
import { formatNumero, formatPorcentaje } from '@/lib/utils/formatters'
import { BarraApilada } from '../BarraApilada'
import { DataTable, type Columna } from '../DataTable'
import { Dato, Datos } from '../Datos'
import { TituloBloque } from '../Encabezado'
import { StatCard } from '../StatCard'
import { cantidad, usd, usdPreciso } from '../etiquetas'
import { Marca } from './Marca'

/**
 * Bloques de resultados de la calculadora (los pinta la isla cliente, que
 * recalcula al momento). Cada cifra lleva su marca «real» o «supuesto».
 */

const NOMBRE_ACCION_CORTO = {
  generar: 'viajes',
  ajustar: 'ajustes',
  analizar: 'fotos o videos',
} as const

const NOMBRE_ACCION_UNO = {
  generar: 'viaje',
  ajustar: 'ajuste',
  analizar: 'foto o video',
} as const

function Dinero({
  valor,
  preciso = false,
}: {
  valor: number
  preciso?: boolean
}) {
  // −0 se escribiría «-US$0.00».
  const v = valor === 0 ? 0 : valor
  return (
    <span className={cn('tnum', v < 0 && 'text-danger')}>
      {preciso ? usdPreciso(v) : usd(v)}
    </span>
  )
}

function Linea({
  etiqueta,
  real,
  children,
}: {
  etiqueta: string
  real: boolean
  children: ReactNode
}) {
  return (
    <Dato etiqueta={etiqueta}>
      <span className="inline-flex items-center gap-2">
        <Marca real={real} />
        {children}
      </span>
    </Dato>
  )
}

function Seccion({
  titulo,
  descripcion,
  children,
}: {
  titulo: string
  descripcion?: ReactNode
  children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div>
        <TituloBloque id={id}>{titulo}</TituloBloque>
        {descripcion ? (
          <p className="mt-0.5 max-w-[75ch] text-caption text-fg-muted">
            {descripcion}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

// ─── (a) Resumen del mes ──────────────────────────────────────────────────

export function ResumenMes({
  r,
  datos,
  s,
}: {
  r: Resultado
  datos: DatosRentabilidad
  s: Supuestos
}) {
  const m = r.real
  const p = r.periodo
  const sus = datos.suscriptores
  const pagan =
    Object.values(sus.recurrentes).reduce((t, n) => t + n, 0) +
    sus.pasesVigentes
  const proyectado = p.factorMes > 1.01
  const id = useId()

  return (
    <section aria-labelledby={id} className="space-y-4">
      <h2 id={id} className="sr-only">
        Resumen del mes
      </h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          principal
          label={m.ganancia < 0 ? 'Pérdida del mes' : 'Ganancia del mes'}
          value={usd(m.ganancia)}
          tone={m.ganancia < 0 ? 'danger' : 'success'}
          caption={
            <>
              Ingresos y uso reales; comisiones y fijos supuestos
              {proyectado ? '. IA proyectada al mes completo.' : '.'}
            </>
          }
        />
        <StatCard
          label="Ingresos netos"
          value={usd(m.ingresosNetos)}
          caption={
            <>
              <Marca real /> {usd(m.ingresosBrutos)} brutos −{' '}
              {usd(m.comisiones)} de comisión
            </>
          }
        />
        <StatCard
          label="IA del mes"
          value={usd(m.ia)}
          tone={m.ia > m.ingresosNetos && m.ia > 0 ? 'warning' : 'neutral'}
          caption={
            <>
              <Marca real /> {usdPreciso(m.iaHastaHoy)} en{' '}
              {cantidad(Math.max(1, Math.round(p.dias)), 'día', 'días')}
            </>
          }
        />
        <StatCard
          label="Usuarios activos"
          value={formatNumero(p.activos.total)}
          caption={
            <>
              <Marca real /> {formatNumero(p.activos.pago)} Pro ·{' '}
              {formatNumero(p.activos.gratis)} gratis (aprox.)
            </>
          }
        />
        <StatCard
          label="Pagan"
          value={formatNumero(pagan)}
          caption={
            <>
              <Marca real />{' '}
              {cantidad(
                pagan - sus.pasesVigentes,
                'suscripción',
                'suscripciones'
              )}{' '}
              · {cantidad(sus.pasesVigentes, 'pase', 'pases')}
            </>
          }
        />
        <StatCard
          label="Concedidos o en gracia"
          value={formatNumero(sus.concedidos + sus.enGracia)}
          caption={
            <>
              <Marca real /> usan Pro sin sumar ingreso
            </>
          }
        />
        <StatCard
          label="Costos fijos"
          value={usd(m.fijos + m.retiros)}
          caption={
            <>
              <Marca real={false} /> {usd(m.fijos)} fijos + {usd(m.retiros)} de
              retiros ({NOMBRE_CANAL[s.canal]})
            </>
          }
        />
      </div>

      <Card className="p-5 md:p-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <h3 className="text-[15px] font-semibold text-fg">
              Cuenta del mes · {p.etiqueta.toLowerCase()}
            </h3>
            <Datos className="mt-3">
              {m.porPlan
                .filter((x) => x.cantidad > 0)
                .map((x) => (
                  <Linea
                    key={x.plan}
                    etiqueta={`${NOMBRE_PLAN[x.plan]} × ${formatNumero(x.cantidad)}`}
                    real
                  >
                    <Dinero valor={x.bruto} />
                  </Linea>
                ))}
              <Linea etiqueta="− Comisiones del cobro" real={false}>
                <Dinero valor={-m.comisiones} />
              </Linea>
              {m.afiliados > 0 ? (
                <Linea etiqueta="+ Afiliados" real={false}>
                  <Dinero valor={m.afiliados} />
                </Linea>
              ) : null}
              {GRUPOS_USUARIO.map((g) =>
                m.iaPorGrupo[g] > 0 ? (
                  <Linea key={g} etiqueta={`− IA · ${NOMBRE_GRUPO[g]}`} real>
                    <Dinero valor={-m.iaPorGrupo[g]} preciso />
                  </Linea>
                ) : null
              )}
              <Linea etiqueta="− Costos fijos" real={false}>
                <Dinero valor={-m.fijos} />
              </Linea>
              {m.retiros > 0 ? (
                <Linea etiqueta="− Retiros del canal" real={false}>
                  <Dinero valor={-m.retiros} />
                </Linea>
              ) : null}
              {m.impuestoVentas + m.retencion + m.isr > 0 ? (
                <Linea etiqueta="− Impuestos (contador)" real={false}>
                  <Dinero valor={-(m.impuestoVentas + m.retencion + m.isr)} />
                </Linea>
              ) : null}
              <Dato etiqueta="Resultado">
                <span
                  className={cn(
                    'text-[15px] font-semibold tnum',
                    m.ganancia < 0 ? 'text-danger' : 'text-success'
                  )}
                >
                  {usd(m.ganancia)}
                </span>
              </Dato>
            </Datos>
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-fg">
              ¿Adónde va el dinero?
            </h3>
            <p className="mt-0.5 text-caption text-fg-muted">
              Costos del mes: cobro, IA y fijos.
            </p>
            <BarraApilada
              className="mt-4"
              unidad="de costos al mes"
              formato={usd}
              segmentos={[
                {
                  clave: 'cobro',
                  label: 'Comisiones y retiros',
                  valor: m.comisiones + m.retiros,
                },
                { clave: 'ia', label: 'IA', valor: m.ia },
                {
                  clave: 'fijos',
                  label: 'Fijos e impuestos',
                  valor: m.fijos + m.impuestoVentas + m.retencion + m.isr,
                },
              ]}
            />
          </div>
        </div>
      </Card>
    </section>
  )
}

// ─── (f) Alertas ──────────────────────────────────────────────────────────

export function Alertas({ alertas }: { alertas: readonly Alerta[] }) {
  if (alertas.length === 0) return null
  return (
    <Seccion titulo="Alertas">
      <ul className="space-y-3">
        {alertas.map((a) => (
          <li key={a.id}>
            <Callout tone={a.tono} title={a.titulo} role="status">
              {a.texto}
            </Callout>
          </li>
        ))}
      </ul>
    </Seccion>
  )
}

// ─── (b) Economía por plan ────────────────────────────────────────────────

function periodoPlan(p: EconomiaPlan): string {
  const periodo = PLANS[p.plan].periodo
  return periodo === 'año'
    ? 'al año'
    : periodo === 'único'
      ? '30 días'
      : 'al mes'
}

const COLUMNAS_PLANES: readonly Columna<EconomiaPlan>[] = [
  {
    id: 'plan',
    encabezado: 'Plan',
    tarjeta: 'titulo',
    celda: (p) => (
      <span className="flex flex-col">
        <span className="inline-flex items-center gap-2 font-medium">
          {p.nombre}
          {p.aLaVenta ? null : <Badge>Oculto</Badge>}
        </span>
        <span className="text-caption text-fg-muted tnum">
          {usd(p.precio)} {periodoPlan(p)}
        </span>
      </span>
    ),
  },
  {
    id: 'comision',
    encabezado: 'Comisión',
    alinear: 'fin',
    celda: (p) => (
      <span className="tnum">
        {usd(p.comision)}{' '}
        <span className="text-fg-muted">
          ({formatPorcentaje(p.comisionPct, 1)})
        </span>
      </span>
    ),
  },
  {
    id: 'neto',
    encabezado: 'Neto al mes',
    alinear: 'fin',
    tarjeta: 'meta',
    celda: (p) => usd(p.netoMensual),
    celdaTarjeta: (p) => `Neto ${usd(p.netoMensual)}/mes`,
  },
  {
    id: 'ia',
    encabezado: 'IA al mes',
    alinear: 'fin',
    tarjeta: 'meta',
    celda: (p) => usdPreciso(p.ia.valor),
    celdaTarjeta: (p) => `IA ${usdPreciso(p.ia.valor)}`,
  },
  {
    id: 'margen',
    encabezado: 'Margen',
    alinear: 'fin',
    tarjeta: 'meta',
    celda: (p) => (
      <span className={cn('tnum', p.margen < 0 && 'text-danger')}>
        {usd(p.margen)}{' '}
        <span className="text-fg-muted">({formatPorcentaje(p.margenPct)})</span>
      </span>
    ),
    celdaTarjeta: (p) => (
      <span className={cn(p.margen < 0 && 'text-danger')}>
        Margen {usd(p.margen)} ({formatPorcentaje(p.margenPct)})
      </span>
    ),
  },
  {
    id: 'intenso',
    encabezado: 'Usuario intenso',
    alinear: 'fin',
    celda: (p) => <Dinero valor={p.margenIntenso} />,
  },
  {
    id: 'minimo',
    encabezado: 'Precio mínimo',
    alinear: 'fin',
    tarjeta: 'meta',
    celda: (p) =>
      p.precioMinimo === null ? (
        <span className="text-danger">Imposible</span>
      ) : (
        <span
          className={cn('tnum', p.precioMinimo > p.precio && 'text-warning-fg')}
        >
          {usd(p.precioMinimo)}
        </span>
      ),
    celdaTarjeta: (p) =>
      p.precioMinimo === null
        ? 'Sin precio mínimo posible'
        : `Mínimo ${usd(p.precioMinimo)}`,
  },
]

export function EconomiaPlanes({ r, s }: { r: Resultado; s: Supuestos }) {
  return (
    <Seccion
      titulo="Economía por plan"
      descripcion={
        <>
          Por suscriptor y mes, con {NOMBRE_CANAL[s.canal]}
          {s.ventasTiendasPct > 0
            ? ` (${formatPorcentaje(s.ventasTiendasPct)} por las tiendas)`
            : ''}{' '}
          y la IA de {MODELOS_ESCENARIO[s.escenario].nombre}. IA:{' '}
          {r.perfilPago.etiqueta} <Marca real={r.perfilPago.real} />. «Usuario
          intenso» es el margen con 8 viajes y 10 ajustes al mes. Precio mínimo:
          el que deja un margen del {formatPorcentaje(s.margenObjetivoPct)}{' '}
          sobre el precio tras comisión e IA.
        </>
      }
    >
      <DataTable
        etiqueta="Economía por plan"
        densidad={false}
        columnas={COLUMNAS_PLANES}
        filas={r.planes}
        clave={(p) => p.plan}
      />
    </Seccion>
  )
}

// ─── (c) Plan Gratis y (d) equilibrio ─────────────────────────────────────

export function PlanGratis({ r, s }: { r: Resultado; s: Supuestos }) {
  const g = r.gratis
  const modelo = MODELOS_ESCENARIO[s.escenario].nombre
  return (
    <Seccion
      titulo="Costo del plan Gratis"
      descripcion={`Con ${modelo}. % que debe pagar = costo por usuario gratis ÷ (ese costo + margen medio por suscriptor de ${usd(r.margenMedio)}).`}
    >
      <Card className="p-5 md:p-6">
        <Datos>
          <Linea etiqueta="Cupo al mes" real={false}>
            <span className="tnum">
              {ACCIONES_CUPO.map(
                (a) => `${s.cupo[a]} ${NOMBRE_ACCION_CORTO[a]}`
              ).join(' · ')}
            </span>
          </Linea>
          <Linea
            etiqueta="Costo por acción"
            real={ACCIONES_CUPO.some((a) => r.costoAccion[a].real)}
          >
            <span className="tnum">
              {ACCIONES_CUPO.map(
                (a) =>
                  `${usdPreciso(r.costoAccion[a].valor)} por ${NOMBRE_ACCION_UNO[a]}`
              ).join(' · ')}
            </span>
          </Linea>
          <Linea
            etiqueta="Máximo por usuario gratis (agota el cupo)"
            real={false}
          >
            <Dinero valor={g.maximo} preciso />
          </Linea>
          <Linea
            etiqueta={`Esperado por usuario gratis (${r.perfilGratis.etiqueta.toLowerCase()})`}
            real={r.perfilGratis.real}
          >
            <Dinero valor={g.esperado} preciso />
          </Linea>
          {g.realPorUsuario !== null ? (
            <Linea
              etiqueta={`Real por usuario gratis activo, con ${modelo}`}
              real
            >
              <Dinero valor={g.realPorUsuario} preciso />
            </Linea>
          ) : null}
          <Linea
            etiqueta="Deben pagar para cubrirlo (uso esperado)"
            real={false}
          >
            <span className="tnum">
              {g.pctPagoEsperado === null
                ? 'Sin margen'
                : formatPorcentaje(g.pctPagoEsperado, 1)}
            </span>
          </Linea>
          <Linea etiqueta="Deben pagar si todos agotan el cupo" real={false}>
            <span className="tnum">
              {g.pctPagoMaximo === null
                ? 'Sin margen'
                : formatPorcentaje(g.pctPagoMaximo, 1)}
            </span>
          </Linea>
        </Datos>
      </Card>
    </Seccion>
  )
}

export function PuntoEquilibrio({ r, s }: { r: Resultado; s: Supuestos }) {
  const e = r.equilibrio
  const n = (v: number | null) =>
    v === null ? 'Imposible' : formatNumero(Math.ceil(v))
  return (
    <Seccion
      titulo="Punto de equilibrio"
      descripcion={`Cada usuario activo aporta ${usdPreciso(e.contribucionPorUsuario)} al mes (con ${formatPorcentaje(s.conversionPct, 1)} de conversión) frente a ${usd(e.costosFijos)} de costos fijos y retiros mínimos.`}
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Usuarios activos"
          value={n(e.usuarios)}
          tone={e.usuarios === null ? 'danger' : 'neutral'}
          caption={
            <>
              <Marca real={false} /> para no perder con la conversión supuesta
            </>
          }
        />
        <StatCard
          label="Suscriptores"
          value={n(e.suscriptores)}
          tone={e.suscriptores === null ? 'danger' : 'neutral'}
          caption="Los que pagan en ese punto"
        />
        <StatCard
          label="Conversión necesaria"
          value={
            e.conversionPct === null
              ? 'Imposible'
              : formatPorcentaje(e.conversionPct, 1)
          }
          tone={
            e.conversionPct === null
              ? 'danger'
              : e.conversionPct > s.conversionPct
                ? 'warning'
                : 'success'
          }
          caption={`Con ${formatNumero(s.usuariosActivos)} usuarios; supones ${formatPorcentaje(s.conversionPct, 1)}`}
        />
        <StatCard
          label="Solo para los fijos"
          value={n(e.suscriptoresSoloFijos)}
          caption={`Suscriptores sin contar a los gratis (margen ${usd(e.margenSuscriptor)})`}
        />
      </div>
    </Seccion>
  )
}

// ─── Proyección ───────────────────────────────────────────────────────────

export function ProyeccionMes({ r, s }: { r: Resultado; s: Supuestos }) {
  const p = r.proyeccion
  return (
    <Seccion
      titulo="Proyección con tus supuestos"
      descripcion={`${formatNumero(p.usuarios)} usuarios activos, ${formatPorcentaje(s.conversionPct, 1)} pagan y la IA va con ${MODELOS_ESCENARIO[s.escenario].nombre}.`}
    >
      <Card className="p-5 md:p-6">
        <Datos>
          <Linea
            etiqueta={`Suscriptores (${formatNumero(p.suscriptores, 1)})`}
            real={false}
          >
            <Dinero valor={p.ingresosNetos} />
          </Linea>
          {p.afiliados > 0 ? (
            <Linea etiqueta="Afiliados" real={false}>
              <Dinero valor={p.afiliados} />
            </Linea>
          ) : null}
          <Linea etiqueta="− IA de los que pagan" real={r.iaSuscriptor.real}>
            <Dinero valor={-p.iaPago} />
          </Linea>
          <Linea
            etiqueta={`− IA de los gratis (${formatNumero(p.gratis, 0)})`}
            real={r.perfilGratis.real}
          >
            <Dinero valor={-p.iaGratis} />
          </Linea>
          <Linea etiqueta="− Fijos y retiros" real={false}>
            <Dinero valor={-(p.fijos + p.retiros)} />
          </Linea>
          {p.impuestoVentas + p.retencion + p.isr > 0 ? (
            <Linea etiqueta="− Impuestos (contador)" real={false}>
              <Dinero valor={-(p.impuestoVentas + p.retencion + p.isr)} />
            </Linea>
          ) : null}
          <Dato etiqueta="Ganancia al mes">
            <span
              className={cn(
                'text-[15px] font-semibold tnum',
                p.ganancia < 0 ? 'text-danger' : 'text-success'
              )}
            >
              {usd(p.ganancia)}
            </span>
          </Dato>
        </Datos>
      </Card>
    </Seccion>
  )
}

// ─── (e) Escenarios por modelo ────────────────────────────────────────────

export function Escenarios({
  r,
  s,
  datos,
  referencias,
}: {
  r: Resultado
  s: Supuestos
  datos: DatosRentabilidad
  referencias: Referencias
}) {
  const columnas: readonly Columna<FilaEscenario>[] = [
    {
      id: 'modelo',
      encabezado: 'Modelo',
      tarjeta: 'titulo',
      celda: (f) => {
        const t = referencias.tarifas[f.escenario]
        return (
          <span className="flex flex-col">
            <span className="inline-flex flex-wrap items-center gap-1.5 font-medium">
              {f.nombre}
              {f.escenario === s.escenario ? (
                <Badge variant="info">Elegido</Badge>
              ) : null}
              {f.escenario === datos.modeloActual.escenario ? (
                <Badge>En producción</Badge>
              ) : null}
            </span>
            {t ? (
              <span className="text-caption text-fg-muted tnum">
                US${formatNumero(t.entrada, 2)} / US${formatNumero(t.salida, 2)}{' '}
                por millón
              </span>
            ) : null}
          </span>
        )
      },
    },
    {
      id: 'viaje',
      encabezado: 'Viaje',
      alinear: 'fin',
      celda: (f) => (
        <span className="inline-flex items-center gap-1.5">
          {usdPreciso(f.costoViaje.valor)}
          <Marca real={f.costoViaje.real} />
        </span>
      ),
    },
    {
      id: 'ajuste',
      encabezado: 'Ajuste',
      alinear: 'fin',
      celda: (f) => usdPreciso(f.costoAjuste.valor),
    },
    {
      id: 'suscriptor',
      encabezado: 'IA suscriptor',
      alinear: 'fin',
      tarjeta: 'meta',
      celda: (f) => usdPreciso(f.iaSuscriptor),
      celdaTarjeta: (f) => `IA ${usdPreciso(f.iaSuscriptor)}/suscriptor`,
    },
    {
      id: 'gratis',
      encabezado: 'Gratis máx.',
      alinear: 'fin',
      celda: (f) => usdPreciso(f.gratisMaximo),
    },
    {
      id: 'pago',
      encabezado: '% que paga',
      alinear: 'fin',
      celda: (f) =>
        f.pctPago === null ? 'Sin margen' : formatPorcentaje(f.pctPago, 1),
    },
    {
      id: 'real',
      encabezado: 'Este mes (real)',
      alinear: 'fin',
      tarjeta: 'meta',
      celda: (f) => <Dinero valor={f.gananciaReal} />,
      celdaTarjeta: (f) => (
        <span className={cn(f.gananciaReal < 0 && 'text-danger')}>
          Este mes {usd(f.gananciaReal)}
        </span>
      ),
    },
    {
      id: 'proyeccion',
      encabezado: 'Proyección',
      alinear: 'fin',
      tarjeta: 'meta',
      celda: (f) => <Dinero valor={f.gananciaProyectada} />,
      celdaTarjeta: (f) => (
        <span className={cn(f.gananciaProyectada < 0 && 'text-danger')}>
          Proyección {usd(f.gananciaProyectada)}
        </span>
      ),
    },
  ]
  return (
    <Seccion
      titulo="Escenarios por modelo"
      descripcion="Ganancia al mes con cada modelo para el itinerario y los ajustes. «Este mes» recalcula los tokens reales del periodo con la tarifa de cada modelo (aproximado: otro modelo escribe y razona distinto); «Proyección» usa tus supuestos."
    >
      <DataTable
        etiqueta="Escenarios por modelo"
        densidad={false}
        columnas={columnas}
        filas={r.escenarios}
        clave={(f) => f.escenario}
      />
    </Seccion>
  )
}

// ─── IA real por acción, por grupo y uso por usuario ──────────────────────

export function IaPorAccion({ r, s }: { r: Resultado; s: Supuestos }) {
  const e = s.escenario
  const modelo = MODELOS_ESCENARIO[e].nombre
  const columnas: readonly Columna<FamiliaReal>[] = [
    {
      id: 'accion',
      encabezado: 'Acción',
      tarjeta: 'titulo',
      celda: (f) => (
        <span className="flex flex-col">
          <span className="font-medium">{NOMBRE_FAMILIA[f.familia]}</span>
          <span className="text-caption text-fg-muted tnum">
            {cantidad(f.llamadas, 'llamada', 'llamadas')}
            {f.truncadas > 0 ? ` · ${formatNumero(f.truncadas)} truncadas` : ''}
          </span>
        </span>
      ),
    },
    {
      id: 'acciones',
      encabezado: 'Acciones',
      alinear: 'fin',
      tarjeta: 'meta',
      celda: (f) => formatNumero(f.acciones),
      celdaTarjeta: (f) => `${formatNumero(f.acciones)} acciones`,
    },
    {
      id: 'tokens',
      encabezado: 'Tokens por acción',
      alinear: 'fin',
      celda: (f) =>
        f.acciones > 0
          ? `${formatNumero(f.tokensEntrada / f.acciones)} / ${formatNumero(f.tokensSalida / f.acciones)}`
          : '—',
    },
    {
      id: 'costo',
      encabezado: 'Costo real',
      alinear: 'fin',
      tarjeta: 'meta',
      celda: (f) => usdPreciso(f.costoReal),
      celdaTarjeta: (f) => `Real ${usdPreciso(f.costoReal)}`,
    },
    {
      id: 'media',
      encabezado: 'Media · p90',
      alinear: 'fin',
      celda: (f) =>
        `${usdPreciso(f.porAccionReal.media)} · ${usdPreciso(f.porAccionReal.p90)}`,
    },
    {
      id: 'escenario',
      encabezado: `Con ${modelo}`,
      alinear: 'fin',
      tarjeta: 'meta',
      celda: (f) =>
        `${usdPreciso(f.porEscenario[e].porAccion.media)} · ${usdPreciso(f.porEscenario[e].porAccion.p90)}`,
      celdaTarjeta: (f) =>
        `${modelo}: ${usdPreciso(f.porEscenario[e].porAccion.media)}`,
    },
  ]
  return (
    <Seccion
      titulo="IA por acción"
      descripcion={
        <>
          <Marca real /> ai_logs de {r.periodo.etiqueta.toLowerCase()}. Una
          generación o una foto = sus llamadas de la misma persona a menos de 90
          s; un ajuste truncado y su reintento cuentan como uno. Tokens: entrada
          / salida. Media y p90 por acción.
        </>
      }
    >
      <DataTable
        etiqueta="Costo de IA por acción"
        densidad={false}
        columnas={columnas}
        filas={r.periodo.ia.familias}
        clave={(f) => f.familia}
        vacio={
          <EmptyState
            illustration="ninguna"
            title="Sin llamadas de IA en el periodo"
            description="Los costos por acción salen del informe."
            className="py-8"
          />
        }
      />
    </Seccion>
  )
}

interface FilaGrupo {
  grupo: GrupoUsuario
  llamadas: number
  usuarios: number
  activos: number | null
  costo: number
  costoMes: number
  escenarioMes: number
}

export function IaPorGrupo({ r, s }: { r: Resultado; s: Supuestos }) {
  const p = r.periodo
  const modelo = MODELOS_ESCENARIO[s.escenario].nombre
  const filas: FilaGrupo[] = GRUPOS_USUARIO.map((g) => ({
    grupo: g,
    llamadas: p.ia.grupos[g].llamadas,
    usuarios: p.ia.grupos[g].usuariosConIa,
    activos:
      g === 'pago' ? p.activos.pago : g === 'gratis' ? p.activos.gratis : null,
    costo: p.ia.grupos[g].costoReal,
    costoMes: p.ia.grupos[g].costoReal * p.factorMes,
    escenarioMes: p.ia.grupos[g].costoEscenario[s.escenario] * p.factorMes,
  })).filter((f) => f.llamadas > 0 || (f.activos ?? 0) > 0)
  const porUsuario = (f: FilaGrupo) =>
    f.activos && f.activos > 0 ? usdPreciso(f.costoMes / f.activos) : '—'
  const columnas: readonly Columna<FilaGrupo>[] = [
    {
      id: 'grupo',
      encabezado: 'Grupo',
      tarjeta: 'titulo',
      celda: (f) => (
        <span className="font-medium">{NOMBRE_GRUPO[f.grupo]}</span>
      ),
    },
    {
      id: 'llamadas',
      encabezado: 'Llamadas',
      alinear: 'fin',
      celda: (f) => formatNumero(f.llamadas),
    },
    {
      id: 'personas',
      encabezado: 'Con IA · activos',
      alinear: 'fin',
      tarjeta: 'meta',
      celda: (f) =>
        f.grupo === 'anonimo'
          ? '—'
          : `${formatNumero(f.usuarios)}${f.activos === null ? '' : ` · ${formatNumero(f.activos)}`}`,
      celdaTarjeta: (f) =>
        f.grupo === 'anonimo'
          ? 'Sin personas'
          : cantidad(f.activos ?? f.usuarios, 'persona', 'personas'),
    },
    {
      id: 'costo',
      encabezado: 'Costo del periodo',
      alinear: 'fin',
      celda: (f) => usdPreciso(f.costo),
    },
    {
      id: 'mes',
      encabezado: 'Al mes',
      alinear: 'fin',
      tarjeta: 'meta',
      celda: (f) => usdPreciso(f.costoMes),
      celdaTarjeta: (f) => `${usdPreciso(f.costoMes)} al mes`,
    },
    {
      id: 'usuario',
      encabezado: 'Por usuario activo',
      alinear: 'fin',
      tarjeta: 'meta',
      celda: porUsuario,
      celdaTarjeta: (f) => `${porUsuario(f)} por usuario`,
    },
    {
      id: 'escenario',
      encabezado: `Al mes con ${modelo}`,
      alinear: 'fin',
      celda: (f) => usdPreciso(f.escenarioMes),
    },
  ]
  return (
    <Seccion
      titulo="IA por tipo de usuario"
      descripcion={
        <>
          <Marca real /> Plan efectivo de hoy (regla de my_effective_tier):
          «Pro» incluye a los concedidos a mano. Activos = con IA o con un viaje
          creado o editado en el periodo (sin admins). «Al mes» proyecta el mes
          en curso a su duración.
        </>
      }
    >
      <DataTable
        etiqueta="Costo de IA por tipo de usuario"
        densidad={false}
        columnas={columnas}
        filas={filas}
        clave={(f) => f.grupo}
        vacio={
          <EmptyState
            illustration="ninguna"
            title="Sin actividad en el periodo"
            className="py-8"
          />
        }
      />
    </Seccion>
  )
}

interface FilaUso {
  clave: string
  tier: TierUso
  accion: (typeof ACCIONES_CUPO)[number]
  usuarios: number
  media: number
  p50: number
  p90: number
}

const COLUMNAS_USO: readonly Columna<FilaUso>[] = [
  {
    id: 'tier',
    encabezado: 'Plan · acción',
    tarjeta: 'titulo',
    celda: (f) => (
      <span>
        <span className="font-medium">
          {f.tier === 'pago' ? 'Pro' : 'Gratis'}
        </span>{' '}
        · {NOMBRE_ACCION_CORTO[f.accion]}
      </span>
    ),
  },
  {
    id: 'usuarios',
    encabezado: 'Usuarios',
    alinear: 'fin',
    celda: (f) => formatNumero(f.usuarios),
  },
  {
    id: 'media',
    encabezado: 'Media',
    alinear: 'fin',
    tarjeta: 'meta',
    celda: (f) => formatNumero(f.media, 1),
    celdaTarjeta: (f) => `Media ${formatNumero(f.media, 1)}`,
  },
  {
    id: 'p50',
    encabezado: 'p50',
    alinear: 'fin',
    celda: (f) => formatNumero(f.p50),
  },
  {
    id: 'p90',
    encabezado: 'p90',
    alinear: 'fin',
    tarjeta: 'meta',
    celda: (f) => formatNumero(f.p90),
    celdaTarjeta: (f) => `p90 ${formatNumero(f.p90)}`,
  },
]

export function AccionesPorUsuario({ r }: { r: Resultado }) {
  const u = r.uso
  const filas: FilaUso[] = (['pago', 'gratis'] as const).flatMap((tier) =>
    ACCIONES_CUPO.map((accion) => ({
      clave: `${tier}-${accion}`,
      tier,
      accion,
      usuarios: u.porTier[tier].usuarios,
      ...u.porTier[tier].porAccion[accion],
    }))
  )
  const hay = u.porTier.pago.usuarios + u.porTier.gratis.usuarios > 0
  return (
    <Seccion
      titulo="Acciones por usuario al mes"
      descripcion={
        <>
          <Marca real />{' '}
          {u.fuente === 'usage_counters'
            ? `usage_counters (conteo exacto), ${u.etiqueta}`
            : `ai_logs (aproximado), ${u.etiqueta}`}
          {u.parcial
            ? `: el periodo sigue abierto y los conteos suben (el perfil «real» los multiplica por ${formatNumero(u.factorMes, 2)} para llevarlos al mes).`
            : '.'}{' '}
          Solo personas con al menos una acción.
        </>
      }
    >
      <DataTable
        etiqueta="Acciones con cupo por usuario y mes"
        densidad={false}
        columnas={COLUMNAS_USO}
        filas={hay ? filas : []}
        clave={(f) => f.clave}
        vacio={
          <EmptyState
            illustration="ninguna"
            title="Aún no hay uso por usuario"
            description="El perfil de uso sale del informe hasta que haya datos."
            className="py-8"
          />
        }
      />
    </Seccion>
  )
}
