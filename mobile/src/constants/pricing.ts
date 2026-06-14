export interface Plan {
  id: string
  nombre: string
  precio: number
  periodo: string
  destacado: boolean
}

export const PLANS: Plan[] = [
  {
    id: 'pro_por_viaje',
    nombre: 'Pro por Viaje',
    precio: 4.99,
    periodo: 'pago único',
    destacado: false,
  },
  {
    id: 'pro_mensual',
    nombre: 'Pro Viajero Mensual',
    precio: 6.99,
    periodo: 'mes',
    destacado: false,
  },
  {
    id: 'pro_anual',
    nombre: 'Pro Viajero Anual',
    precio: 49.99,
    periodo: 'año · ahorra 40%',
    destacado: true,
  },
  {
    id: 'pro_grupo',
    nombre: 'Pro Grupo Mensual',
    precio: 12.99,
    periodo: 'mes · hasta 15 personas',
    destacado: false,
  },
]

export const PRO_FEATURES = [
  'Análisis IA de alertas y demoras',
  'Reoptimización de ruta en vivo',
  'Modo sin conexión (offline)',
  'Recuperar actividades perdidas',
  'Análisis de TikTok ilimitado',
  'Historial de viajes y export PDF',
]

export const GROUP_FEATURES = [
  'Dividir gastos del grupo',
  'Chat integrado',
  'Ubicación del grupo en vivo',
  'Alertas sincronizadas',
]
