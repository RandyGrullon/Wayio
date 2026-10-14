'use client'

import { ErrorSeccion } from '@/components/admin/ErrorSeccion'

export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <ErrorSeccion
      error={error}
      unstable_retry={unstable_retry}
      seccion="esta sección"
    />
  )
}
