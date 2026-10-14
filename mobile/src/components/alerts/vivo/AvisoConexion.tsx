import { Check, CloudOff } from '../../ui/iconos'
import { Button } from '../../ui/Button'
import { formatFechaHora } from '../../ui/formato'
import { Aviso, Sello } from '../piezas'

interface Props {
  isOnline: boolean
  guardadoEn: Date | null
  pendingCount: number
  syncing: boolean
  onSincronizar: () => void
}

/**
 * Un solo aviso de conexión (§6.6): sello «Disponible sin conexión» con la
 * hora del guardado, o callout de aviso si no hay red.
 */
export function AvisoConexion({
  isOnline,
  guardadoEn,
  pendingCount,
  syncing,
  onSincronizar,
}: Props): React.ReactElement | null {
  const cuando = guardadoEn ? formatFechaHora(guardadoEn) : ''

  if (!isOnline) {
    return (
      <Aviso tono="warning" icon={CloudOff} titulo="Sin conexión" vivo>
        {cuando
          ? `Usas tu copia guardada del ${cuando}. Tus llegadas se sincronizarán al volver la conexión.`
          : 'Tus llegadas se guardan en el teléfono y se sincronizarán al volver la conexión.'}
      </Aviso>
    )
  }

  if (pendingCount > 0) {
    return (
      <Aviso
        tono="info"
        icon={Check}
        accion={
          <Button
            title="Sincronizar ahora"
            variant="link"
            size="sm"
            loading={syncing}
            loadingText="Sincronizando…"
            onPress={onSincronizar}
          />
        }
      >
        {pendingCount === 1
          ? '1 cambio guardado en el teléfono, pendiente de subir.'
          : `${pendingCount} cambios guardados en el teléfono, pendientes de subir.`}
      </Aviso>
    )
  }

  if (!guardadoEn) return null
  return (
    <Sello icon={Check} tono="mar">
      {`Disponible sin conexión · guardado ${cuando}`}
    </Sello>
  )
}
