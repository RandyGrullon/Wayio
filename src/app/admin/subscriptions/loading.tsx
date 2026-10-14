import { CargandoLista } from '@/components/admin/Cargando'

export default function Loading() {
  return (
    <CargandoLista
      stats={4}
      columnas={6}
      etiqueta="Cargando las suscripciones…"
    />
  )
}
