import 'server-only'
import { ultimosDiasRD } from '@/lib/admin/horaRD'
import {
  DIAS_IA_USUARIO,
  ESTADOS_FILTRO,
  ROLES_FILTRO,
} from '@/lib/admin/queries'
import type {
  AiUsageStats,
  DashboardMetrics,
  DayPoint,
  Paged,
  PagedConConteos,
  RangoPanel,
  TripListItem,
  UserAiUsage,
  UserListItem,
  getModerationData,
  getSubscriptionsData,
  getTripDetail,
  getUserDetail,
  listReferrals,
} from '@/lib/admin/queries'
import type {
  AdminAuditRow,
  AiLogRow,
  AnnouncementRow,
  FeatureFlagRow,
  ProfileRow,
} from '@/types/admin'
import type {
  ActivityVoteRow,
  GroupExpenseRow,
  GroupMessageRow,
  SubscriptionRow,
  TripMemberRow,
} from '@/types/database'
import type { Activity } from '@/types/activity'
import type { Day, Trip } from '@/types/trip'
import { estimateCost } from '@/lib/ai/pricing'
import {
  construirDatos,
  rangosRD,
  type FilaContador,
  type FilaIa,
  type FilaViaje,
  type SubRentabilidad,
} from '@/lib/admin/rentabilidad/agregar'
import {
  referencias,
  supuestosPorDefecto,
} from '@/lib/admin/rentabilidad/supuestos'
import type { PropsRentabilidad } from '@/lib/rentabilidad/tipos'
import { ADMIN_DEMO } from './acceso'

/**
 * Datos de EJEMPLO del panel (solo `next dev` sin base de datos; el layout lo
 * avisa con un Callout). Son deterministas: la misma vista siempre muestra lo
 * mismo y nunca se confunden con datos reales (dominio ejemplo.com).
 */

const DIA_MS = 86_400_000
const PAGINA = 25

type UserDetail = Awaited<ReturnType<typeof getUserDetail>>
type TripDetail = Awaited<ReturnType<typeof getTripDetail>>
type SubsData = Awaited<ReturnType<typeof getSubscriptionsData>>
type Moderacion = Awaited<ReturnType<typeof getModerationData>>
type Referidos = Awaited<ReturnType<typeof listReferrals>>

// ─── Utilidades deterministas ─────────────────────────────────────────────

function aleatorio(semilla: number): () => number {
  let s = semilla >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function uuid(n: number): string {
  const r = aleatorio(n * 7919 + 17)
  const hex = (len: number) =>
    Array.from({ length: len }, () => Math.floor(r() * 16).toString(16)).join(
      ''
    )
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`
}

function haceDias(dias: number, horas = 0): string {
  return new Date(Date.now() - dias * DIA_MS - horas * 3_600_000).toISOString()
}

/** Serie diaria por días de RD, como las de queries.ts. */
function serie(dias: number, base: number, semilla: number): DayPoint[] {
  const r = aleatorio(semilla)
  return ultimosDiasRD(dias).map((fecha, i) => {
    const tendencia = 1 + i / (dias * 2)
    return { date: fecha, value: Math.round(base * tendencia * (0.55 + r())) }
  })
}

function suma(puntos: readonly DayPoint[]): number {
  return puntos.reduce((s, p) => s + p.value, 0)
}

/** Conteo de cada opción de un filtro ('all' incluido). */
function contarPor<T>(
  lista: readonly T[],
  valores: readonly string[],
  valor: (fila: T) => string
): Record<string, number> {
  const conteos: Record<string, number> = { all: lista.length }
  for (const v of valores) {
    conteos[v] = lista.filter((x) => valor(x) === v).length
  }
  return conteos
}

function sinTildes(t: string): string {
  return t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

// ─── Usuarios ─────────────────────────────────────────────────────────────

const NOMBRES = [
  'Ana',
  'Luis',
  'María',
  'Carlos',
  'Yokasta',
  'José',
  'Carmen',
  'Miguel',
  'Rosa',
  'Pedro',
  'Lucía',
  'Rafael',
  'Patricia',
  'Juan',
  'Altagracia',
]
const APELLIDOS = [
  'Pérez',
  'Martínez',
  'Rodríguez',
  'Gómez',
  'Féliz',
  'Almonte',
  'Núñez',
  'Castillo',
  'Peña',
  'Santana',
  'Reyes',
  'Batista',
]

interface UsuarioDemo {
  profile: ProfileRow
  tier: 'free' | 'pro' | 'grupo'
  planId: string
  status: string | null
}

const USUARIOS: UsuarioDemo[] = (() => {
  const r = aleatorio(42)
  const lista: UsuarioDemo[] = [
    {
      profile: {
        id: ADMIN_DEMO.userId,
        email: ADMIN_DEMO.email,
        full_name: 'Equipo Wayio',
        avatar_url: null,
        role: 'admin',
        is_banned: false,
        created_at: haceDias(240),
        updated_at: haceDias(3),
      },
      tier: 'pro',
      planId: 'pro_anual',
      status: 'active',
    },
  ]
  for (let i = 1; i < 42; i++) {
    const nombre = NOMBRES[i % NOMBRES.length] ?? 'Ana'
    const apellido = APELLIDOS[(i * 5) % APELLIDOS.length] ?? 'Pérez'
    const planes = [
      'free',
      'free',
      'free',
      'pro_mensual',
      'pro_anual',
      'pro_grupo',
    ]
    const planId = planes[Math.floor(r() * planes.length)] ?? 'free'
    lista.push({
      profile: {
        id: uuid(i),
        email: `${sinTildes(nombre)}.${sinTildes(apellido)}${i}@ejemplo.com`,
        full_name: i % 9 === 0 ? null : `${nombre} ${apellido}`,
        avatar_url: null,
        role: i === 7 ? 'admin' : 'user',
        is_banned: i === 13,
        created_at: haceDias(i * 4 + Math.floor(r() * 3), i),
        updated_at: haceDias(i),
      },
      tier:
        planId === 'free' ? 'free' : planId === 'pro_grupo' ? 'grupo' : 'pro',
      planId,
      status: planId === 'free' ? null : i % 11 === 0 ? 'past_due' : 'active',
    })
  }
  return lista.sort((a, b) =>
    b.profile.created_at.localeCompare(a.profile.created_at)
  )
})()

// ─── Viajes ───────────────────────────────────────────────────────────────

const DESTINOS = [
  'Punta Cana',
  'Cartagena',
  'Ciudad de México',
  'Madrid',
  'Samaná',
  'Medellín',
  'Cusco',
  'San Juan',
  'Buenos Aires',
  'Jarabacoa',
  'Puerto Plata',
  'Lisboa',
]
const PAQUETES = ['basico', 'confort', 'confort', 'premium'] as const
const ESTADOS = [
  'planificando',
  'planificando',
  'en_viaje',
  'completado',
] as const
const MONEDAS = ['USD', 'USD', 'DOP', 'EUR'] as const

interface ViajeDemo {
  item: TripListItem
  userId: string
  moneda: 'USD' | 'EUR' | 'DOP'
}

const VIAJES: ViajeDemo[] = (() => {
  const r = aleatorio(7)
  return Array.from({ length: 64 }, (_, i) => {
    const dueno = USUARIOS[(i * 3) % USUARIOS.length] ?? USUARIOS[0]
    const moneda = MONEDAS[i % MONEDAS.length] ?? 'USD'
    const dias = 3 + Math.floor(r() * 6)
    const base = moneda === 'DOP' ? 60_000 : 900
    return {
      userId: dueno?.profile.id ?? ADMIN_DEMO.userId,
      moneda,
      item: {
        id: uuid(500 + i),
        destino: DESTINOS[i % DESTINOS.length] ?? 'Punta Cana',
        paquete: PAQUETES[i % PAQUETES.length] ?? 'confort',
        estado: ESTADOS[(i * 7) % ESTADOS.length] ?? 'planificando',
        presupuesto: Math.round(base * dias * (0.6 + r())),
        moneda,
        dias,
        created_at: haceDias(i * 1.5, i % 12),
        ownerEmail: dueno?.profile.email ?? null,
      },
    }
  })
})()

function paginar<T>(lista: T[], page: number): Paged<T> {
  const p = Math.max(1, page)
  return {
    items: lista.slice((p - 1) * PAGINA, p * PAGINA),
    total: lista.length,
    page: p,
    pageSize: PAGINA,
  }
}

// ─── API de ejemplo (mismas formas que src/lib/admin/queries.ts) ──────────

export function dashboard(rango: RangoPanel = 30): DashboardMetrics {
  const signupSeries = serie(rango, 11, 3)
  const tripSeries = serie(rango, 20, 9)
  const proporcion = rango / 30
  return {
    rango,
    totalUsers: 1284,
    newUsersHoy: signupSeries.at(-1)?.value ?? 0,
    newUsers7d: suma(signupSeries.slice(-7)),
    newUsersPeriodo: suma(signupSeries),
    newUsersPeriodoPrevio: Math.round(suma(signupSeries) * 0.88),
    totalTrips: 3417,
    tripsPeriodo: suma(tripSeries),
    tripsPeriodoPrevio: Math.round(suma(tripSeries) * 0.94),
    tripsByPackage: { basico: 980, confort: 1806, premium: 631 },
    activeSubs: 148,
    mrr: 1034.52,
    aiCallsPeriodo: Math.round(2210 * proporcion),
    aiCostPeriodo: Number((184.32 * proporcion).toFixed(2)),
    aiTokensPeriodo: Math.round(18_406_220 * proporcion),
    signupSeries,
    tripSeries,
  }
}

export function usuarios(opts: {
  search?: string | undefined
  role?: string | undefined
  page?: number | undefined
}): PagedConConteos<UserListItem> {
  const q = opts.search ? sinTildes(opts.search) : ''
  const buscados = USUARIOS.filter(
    (u) => !q || sinTildes(u.profile.email ?? '').includes(q)
  )
  const filtrados = buscados
    .filter(
      (u) => !opts.role || opts.role === 'all' || u.profile.role === opts.role
    )
    .map((u) => ({
      profile: u.profile,
      tier: u.tier,
      planId: u.planId,
      status: u.status,
      tripCount: VIAJES.filter((v) => v.userId === u.profile.id).length,
    }))
  return {
    ...paginar(filtrados, opts.page ?? 1),
    conteos: contarPor(buscados, ROLES_FILTRO, (u) => u.profile.role),
  }
}

const MODELOS_IA: readonly [string, string, number][] = [
  ['anthropic', 'claude-opus-5-5', 0.11],
  ['anthropic', 'claude-haiku-5-5', 0.006],
  ['groq', 'openai/gpt-oss-120b', 0.002],
]

/** Uso de IA de ejemplo de una persona (algunas no tienen ninguno). */
function usoIaUsuario(i: number): UserAiUsage {
  const r = aleatorio(1500 + i)
  const byModel =
    i % 5 === 2
      ? []
      : MODELOS_IA.map(([provider, model, coste], k) => {
          const calls = Math.round(([14, 9, 4][k] ?? 1) * (0.4 + r()))
          return {
            model,
            provider,
            calls,
            tokens: calls * Math.round(4200 + r() * 5000),
            cost: Number((calls * coste * (0.7 + r() * 0.6)).toFixed(4)),
          }
        })
          .filter((m) => m.calls > 0)
          .sort((a, b) => b.cost - a.cost)
  const calls = byModel.reduce((s, m) => s + m.calls, 0)
  const fallidas = calls > 0 && i % 3 === 0 ? 1 : 0
  return {
    days: DIAS_IA_USUARIO,
    calls,
    successRate: calls ? (calls - fallidas) / calls : 0,
    tokens: byModel.reduce((s, m) => s + m.tokens, 0),
    cost: byModel.reduce((s, m) => s + m.cost, 0),
    lastCallAt: calls ? haceDias(i % 6, i % 10) : null,
    byModel,
  }
}

export function usuario(id: string): UserDetail {
  const u = USUARIOS.find((x) => x.profile.id === id)
  if (!u)
    return {
      profile: null,
      subscription: null,
      trips: [],
      referral: null,
      ai: usoIaUsuario(2),
    }
  const i = USUARIOS.indexOf(u)
  const subscription: SubscriptionRow | null =
    u.planId === 'free'
      ? null
      : {
          id: uuid(900 + i),
          user_id: id,
          plan_id: u.planId as SubscriptionRow['plan_id'],
          tier: u.tier,
          stripe_customer_id: i % 4 === 0 ? null : `cus_Demo${i}Xk2PqR`,
          stripe_subscription_id: i % 4 === 0 ? null : `sub_Demo${i}Lm9TzQ`,
          stripe_price_id: null,
          status: (u.status ?? 'active') as SubscriptionRow['status'],
          current_period_end: haceDias(-20 + i),
          cancel_at_period_end: i % 5 === 0,
          source: i % 4 === 0 ? 'admin' : 'stripe',
          created_at: haceDias(60 + i),
        }
  return {
    profile: u.profile,
    subscription,
    trips: VIAJES.filter((v) => v.userId === id).map((v) => ({
      id: v.item.id,
      destino: v.item.destino,
      paquete: v.item.paquete,
      estado: v.item.estado,
      created_at: v.item.created_at,
    })),
    referral:
      i % 3 === 0
        ? {
            id: uuid(1200 + i),
            user_id: id,
            code: `WAY${(1000 + i * 37).toString(36).toUpperCase()}`,
            conversions: (i * 7) % 11,
            created_at: haceDias(50 + i),
          }
        : null,
    ai: usoIaUsuario(i),
  }
}

export function viajes(opts: {
  search?: string | undefined
  estado?: string | undefined
  page?: number | undefined
}): PagedConConteos<TripListItem> {
  const q = opts.search ? sinTildes(opts.search) : ''
  const buscados = VIAJES.map((v) => v.item).filter(
    (t) => !q || sinTildes(t.destino).includes(q)
  )
  const filtrados = buscados.filter(
    (t) => !opts.estado || opts.estado === 'all' || t.estado === opts.estado
  )
  return {
    ...paginar(filtrados, opts.page ?? 1),
    conteos: contarPor(buscados, ESTADOS_FILTRO, (t) => t.estado),
  }
}

function actividad(
  id: string,
  nombre: string,
  inicio: string,
  fin: string,
  tipo: Activity['tipo'],
  precio: number,
  estado: Activity['estado'] = 'pendiente'
): Activity {
  return {
    id,
    nombre,
    descripcion: '',
    horaInicio: inicio,
    horaFin: fin,
    duracionMinutos: 90,
    tipo,
    direccion: '',
    lat: 18.47,
    lng: -69.89,
    radioGeofencingMetros: 100,
    precioEstimado: precio,
    reservaRequerida: false,
    reservaPagada: false,
    mejorHoraVisita: '',
    consejos: [],
    tiempoHastaSiguiente: 15,
    estado,
    esPerdida: estado === 'perdida',
  }
}

export function viaje(id: string): TripDetail {
  const v = VIAJES.find((x) => x.item.id === id)
  if (!v) {
    return {
      trip: null,
      ownerEmail: null,
      members: [],
      messages: [],
      expenses: [],
      votes: [],
    }
  }
  const factor = v.moneda === 'DOP' ? 60 : 1
  const dias: Day[] = [
    {
      numero: 1,
      titulo: 'Llegada y primer paseo',
      descripcion: '',
      ciudad: v.item.destino,
      presupuestoDia: 180 * factor,
      colorMapa: '',
      actividades: [
        actividad(
          'a1',
          'Check-in en el hotel',
          '15:00',
          '16:00',
          'actividad',
          0,
          'completada'
        ),
        actividad(
          'a2',
          'Paseo por el centro histórico',
          '17:00',
          '19:00',
          'barrio',
          0,
          'completada'
        ),
        actividad(
          'a3',
          'Cena criolla',
          '20:00',
          '21:30',
          'restaurante',
          45 * factor,
          'completada'
        ),
      ],
    },
    {
      numero: 2,
      titulo: 'Playa y atardecer',
      descripcion: '',
      ciudad: v.item.destino,
      presupuestoDia: 240 * factor,
      colorMapa: '',
      actividades: [
        actividad(
          'a4',
          'Desayuno con vista al mar',
          '8:30',
          '9:30',
          'restaurante',
          18 * factor
        ),
        actividad(
          'a5',
          'Mañana de playa',
          '10:00',
          '13:00',
          'playa',
          0,
          'perdida'
        ),
        actividad(
          'a6',
          'Museo de la ciudad',
          '15:00',
          '16:30',
          'museo',
          12 * factor
        ),
        actividad(
          'a7',
          'Atardecer en el malecón',
          '18:00',
          '19:00',
          'parque',
          0
        ),
      ],
    },
    {
      numero: 3,
      titulo: 'Último día',
      descripcion: '',
      ciudad: v.item.destino,
      presupuestoDia: 120 * factor,
      colorMapa: '',
      actividades: [
        actividad(
          'a8',
          'Mercado local',
          '9:00',
          '11:00',
          'barrio',
          20 * factor
        ),
        actividad(
          'a9',
          'Traslado al aeropuerto',
          '13:00',
          '14:00',
          'traslado',
          35 * factor
        ),
      ],
    },
  ]
  const inicio = new Date(Date.now() + 12 * DIA_MS)
  const fin = new Date(inicio.getTime() + 2 * DIA_MS)
  const dato: Trip = {
    id: `trip-${v.item.id.slice(0, 8)}`,
    destino: v.item.destino,
    origen: 'Santo Domingo',
    personas: 3,
    fechaInicio: inicio.toISOString().slice(0, 10),
    fechaFin: fin.toISOString().slice(0, 10),
    presupuestoTotal: v.item.presupuesto,
    presupuestoPorPersona: Math.round(v.item.presupuesto / 3),
    dias,
    paquete: v.item.paquete as Trip['paquete'],
    moneda: v.moneda,
    resumenViaje:
      'Un viaje corto para conocer lo esencial: centro histórico, una mañana de playa y buena comida local.',
    consejos: [],
    advertencias: [],
    listaActividades: [],
    actividadesPendientes: [],
  }
  const nombres = ['Ana Pérez', 'Luis Martínez', 'Carmen Núñez']
  const members: TripMemberRow[] = nombres.map((nombre, i) => ({
    id: uuid(3000 + i),
    trip_id: id,
    user_id: i === 0 ? v.userId : uuid(3100 + i),
    nombre,
    avatar_url: null,
    lat_actual: null,
    lng_actual: null,
    ultima_ubicacion: i === 2 ? null : haceDias(0, i + 1),
    joined_at: haceDias(10 - i),
  }))
  const messages: GroupMessageRow[] = [
    ['Ana Pérez', '¿Quién se apunta a la playa mañana temprano?', 'mensaje'],
    ['Luis Martínez', 'Yo. Llevo la sombrilla.', 'mensaje'],
    ['Wayio', 'Carmen llegó al hotel.', 'sistema'],
    ['Carmen Núñez', 'Vamos con 20 minutos de retraso al museo.', 'alerta'],
  ].map(([nombre, mensaje, tipo], i) => ({
    id: uuid(3200 + i),
    trip_id: id,
    user_id: uuid(3100 + i),
    nombre_usuario: nombre ?? '',
    mensaje: mensaje ?? '',
    tipo: (tipo ?? 'mensaje') as GroupMessageRow['tipo'],
    created_at: haceDias(1, 8 - i * 2),
  }))
  const expenses: GroupExpenseRow[] = [
    ['Cena criolla', 'Ana Pérez', 135],
    ['Taxi al malecón', 'Luis Martínez', 22.5],
    ['Entradas al museo', 'Carmen Núñez', 36],
  ].map(([concepto, nombre, monto], i) => ({
    id: uuid(3300 + i),
    trip_id: id,
    pagado_por: uuid(3100 + i),
    nombre_pagador: String(nombre),
    concepto: String(concepto),
    monto: Number(monto) * factor,
    entre_todos: true,
    created_at: haceDias(1, i * 3),
  }))
  const votes: ActivityVoteRow[] = [0, 1, 2, 3].map((i) => ({
    id: uuid(3400 + i),
    trip_id: id,
    activity_id: i < 2 ? 'a5' : 'a6',
    user_id: uuid(3100 + i),
    voto: i !== 1,
    created_at: haceDias(2),
  }))
  return {
    trip: {
      id,
      user_id: v.userId,
      data: dato,
      paquete: dato.paquete,
      grupo_link: 'demo-enlace',
      is_public: false,
      estado: v.item.estado as 'planificando' | 'en_viaje' | 'completado',
      actividades_pendientes: [],
      created_at: v.item.created_at,
      updated_at: v.item.created_at,
    },
    ownerEmail: v.item.ownerEmail,
    members,
    messages,
    expenses,
    votes,
  }
}

export function suscripciones(): SubsData {
  const items = USUARIOS.filter((u) => u.planId !== 'free').map((u, i) => {
    const sub = usuario(u.profile.id).subscription
    return {
      sub:
        sub ??
        ({
          id: uuid(4000 + i),
          user_id: u.profile.id,
          plan_id: 'free',
          tier: 'free',
          stripe_customer_id: null,
          stripe_subscription_id: null,
          stripe_price_id: null,
          status: 'active',
          current_period_end: null,
          cancel_at_period_end: false,
          created_at: haceDias(30),
        } satisfies SubscriptionRow),
      email: u.profile.email,
    }
  })
  items.push({
    sub: {
      id: uuid(4100),
      user_id: uuid(4101),
      plan_id: 'pro_mensual',
      tier: 'pro',
      stripe_customer_id: 'cus_DemoTrialAb12',
      stripe_subscription_id: 'sub_DemoTrialCd34',
      stripe_price_id: null,
      status: 'trialing',
      current_period_end: haceDias(-6),
      cancel_at_period_end: false,
      source: 'stripe',
      created_at: haceDias(8),
    },
    email: 'prueba.gratis@ejemplo.com',
  })
  items.push({
    sub: {
      id: uuid(4102),
      user_id: uuid(4103),
      plan_id: 'free',
      tier: 'free',
      stripe_customer_id: 'cus_DemoCanceladoEf5',
      stripe_subscription_id: null,
      stripe_price_id: null,
      status: 'canceled',
      current_period_end: null,
      cancel_at_period_end: false,
      source: 'stripe',
      created_at: haceDias(120),
    },
    email: 'ex.suscriptor@ejemplo.com',
  })
  const activas = items.filter(
    (s) => s.sub.status === 'active' && s.sub.plan_id !== 'free'
  )
  const cobradas = activas.filter(
    (s) => s.sub.source !== 'admin' && Boolean(s.sub.stripe_subscription_id)
  )
  const mensual = (plan: string) =>
    plan === 'pro_anual' ? 49.99 / 12 : plan === 'pro_grupo' ? 12.99 : 6.99
  const mrr = cobradas.reduce((s, x) => s + mensual(x.sub.plan_id), 0)
  const byTier: Record<string, number> = { free: 0, pro: 0, grupo: 0 }
  for (const s of items) byTier[s.sub.tier] = (byTier[s.sub.tier] ?? 0) + 1
  return {
    items,
    mrr,
    arr: mrr * 12,
    activeCount: activas.length,
    payingCount: cobradas.length,
    manualCount: activas.length - cobradas.length,
    byTier,
  }
}

export function moderacion(): Moderacion {
  const viajesGrupo = VIAJES.slice(0, 6)
  const ids = viajesGrupo.map((v) => v.item.id)
  const textos: [string, string, GroupMessageRow['tipo']][] = [
    ['Ana Pérez', '¿Alguien tiene el enlace del tour en catamarán?', 'mensaje'],
    [
      'Luis Martínez',
      'Llegamos al aeropuerto, salimos en 10 minutos.',
      'mensaje',
    ],
    ['Wayio', 'Rafael se unió al grupo.', 'sistema'],
    ['Carmen Núñez', 'Vamos tarde a la excursión, nos vemos allá.', 'alerta'],
    ['Pedro Santana', 'Ya pagué los boletos del ferry.', 'mensaje'],
    ['Rosa Peña', 'La cena de hoy es a las 8:00 p. m.', 'mensaje'],
    ['Miguel Reyes', '¿Votamos por el museo o por la playa?', 'mensaje'],
  ]
  const gastos: [string, string, number][] = [
    ['Tour en catamarán', 'Ana Pérez', 240],
    ['Ferry a la isla', 'Pedro Santana', 96],
    ['Cena de grupo', 'Rosa Peña', 182.4],
    ['Gasolina', 'Luis Martínez', 55],
  ]
  return {
    groupCount: 37,
    messages: textos.map(([nombre, mensaje, tipo], i) => ({
      id: uuid(5000 + i),
      trip_id: ids[i % ids.length] ?? '',
      user_id: uuid(5100 + i),
      nombre_usuario: nombre,
      mensaje,
      tipo,
      created_at: haceDias(0, i * 3 + 1),
    })),
    expenses: gastos.map(([concepto, nombre, monto], i) => {
      const v = viajesGrupo[i % viajesGrupo.length]
      const moneda = v?.moneda ?? 'USD'
      return {
        id: uuid(5200 + i),
        trip_id: v?.item.id ?? '',
        pagado_por: uuid(5100 + i),
        nombre_pagador: nombre,
        concepto,
        // Los importes van en la moneda del viaje (RD$ ≈ 60 × US$).
        monto: moneda === 'DOP' ? monto * 60 : monto,
        entre_todos: true,
        created_at: haceDias(i, 4),
        moneda,
        destino: v?.item.destino ?? null,
      }
    }),
  }
}

export function referidos(): Referidos {
  const items = USUARIOS.slice(0, 14).map((u, i) => ({
    ref: {
      id: uuid(6000 + i),
      user_id: u.profile.id,
      code: `WAY${(1000 + i * 37).toString(36).toUpperCase()}`,
      conversions: (i * 7 + 3) % 13,
      created_at: haceDias(20 + i * 6),
    },
    email: u.profile.email,
  }))
  items.sort((a, b) => b.ref.conversions - a.ref.conversions)
  return {
    items,
    totalConversions: items.reduce((s, x) => s + x.ref.conversions, 0),
  }
}

export function usoIa(): AiUsageStats {
  const r = aleatorio(11)
  const recent: AiLogRow[] = Array.from({ length: 20 }, (_, i) => {
    const [provider, model, coste] = MODELOS_IA[i % 3] ??
      MODELOS_IA[0] ?? ['', '', 0]
    const ok = i % 9 !== 4
    const prompt = 1800 + Math.floor(r() * 2400)
    const completion = ok ? 2200 + Math.floor(r() * 5200) : 0
    return {
      id: uuid(7000 + i),
      user_id: USUARIOS[i % USUARIOS.length]?.profile.id ?? null,
      provider,
      model,
      endpoint: ['generate', 'adjust', 'interpret', 'validate'][i % 4] ?? null,
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: prompt + completion,
      cost_usd: ok ? Number((coste * (0.6 + r())).toFixed(4)) : 0,
      latency_ms: ok ? 4000 + Math.floor(r() * 38000) : 60000,
      success: ok,
      error: ok ? null : 'Tiempo de espera agotado',
      created_at: haceDias(0, i * 2.5),
    }
  })
  const series = serie(30, 6, 21).map((p) => ({
    date: p.date,
    value: Number((p.value * 0.97).toFixed(2)),
  }))
  return {
    totalCalls: 2210,
    totalCost: 184.32,
    totalTokens: 18_406_220,
    successRate: 0.973,
    avgLatency: 18_420,
    byProvider: [
      { provider: 'anthropic', calls: 1702, cost: 176.9, tokens: 15_220_400 },
      { provider: 'groq', calls: 508, cost: 7.42, tokens: 3_185_820 },
    ],
    byModel: [
      { model: 'claude-opus-5-5', calls: 902, cost: 151.3, tokens: 11_908_000 },
      { model: 'claude-haiku-5-5', calls: 800, cost: 25.6, tokens: 3_312_400 },
      {
        model: 'openai/gpt-oss-120b',
        calls: 508,
        cost: 7.42,
        tokens: 3_185_820,
      },
    ],
    recent,
    series,
  }
}

export function funciones(): FeatureFlagRow[] {
  return [
    {
      key: 'analisis_video',
      enabled: true,
      value: {},
      description: 'Recrear un viaje desde un video o una foto',
      platform: 'all',
      updated_at: haceDias(3),
      updated_by: ADMIN_DEMO.userId,
    },
    {
      key: 'chat_grupo_v2',
      enabled: false,
      value: { porcentaje: 20 },
      description: 'Nuevo chat del grupo con respuestas',
      platform: 'mobile',
      updated_at: haceDias(9),
      updated_by: ADMIN_DEMO.userId,
    },
    {
      key: 'mapa_sin_conexion',
      enabled: true,
      value: { maxMb: 80 },
      description: 'Descargar el mapa del viaje para usarlo sin conexión',
      platform: 'mobile',
      updated_at: haceDias(21),
      updated_by: null,
    },
    {
      key: 'reservas',
      enabled: false,
      value: {},
      description: null,
      platform: 'web',
      updated_at: haceDias(40),
      updated_by: null,
    },
  ]
}

export function anuncios(): AnnouncementRow[] {
  return [
    {
      id: uuid(8000),
      title: 'Nuevo: viajes en grupo',
      body: 'Invita a tu gente, voten actividades y repartan los gastos.',
      level: 'info',
      platform: 'all',
      active: true,
      starts_at: haceDias(2),
      ends_at: null,
      created_at: haceDias(2),
      created_by: ADMIN_DEMO.userId,
    },
    {
      id: uuid(8002),
      title: 'Temporada de verano',
      body: 'Ofertas en viajes a la playa del 15 al 22: planifica el tuyo.',
      level: 'info',
      platform: 'web',
      active: true,
      starts_at: haceDias(-3),
      ends_at: haceDias(-10),
      created_at: haceDias(1),
      created_by: ADMIN_DEMO.userId,
    },
    {
      id: uuid(8001),
      title: 'Mantenimiento programado',
      body: 'El domingo de 2:00 a 3:00 a. m. la app puede ir lenta.',
      level: 'warning',
      platform: 'mobile',
      active: false,
      starts_at: haceDias(15),
      ends_at: haceDias(14),
      created_at: haceDias(16),
      created_by: ADMIN_DEMO.userId,
    },
  ]
}

export function ajustes(): Record<string, Record<string, unknown>> {
  return {
    maintenance_mode: { enabled: false, message: '' },
    ai_provider: { provider: 'anthropic' },
  }
}

export function auditoria(): AdminAuditRow[] {
  const u = USUARIOS[3]?.profile.id ?? ''
  const t = VIAJES[2]?.item.id ?? ''
  const filas: [
    string,
    string | null,
    string | null,
    Record<string, unknown>,
  ][] = [
    ['set_user_role', 'user', u, { role: 'admin' }],
    ['grant_plan', 'user', u, { planId: 'pro_anual' }],
    ['set_trip_estado', 'trip', t, { estado: 'en_viaje' }],
    ['toggle_flag', 'flag', 'analisis_video', { enabled: true }],
    ['create_announcement', 'announcement', 'Nuevo: viajes en grupo', {}],
    ['set_maintenance_mode', 'setting', 'maintenance_mode', { enabled: false }],
    ['delete_message', 'message', uuid(9001), {}],
    [
      'revoke_plan',
      'user',
      uuid(9002),
      { stripeSubscriptionId: 'sub_DemoAb12', canceladaEnStripe: true },
    ],
    ['ban_user', 'user', USUARIOS[12]?.profile.id ?? '', {}],
    ['set_ai_provider', 'setting', 'ai_provider', { provider: 'anthropic' }],
    ['delete_trip', 'trip', uuid(9003), {}],
  ]
  return filas.map(([action, targetType, targetId, metadata], i) => ({
    id: uuid(9100 + i),
    admin_id: ADMIN_DEMO.userId,
    admin_email: ADMIN_DEMO.email,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
    created_at: haceDias(i * 0.7, i),
  }))
}

// ─── Rentabilidad (solo el dueño) ─────────────────────────────────────────

const OPUS = 'claude-opus-5-5'
const HAIKU = 'claude-haiku-5-5'

/**
 * Calculadora de rentabilidad de ejemplo: filas de ai_logs, viajes,
 * suscripciones y contadores sintéticos (60 personas, 10 de ellas Pro) que
 * pasan por el MISMO agregado que los datos reales (agregar.ts). Tokens
 * calibrados para que un viaje de 5 días con Opus cueste ≈ US$0.33 y un
 * ajuste ≈ US$0.17, como el informe.
 */
export function rentabilidad(): PropsRentabilidad {
  const ahora = Date.now()
  const r = aleatorio(2026)
  const filas: FilaIa[] = []
  const viajes: FilaViaje[] = []
  const contadores = new Map<string, number>()
  const { inicioMes, periodoActual } = rangosRD(ahora)

  const fila = (
    usuario: string | null,
    instante: number,
    endpoint: string,
    model: string,
    entrada: number,
    salida: number,
    error: string | null = null
  ) => {
    filas.push({
      user_id: usuario,
      model,
      endpoint,
      prompt_tokens: entrada,
      completion_tokens: salida,
      cost_usd: Number(estimateCost(model, entrada, salida).toFixed(6)),
      error,
      created_at: new Date(instante).toISOString(),
    })
  }
  const contar = (usuario: string, accion: string, instante: number) => {
    if (instante < inicioMes) return
    const clave = `${usuario}|${accion}`
    contadores.set(clave, (contadores.get(clave) ?? 0) + 1)
  }
  /** Un instante de los últimos 40 días, a una hora de RD razonable. */
  const momento = () =>
    ahora - Math.floor(r() * 40) * DIA_MS - Math.floor(r() * 12) * 3_600_000

  const generar = (usuario: string | null, t: number, dias: number) => {
    const u = usuario
    const vary = (n: number) => Math.round(n * (0.85 + r() * 0.3))
    fila(u, t - 40_000, 'interpret', HAIKU, vary(1200), vary(300))
    if (dias <= 3) {
      fila(u, t, 'generate', OPUS, vary(3500), vary(6000))
    } else {
      fila(u, t, 'generate:esqueleto', OPUS, vary(3000), vary(2500))
      for (let b = 0; b < Math.ceil(dias / 2); b++) {
        fila(
          u,
          t + 2_000 + b * 300,
          'generate:bloque',
          OPUS,
          vary(3500),
          vary(3800)
        )
      }
    }
    fila(u, t + 150_000, '/api/validate', HAIKU, vary(2500), vary(600))
    if (u) {
      contar(u, 'generar', t)
      viajes.push({ user_id: u, updated_at: new Date(t).toISOString() })
    }
  }
  const ajustar = (usuario: string, t: number, truncado: boolean) => {
    const vary = (n: number) => Math.round(n * (0.85 + r() * 0.3))
    if (truncado) {
      fila(
        usuario,
        t - 20_000,
        '/api/adjust',
        OPUS,
        vary(9000),
        12_000,
        'max_tokens'
      )
    }
    fila(usuario, t, '/api/adjust', OPUS, vary(9000), vary(6500))
    contar(usuario, 'ajustar', t)
  }
  const foto = (usuario: string, t: number) => {
    fila(usuario, t, '/api/analyze-video:imagen', OPUS, 2500, 900)
    fila(usuario, t + 1_500, '/api/analyze-video:imagen', HAIKU, 1500, 500)
    contar(usuario, 'analizar', t)
  }

  const personas = Array.from({ length: 60 }, (_, i) => ({
    id: uuid(6000 + i),
    pago: i % 6 === 0,
    i,
  }))
  for (const p of personas) {
    const viajesN = p.pago ? 2 + (p.i % 5) : p.i % 3
    const ajustesN = p.pago ? 3 + (p.i % 8) : p.i % 5
    const fotosN = p.pago ? p.i % 3 : p.i % 4 === 0 ? 1 : 0
    for (let k = 0; k < viajesN; k++) {
      generar(p.id, momento(), [3, 5, 5, 7, 14][(p.i + k) % 5] ?? 5)
    }
    for (let k = 0; k < ajustesN; k++) {
      ajustar(p.id, momento(), (p.i + k) % 9 === 0)
    }
    for (let k = 0; k < fotosN; k++) foto(p.id, momento())
  }
  // Personas que solo editaron o abrieron su viaje (sin IA).
  for (let i = 0; i < 15; i++) {
    viajes.push({
      user_id: uuid(6100 + i),
      updated_at: new Date(momento()).toISOString(),
    })
  }
  // Llamadas sin cuenta (interpretar) y pruebas del equipo.
  for (let i = 0; i < 30; i++) {
    fila(null, momento(), 'interpret', HAIKU, 1200, 300)
  }
  for (let i = 0; i < 4; i++) generar(ADMIN_DEMO.userId, momento(), 5)

  filas.sort((a, b) => a.created_at.localeCompare(b.created_at))

  const enUnMes = new Date(ahora + 20 * DIA_MS).toISOString()
  const sub = (
    i: number,
    plan_id: SubRentabilidad['plan_id'],
    extra: Partial<SubRentabilidad> = {}
  ): SubRentabilidad => ({
    user_id: uuid(6000 + i),
    plan_id,
    tier: plan_id === 'pro_grupo' ? 'grupo' : 'pro',
    status: 'active',
    stripe_subscription_id: `sub_Demo${i}`,
    current_period_end: enUnMes,
    source: 'stripe',
    ...extra,
  })
  const suscripciones: SubRentabilidad[] = [
    sub(0, 'pro_mensual'),
    sub(6, 'pro_mensual'),
    sub(12, 'pro_mensual'),
    sub(18, 'pro_mensual'),
    sub(24, 'pro_anual'),
    sub(30, 'pro_anual'),
    sub(36, 'pro_grupo'),
    sub(42, 'pro_por_viaje', { stripe_subscription_id: null }),
    sub(48, 'pro_anual', { stripe_subscription_id: null, source: 'admin' }),
    sub(54, 'pro_mensual', { status: 'past_due' }),
  ]

  const filasContador: FilaContador[] = [...contadores.entries()].map(
    ([clave, usados]) => {
      const [user_id = '', accion = ''] = clave.split('|')
      return { user_id, periodo: periodoActual, accion, usados }
    }
  )

  const datos = construirDatos({
    ahora,
    filasIa: filas,
    viajes,
    suscripciones,
    admins: [ADMIN_DEMO.userId],
    contadores: filasContador,
    truncado: false,
    vigentes: {
      proveedor: 'anthropic',
      principal: OPUS,
      vision: OPUS,
      rapido: HAIKU,
    },
    supuestos: { estado: 'por_defecto', actualizado: null },
  })
  const porDefecto = supuestosPorDefecto(datos)
  return {
    datos,
    supuestos: porDefecto,
    porDefecto,
    referencias: referencias(),
  }
}
