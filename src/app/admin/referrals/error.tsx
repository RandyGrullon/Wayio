'use client'

import { ErrorSeccion } from '@/components/admin/ErrorSeccion'

export default function ReferidosError(props: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return <ErrorSeccion {...props} seccion="los referidos" />
}
