import type { AccionConCupo } from '@/constants/planes'
import { NOMBRE_PLAN, PLANES_A_LA_VENTA } from '@/constants/planes'
import { PLANS, type PlanKey } from '@/constants/pricing'
import { formatCurrency, formatPorcentaje } from '@/lib/utils/formatters'
import {
  ACCIONES_CUPO,
  ESCENARIOS_IA,
  FAMILIA_DE_ACCION,
  GRUPOS_USUARIO,
  MODELOS_ESCENARIO,
  type CostoFijo,
  type DatosRentabilidad,
  type EscenarioIa,
  type GrupoUsuario,
  type PeriodoReal,
  type PerfilUso,
  type Referencias,
  type Supuestos,
  type TierUso,
  type UsoPorUsuario,
} from './tipos'

/**
 * Calculadora de rentabilidad: funciones PURAS (sin E/S ni secretos) que usan
 * el servidor y la isla cliente para recalcular al momento cada vez que el
 * dueño cambia un supuesto. Las cifras llegan como argumentos.
 *
 * Fórmulas (todas en US$ al mes salvo que se diga otra cosa):
 *
 * - Comisión por cobro de un plan = precio × %efectivo + fijo efectivo, con
 *   w = % de cobros por tiendas, %efectivo = (1 − w)·(%canal + %recurrente si
 *   es suscripción) + w·%tienda y fijo efectivo = (1 − w)·fijo del canal.
 * - Neto mensual = (precio − comisión) ÷ meses del cobro (anual 12; mensual,
 *   grupo y pase de 30 días 1).
 * - IA por usuario = Σ acciones del perfil × costo medio por acción del
 *   modelo (generar, ajustar, analizar). El perfil real de un mes abierto se
 *   multiplica por la duración del mes ÷ lo transcurrido.
 * - Margen del plan = neto mensual − IA por suscriptor; margen % = margen ÷
 *   (precio ÷ meses).
 * - Precio mínimo para un margen objetivo m (sobre el precio) =
 *   (fijo efectivo + meses × IA por suscriptor) ÷ (1 − %efectivo − m).
 * - Plan Gratis: máximo = Σ cupo × costo por acción; esperado =
 *   Σ mín(perfil gratis, cupo) × costo. % que debe pagar (fórmula del
 *   informe) = costo gratis ÷ (costo gratis + margen medio por suscriptor).
 * - Cuenta del mes: ingresos netos + afiliados − impuesto sobre ventas − IA −
 *   fijos − retiros − retención exterior × (fijos + IA) − ISR sobre la
 *   ganancia positiva. Retiros = pagos × máx(mínimo, % × ingreso web ÷ pagos).
 * - Proyección: S = usuarios × conversión suscriptores repartidos por la
 *   mezcla; IA = S × IA por suscriptor + (usuarios − S) × gratis esperado.
 * - Equilibrio: aportación por usuario activo u = c·m' − (1 − c)·g' + a, con
 *   m' = margen medio tras impuesto y retención, g' = gratis esperado con
 *   retención, a = afiliados; F = fijos con retención + retiros mínimos.
 *   Usuarios = F ÷ u; suscriptores = usuarios × c; conversión necesaria con
 *   los usuarios supuestos = (F ÷ N + g' − a) ÷ (m' + g').
 */

export const PLANES_CALCULO: readonly PlanKey[] = [
  'pro_mensual',
  'pro_anual',
  'pro_por_viaje',
  'pro_grupo',
]

/** Una cifra con su origen: dato real (BD) o supuesto (informe o dueño). */
export interface Valor {
  valor: number
  real: boolean
}

export interface Perfil {
  acciones: Record<AccionConCupo, number>
  real: boolean
  etiqueta: string
}

export interface EconomiaPlan {
  plan: PlanKey
  nombre: string
  aLaVenta: boolean
  precio: number
  /** Meses que cubre cada cobro (anual 12, el resto 1). */
  meses: number
  comision: number
  comisionPct: number
  neto: number
  netoMensual: number
  ia: Valor
  margen: number
  margenPct: number
  /** Margen con el usuario intenso del informe. */
  margenIntenso: number
  /** null: con esas comisiones no hay precio que dé el margen objetivo. */
  precioMinimo: number | null
}

export interface Cuenta {
  ingresosNetos: number
  afiliados: number
  ia: number
  fijos: number
  retiros: number
  impuestoVentas: number
  retencion: number
  isr: number
  ganancia: number
}

export interface MesReal extends Cuenta {
  ingresosBrutos: number
  comisiones: number
  porPlan: {
    plan: PlanKey
    cantidad: number
    bruto: number
    neto: number
  }[]
  /** IA registrada en el periodo (sin proyectar). */
  iaHastaHoy: number
  iaPorGrupo: Record<GrupoUsuario, number>
}

export interface Proyeccion extends Cuenta {
  usuarios: number
  suscriptores: number
  gratis: number
  porPlan: Record<PlanKey, number>
  iaPago: number
  iaGratis: number
}

export interface CostoGratis {
  maximo: number
  esperado: number
  pctPagoEsperado: number | null
  pctPagoMaximo: number | null
  /** IA de los usuarios gratis reales ÷ usuarios gratis activos (al mes). */
  realPorUsuario: number | null
}

export interface Equilibrio {
  contribucionPorUsuario: number
  margenSuscriptor: number
  costoGratis: number
  costosFijos: number
  usuarios: number | null
  suscriptores: number | null
  /** null: ni con el 100 % de conversión se cubren los costos. */
  conversionPct: number | null
  suscriptoresSoloFijos: number | null
}

export interface FilaEscenario {
  escenario: EscenarioIa
  nombre: string
  costoViaje: Valor
  costoAjuste: Valor
  iaSuscriptor: number
  gratisMaximo: number
  pctPago: number | null
  gananciaReal: number
  gananciaProyectada: number
  peorMargenIntenso: { plan: PlanKey; margen: number } | null
}

export type TonoAlerta = 'info' | 'success' | 'warning' | 'danger'

export interface Alerta {
  id: string
  tono: TonoAlerta
  titulo: string
  texto?: string
}

export interface Resultado {
  periodo: PeriodoReal
  escenario: EscenarioIa
  uso: UsoPorUsuario
  costoAccion: Record<AccionConCupo, Valor>
  perfilPago: Perfil
  perfilGratis: Perfil
  iaSuscriptor: Valor
  mezcla: Record<PlanKey, number>
  mezclaSuma: number
  margenMedio: number
  planes: EconomiaPlan[]
  fijos: { id: string; nombre: string; mensual: number }[]
  real: MesReal
  gratis: CostoGratis
  proyeccion: Proyeccion
  equilibrio: Equilibrio
  escenarios: FilaEscenario[]
  alertas: Alerta[]
}

// ─── Utilidades ───────────────────────────────────────────────────────────

const usd = (n: number) => formatCurrency(n, 'USD', { decimales: true })
const pct = (n: number) => formatPorcentaje(n, n < 10 ? 1 : 0)
const fraccion = (n: number) => Math.min(1, Math.max(0, n / 100))
const finito = (n: number) => (Number.isFinite(n) ? n : 0)

/** Meses que cubre cada cobro del plan. */
export function mesesPorCobro(plan: PlanKey): number {
  return PLANS[plan].periodo === 'año' ? 12 : 1
}

/** Costo fijo llevado a un mes (anual ÷ 12; único repartido en 12 meses). */
export function mensualDe(c: CostoFijo): number {
  const monto = Math.max(0, finito(c.monto))
  return c.periodicidad === 'mes' ? monto : monto / 12
}

export function fijosMensuales(s: Supuestos): number {
  return s.costosFijos.reduce((t, c) => t + mensualDe(c), 0)
}

/** Comisión de un cobro del plan con el canal y la mezcla web/tiendas. */
export function comisionDe(
  plan: PlanKey,
  s: Supuestos
): { comision: number; pctEfectivo: number; fijoEfectivo: number } {
  const precio = PLANS[plan].precio
  const recurrente = PLANS[plan].periodo !== 'único'
  const canal = s.comisiones[s.canal]
  const w = fraccion(s.ventasTiendasPct)
  const pctWeb = (canal.pct + (recurrente ? canal.pctRecurrente : 0)) / 100
  const pctEfectivo = (1 - w) * pctWeb + w * (s.comisionTiendaPct / 100)
  const fijoEfectivo = (1 - w) * canal.fijo
  return {
    comision: precio * pctEfectivo + fijoEfectivo,
    pctEfectivo,
    fijoEfectivo,
  }
}

export function netoMensualDe(plan: PlanKey, s: Supuestos): number {
  return (
    (PLANS[plan].precio - comisionDe(plan, s).comision) / mesesPorCobro(plan)
  )
}

/** Pagos al banco del canal web: pagos × máx(mínimo, % del pago). */
export function retirosDe(ingresosNetos: number, s: Supuestos): number {
  const canal = s.comisiones[s.canal]
  const base = ingresosNetos * (1 - fraccion(s.ventasTiendasPct))
  if (!(base > 0) || !(canal.retirosMes > 0)) return 0
  const porPago = base / canal.retirosMes
  return (
    canal.retirosMes *
    Math.max(canal.retiroMinimo, (porPago * canal.retiroPct) / 100)
  )
}

function cerrarCuenta(
  ingresosNetos: number,
  afiliados: number,
  ia: number,
  s: Supuestos
): Cuenta {
  const fijos = fijosMensuales(s)
  const retiros = retirosDe(ingresosNetos, s)
  const impuestoVentas = (ingresosNetos * s.impuestoVentasPct) / 100
  const retencion = ((fijos + ia) * s.retencionExteriorPct) / 100
  const antesIsr =
    ingresosNetos +
    afiliados -
    impuestoVentas -
    ia -
    fijos -
    retiros -
    retencion
  const isr = (Math.max(0, antesIsr) * s.isrPct) / 100
  return {
    ingresosNetos,
    afiliados,
    ia,
    fijos,
    retiros,
    impuestoVentas,
    retencion,
    isr,
    ganancia: antesIsr - isr,
  }
}

/** Mezcla de planes normalizada a fracciones que suman 1. */
export function mezclaNormalizada(s: Supuestos): {
  mezcla: Record<PlanKey, number>
  suma: number
} {
  const suma = PLANES_CALCULO.reduce(
    (t, p) => t + Math.max(0, finito(s.mezcla[p])),
    0
  )
  const mezcla = Object.fromEntries(
    PLANES_CALCULO.map((p) => [
      p,
      suma > 0
        ? Math.max(0, finito(s.mezcla[p])) / suma
        : p === 'pro_mensual'
          ? 1
          : 0,
    ])
  ) as Record<PlanKey, number>
  return { mezcla, suma }
}

/** Acciones por usuario del periodo: usage_counters si existe; si no, ai_logs. */
export function usoDe(datos: DatosRentabilidad, periodo: PeriodoReal) {
  return datos.contadores.disponible && datos.contadores.uso
    ? datos.contadores.uso
    : periodo.uso
}

export function perfilDe(
  tier: TierUso,
  perfil: PerfilUso,
  uso: UsoPorUsuario,
  ref: Referencias
): Perfil {
  if (perfil === 'tipico' || perfil === 'intenso') {
    return {
      acciones: ref.perfilesInforme[perfil],
      real: false,
      etiqueta:
        perfil === 'tipico' ? 'Típico del informe' : 'Intenso del informe',
    }
  }
  const t = uso.porTier[tier]
  if (t.usuarios === 0) {
    return {
      acciones: ref.perfilesInforme.tipico,
      real: false,
      etiqueta: 'Típico del informe (aún sin datos reales)',
    }
  }
  // Un periodo abierto (mes en curso) se lleva a un mes completo.
  const campo = perfil === 'real' ? 'media' : 'p90'
  const factor = Math.max(1, uso.factorMes)
  const acciones = Object.fromEntries(
    ACCIONES_CUPO.map((a) => [a, t.porAccion[a][campo] * factor])
  ) as Record<AccionConCupo, number>
  return {
    acciones,
    real: true,
    etiqueta: `${perfil === 'real' ? 'Media' : 'p90'} real · ${uso.etiqueta}${factor > 1.01 ? ', proyectada al mes' : ''}`,
  }
}

/** Costo medio por acción: real (tokens de ai_logs) o del informe. */
export function costoAccionDe(
  escenario: EscenarioIa,
  periodo: PeriodoReal,
  s: Supuestos,
  ref: Referencias
): Record<AccionConCupo, Valor> {
  return Object.fromEntries(
    ACCIONES_CUPO.map((a) => {
      const familia = periodo.ia.familias.find(
        (f) => f.familia === FAMILIA_DE_ACCION[a]
      )
      const usarReal =
        s.fuenteCosto === 'real' &&
        familia !== undefined &&
        familia.acciones >= ref.minAccionesReales
      return [
        a,
        usarReal
          ? {
              valor: familia.porEscenario[escenario].porAccion.media,
              real: true,
            }
          : { valor: ref.costoAccionInforme[escenario][a], real: false },
      ]
    })
  ) as Record<AccionConCupo, Valor>
}

export function iaDePerfil(
  acciones: Record<AccionConCupo, number>,
  costo: Record<AccionConCupo, Valor>,
  cupo?: Record<AccionConCupo, number>
): number {
  return ACCIONES_CUPO.reduce((t, a) => {
    const n = Math.max(0, finito(acciones[a]))
    const tope = cupo ? Math.min(n, Math.max(0, cupo[a])) : n
    return t + tope * costo[a].valor
  }, 0)
}

// ─── Evaluación con un modelo ─────────────────────────────────────────────

interface Evaluacion {
  costoAccion: Record<AccionConCupo, Valor>
  iaSuscriptor: number
  planes: EconomiaPlan[]
  margenMedio: number
  gratis: CostoGratis
  proyeccion: Proyeccion
  equilibrio: Equilibrio
  realConModelo: Cuenta
}

function evaluar(
  escenario: EscenarioIa,
  periodo: PeriodoReal,
  s: Supuestos,
  ref: Referencias,
  perfilPago: Perfil,
  perfilGratis: Perfil,
  ingresosReales: number
): Evaluacion {
  const costoAccion = costoAccionDe(escenario, periodo, s, ref)
  const iaSuscriptor = iaDePerfil(perfilPago.acciones, costoAccion)
  const iaIntenso = iaDePerfil(ref.perfilesInforme.intenso, costoAccion)
  const mObjetivo = Math.min(0.95, Math.max(0, s.margenObjetivoPct / 100))

  const planes: EconomiaPlan[] = PLANES_CALCULO.map((plan) => {
    const { precio } = PLANS[plan]
    const meses = mesesPorCobro(plan)
    const { comision, pctEfectivo, fijoEfectivo } = comisionDe(plan, s)
    const neto = precio - comision
    const netoMensual = neto / meses
    const margen = netoMensual - iaSuscriptor
    const denominador = 1 - pctEfectivo - mObjetivo
    return {
      plan,
      nombre: NOMBRE_PLAN[plan],
      aLaVenta: PLANES_A_LA_VENTA.includes(plan),
      precio,
      meses,
      comision,
      comisionPct: precio > 0 ? (comision / precio) * 100 : 0,
      neto,
      netoMensual,
      ia: { valor: iaSuscriptor, real: perfilPago.real },
      margen,
      margenPct: precio > 0 ? (margen / (precio / meses)) * 100 : 0,
      margenIntenso: netoMensual - iaIntenso,
      precioMinimo:
        denominador > 0.001
          ? (fijoEfectivo + meses * iaSuscriptor) / denominador
          : null,
    }
  })

  const { mezcla } = mezclaNormalizada(s)
  const margenMedio = planes.reduce((t, p) => t + mezcla[p.plan] * p.margen, 0)

  // Plan Gratis.
  const maximo = iaDePerfil(s.cupo, costoAccion)
  const esperado = iaDePerfil(perfilGratis.acciones, costoAccion, s.cupo)
  const pctPago = (g: number) =>
    margenMedio > 0 && g + margenMedio > 0
      ? (g / (g + margenMedio)) * 100
      : null
  const gratisReales = periodo.activos.gratis
  const gratis: CostoGratis = {
    maximo,
    esperado,
    pctPagoEsperado: pctPago(esperado),
    pctPagoMaximo: pctPago(maximo),
    realPorUsuario:
      gratisReales > 0
        ? (periodo.ia.grupos.gratis.costoEscenario[escenario] *
            periodo.factorMes) /
          gratisReales
        : null,
  }

  // Proyección con los usuarios y la conversión supuestos.
  const usuarios = Math.max(0, finito(s.usuariosActivos))
  const c = fraccion(s.conversionPct)
  const suscriptores = usuarios * c
  const porPlan = Object.fromEntries(
    PLANES_CALCULO.map((p) => [p, suscriptores * mezcla[p]])
  ) as Record<PlanKey, number>
  const ingresosNetos = PLANES_CALCULO.reduce(
    (t, p) => t + porPlan[p] * netoMensualDe(p, s),
    0
  )
  const iaPago = suscriptores * iaSuscriptor
  const iaGratis = (usuarios - suscriptores) * esperado
  const proyeccion: Proyeccion = {
    ...cerrarCuenta(
      ingresosNetos,
      usuarios * Math.max(0, s.afiliadosPorUsuario),
      iaPago + iaGratis,
      s
    ),
    usuarios,
    suscriptores,
    gratis: usuarios - suscriptores,
    porPlan,
    iaPago,
    iaGratis,
  }

  // Punto de equilibrio.
  const tv = s.impuestoVentasPct / 100
  const r = s.retencionExteriorPct / 100
  const canal = s.comisiones[s.canal]
  const retiroFijo =
    fraccion(s.ventasTiendasPct) < 1
      ? Math.max(0, canal.retirosMes) * Math.max(0, canal.retiroMinimo)
      : 0
  const mNeto = planes.reduce(
    (t, p) =>
      t + mezcla[p.plan] * (p.netoMensual * (1 - tv) - iaSuscriptor * (1 + r)),
    0
  )
  const gNeto = esperado * (1 + r)
  const a = Math.max(0, s.afiliadosPorUsuario)
  const F = fijosMensuales(s) * (1 + r) + retiroFijo
  const u = c * mNeto - (1 - c) * gNeto + a
  const usuariosEq = u > 0 ? F / u : null
  let conversionPct: number | null = null
  if (mNeto + gNeto > 0) {
    const cEstrella =
      (usuarios > 0 ? F / usuarios : Number.POSITIVE_INFINITY) + gNeto - a
    const cNecesaria = cEstrella / (mNeto + gNeto)
    conversionPct =
      Number.isFinite(cNecesaria) && cNecesaria <= 1
        ? Math.max(0, cNecesaria) * 100
        : null
  }
  const equilibrio: Equilibrio = {
    contribucionPorUsuario: u,
    margenSuscriptor: mNeto,
    costoGratis: gNeto,
    costosFijos: F,
    usuarios: usuariosEq,
    suscriptores: usuariosEq === null ? null : usuariosEq * c,
    conversionPct,
    suscriptoresSoloFijos: mNeto > 0 ? F / mNeto : null,
  }

  const realConModelo = cerrarCuenta(
    ingresosReales,
    periodo.activos.total * Math.max(0, s.afiliadosPorUsuario),
    periodo.ia.costoEscenario[escenario] * periodo.factorMes,
    s
  )

  return {
    costoAccion,
    iaSuscriptor,
    planes,
    margenMedio,
    gratis,
    proyeccion,
    equilibrio,
    realConModelo,
  }
}

// ─── Cálculo completo ─────────────────────────────────────────────────────

export function calcularRentabilidad(
  datos: DatosRentabilidad,
  s: Supuestos,
  ref: Referencias,
  clavePeriodo: PeriodoReal['clave']
): Resultado {
  const periodo = datos.periodos[clavePeriodo]
  const uso = usoDe(datos, periodo)
  const perfilPago = perfilDe('pago', s.perfil, uso, ref)
  const perfilGratis = perfilDe('gratis', s.perfil, uso, ref)

  // Ingresos reales: suscripciones cobradas + pases vigentes (≈ vendidos en
  // los últimos 30 días, cada uno vale un mes de Pro). Concedidos: 0.
  const porPlan = PLANES_CALCULO.map((plan) => {
    const cantidad =
      datos.suscriptores.recurrentes[plan] +
      (plan === 'pro_por_viaje' ? datos.suscriptores.pasesVigentes : 0)
    return {
      plan,
      cantidad,
      bruto: (cantidad * PLANS[plan].precio) / mesesPorCobro(plan),
      neto: cantidad * netoMensualDe(plan, s),
    }
  })
  const ingresosBrutos = porPlan.reduce((t, p) => t + p.bruto, 0)
  const ingresosNetos = porPlan.reduce((t, p) => t + p.neto, 0)

  const ev = evaluar(
    s.escenario,
    periodo,
    s,
    ref,
    perfilPago,
    perfilGratis,
    ingresosNetos
  )

  const iaPorGrupo = Object.fromEntries(
    GRUPOS_USUARIO.map((g) => [
      g,
      periodo.ia.grupos[g].costoReal * periodo.factorMes,
    ])
  ) as Record<GrupoUsuario, number>
  const real: MesReal = {
    ...cerrarCuenta(
      ingresosNetos,
      periodo.activos.total * Math.max(0, s.afiliadosPorUsuario),
      periodo.ia.costoReal * periodo.factorMes,
      s
    ),
    ingresosBrutos,
    comisiones: ingresosBrutos - ingresosNetos,
    porPlan,
    iaHastaHoy: periodo.ia.costoReal,
    iaPorGrupo,
  }

  const evaluaciones = Object.fromEntries(
    ESCENARIOS_IA.map((e) => [
      e,
      e === s.escenario
        ? ev
        : evaluar(e, periodo, s, ref, perfilPago, perfilGratis, ingresosNetos),
    ])
  ) as Record<EscenarioIa, Evaluacion>

  const escenarios: FilaEscenario[] = ESCENARIOS_IA.map((e) => {
    const x = evaluaciones[e]
    const enVenta = x.planes.filter(
      (p) => p.aLaVenta || mezclaNormalizada(s).mezcla[p.plan] > 0
    )
    const peor = enVenta.reduce<EconomiaPlan | null>(
      (min, p) =>
        min === null || p.margenIntenso < min.margenIntenso ? p : min,
      null
    )
    return {
      escenario: e,
      nombre: MODELOS_ESCENARIO[e].nombre,
      costoViaje: x.costoAccion.generar,
      costoAjuste: x.costoAccion.ajustar,
      iaSuscriptor: x.iaSuscriptor,
      gratisMaximo: x.gratis.maximo,
      pctPago: x.gratis.pctPagoEsperado,
      gananciaReal: x.realConModelo.ganancia,
      gananciaProyectada: x.proyeccion.ganancia,
      peorMargenIntenso: peor
        ? { plan: peor.plan, margen: peor.margenIntenso }
        : null,
    }
  })

  const { mezcla, suma } = mezclaNormalizada(s)
  const resultado: Resultado = {
    periodo,
    escenario: s.escenario,
    uso,
    costoAccion: ev.costoAccion,
    perfilPago,
    perfilGratis,
    iaSuscriptor: { valor: ev.iaSuscriptor, real: perfilPago.real },
    mezcla,
    mezclaSuma: suma,
    margenMedio: ev.margenMedio,
    planes: ev.planes,
    fijos: s.costosFijos.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      mensual: mensualDe(c),
    })),
    real,
    gratis: ev.gratis,
    proyeccion: ev.proyeccion,
    equilibrio: ev.equilibrio,
    escenarios,
    alertas: [],
  }
  resultado.alertas = alertasDe(resultado, evaluaciones, datos, s)
  return resultado
}

// ─── Alertas ──────────────────────────────────────────────────────────────

function lista(textos: readonly string[]): string {
  if (textos.length <= 1) return textos[0] ?? ''
  return `${textos.slice(0, -1).join(', ')} y ${textos[textos.length - 1]}`
}

function alertasDe(
  r: Resultado,
  evaluaciones: Record<EscenarioIa, Evaluacion>,
  datos: DatosRentabilidad,
  s: Supuestos
): Alerta[] {
  const alertas: Alerta[] = []
  const modelo = MODELOS_ESCENARIO[s.escenario].nombre
  const p = r.proyeccion

  // 1. Resultado de la proyección.
  if (p.usuarios > 0) {
    alertas.push(
      p.ganancia < 0
        ? {
            id: 'proyeccion',
            tono: 'danger',
            titulo: `Con estos supuestos Wayio pierde ${usd(-p.ganancia)} al mes`,
            texto: `${Math.round(p.usuarios)} usuarios activos, ${pct(s.conversionPct)} pagan y la IA va con ${modelo}: ingresos netos ${usd(p.ingresosNetos)}, IA ${usd(p.ia)} y costos fijos ${usd(p.fijos)}.`,
          }
        : {
            id: 'proyeccion',
            tono: 'success',
            titulo: `Con estos supuestos Wayio gana ${usd(p.ganancia)} al mes`,
            texto: `${Math.round(p.usuarios)} usuarios activos, ${pct(s.conversionPct)} pagan y la IA va con ${modelo}.`,
          }
    )
  }

  // 2. El mes real.
  const hayDatos = r.periodo.ia.llamadas > 0 || r.real.ingresosBrutos > 0
  if (hayDatos && r.real.ganancia < 0) {
    alertas.push({
      id: 'real',
      tono: 'warning',
      titulo: `Con los datos reales, ${r.periodo.etiqueta.toLowerCase()} cierra en ${usd(r.real.ganancia)}`,
      texto: `Ingresos netos ${usd(r.real.ingresosNetos)} frente a IA ${usd(r.real.ia)} y costos fijos ${usd(r.real.fijos)} (la IA se proyecta al mes completo).`,
    })
  }

  // 3. Planes que pierden con un usuario intenso, por modelo.
  for (const e of ESCENARIOS_IA) {
    const ev = evaluaciones[e]
    const { mezcla } = mezclaNormalizada(s)
    const pierden = ev.planes.filter(
      (x) => (x.aLaVenta || mezcla[x.plan] > 0) && x.margenIntenso < 0
    )
    if (pierden.length === 0) continue
    const nombres = pierden.map(
      (x) => `${x.nombre} pierde ${usd(-x.margenIntenso)}`
    )
    alertas.push({
      id: `intenso-${e}`,
      tono: e === s.escenario ? 'danger' : 'warning',
      titulo: `Con ${MODELOS_ESCENARIO[e].nombre}, ${lista(nombres)} al mes con un usuario intenso`,
      texto:
        'Usuario intenso del informe: 8 viajes (con «Otra versión») y 10 ajustes al mes. Pro no tiene cupo: solo los topes de uso justo lo frenan.',
    })
  }

  // 4. Conversión necesaria frente a la supuesta.
  const eq = r.equilibrio
  if (p.usuarios <= 0) {
    // Sin usuarios proyectados no hay conversión que comparar.
  } else if (eq.conversionPct === null) {
    alertas.push({
      id: 'conversion-imposible',
      tono: 'danger',
      titulo: `Con ${modelo} y estos precios no hay conversión que cubra los costos`,
      texto:
        'Ni con todos los usuarios pagando alcanza: baja el costo de la IA, el cupo gratis o los costos fijos.',
    })
  } else if (eq.conversionPct > s.conversionPct) {
    alertas.push({
      id: 'conversion',
      tono: 'warning',
      titulo: `Para no perder hace falta que pague el ${pct(eq.conversionPct)} y supones el ${pct(s.conversionPct)}`,
      texto: `Con ${Math.round(p.usuarios)} usuarios activos y la IA con ${modelo}.`,
    })
  }

  // 5. Usuarios gratis que agotan el cupo.
  const g = r.gratis
  if (g.pctPagoMaximo !== null && g.pctPagoMaximo > s.conversionPct) {
    alertas.push({
      id: 'cupo',
      tono: 'warning',
      titulo: `Si cada usuario gratis agota su cupo (${usd(g.maximo)} al mes con ${modelo}), tendría que pagar el ${pct(g.pctPagoMaximo)} para cubrirlo`,
      texto: `Cupo simulado: ${s.cupo.generar} viajes, ${s.cupo.ajustar} ajustes y ${s.cupo.analizar} fotos o videos al mes.`,
    })
  }

  // 6. Modelo de producción y Groq.
  if (datos.modeloActual.escenario === 'opus') {
    alertas.push({
      id: 'opus',
      tono: 'info',
      titulo: 'Producción usa Opus 5.5 para el itinerario y los ajustes',
      texto:
        'Con Sonnet 5.5 esa IA cuesta la mitad y con Haiku 5.5 unas 40 veces menos (AI_ITINERARY_MODEL). Antes, mide la calidad con npm run eval:ia.',
    })
  }
  if (s.escenario === 'groq') {
    alertas.push({
      id: 'groq',
      tono: 'info',
      titulo: 'Groq gratis cuesta 0: aquí se calcula con su tarifa de pago',
      texto:
        'El plan gratis de Groq no aguanta una beta pública (unos 4–10 viajes al día) y su uso comercial no está confirmado.',
    })
  }

  // 7. Uso sin ingreso.
  const sus = datos.suscriptores
  if (sus.concedidos > 0 || sus.enGracia > 0) {
    const partes = [
      sus.concedidos > 0 ? `${sus.concedidos} con Pro concedido a mano` : null,
      sus.enGracia > 0
        ? `${sus.enGracia} en prueba o con el cobro pendiente`
        : null,
    ].filter((x): x is string => x !== null)
    alertas.push({
      id: 'sin-ingreso',
      tono: 'info',
      titulo: `Hay cuentas Pro que usan la IA sin sumar ingreso: ${lista(partes)}`,
    })
  }
  const anonimo = r.periodo.ia.grupos.anonimo.costoReal
  if (r.periodo.ia.costoReal > 0 && anonimo / r.periodo.ia.costoReal > 0.25) {
    alertas.push({
      id: 'anonimo',
      tono: 'warning',
      titulo: `El ${pct((anonimo / r.periodo.ia.costoReal) * 100)} del gasto de IA es de llamadas sin cuenta`,
      texto:
        'Desde que generar, ajustar y analizar exigen sesión debería bajar; si no, revisa qué ruta las hace (incluida la batería eval:ia).',
    })
  }

  // 8. Mezcla que no suma 100.
  if (Math.abs(r.mezclaSuma - 100) > 0.5) {
    alertas.push({
      id: 'mezcla',
      tono: 'info',
      titulo: `La mezcla de planes suma ${pct(r.mezclaSuma)}: se reparte en proporción`,
    })
  }

  return alertas
}
