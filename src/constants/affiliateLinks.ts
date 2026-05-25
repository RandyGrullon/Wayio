export const buildBookingLink = (hotel: string, checkIn: string): string =>
  `https://www.booking.com/searchresults.html?aid=TU_ID&ss=${encodeURIComponent(hotel)}&checkin=${checkIn}`

export const buildViatorLink = (actividad: string, ciudad: string): string =>
  `https://www.viator.com/searchResults/all?text=${encodeURIComponent(actividad)}&city=${encodeURIComponent(ciudad)}&pid=TU_PID`

export const buildSkyscannerLink = (
  origen: string,
  destino: string,
  fecha: string
): string =>
  `https://www.skyscanner.com/transport/flights/${encodeURIComponent(origen)}/${encodeURIComponent(destino)}/${fecha}/?associateId=TU_ID`

export const buildAiraloLink = (pais: string): string =>
  `https://ref.airalo.com/TU_CODIGO?country=${encodeURIComponent(pais)}`

export const buildNavigationLinks = (
  lat: number,
  lng: number
): {
  google: string
  waze: string
  apple: string
  citymapper: string
} => ({
  google: `https://maps.google.com/?daddr=${lat},${lng}`,
  waze: `waze://?ll=${lat},${lng}&navigate=yes`,
  apple: `maps://?daddr=${lat},${lng}`,
  citymapper: `citymapper://directions?endcoord=${lat},${lng}`,
})
