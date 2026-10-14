import { CargandoLista } from '@/components/admin/Cargando'

export default function Loading() {
  return (
    <CargandoLista
      stats={3}
      columnas={3}
      filtros={false}
      etiqueta="Cargando los grupos…"
    />
  )
}
