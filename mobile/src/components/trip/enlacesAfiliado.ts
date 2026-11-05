import { config } from '../../config'

/**
 * Enlaces de afiliado de la app: los de RESPALDO (si el backend no devuelve su
 * `enlace`) y los de eSIM y seguro. Mismo formato y mismas reglas que
 * src/constants/affiliateLinks.ts de la web, donde están las fuentes de cada
 * socio (revisadas el 2026-11-05): sin ID se omite el parámetro y el enlace
 * sigue sirviendo sin comisión; nunca se ponen marcadores falsos.
 */

const af = config.afiliados

/** Programa Trip.com dentro de Travelpayouts (igual que en la web). */
const TP_TRIPCOM = { p: '8626', campaignId: '121' } as const

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/

function fecha(v: string | undefined): string | undefined {
  return v && FECHA_ISO.test(v) ? v : undefined
}

function entre(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, Math.round(n)))
}

/**
 * Código IATA si el texto ya lo trae ('MAD' o 'Madrid (MAD)'). La app no
 * tiene la tabla de ciudades de la web: sin código, Google Flights.
 */
function iata(texto: string): string | null {
  const t = texto.trim()
  const m = /^([A-Z]{3})$/.exec(t) ?? /\(([A-Z]{3})\)/.exec(t)
  return m?.[1] ?? null
}

export interface VuelosRespaldo {
  origen: string
  destino: string
  ida?: string | undefined
  vuelta?: string | undefined
  personas: number
}

/** Búsqueda de vuelos: Skyscanner (o Aviasales con marker) o Google Flights. */
export function enlaceVuelos(v: VuelosRespaldo): string {
  const o = iata(v.origen)
  const d = iata(v.destino)
  const ida = fecha(v.ida)
  const regreso = fecha(v.vuelta)
  const vuelta = ida && regreso && regreso >= ida ? regreso : undefined
  const adultos = entre(v.personas, 1, 9)

  if (o && d && o !== d) {
    if (!af.skyscannerAssociateId && af.tpMarker && ida) {
      const ddmm = (f: string): string => `${f.slice(8, 10)}${f.slice(5, 7)}`
      const ruta = `${o}${ddmm(ida)}${d}${vuelta ? ddmm(vuelta) : ''}${adultos}`
      return `https://www.aviasales.com/search/${ruta}?${new URLSearchParams({ marker: af.tpMarker })}`
    }
    const yymmdd = (f: string): string => f.slice(2).replace(/-/g, '')
    const segmentos = [o.toLowerCase(), d.toLowerCase()]
    if (ida) segmentos.push(yymmdd(ida))
    if (ida && vuelta) segmentos.push(yymmdd(vuelta))
    const params = new URLSearchParams({
      adultsv2: String(adultos),
      cabinclass: 'economy',
      rtn: vuelta ? '1' : '0',
    })
    if (af.skyscannerAssociateId) {
      params.set('associateid', af.skyscannerAssociateId)
    }
    return `https://www.skyscanner.com/transport/flights/${segmentos.join('/')}/?${params}`
  }

  let q = `Flights to ${v.destino.trim()} from ${v.origen.trim()}`
  if (ida) q += ` on ${ida}`
  q += vuelta ? ` through ${vuelta}` : ' one way'
  return `https://www.google.com/travel/flights?${new URLSearchParams({ q, hl: 'es' })}`
}

export interface HotelesRespaldo {
  destino: string
  entrada?: string | undefined
  salida?: string | undefined
  adultos: number
  habitaciones: number
}

/** Hoteles: Trip.com por Travelpayouts si está activo; si no, Booking.com. */
export function enlaceHoteles(h: HotelesRespaldo): string {
  const entrada = fecha(h.entrada)
  const fin = fecha(h.salida)
  const salida = entrada && fin && fin > entrada ? fin : undefined
  const adultos = String(entre(h.adultos, 1, 30))
  const habitaciones = String(entre(h.habitaciones, 1, 30))

  if (af.tpMarker && af.tpTripcom) {
    const trip = new URLSearchParams({
      keyword: h.destino.trim(),
      locale: 'es-ES',
    })
    if (entrada) trip.set('checkin', entrada)
    if (salida) trip.set('checkout', salida)
    trip.set('adult', adultos)
    trip.set('crn', habitaciones)
    const tp = new URLSearchParams({ marker: af.tpMarker })
    if (af.tpTrs) tp.set('trs', af.tpTrs)
    tp.set('p', TP_TRIPCOM.p)
    tp.set('campaign_id', TP_TRIPCOM.campaignId)
    tp.set('u', `https://www.trip.com/hotels/list?${trip}`)
    return `https://tp.media/r?${tp}`
  }

  // Booking.com exige aprobación por escrito para usarlo con IA: sin ella,
  // EXPO_PUBLIC_BOOKING_AID se queda vacío y el enlace va sin comisión.
  const params = new URLSearchParams({ ss: h.destino.trim(), lang: 'es' })
  if (entrada) params.set('checkin', entrada)
  if (salida) params.set('checkout', salida)
  params.set('group_adults', adultos)
  params.set('no_rooms', habitaciones)
  params.set('group_children', '0')
  if (af.bookingAid) params.set('aid', af.bookingAid)
  return `https://www.booking.com/searchresults.html?${params}`
}

/** Carros: DiscoverCars con su ID; si no, Booking.com Cars. */
export function enlaceCarros(destino: string): string {
  if (af.discoverCarsAid) {
    return `https://www.discovercars.com/es?${new URLSearchParams({ a_aid: af.discoverCarsAid })}`
  }
  const params = new URLSearchParams({ ss: destino.trim(), lang: 'es' })
  if (af.bookingAid) params.set('aid', af.bookingAid)
  return `https://www.booking.com/cars/index.html?${params}`
}

/** eSIM de Airalo: solo con su código (sin él no se muestra). */
export function enlaceEsim(): string | null {
  return af.airaloRef
    ? `https://ref.airalo.com/${encodeURIComponent(af.airaloRef)}`
    : null
}

/** Seguro de viaje de IATI: solo con su código (sin él no se muestra). */
export function enlaceSeguro(): string | null {
  return af.iatiRef
    ? `https://www.iatiseguros.com/?${new URLSearchParams({ r: af.iatiRef })}`
    : null
}

/** Aviso de enlaces patrocinados (FTC y LSSI), igual que en la web. */
export const AVISO_PATROCINADO =
  'Enlaces patrocinados: Wayio puede recibir una comisión, sin costo para ti.'
