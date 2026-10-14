'use client'

import { ErrorSeccion } from '@/components/admin/ErrorSeccion'

export default function UsuarioError(props: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return <ErrorSeccion {...props} seccion="la ficha del usuario" />
}
