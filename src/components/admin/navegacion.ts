import type { LucideIcon } from 'lucide-react'
import {
  Bot,
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
