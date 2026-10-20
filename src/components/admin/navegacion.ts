import type { LucideIcon } from 'lucide-react'
import {
  Bot,
  Calculator,
  CreditCard,
  Flag,
  Gift,
  LayoutDashboard,
  Map as MapIcon,
  Megaphone,
  MessagesSquare,
  ScrollText,
  Settings,
  Users,
} from 'lucide-react'

/**
 * Navegación del panel (docs/DISENO.md §6.12): grupos con kicker
 * OPERACIÓN · NEGOCIO · PLATAFORMA. La usan el sidebar, el drawer móvil,
 * las migas y la búsqueda ⌘K.
 */

export interface ItemNav {
  href: string
  label: string
  icono: LucideIcon
  /**
   * Solo lo ve el dueño (WAYIO_OWNER_EMAILS). Ocultarlo en el menú es solo
   * presentación: la página lo vuelve a exigir en el servidor (requireOwner).
   */
  soloDueno?: boolean
}

export interface GrupoNav {
  id: string
  titulo: string
  items: readonly ItemNav[]
}

export const NAV_ADMIN: readonly GrupoNav[] = [
  {
    id: 'operacion',
    titulo: 'Operación',
    items: [
      { href: '/admin', label: 'Panel', icono: LayoutDashboard },
      { href: '/admin/users', label: 'Usuarios', icono: Users },
      { href: '/admin/trips', label: 'Viajes', icono: MapIcon },
      { href: '/admin/groups', label: 'Grupos', icono: MessagesSquare },
    ],
  },
  {
    id: 'negocio',
    titulo: 'Negocio',
    items: [
      {
        href: '/admin/subscriptions',
        label: 'Suscripciones',
        icono: CreditCard,
      },
      { href: '/admin/referrals', label: 'Referidos', icono: Gift },
      { href: '/admin/ai', label: 'Uso de IA', icono: Bot },
      {
        href: '/admin/rentabilidad',
        label: 'Rentabilidad',
        icono: Calculator,
        soloDueno: true,
      },
    ],
  },
  {
    id: 'plataforma',
    titulo: 'Plataforma',
    items: [
      { href: '/admin/flags', label: 'Funciones', icono: Flag },
      { href: '/admin/announcements', label: 'Anuncios', icono: Megaphone },
      { href: '/admin/audit', label: 'Auditoría', icono: ScrollText },
      { href: '/admin/settings', label: 'Ajustes', icono: Settings },
    ],
  },
]

export const ITEMS_ADMIN: readonly ItemNav[] = NAV_ADMIN.flatMap((g) => g.items)

/** Menú que ve cada admin: sin las secciones del dueño si no lo es. */
export function navegacionPara(esDueno: boolean): readonly GrupoNav[] {
  if (esDueno) return NAV_ADMIN
  return NAV_ADMIN.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.soloDueno),
  })).filter((g) => g.items.length > 0)
}

/** Secciones a las que puede saltar cada admin (búsqueda ⌘K). */
export function itemsPara(esDueno: boolean): readonly ItemNav[] {
  return esDueno ? ITEMS_ADMIN : ITEMS_ADMIN.filter((i) => !i.soloDueno)
}

/** ¿El ítem corresponde a la ruta actual? (/admin solo en su raíz). */
export function itemActivo(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Etiqueta de un segmento de /admin/<segmento> para las migas. */
export function etiquetaSeccion(segmento: string): string | null {
  const item = ITEMS_ADMIN.find((i) => i.href === `/admin/${segmento}`)
  return item?.label ?? null
}

/** Texto sin tildes y en minúsculas, para buscar «auditoria» = «Auditoría». */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}
