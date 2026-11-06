/**
 * Carga perezosa de los módulos nativos de exportar (expo-print,
 * expo-sharing, expo-file-system). Se importan al usarlos, no al abrir la
 * pantalla: un dev build anterior a estas dependencias no trae su parte
 * nativa y un import estático rompería el viaje entero. Así solo falla
 * exportar, con un mensaje tranquilo.
 */
// Solo tipos: no cargan el módulo nativo.
import type * as ArchivosTipos from 'expo-file-system'
import type * as PrintTipos from 'expo-print'
import type * as SharingTipos from 'expo-sharing'

/** Error con un texto ya listo para mostrar al viajero. */
export class ErrorExportar extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorExportar'
  }
}

export const MENSAJE_SIN_MODULO =
  'Esta versión de la app aún no puede exportar. Actualízala para usarlo.'

export type ModuloPrint = typeof PrintTipos
export type ModuloSharing = typeof SharingTipos
export type ModuloArchivos = typeof ArchivosTipos

export async function cargarPrint(): Promise<ModuloPrint> {
  try {
    return await import('expo-print')
  } catch {
    throw new ErrorExportar(MENSAJE_SIN_MODULO)
  }
}

export async function cargarArchivos(): Promise<ModuloArchivos> {
  try {
    return await import('expo-file-system')
  } catch {
    throw new ErrorExportar(MENSAJE_SIN_MODULO)
  }
}

/** expo-sharing si existe y el sistema deja compartir archivos; si no, null. */
export async function cargarSharing(): Promise<ModuloSharing | null> {
  try {
    const Sharing = await import('expo-sharing')
    return (await Sharing.isAvailableAsync()) ? Sharing : null
  } catch {
    return null
  }
}
