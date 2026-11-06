import { config } from '../../config'
import type { ProveedorAfiliado } from '../../lib/analytics/types'
import type { PlanningActivity } from '../../types/planning'

/**
 * Enlaces de afiliado de la app: los de RESPALDO (si el backend no devuelve su
 * `enlace`), «Reservar» / «Ver hotel» de cada actividad y los de eSIM y
 * seguro. Mismo formato y mismas reglas que src/constants/affiliateLinks.ts de
 * la web, donde están las fuentes de cada socio (revisadas el 2026-11-05): sin
 * ID se omite el parámetro y el enlace sigue sirviendo sin comisión; nunca se
 * ponen marcadores falsos. Se construyen AL RENDERIZAR (no se guardan en el
 * viaje), así los viajes antiguos se benefician en cuanto haya IDs.
 */

const af = config.afiliados

/** Socio al que apunta un enlace (para la analítica de clics). */
export type SocioAfiliado =
  | 'booking'
  | 'booking_cars'
  | 'tripcom'
  | 'viator'
  | 'civitatis'
  | 'getyourguide'
  | 'discovercars'
  | 'airalo'
  | 'iati'

export interface EnlaceAfiliado<P extends SocioAfiliado = SocioAfiliado> {
  url: string
  proveedor: P
}

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

/** Minúsculas, sin tildes ni signos, espacios simples (como la web). */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9,]+/g, ' ')
    .replace(/\s*,\s*/g, ',')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 'Santo Domingo, República Dominicana' → 'santo-domingo' (Civitatis). */
function slugCiudad(ciudad: string): string {
  return (normalizar(ciudad).split(',')[0] ?? '').trim().replace(/\s+/g, '-')
}

/** «nombre ciudad» sin huecos (texto de búsqueda de los socios). */
function textoBusqueda(nombre: string, ciudad: string): string {
  return [nombre, ciudad]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ')
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
  /** Sin adultos no se mandan ni personas ni habitaciones (como la web). */
  adultos?: number | undefined
  habitaciones?: number | undefined
}

/**
 * Hoteles para la UI (describeHotelsLink de la web): Trip.com por
 * Travelpayouts si está activo; si no, Booking.com (con su aid si lo hay).
 */
export function describirHoteles(
  h: HotelesRespaldo
): EnlaceAfiliado<'tripcom' | 'booking'> {
  const entrada = fecha(h.entrada)
  const fin = fecha(h.salida)
  const salida = entrada && fin && fin > entrada ? fin : undefined
  const adultos =
    h.adultos !== undefined ? String(entre(h.adultos, 1, 30)) : undefined
  const habitaciones =
    adultos !== undefined
      ? String(entre(h.habitaciones ?? 1, 1, 30))
      : undefined

  if (af.tpMarker && af.tpTripcom) {
    const trip = new URLSearchParams({
      keyword: h.destino.trim(),
      locale: 'es-ES',
    })
    if (entrada) trip.set('checkin', entrada)
    if (salida) trip.set('checkout', salida)
    if (adultos && habitaciones) {
      trip.set('adult', adultos)
      trip.set('crn', habitaciones)
    }
    const tp = new URLSearchParams({ marker: af.tpMarker })
    if (af.tpTrs) tp.set('trs', af.tpTrs)
    tp.set('p', TP_TRIPCOM.p)
    tp.set('campaign_id', TP_TRIPCOM.campaignId)
    tp.set('u', `https://www.trip.com/hotels/list?${trip}`)
    return { url: `https://tp.media/r?${tp}`, proveedor: 'tripcom' }
  }

  // Booking.com exige aprobación por escrito para usarlo con IA: sin ella,
  // EXPO_PUBLIC_BOOKING_AID se queda vacío y el enlace va sin comisión.
  const params = new URLSearchParams({ ss: h.destino.trim(), lang: 'es' })
  if (entrada) params.set('checkin', entrada)
  if (salida) params.set('checkout', salida)
  if (adultos && habitaciones) {
    params.set('group_adults', adultos)
    params.set('no_rooms', habitaciones)
    params.set('group_children', '0')
  }
  if (af.bookingAid) params.set('aid', af.bookingAid)
  return {
    url: `https://www.booking.com/searchresults.html?${params}`,
    proveedor: 'booking',
  }
}

/** Hoteles: Trip.com por Travelpayouts si está activo; si no, Booking.com. */
export function enlaceHoteles(h: HotelesRespaldo): string {
  return describirHoteles(h).url
}

/** Carros para la UI: DiscoverCars con su ID; si no, Booking.com Cars. */
export function describirCarros(
  destino: string
): EnlaceAfiliado<'discovercars' | 'booking_cars'> {
  if (af.discoverCarsAid) {
    return {
      url: `https://www.discovercars.com/es?${new URLSearchParams({ a_aid: af.discoverCarsAid })}`,
      proveedor: 'discovercars',
    }
  }
  const params = new URLSearchParams({ ss: destino.trim(), lang: 'es' })
  if (af.bookingAid) params.set('aid', af.bookingAid)
  return {
    url: `https://www.booking.com/cars/index.html?${params}`,
    proveedor: 'booking_cars',
  }
}

/** Carros: DiscoverCars con su ID; si no, Booking.com Cars. */
export function enlaceCarros(destino: string): string {
  return describirCarros(destino).url
}

/** Actividad en Viator (con pid y mcid si los hay). */
export function enlaceViator(nombre: string, ciudad = ''): string {
  const params = new URLSearchParams({ text: textoBusqueda(nombre, ciudad) })
  if (af.viatorPid) params.set('pid', af.viatorPid)
  if (af.viatorMcid) params.set('mcid', af.viatorMcid)
  if (af.viatorPid || af.viatorMcid) {
    params.set('medium', 'link')
    params.set('campaign', 'wayio')
  }
  return `https://www.viator.com/searchResults/all?${params}`
}

/**
 * Actividad en Civitatis. Con nombre: su buscador. Solo con ciudad: la página
 * del destino, porque si la búsqueda coincide con un destino Civitatis
 * redirige y pierde el `aid`.
 */
export function enlaceCivitatis(nombre: string, ciudad = ''): string {
  if (nombre.trim()) {
    const params = new URLSearchParams({ q: textoBusqueda(nombre, ciudad) })
    if (af.civitatisAid) params.set('aid', af.civitatisAid)
    return `https://www.civitatis.com/es/buscar?${params}`
  }
  const slug = slugCiudad(ciudad)
  const base = `https://www.civitatis.com/es/${slug ? `${slug}/` : ''}`
  return af.civitatisAid
    ? `${base}?${new URLSearchParams({ aid: af.civitatisAid })}`
    : base
}

/** Actividad en GetYourGuide (su buscador, con el Partner ID si lo hay). */
export function enlaceGetYourGuide(nombre: string, ciudad = ''): string {
  const params = new URLSearchParams({ q: textoBusqueda(nombre, ciudad) })
  if (af.gygPartnerId) {
    params.set('partner_id', af.gygPartnerId)
    params.set('cmp', 'wayio')
  }
  return `https://www.getyourguide.com/s/?${params}`
}

/**
 * «Reservar» de una actividad (describeActivityLink de la web): el primer
 * socio configurado en este orden (Viator, Civitatis, GetYourGuide). Si no
 * hay ninguno, Viator sin comisión.
 */
export function describirActividad(
  nombre: string,
  ciudad = ''
): EnlaceAfiliado<'viator' | 'civitatis' | 'getyourguide'> {
  if (af.viatorPid && af.viatorMcid) {
    return { url: enlaceViator(nombre, ciudad), proveedor: 'viator' }
  }
  if (af.civitatisAid) {
    return { url: enlaceCivitatis(nombre, ciudad), proveedor: 'civitatis' }
  }
  if (af.gygPartnerId) {
    return {
      url: enlaceGetYourGuide(nombre, ciudad),
      proveedor: 'getyourguide',
    }
  }
  return { url: enlaceViator(nombre, ciudad), proveedor: 'viator' }
}

/** «Check-in en <hotel>»: el alojamiento ya viene en el plan. */
export function esCheckIn(nombre: string): boolean {
  return /\bcheck-?in\b/i.test(nombre)
}

export interface ReservaActividad {
  url: string
  proveedor: SocioAfiliado
  etiqueta: 'Ver hotel' | 'Reservar'
  categoria: 'hotel' | 'actividad'
}

/**
 * Botón de reserva de una actividad, con las mismas reglas que ActivityItem de
 * la web: nada si ya está pagada o se perdió; «Ver hotel» en el check-in;
 * «Reservar» si requiere reserva y no es un traslado. `ciudad` es la del día
 * (o el destino del viaje).
 */
export function reservaDeActividad(
  a: Pick<
    PlanningActivity,
    'nombre' | 'tipo' | 'reservaRequerida' | 'reservaPagada' | 'estado'
  > &
    Partial<Pick<PlanningActivity, 'esPerdida'>>,
  ciudad: string
): ReservaActividad | null {
  const perdida = a.estado === 'perdida' || Boolean(a.esPerdida)
  if (a.reservaPagada || perdida) return null
  if (esCheckIn(a.nombre)) {
    const hotel = a.nombre.replace(/^\s*check-?in\s*(en|:)?\s*/i, '')
    return {
      ...describirHoteles({ destino: `${hotel} ${ciudad}`.trim() }),
      etiqueta: 'Ver hotel',
      categoria: 'hotel',
    }
  }
  if (a.reservaRequerida && a.tipo !== 'traslado') {
    return {
      ...describirActividad(a.nombre, ciudad),
      etiqueta: 'Reservar',
      categoria: 'actividad',
    }
  }
  return null
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

/**
 * Proveedor de un enlace (analítica) a partir del dominio, para los que no
 * construye la app (el `enlace` y los resultados del backend). Igual que
 * `proveedorDe` del RealSearch web, con el resto de socios del catálogo.
 */
export function proveedorDe(url: string): ProveedorAfiliado {
  const host = /^https?:\/\/(?:[^@/?#]+@)?([^:/?#]+)/i.exec(url)?.[1]
  if (!host) return 'otro'
  const h = host.toLowerCase()
  const es = (dominio: string): boolean =>
    h === dominio || h.endsWith(`.${dominio}`)
  if (es('booking.com')) {
    return url.includes('/cars') ? 'booking_cars' : 'booking'
  }
  if (es('trip.com')) return 'tripcom'
  // tp.media es el redirector de Travelpayouts: p=8626 es el programa Trip.com.
  if (es('tp.media')) {
    return /[?&]p=8626(?:&|$)/.test(url) ? 'tripcom' : 'otro'
  }
  if (es('viator.com')) return 'viator'
  if (es('civitatis.com')) return 'civitatis'
  if (es('getyourguide.com')) return 'getyourguide'
  if (es('discovercars.com')) return 'discovercars'
  if (es('iatiseguros.com')) return 'iati'
  if (es('airalo.com')) return 'airalo'
  if (h.includes('skyscanner')) return 'skyscanner'
  if (h.includes('aviasales')) return 'aviasales'
  if (h.includes('google')) return 'google_flights'
  return 'otro'
}

/** Aviso de enlaces patrocinados (FTC y LSSI), igual que en la web. */
export const AVISO_PATROCINADO =
  'Enlaces patrocinados: Wayio puede recibir una comisión, sin costo para ti.'
