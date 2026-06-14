import type { ReactNode } from 'react'
import { requireAdmin } from '@/lib/admin/auth'
import { Sidebar } from '@/components/admin/Sidebar'

// El panel siempre se renderiza en runtime (usa auth + service role)
export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  const ctx = await requireAdmin()

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar email={ctx.email} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl p-6">{children}</div>
      </main>
    </div>
  )
}
