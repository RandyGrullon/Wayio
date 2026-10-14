import 'server-only'
import {
  getAiUsage,
  getDashboardMetrics,
  getModerationData,
  getSettings,
  getSubscriptionsData,
  getTripDetail,
  getUserDetail,
  listAnnouncements,
  listAudit,
  listFlags,
  listReferrals,
  listTrips,
  listUsers,
} from '@/lib/admin/queries'
import type { RangoPanel } from '@/lib/admin/queries'
import { modoPanel } from './acceso'
import * as demo from './demo'

/**
 * Datos del panel: las consultas reales de src/lib/admin/queries.ts (que
 * llaman a requireAdmin) o, en `next dev` sin base de datos, los de ejemplo.
 */

const enDemo = () => modoPanel() === 'demo'

export const datosPanel = (rango: RangoPanel) =>
  enDemo() ? Promise.resolve(demo.dashboard(rango)) : getDashboardMetrics(rango)

export const datosUsuarios = (opts: Parameters<typeof listUsers>[0]) =>
  enDemo() ? Promise.resolve(demo.usuarios(opts)) : listUsers(opts)

export const datosUsuario = (id: string) =>
  enDemo() ? Promise.resolve(demo.usuario(id)) : getUserDetail(id)

export const datosViajes = (opts: Parameters<typeof listTrips>[0]) =>
  enDemo() ? Promise.resolve(demo.viajes(opts)) : listTrips(opts)

export const datosViaje = (id: string) =>
  enDemo() ? Promise.resolve(demo.viaje(id)) : getTripDetail(id)

export const datosSuscripciones = () =>
  enDemo() ? Promise.resolve(demo.suscripciones()) : getSubscriptionsData()

export const datosModeracion = () =>
  enDemo() ? Promise.resolve(demo.moderacion()) : getModerationData()

export const datosReferidos = () =>
  enDemo() ? Promise.resolve(demo.referidos()) : listReferrals()

export const datosIa = (dias = 30) =>
  enDemo() ? Promise.resolve(demo.usoIa()) : getAiUsage(dias)

export const datosFunciones = () =>
  enDemo() ? Promise.resolve(demo.funciones()) : listFlags()

export const datosAnuncios = () =>
  enDemo() ? Promise.resolve(demo.anuncios()) : listAnnouncements()

export const datosAjustes = () =>
  enDemo() ? Promise.resolve(demo.ajustes()) : getSettings()

export const datosAuditoria = () =>
  enDemo() ? Promise.resolve(demo.auditoria()) : listAudit()
