export const PLANS = {
  pro_mensual: {
    id: 'pro_mensual',
    nombre: 'Pro Viajero Mensual',
    precio: 6.99,
    periodo: 'mes',
    stripePriceEnv: 'STRIPE_PRICE_MONTHLY',
    ahorro: null,
    destacado: false,
  },
  pro_anual: {
    id: 'pro_anual',
    nombre: 'Pro Viajero Anual',
    precio: 49.99,
    periodo: 'año',
    stripePriceEnv: 'STRIPE_PRICE_ANNUAL',
    ahorro: '40%',
    destacado: true,
  },
  pro_por_viaje: {
    id: 'pro_por_viaje',
    nombre: 'Pase Pro de 30 días',
    precio: 4.99,
    periodo: 'único',
    stripePriceEnv: 'STRIPE_PRICE_PER_TRIP',
    ahorro: null,
    destacado: false,
  },
  pro_grupo: {
    id: 'pro_grupo',
    nombre: 'Pro Grupo Mensual',
    precio: 12.99,
    periodo: 'mes',
    stripePriceEnv: 'STRIPE_PRICE_GROUP',
    ahorro: null,
    destacado: false,
  },
} as const

export type PlanKey = keyof typeof PLANS
