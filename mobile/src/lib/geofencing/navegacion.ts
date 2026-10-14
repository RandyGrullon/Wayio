import { Linking, Platform } from 'react-native'

/**
 * Abre la navegación hacia un punto en la app de mapas del teléfono (Apple
 * Maps en iOS, Google Maps en Android). No depende del módulo nativo de
 * Mapbox: funciona también donde el mapa en vivo no está disponible.
 */
export function abrirComoLlegar(
  lat: number,
  lng: number,
  nombre: string
): void {
  const destino = `${lat},${lng}`
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${destino}&q=${encodeURIComponent(nombre)}`
      : `https://www.google.com/maps/dir/?api=1&destination=${destino}`
  void Linking.openURL(url).catch(() => undefined)
}
