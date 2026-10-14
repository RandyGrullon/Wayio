import type { Metadata } from 'next'
import type { ReactNode } from 'react'

/** La página es cliente: el título y el noindex de la sala van aquí. */
export const metadata: Metadata = {
  title: 'Sala del grupo',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default function GroupLayout({ children }: { children: ReactNode }) {
  return children
}
