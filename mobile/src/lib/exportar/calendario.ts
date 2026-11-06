/**
 * «Añadir al calendario» (web: VistaViaje.tsx alCalendario → downloadIcs):
 * escribe el .ics del itinerario en la caché de la app y abre la hoja de
 * compartir del sistema para pasarlo a Calendario, Google Calendar, Outlook…
 */
import {
  buildIcs,
  nombreArchivoIcs,
  tieneEventosIcs,
  type ViajeIcs,
} from '../utils/ics'
import { ErrorExportar, cargarArchivos, cargarSharing } from './nativos'

/** Comparte el .ics del viaje. Lanza ErrorExportar con un texto ya listo. */
export async function compartirCalendario(trip: ViajeIcs): Promise<void> {
  if (!tieneEventosIcs(trip)) {
    throw new ErrorExportar(
      'Este viaje aún no tiene actividades que añadir al calendario.'
    )
  }
  const Sharing = await cargarSharing()
  if (!Sharing) {
    throw new ErrorExportar(
      'Tu dispositivo no deja compartir archivos desde la app.'
    )
  }
  const { File, Paths } = await cargarArchivos()

  let uri: string
  try {
    const archivo = new File(Paths.cache, nombreArchivoIcs(trip.destino))
    archivo.create({ overwrite: true })
    archivo.write(buildIcs(trip))
    uri = archivo.uri
  } catch {
    throw new ErrorExportar(
      'No pudimos preparar el calendario. Inténtalo de nuevo.'
    )
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'text/calendar',
    UTI: 'com.apple.ical.ics',
    dialogTitle: 'Añadir al calendario',
  })
}
