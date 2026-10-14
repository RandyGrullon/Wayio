import { ArrowLeft } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

export default function AdminNotFound() {
  return (
    <Card className="mx-auto mt-4 max-w-xl">
      <EmptyState
        illustration="sello"
        headingLevel="h1"
        title="No encontramos este registro"
        description="Puede que se haya eliminado o que el enlace esté incompleto."
        action={
          <ButtonLink href="/admin" variant="tinta" icon={<ArrowLeft />}>
            Volver al panel
          </ButtonLink>
        }
        className="py-6"
      />
    </Card>
  )
}
