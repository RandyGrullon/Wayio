import { CargandoLista } from '@/components/admin/Cargando'

export default function Loading() {
  return (
    <CargandoLista
      columnas={5}
      filtros={false}
      etiqueta="Cargando las funciones…"
    />
  )
}
