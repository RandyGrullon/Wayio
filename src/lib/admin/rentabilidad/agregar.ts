import 'server-only'
import type { AccionConCupo } from '@/constants/planes'
import { PLANS, type PlanKey } from '@/constants/pricing'
import { diaRD, horaRDaIso, ultimosDiasRD } from '@/lib/admin/horaRD'
import { estimateCost } from '@/lib/ai/pricing'
import {
  ACCIONES_CUPO,
  ESCENARIOS_IA,
  FAMILIAS_IA,
  GRUPOS_USUARIO,
  MODELOS_ESCENARIO,
  type ClavePeriodo,
  type DatosRentabilidad,
  type EscenarioIa,
  type Estadistica,
  type EstadoSupuestos,
  type FamiliaIa,
  type FamiliaReal,
  type GrupoReal,
  type GrupoUsuario,
  type ModeloActual,
  type PeriodoReal,
  type PorEscenario,
  type SuscriptoresReales,
  type TierUso,
  type UsoPorUsuario,
} from '@/lib/rentabilidad/tipos'
import { tierEfectivo } from '@/lib/stripe/entitlements'
import type { SubscriptionRow } from '@/types/database'

/**
 * Agregados reales de la calculadora de rentabilidad, a partir de filas ya
 * leídas (las consultas viven en queries.ts; el modo demo pasa filas de
 * ejemplo). Funciones puras de servidor: no leen la BD.
 *
 * Aproximaciones (ai_logs no guarda un id de acción):
 * - Generar y foto/video: una acción = las filas de la misma familia y la
 *   misma persona separadas por 90 s o menos (las filas de una petición se
 *   insertan juntas al terminar la respuesta, con after()). Los anónimos
 *   (user_id null) se mezclan entre sí.
 * - Ajustar: cada fila es un ajuste salvo el reintento tras un truncado
 *   (error 'max_tokens' seguido de otra fila en 90 s o menos).
 * - El resto de familias: una fila = una acción.
 * - El plan de cada persona es el efectivo de HOY (tierEfectivo): una
 *   persona que pasó a Pro a mitad de mes cuenta entera como Pro.
 */

const DIA_MS = 86_400_000
const CORTE_SESION_MS = 90_000

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

// ─── Filas de entrada ─────────────────────────────────────────────────────

export interface FilaIa {
  user_id: string | null
  model: string
  endpoint: string | null
  prompt_tokens: number
  completion_tokens: number
  cost_usd: number | string
  error: string | null
  created_at: string
}

export interface FilaViaje {
  user_id: string
  updated_at: string
}

export type SubRentabilidad = Pick<
  SubscriptionRow,
  | 'user_id'
  | 'plan_id'
  | 'tier'
  | 'status'
  | 'stripe_subscription_id'
  | 'current_period_end'
> & { source?: string | null }

export interface FilaContador {
  user_id: string
  periodo: string
  accion: string
  usados: number
}

// ─── Rangos en hora de RD ─────────────────────────────────────────────────

export interface RangosRD {
  inicioMes: number
  finMes: number
  inicio30: number
  /** 'YYYY-MM-01' del mes en curso y del anterior (claves de usage_counters). */
  periodoActual: string
  periodoPrevio: string
  nombreMes: string
  nombreMesPrevio: string
}

const dosDigitos = (n: number) => String(n).padStart(2, '0')

export function rangosRD(ahora: number): RangosRD {
  const [a = 1970, m = 1] = diaRD(ahora).split('-').map(Number)
  const siguiente = m === 12 ? { a: a + 1, m: 1 } : { a, m: m + 1 }
  const previo = m === 1 ? { a: a - 1, m: 12 } : { a, m: m - 1 }
  const instante = (anio: number, mes: number) =>
    Date.parse(
      horaRDaIso(`${anio}-${dosDigitos(mes)}-01T00:00`) ??
        `${anio}-${dosDigitos(mes)}-01T04:00:00Z`
    )
  const primero30 = ultimosDiasRD(30, ahora)[0]
  const inicio30 = primero30
    ? Date.parse(horaRDaIso(`${primero30}T00:00`) ?? '')
    : ahora - 30 * DIA_MS
  return {
    inicioMes: instante(a, m),
    finMes: instante(siguiente.a, siguiente.m),
    inicio30: Number.isFinite(inicio30) ? inicio30 : ahora - 30 * DIA_MS,
    periodoActual: `${a}-${dosDigitos(m)}-01`,
    periodoPrevio: `${previo.a}-${dosDigitos(previo.m)}-01`,
    nombreMes: `${MESES[m - 1] ?? ''} de ${a}`,
    nombreMesPrevio: `${MESES[previo.m - 1] ?? ''} de ${previo.a}`,
  }
}

// ─── Familias y modelos de cada escenario ─────────────────────────────────

/** Familia de una fila de ai_logs por su endpoint (o nombre de tarea). */
export function familiaDe(endpoint: string | null): FamiliaIa {
  switch (endpoint) {
    case 'generate':
    case 'generate:esqueleto':
    case 'generate:bloque':
    case 'itinerario':
      return 'generar'
    case '/api/adjust':
    case 'adjust':
    case 'ajuste':
      return 'ajustar'
    case '/api/analyze-video':
    case '/api/analyze-video:imagen':
    case 'vision':
      return 'foto_video'
    case 'interpret':
    case 'interpretar':
      return 'interpretar'
    case '/api/validate':
    case 'validate':
      return 'validar'
    case '/api/reschedule':
      return 'reagendar'
    case '/api/alert-message':
      return 'alertas'
    default:
      return 'otros'
  }
}

const RAPIDAS = new Set<FamiliaIa>([
  'interpretar',
  'validar',
  'reagendar',
  'alertas',
])
const ACCION_DE_FAMILIA: Partial<Record<FamiliaIa, AccionConCupo>> = {
  generar: 'generar',
  ajustar: 'ajustar',
  foto_video: 'analizar',
}

export interface ModelosVigentes {
  proveedor: string
  principal: string
  vision: string
  rapido: string
}

const sinFecha = (m: string) => m.replace(/-\d{8}$/, '')

/**
 * Modelo con el que se recalcula una fila en un escenario. Dentro de foto o
 * video (y de «otras») la llamada hecha con el modelo rápido vigente es la
 * consolidación y pasa al modelo rápido del escenario.
 */
function modeloEnEscenario(
  familia: FamiliaIa,
  modelo: string,
  escenario: EscenarioIa,
  vigentes: ModelosVigentes
): string {
  const m = MODELOS_ESCENARIO[escenario]
  if (RAPIDAS.has(familia)) return m.rapido
  const rapido = sinFecha(vigentes.rapido)
  const usaRapido = sinFecha(modelo) === rapido
  if (familia === 'foto_video') {
    return usaRapido && rapido !== sinFecha(vigentes.vision)
      ? m.rapido
      : m.vision
  }
  if (familia === 'otros') {
    return usaRapido && rapido !== sinFecha(vigentes.principal)
      ? m.rapido
      : m.principal
  }
  return m.principal
}

export function escenarioDe(modelo: string): EscenarioIa | null {
  const id = sinFecha(modelo)
  return (
    ESCENARIOS_IA.find((e) => MODELOS_ESCENARIO[e].principal === id) ?? null
  )
}

// ─── Estadística ──────────────────────────────────────────────────────────

const ceros = (): PorEscenario<number> => ({
  opus: 0,
  sonnet: 0,
  haiku: 0,
  groq: 0,
})

/** Media, p50 y p90 (rango más cercano). Sin valores: ceros. */
export function estadistica(valores: readonly number[]): Estadistica {
  const n = valores.length
  if (n === 0) return { media: 0, p50: 0, p90: 0 }
  const orden = [...valores].sort((x, y) => x - y)
  const rango = (q: number) => orden[Math.max(0, Math.ceil(q * n) - 1)] ?? 0
  return {
    media: orden.reduce((t, v) => t + v, 0) / n,
    p50: rango(0.5),
    p90: rango(0.9),
  }
}

/** Acciones por usuario (con ≥ 1 acción) de cada plan efectivo. */
export function usoPorUsuario(
  porUsuario: ReadonlyMap<string, Record<AccionConCupo, number>>,
  tierDe: (userId: string) => TierUso,
  meta: Pick<UsoPorUsuario, 'fuente' | 'etiqueta' | 'parcial' | 'factorMes'>
): UsoPorUsuario {
  const listas: Record<TierUso, Record<AccionConCupo, number>[]> = {
    pago: [],
    gratis: [],
  }
  for (const [usuario, acciones] of porUsuario) {
    if (ACCIONES_CUPO.some((a) => acciones[a] > 0)) {
      listas[tierDe(usuario)].push(acciones)
    }
  }
  const resumen = (lista: Record<AccionConCupo, number>[]) => ({
    usuarios: lista.length,
    porAccion: Object.fromEntries(
      ACCIONES_CUPO.map((a) => [a, estadistica(lista.map((x) => x[a]))])
    ) as Record<AccionConCupo, Estadistica>,
  })
  return {
    ...meta,
    porTier: { pago: resumen(listas.pago), gratis: resumen(listas.gratis) },
  }
}

// ─── Agregado de ai_logs de un periodo ────────────────────────────────────

interface Contexto {
  admins: ReadonlySet<string>
  tierDe: (userId: string) => TierUso
  vigentes: ModelosVigentes
}

interface Accion {
  real: number
  escenario: PorEscenario<number>
}

function agregarIa(filas: readonly FilaIa[], ctx: Contexto) {
  const familias = new Map(
    FAMILIAS_IA.map((f) => [
      f,
      {
        llamadas: 0,
        tokensEntrada: 0,
        tokensSalida: 0,
        truncadas: 0,
        costoReal: 0,
        escenario: ceros(),
        acciones: [] as Accion[],
      },
    ])
  )
  const grupos = new Map(
    GRUPOS_USUARIO.map((g) => [
      g,
      {
        llamadas: 0,
        costoReal: 0,
        escenario: ceros(),
        usuarios: new Set<string>(),
      },
    ])
  )
  const ultima = new Map<
    string,
    { t: number; truncada: boolean; accion: Accion }
  >()
  const accionesPorUsuario = new Map<string, Record<AccionConCupo, number>>()
  const usuariosConIa = new Set<string>()
  let costoReal = 0
  const costoEscenario = ceros()

  for (const fila of filas) {
    const familia = familiaDe(fila.endpoint)
    const t = Date.parse(fila.created_at)
    const entrada = Math.max(0, Number(fila.prompt_tokens) || 0)
    const salida = Math.max(0, Number(fila.completion_tokens) || 0)
    const real = Number(fila.cost_usd) || 0
    const truncada = fila.error === 'max_tokens'
    const escenario = ceros()
    for (const e of ESCENARIOS_IA) {
      escenario[e] = estimateCost(
        modeloEnEscenario(familia, fila.model, e, ctx.vigentes),
        entrada,
        salida
      )
    }

    // Grupo de la persona.
    const usuario = fila.user_id
    const grupo: GrupoUsuario = !usuario
      ? 'anonimo'
      : ctx.admins.has(usuario)
        ? 'equipo'
        : ctx.tierDe(usuario)
    const g = grupos.get(grupo)
    if (g) {
      g.llamadas += 1
      g.costoReal += real
      for (const e of ESCENARIOS_IA) g.escenario[e] += escenario[e]
      if (usuario) g.usuarios.add(usuario)
    }
    if (usuario && grupo !== 'equipo') usuariosConIa.add(usuario)

    // Familia y acción.
    const f = familias.get(familia)
    if (!f) continue
    f.llamadas += 1
    f.tokensEntrada += entrada
    f.tokensSalida += salida
    if (truncada) f.truncadas += 1
    f.costoReal += real
    for (const e of ESCENARIOS_IA) f.escenario[e] += escenario[e]
    costoReal += real
    for (const e of ESCENARIOS_IA) costoEscenario[e] += escenario[e]

    const clave = `${familia}|${usuario ?? 'anon'}`
    const previa = ultima.get(clave)
    const cerca = previa !== undefined && t - previa.t <= CORTE_SESION_MS
    const misma =
      previa !== undefined &&
      (familia === 'generar' || familia === 'foto_video'
        ? cerca
        : familia === 'ajustar'
          ? cerca && previa.truncada
          : false)
    let accion: Accion
    if (misma && previa) {
      accion = previa.accion
    } else {
      accion = { real: 0, escenario: ceros() }
      f.acciones.push(accion)
      const tipo = ACCION_DE_FAMILIA[familia]
      if (usuario && tipo && grupo !== 'equipo') {
        const cuenta = accionesPorUsuario.get(usuario) ?? {
          generar: 0,
          ajustar: 0,
          analizar: 0,
        }
        cuenta[tipo] += 1
        accionesPorUsuario.set(usuario, cuenta)
      }
    }
    accion.real += real
    for (const e of ESCENARIOS_IA) accion.escenario[e] += escenario[e]
    ultima.set(clave, { t, truncada, accion })
  }

  const listaFamilias: FamiliaReal[] = FAMILIAS_IA.flatMap((familia) => {
    const f = familias.get(familia)
    if (!f || f.llamadas === 0) return []
    return [
      {
        familia,
        llamadas: f.llamadas,
        acciones: f.acciones.length,
        tokensEntrada: f.tokensEntrada,
        tokensSalida: f.tokensSalida,
        truncadas: f.truncadas,
        costoReal: f.costoReal,
        porAccionReal: estadistica(f.acciones.map((a) => a.real)),
        porEscenario: Object.fromEntries(
          ESCENARIOS_IA.map((e) => [
            e,
            {
              total: f.escenario[e],
              porAccion: estadistica(f.acciones.map((a) => a.escenario[e])),
            },
          ])
        ) as FamiliaReal['porEscenario'],
      },
    ]
  })

  const listaGrupos = Object.fromEntries(
    GRUPOS_USUARIO.map((nombre) => {
      const g = grupos.get(nombre)
      const valor: GrupoReal = {
        llamadas: g?.llamadas ?? 0,
        usuariosConIa: g?.usuarios.size ?? 0,
        costoReal: g?.costoReal ?? 0,
        costoEscenario: g?.escenario ?? ceros(),
      }
      return [nombre, valor]
    })
  ) as Record<GrupoUsuario, GrupoReal>

  return {
    ia: {
      llamadas: filas.length,
      costoReal,
      costoEscenario,
      familias: listaFamilias,
      grupos: listaGrupos,
    },
    usuariosConIa,
    accionesPorUsuario,
  }
}

// ─── Datos completos ──────────────────────────────────────────────────────

export interface EntradaDatos {
  ahora: number
  /** Filas de ai_logs ordenadas por created_at (de más antigua a más nueva). */
  filasIa: readonly FilaIa[]
  viajes: readonly FilaViaje[]
  suscripciones: readonly SubRentabilidad[]
  admins: readonly string[]
  /** null: la tabla usage_counters no existe (migración sin aplicar). */
  contadores: readonly FilaContador[] | null
  truncado: boolean
  vigentes: ModelosVigentes
  supuestos: { estado: EstadoSupuestos; actualizado: string | null }
}

function clasificarSuscripciones(
  subs: readonly SubRentabilidad[],
  admins: ReadonlySet<string>
): { suscriptores: SuscriptoresReales; pago: Set<string> } {
  const recurrentes: Record<PlanKey, number> = {
    pro_mensual: 0,
    pro_anual: 0,
    pro_por_viaje: 0,
    pro_grupo: 0,
  }
  let enGracia = 0
  let pasesVigentes = 0
  let concedidos = 0
  const pago = new Set<string>()
  for (const s of subs) {
    if (s.plan_id === 'free' || admins.has(s.user_id)) continue
    const vigente = tierEfectivo(s) !== 'free'
    if (vigente) pago.add(s.user_id)
    const concedido =
      s.source === 'admin' ||
      (s.source === undefined &&
        !s.stripe_subscription_id &&
        s.plan_id !== 'pro_por_viaje')
    if (concedido) {
      if (vigente) concedidos += 1
      continue
    }
    if (!s.stripe_subscription_id) {
      if (s.plan_id === 'pro_por_viaje' && vigente) pasesVigentes += 1
      continue
    }
    if (s.status === 'active' && s.plan_id in PLANS) {
      recurrentes[s.plan_id as PlanKey] += 1
    } else if (s.status === 'trialing' || s.status === 'past_due') {
      enGracia += 1
    }
  }
  return {
    suscriptores: { recurrentes, enGracia, pasesVigentes, concedidos },
    pago,
  }
}

function construirPeriodo(args: {
  clave: ClavePeriodo
  etiqueta: string
  desde: number
  ahora: number
  factorMes: number
  entrada: EntradaDatos
  ctx: Contexto
}): PeriodoReal {
  const { desde, ahora, entrada, ctx } = args
  const filas = entrada.filasIa.filter((f) => Date.parse(f.created_at) >= desde)
  const { ia, usuariosConIa, accionesPorUsuario } = agregarIa(filas, ctx)
  const conViajes = new Set(
    entrada.viajes
      .filter(
        (v) => Date.parse(v.updated_at) >= desde && !ctx.admins.has(v.user_id)
      )
      .map((v) => v.user_id)
  )
  const activos = new Set([...usuariosConIa, ...conViajes])
  let pago = 0
  for (const u of activos) if (ctx.tierDe(u) === 'pago') pago += 1
  return {
    clave: args.clave,
    etiqueta: args.etiqueta,
    desde: new Date(desde).toISOString(),
    dias: Math.max(0, (ahora - desde) / DIA_MS),
    factorMes: args.factorMes,
    ia,
    activos: {
      total: activos.size,
      pago,
      gratis: activos.size - pago,
      conIa: usuariosConIa.size,
      conViajes: conViajes.size,
    },
    uso: usoPorUsuario(accionesPorUsuario, ctx.tierDe, {
      fuente: 'ai_logs',
      etiqueta: args.etiqueta.toLowerCase(),
      parcial: args.clave === 'mes',
      factorMes: args.factorMes,
    }),
  }
}

/** Arma todos los datos reales de la calculadora a partir de las filas. */
export function construirDatos(entrada: EntradaDatos): DatosRentabilidad {
  const { ahora } = entrada
  const r = rangosRD(ahora)
  const admins = new Set(entrada.admins)
  const { suscriptores, pago } = clasificarSuscripciones(
    entrada.suscripciones,
    admins
  )
  const ctx: Contexto = {
    admins,
    tierDe: (u) => (pago.has(u) ? 'pago' : 'gratis'),
    vigentes: entrada.vigentes,
  }

  // Mes en curso: se proyecta a su duración (con al menos un día de base
  // para que el primer minuto del mes no multiplique por miles).
  const transcurrido = Math.max(DIA_MS, ahora - r.inicioMes)
  const mes = construirPeriodo({
    clave: 'mes',
    etiqueta: `Mes en curso (${r.nombreMes})`,
    desde: r.inicioMes,
    ahora,
    factorMes: Math.max(1, (r.finMes - r.inicioMes) / transcurrido),
    entrada,
    ctx,
  })
  const treinta = construirPeriodo({
    clave: '30d',
    etiqueta: 'Últimos 30 días',
    desde: r.inicio30,
    ahora,
    factorMes: 1,
    entrada,
    ctx,
  })

  // usage_counters: el mes anterior si ya tiene filas (completo); si no, el
  // mes en curso (parcial).
  let uso: UsoPorUsuario | null = null
  if (entrada.contadores) {
    const previo = entrada.contadores.filter(
      (c) => c.periodo === r.periodoPrevio
    )
    const usarPrevio = previo.length > 0
    const filas = usarPrevio
      ? previo
      : entrada.contadores.filter((c) => c.periodo === r.periodoActual)
    const porUsuario = new Map<string, Record<AccionConCupo, number>>()
    for (const c of filas) {
      if (admins.has(c.user_id)) continue
      const accion = ACCIONES_CUPO.find((a) => a === c.accion)
      if (!accion) continue
      const cuenta = porUsuario.get(c.user_id) ?? {
        generar: 0,
        ajustar: 0,
        analizar: 0,
      }
      cuenta[accion] += Math.max(0, Number(c.usados) || 0)
      porUsuario.set(c.user_id, cuenta)
    }
    uso = usoPorUsuario(porUsuario, ctx.tierDe, {
      fuente: 'usage_counters',
      etiqueta: usarPrevio ? r.nombreMesPrevio : `${r.nombreMes} (en curso)`,
      parcial: !usarPrevio,
      factorMes: usarPrevio ? 1 : mes.factorMes,
    })
  }

  const v = entrada.vigentes
  const modeloActual: ModeloActual = {
    proveedor: v.proveedor,
    principal: v.principal,
    vision: v.vision,
    rapido: v.rapido,
    escenario: escenarioDe(v.principal),
  }

  return {
    generadoEn: new Date(ahora).toISOString(),
    periodos: { mes, '30d': treinta },
    suscriptores,
    contadores: { disponible: entrada.contadores !== null, uso },
    truncado: entrada.truncado,
    modeloActual,
    supuestos: entrada.supuestos,
  }
}
