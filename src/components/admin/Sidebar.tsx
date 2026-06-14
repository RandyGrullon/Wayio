'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/users', label: 'Usuarios', icon: '👤' },
  { href: '/admin/trips', label: 'Viajes', icon: '🗺️' },
  { href: '/admin/subscriptions', label: 'Suscripciones', icon: '💳' },
  { href: '/admin/groups', label: 'Grupos', icon: '💬' },
  { href: '/admin/referrals', label: 'Referidos', icon: '🎁' },
  { href: '/admin/ai', label: 'Uso de IA', icon: '🤖' },
  { href: '/admin/flags', label: 'Feature Flags', icon: '🚩' },
  { href: '/admin/announcements', label: 'Anuncios', icon: '📣' },
  { href: '/admin/audit', label: 'Auditoría', icon: '📜' },
  { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
] as const

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname()
  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-4">
        <p className="text-lg font-bold text-gray-900">
          Wayio <span className="text-blue-600">Admin</span>
        </p>
        <p className="truncate text-xs text-gray-400">{email}</p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive(item.href)
                ? 'bg-blue-50 font-medium text-blue-700'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-gray-100 p-2">
        <Link
          href="/"
          className="block rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
        >
          ← Volver a la app
        </Link>
      </div>
    </aside>
  )
}
