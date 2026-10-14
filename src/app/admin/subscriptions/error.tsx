'use client'

import { ErrorSeccion } from '@/components/admin/ErrorSeccion'

export default function SuscripcionesError(props: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return <ErrorSeccion {...props} seccion="las suscripciones" />
}
