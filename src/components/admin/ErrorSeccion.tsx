'use client'

import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

/**
 * Error de una sección del panel (error.tsx): distinto del vacío (§5.10),
 * con «Reintentar» (vuelve a pedir los datos) y el código para los logs.
 * El shell (sidebar y topbar) sigue en pie: el layout no está dentro.
 */
export function ErrorSeccion({
  error,
  unstable_retry,
  seccion,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
  /** «los usuarios», «el panel»… */
  seccion: string
}) {
  return (
    <Card className="mx-auto mt-4 max-w-xl">
      <EmptyState
        illustration="error"
        headingLevel="h1"
        title={`No pudimos cargar ${seccion}`}
        description="Puede ser un corte momentáneo con la base de datos. Inténtalo otra vez en unos segundos."
        action={
          <Button
            variant="tinta"
            icon={<RotateCcw />}
            onClick={() => unstable_retry()}
          >
            Reintentar
          </Button>
        }
        className="py-6"
      />
      {error.digest ? (
        <p className="pb-2 text-center font-mono text-[12px] text-fg-subtle">
          Código: {error.digest}
        </p>
      ) : null}
    </Card>
  )
}
