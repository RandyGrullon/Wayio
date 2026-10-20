import type { AdminAuditRow } from '@/types/admin'
import { BADGE_VIAJE } from '@/components/ui/Badge'
import {
  ETIQUETA_PROVEEDOR_IA,
  ETIQUETA_ROL,
  etiqueta,
  idCorto,
  legible,
  nombrePlan,
} from './etiquetas'

/**
 * Auditoría humanizada (docs/DISENO.md §6.12): «Cambió el rol a Admin» en vez
 * de `set_user_role`, y el objetivo con su enlace cuando todavía existe.
 */

export interface ObjetivoAuditoria {
  tipo: string
  etiqueta: string
  href?: string
  /** El objetivo es una clave o un id (se muestra en mono). */
  mono: boolean
}

export interface AccionHumanizada {
  texto: string
  objetivo: ObjetivoAuditoria | null
}

const TIPOS: Record<string, string> = {
  user: 'Usuario',
  trip: 'Viaje',
  message: 'Mensaje',
  expense: 'Gasto',
  flag: 'Función',
  announcement: 'Anuncio',
  setting: 'Ajuste',
}

/** Filtros de la lista por tipo de objetivo. */
export const FILTROS_AUDITORIA: readonly { valor: string; label: string }[] = [
  { valor: 'all', label: 'Todo' },
  { valor: 'user', label: 'Usuarios' },
  { valor: 'trip', label: 'Viajes' },
  { valor: 'grupo', label: 'Grupos' },
  { valor: 'flag', label: 'Funciones' },
  { valor: 'announcement', label: 'Anuncios' },
  { valor: 'setting', label: 'Ajustes' },
]

/** ¿La fila pertenece al filtro? («grupo» agrupa mensajes y gastos). */
export function enFiltroAuditoria(row: AdminAuditRow, filtro: string): boolean {
  if (filtro === 'all') return true
  if (filtro === 'grupo') {
    return row.target_type === 'message' || row.target_type === 'expense'
  }
  return row.target_type === filtro
}

const AJUSTES: Record<string, string> = {
  maintenance_mode: 'Modo mantenimiento',
  ai_provider: 'Proveedor de IA',
  rentabilidad_supuestos: 'Supuestos de rentabilidad',
}

function bool(meta: Record<string, unknown>, clave: string): boolean | null {
  const v = meta[clave]
  return typeof v === 'boolean' ? v : null
}

function texto(meta: Record<string, unknown>, clave: string): string | null {
  const v = meta[clave]
  return typeof v === 'string' && v ? v : null
}

function describir(row: AdminAuditRow): string {
  const meta = row.metadata ?? {}
  switch (row.action) {
    case 'set_user_role': {
      const rol = texto(meta, 'role')
      return rol
        ? `Cambió el rol a ${etiqueta(ETIQUETA_ROL, rol)}`
        : 'Cambió el rol'
    }
    case 'ban_user':
      return 'Baneó la cuenta'
    case 'unban_user':
      return 'Quitó el ban de la cuenta'
    case 'grant_plan': {
      const plan = texto(meta, 'planId')
      if (plan === 'free') return 'Pasó la cuenta al plan Gratis'
      return plan ? `Concedió el plan ${nombrePlan(plan)}` : 'Concedió un plan'
    }
    case 'revoke_plan':
      return bool(meta, 'canceladaEnStripe')
        ? 'Revocó el plan y canceló el cobro en Stripe'
        : 'Revocó el plan'
    case 'delete_user':
      return 'Eliminó la cuenta'
    case 'delete_trip':
      return 'Eliminó el viaje'
    case 'set_trip_estado': {
      const estado = texto(meta, 'estado')
      const label = estado
        ? (BADGE_VIAJE[estado]?.label ?? legible(estado))
        : null
      return label
        ? `Cambió el estado del viaje a ${label}`
        : 'Cambió el estado del viaje'
    }
    case 'delete_message':
      return 'Borró un mensaje de un grupo'
    case 'delete_expense':
      return 'Borró un gasto de un grupo'
    case 'upsert_flag': {
      const activa = bool(meta, 'enabled')
      return activa === null
        ? 'Guardó una función'
        : `Guardó una función (${activa ? 'activa' : 'inactiva'})`
    }
    case 'toggle_flag':
      return bool(meta, 'enabled')
        ? 'Activó una función'
        : 'Desactivó una función'
    case 'delete_flag':
      return 'Eliminó una función'
    case 'create_announcement':
      return 'Publicó un anuncio'
    case 'set_announcement_active':
      return bool(meta, 'active') ? 'Activó un anuncio' : 'Ocultó un anuncio'
    case 'delete_announcement':
      return 'Eliminó un anuncio'
    case 'set_maintenance_mode':
      return bool(meta, 'enabled')
        ? 'Activó el modo mantenimiento'
        : 'Desactivó el modo mantenimiento'
    case 'set_rentabilidad_supuestos': {
      const campos = meta['campos']
      const n = Array.isArray(campos) ? campos.length : 0
      return n > 0
        ? `Guardó los supuestos de rentabilidad (${n} ${n === 1 ? 'campo' : 'campos'})`
        : 'Guardó los supuestos de rentabilidad'
    }
    case 'set_ai_provider': {
      const p = texto(meta, 'provider')
      return p
        ? `Cambió el proveedor de IA a ${etiqueta(ETIQUETA_PROVEEDOR_IA, p)}`
        : 'Cambió el proveedor de IA'
    }
    default:
      return legible(row.action)
  }
}

function objetivo(row: AdminAuditRow): ObjetivoAuditoria | null {
  const tipo = row.target_type
  const id = row.target_id
  if (!tipo) return null
  const nombreTipo = TIPOS[tipo] ?? legible(tipo)
  if (!id) return { tipo: nombreTipo, etiqueta: nombreTipo, mono: false }
  switch (tipo) {
    case 'user':
      // Una cuenta eliminada ya no tiene detalle.
      return row.action === 'delete_user'
        ? { tipo: nombreTipo, etiqueta: idCorto(id), mono: true }
        : {
            tipo: nombreTipo,
            etiqueta: idCorto(id),
            href: `/admin/users/${id}`,
            mono: true,
          }
    case 'trip':
      return row.action === 'delete_trip'
        ? { tipo: nombreTipo, etiqueta: idCorto(id), mono: true }
        : {
            tipo: nombreTipo,
            etiqueta: idCorto(id),
            href: `/admin/trips/${id}`,
            mono: true,
          }
    case 'flag':
      return {
        tipo: nombreTipo,
        etiqueta: id,
        ...(row.action === 'delete_flag' ? {} : { href: '/admin/flags' }),
        mono: true,
      }
    case 'announcement':
      // create_announcement guarda el título; el resto, el id.
      return row.action === 'create_announcement'
        ? {
            tipo: nombreTipo,
            etiqueta: `«${id}»`,
            href: '/admin/announcements',
            mono: false,
          }
        : {
            tipo: nombreTipo,
            etiqueta: idCorto(id),
            ...(row.action === 'delete_announcement'
              ? {}
              : { href: '/admin/announcements' }),
            mono: true,
          }
    case 'setting':
      // Los supuestos de rentabilidad son del dueño: sin enlace (otro admin
      // recibiría un 404).
      return {
        tipo: nombreTipo,
        etiqueta: AJUSTES[id] ?? legible(id),
        ...(id === 'rentabilidad_supuestos' ? {} : { href: '/admin/settings' }),
        mono: false,
      }
    default:
      return { tipo: nombreTipo, etiqueta: idCorto(id), mono: true }
  }
}

export function humanizarAccion(row: AdminAuditRow): AccionHumanizada {
  return { texto: describir(row), objetivo: objetivo(row) }
}
