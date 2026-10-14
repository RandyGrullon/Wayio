import { CargandoLista } from '@/components/admin/Cargando'

export default function Loading() {
  return (
    <CargandoLista stats={3} columnas={5} etiqueta="Cargando los referidos…" />
  )
}
