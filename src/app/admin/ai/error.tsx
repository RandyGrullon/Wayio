'use client'

import { ErrorSeccion } from '@/components/admin/ErrorSeccion'

export default function IaError(props: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return <ErrorSeccion {...props} seccion="el uso de IA" />
}
