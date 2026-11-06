/**
 * Foto del lugar para «Desde un video o una foto» (RecreateTripScreen), como
 * la web (src/components/trip/RecreateTrip.tsx): JPG, PNG o WebP comprimida en
 * el teléfono y enviada en base64 a POST /api/analyze-video (`analyzeImage`,
 * lib/api/backend.ts), cuerpo `{ imageBase64, mediaType }`.
 *
 * La web reduce la foto con un canvas (1600 px, JPEG) hasta ~2,8 MB de
 * base64. Aquí no hay redimensionado (no está expo-image-manipulator): el
 * selector la recomprime a JPEG con `quality` y se rechaza lo que no quepa en
 * `MAX_BASE64_FOTO` (el servidor acepta 5 MB de base64, pero Vercel corta el
 * cuerpo en ~4,5 MB). El tipo se lee de los primeros bytes, igual que el
 * servidor (`prepararImagen`), y no de la extensión.
 *
 * La galería no pide permiso (el selector del sistema no lo necesita); la
 * cámara sí, y sin él se explica cómo darlo.
 */
import * as ImagePicker from 'expo-image-picker'

export type TipoFoto = 'image/jpeg' | 'image/png' | 'image/webp'
export type OrigenFoto = 'galeria' | 'camara'

export interface FotoLista {
  /** Base64 sin prefijo `data:` ni saltos de línea. */
  base64: string
  mediaType: TipoFoto
  /** URI local para la miniatura. */
  uri: string
  /** Nombre del archivo, si el sistema lo da (la cámara no). */
  nombre: string | null
}

export type ResultadoFoto =
  | { tipo: 'foto'; foto: FotoLista }
  | { tipo: 'cancelada' }
  | { tipo: 'error'; mensaje: string }

/** Base64 máximo que se envía (5 MB en el servidor; ~4,5 MB de cuerpo en Vercel). */
export const MAX_BASE64_FOTO = 4_400_000

/** Compresión JPEG del selector: de sobra para que la IA reconozca el lugar. */
const CALIDAD_FOTO = 0.5

export const MENSAJE_FOTO_ILEGIBLE =
  'No pudimos leer esa foto. Prueba con otra en JPG, PNG o WebP.'
export const MENSAJE_FOTO_PESADA =
  'La foto pesa demasiado (máximo 5 MB). Prueba con una más pequeña.'

const OPCIONES: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: false,
  quality: CALIDAD_FOTO,
  base64: true,
  exif: false,
  // iOS: entrega JPEG en vez de HEIC (el servidor solo acepta JPG, PNG o WebP).
  preferredAssetRepresentationMode:
    ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
}

/** Tipo real por los primeros bytes (en base64); null si no es JPG/PNG/WebP. */
function tipoDeBase64(b64: string): TipoFoto | null {
  if (b64.startsWith('/9j/')) return 'image/jpeg'
  if (b64.startsWith('iVBORw0KGgo')) return 'image/png'
  // «RIFF» + 4 bytes de tamaño + «WEBP» (los bytes 9-11, «EBP», son «RUJQ»).
  if (b64.startsWith('UklGR') && b64.slice(12, 16) === 'RUJQ') {
    return 'image/webp'
  }
  return null
}

/** Valida y limpia lo que devolvió el selector. */
export function prepararFoto(
  asset: ImagePicker.ImagePickerAsset
): ResultadoFoto {
  let b64 = (asset.base64 ?? '').trim()
  const prefijo = /^data:image\/[a-z0-9+.-]+;base64,/i.exec(b64)
  if (prefijo) b64 = b64.slice(prefijo[0].length)
  b64 = b64.replace(/\s+/g, '')
  const tipo = b64.length >= 16 ? tipoDeBase64(b64) : null
  if (!tipo) return { tipo: 'error', mensaje: MENSAJE_FOTO_ILEGIBLE }
  if (b64.length > MAX_BASE64_FOTO) {
    return { tipo: 'error', mensaje: MENSAJE_FOTO_PESADA }
  }
  return {
    tipo: 'foto',
    foto: {
      base64: b64,
      mediaType: tipo,
      uri: asset.uri,
      nombre: asset.fileName?.trim() || null,
    },
  }
}

/** Abre la galería o la cámara y devuelve la foto lista para enviar. */
export async function elegirFoto(origen: OrigenFoto): Promise<ResultadoFoto> {
  let r: ImagePicker.ImagePickerResult
  try {
    if (origen === 'camara') {
      const permiso = await ImagePicker.requestCameraPermissionsAsync()
      if (!permiso.granted) {
        return {
          tipo: 'error',
          mensaje:
            'Para tomar la foto, permite que Wayio use la cámara en los ajustes del teléfono. También puedes elegir una de la galería.',
        }
      }
      r = await ImagePicker.launchCameraAsync(OPCIONES)
    } else {
      r = await ImagePicker.launchImageLibraryAsync(OPCIONES)
    }
  } catch {
    return {
      tipo: 'error',
      mensaje:
        origen === 'camara'
          ? 'No pudimos abrir la cámara. Prueba a elegir una foto de la galería.'
          : 'No pudimos abrir tus fotos. Inténtalo de nuevo.',
    }
  }
  if (r.canceled) return { tipo: 'cancelada' }
  const asset = r.assets[0]
  if (!asset) return { tipo: 'cancelada' }
  return prepararFoto(asset)
}
