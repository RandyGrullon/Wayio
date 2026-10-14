/**
 * Enlaces de afiliado y de navegación.
 *
 * Los IDs de afiliado vienen de variables públicas de entorno. Si falta alguno
 * se omite su parámetro (el enlace sigue funcionando, solo que sin comisión):
 * nunca se generan marcadores tipo TU_ID.
 *
 * Los enlaces se construyen AL RENDERIZAR (no se guardan en el viaje), así los
 * viajes antiguos se benefician en cuanto se configuren los IDs.
 */

// ---------------------------------------------------------------------------
// IDs de afiliado (NEXT_PUBLIC_*: se leen con punto para que Next los incruste)
// ---------------------------------------------------------------------------

function idAfiliado(valor: string | undefined): string | undefined {
  const v = valor?.trim()
  if (!v) return undefined
  // Marcadores de ejemplo que nunca deben llegar a un enlace real.
  if (/^(?:tu[_-]|your[_-]|xxx|changeme|todo\b|<)/i.test(v)) return undefined
  return v
}

const bookingAid = (): string | undefined =>
  idAfiliado(process.env.NEXT_PUBLIC_BOOKING_AID)
const viatorPid = (): string | undefined =>
  idAfiliado(process.env.NEXT_PUBLIC_VIATOR_PID)
const viatorMcid = (): string | undefined =>
  idAfiliado(process.env.NEXT_PUBLIC_VIATOR_MCID)
const skyscannerAssociateId = (): string | undefined =>
  idAfiliado(process.env.NEXT_PUBLIC_SKYSCANNER_ASSOCIATE_ID)
const travelpayoutsMarker = (): string | undefined =>
  idAfiliado(process.env.NEXT_PUBLIC_TP_MARKER)
const airaloRef = (): string | undefined =>
  idAfiliado(process.env.NEXT_PUBLIC_AIRALO_REF)

/** Qué programas de afiliado tienen su ID configurado. */
export function afiliadosConfigurados(): {
  booking: boolean
  viator: boolean
  skyscanner: boolean
  travelpayouts: boolean
  airalo: boolean
} {
  return {
    booking: Boolean(bookingAid()),
    viator: Boolean(viatorPid() && viatorMcid()),
    skyscanner: Boolean(skyscannerAssociateId()),
    travelpayouts: Boolean(travelpayoutsMarker()),
    airalo: Boolean(airaloRef()),
  }
}

/** `rel` recomendado para los enlaces de afiliado. */
export const AFFILIATE_REL = 'noopener noreferrer sponsored'

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/

/** Fecha 'YYYY-MM-DD' válida (y real: nada de 2026-02-31). */
function fechaValida(v: string | undefined): v is string {
  if (!v) return false
  const m = FECHA_ISO.exec(v)
  if (!m) return false
  const d = new Date(`${v}T00:00:00Z`)
  return (
    Number.isFinite(d.getTime()) &&
    d.getUTCFullYear() === Number(m[1]) &&
    d.getUTCMonth() + 1 === Number(m[2]) &&
    d.getUTCDate() === Number(m[3])
  )
}

/** '2026-03-10' → '260310' (formato de Skyscanner). */
function aYYMMDD(fecha: string): string {
  return fecha.slice(2).replace(/-/g, '')
}

/** '2026-03-10' → '1003' (formato de Aviasales). */
function aDDMM(fecha: string): string {
  return `${fecha.slice(8, 10)}${fecha.slice(5, 7)}`
}

function entre(n: number | undefined, min: number, max: number, def: number) {
  if (n === undefined || !Number.isFinite(n)) return def
  return Math.min(max, Math.max(min, Math.round(n)))
}

/** Minúsculas, sin tildes ni signos, espacios simples. */
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

// ---------------------------------------------------------------------------
// Códigos IATA de ciudades frecuentes (aeropuerto principal)
// ---------------------------------------------------------------------------

/**
 * [código, ...nombres normalizados]. Se usa el aeropuerto principal de cada
 * ciudad (y de algunos países como destino). Si una ciudad no está, el enlace
 * de vuelos cae a Google Flights con texto libre.
 */
const AEROPUERTOS: ReadonlyArray<readonly [string, ...string[]]> = [
  // República Dominicana y Caribe
  ['SDQ', 'santo domingo', 'republica dominicana', 'rd'],
  ['PUJ', 'punta cana', 'bavaro', 'cap cana'],
  [
    'STI',
    'santiago de los caballeros',
    'santiago,republica dominicana',
    'santiago rd',
    'santiago,rd',
  ],
  ['POP', 'puerto plata', 'sosua', 'cabarete'],
  ['LRM', 'la romana', 'bayahibe'],
  ['AZS', 'samana', 'las terrenas'],
  ['SJU', 'san juan', 'san juan de puerto rico', 'puerto rico'],
  ['HAV', 'la habana', 'habana', 'havana', 'cuba'],
  ['VRA', 'varadero'],
  ['MBJ', 'montego bay', 'jamaica'],
  ['KIN', 'kingston'],
  ['NAS', 'nassau', 'bahamas'],
  ['AUA', 'aruba', 'oranjestad'],
  ['CUR', 'curazao', 'curacao', 'willemstad'],
  ['BON', 'bonaire'],
  ['SXM', 'sint maarten', 'st maarten', 'san martin', 'saint martin'],
  ['BGI', 'barbados', 'bridgetown'],
  ['POS', 'puerto espana', 'port of spain', 'trinidad y tobago'],
  ['PAP', 'puerto principe', 'port au prince', 'haiti'],
  ['UVF', 'santa lucia', 'st lucia', 'saint lucia'],
  ['ANU', 'antigua', 'antigua y barbuda'],
  ['GCM', 'gran caiman', 'islas caiman', 'george town'],
  ['PTP', 'guadalupe', 'pointe a pitre'],
  ['FDF', 'martinica', 'fort de france'],
  ['STT', 'st thomas', 'saint thomas', 'islas virgenes'],
  ['PLS', 'turcas y caicos', 'turks and caicos', 'providenciales'],
  // México y Centroamérica
  ['MEX', 'ciudad de mexico', 'cdmx', 'mexico df', 'mexico city', 'mexico'],
  ['CUN', 'cancun', 'playa del carmen', 'riviera maya'],
  ['TQO', 'tulum'],
  ['CZM', 'cozumel'],
  ['GDL', 'guadalajara'],
  ['MTY', 'monterrey'],
  ['PVR', 'puerto vallarta'],
  ['SJD', 'los cabos', 'cabo san lucas', 'san jose del cabo'],
  ['OAX', 'oaxaca'],
  ['MID', 'merida'],
  // 'La Paz, México' (Baja California Sur); 'La Paz' a secas es Bolivia (LPB).
  ['LAP', 'la paz,mexico', 'la paz,baja california sur'],
  // 'Antigua, Guatemala' debe ganar a 'antigua' (Antigua y Barbuda, ANU).
  [
    'GUA',
    'ciudad de guatemala',
    'guatemala',
    'antigua guatemala',
    'antigua,guatemala',
  ],
  ['SAL', 'san salvador', 'el salvador'],
  ['SAP', 'san pedro sula', 'honduras'],
  ['RTB', 'roatan'],
  ['MGA', 'managua', 'nicaragua'],
  ['SJO', 'san jose de costa rica', 'san jose,costa rica', 'costa rica'],
  ['LIR', 'liberia', 'guanacaste'],
  ['PTY', 'panama', 'ciudad de panama', 'panama city'],
  ['BZE', 'belice', 'belize'],
  // Sudamérica
  ['BOG', 'bogota', 'colombia'],
  ['MDE', 'medellin'],
  ['CTG', 'cartagena', 'cartagena de indias'],
  ['CLO', 'cali'],
  ['BAQ', 'barranquilla'],
  ['SMR', 'santa marta'],
  ['ADZ', 'san andres'],
  ['CCS', 'caracas', 'venezuela'],
  ['PMV', 'isla margarita', 'margarita', 'porlamar'],
  ['UIO', 'quito', 'ecuador'],
  ['GYE', 'guayaquil'],
  ['GPS', 'galapagos', 'islas galapagos'],
  ['LIM', 'lima', 'peru'],
  ['CUZ', 'cusco', 'cuzco', 'machu picchu'],
  ['AQP', 'arequipa'],
  ['LPB', 'la paz'],
  ['VVI', 'santa cruz de la sierra', 'bolivia'],
  // "Santiago" a secas es ambiguo (Chile, RD, España): cae a texto libre.
  ['SCL', 'santiago de chile', 'santiago,chile', 'chile'],
  ['EZE', 'buenos aires', 'argentina'],
  ['MDZ', 'mendoza'],
  ['BRC', 'bariloche', 'san carlos de bariloche'],
  ['USH', 'ushuaia'],
  ['COR', 'cordoba,argentina'],
  ['IGR', 'puerto iguazu', 'cataratas del iguazu', 'iguazu'],
  ['MVD', 'montevideo', 'uruguay'],
  ['PDP', 'punta del este'],
  ['ASU', 'asuncion', 'paraguay'],
  ['GRU', 'sao paulo', 'brasil', 'brazil'],
  ['GIG', 'rio de janeiro', 'rio'],
  ['SSA', 'salvador de bahia', 'salvador,brasil'],
  ['FLN', 'florianopolis'],
  ['REC', 'recife'],
  ['FOR', 'fortaleza'],
  // Estados Unidos y Canadá
  ['JFK', 'nueva york', 'new york', 'nyc', 'manhattan'],
  ['EWR', 'newark'],
  ['MIA', 'miami', 'miami beach'],
  ['FLL', 'fort lauderdale'],
  ['MCO', 'orlando', 'disney world'],
  ['TPA', 'tampa'],
  ['LAX', 'los angeles'],
  ['SFO', 'san francisco'],
  ['LAS', 'las vegas'],
  ['SAN', 'san diego'],
  ['ORD', 'chicago'],
  ['BOS', 'boston'],
  ['IAD', 'washington', 'washington dc'],
  ['ATL', 'atlanta'],
  ['IAH', 'houston'],
  ['DFW', 'dallas'],
  ['SEA', 'seattle'],
  ['PHL', 'filadelfia', 'philadelphia'],
  ['MSY', 'nueva orleans', 'new orleans'],
  ['DEN', 'denver'],
  ['HNL', 'honolulu', 'hawai', 'hawaii'],
  ['YYZ', 'toronto', 'canada'],
  ['YUL', 'montreal'],
  ['YVR', 'vancouver'],
  // Europa
  ['MAD', 'madrid', 'espana', 'spain'],
  ['BCN', 'barcelona'],
  ['SVQ', 'sevilla', 'seville'],
  ['VLC', 'valencia'],
  ['AGP', 'malaga', 'costa del sol'],
  ['BIO', 'bilbao'],
  ['PMI', 'palma de mallorca', 'mallorca'],
  ['IBZ', 'ibiza'],
  ['TFS', 'tenerife'],
  ['LPA', 'gran canaria', 'las palmas'],
  ['GRX', 'granada'],
  ['SCQ', 'santiago de compostela', 'santiago,espana'],
  ['LIS', 'lisboa', 'lisbon', 'portugal'],
  ['OPO', 'oporto', 'porto'],
  ['FAO', 'faro', 'algarve'],
  ['FNC', 'madeira', 'funchal'],
  ['CDG', 'paris', 'francia', 'france'],
  ['NCE', 'niza', 'nice', 'costa azul'],
  ['LYS', 'lyon'],
  ['MRS', 'marsella', 'marseille'],
  ['LHR', 'londres', 'london', 'reino unido', 'inglaterra'],
  ['EDI', 'edimburgo', 'edinburgh', 'escocia'],
  ['MAN', 'manchester'],
  ['DUB', 'dublin', 'irlanda', 'ireland'],
  ['FCO', 'roma', 'rome', 'italia', 'italy'],
  ['MXP', 'milan', 'milano'],
  ['VCE', 'venecia', 'venice'],
  ['FLR', 'florencia', 'florence', 'toscana'],
  ['NAP', 'napoles', 'naples', 'costa amalfitana'],
  ['BLQ', 'bolonia', 'bologna'],
  ['AMS', 'amsterdam', 'holanda', 'paises bajos'],
  ['BRU', 'bruselas', 'brussels', 'brujas', 'belgica'],
  ['BER', 'berlin', 'alemania', 'germany'],
  ['MUC', 'munich'],
  ['FRA', 'frankfurt', 'francfort'],
  ['ZRH', 'zurich', 'suiza'],
  ['GVA', 'ginebra', 'geneva'],
  ['VIE', 'viena', 'vienna', 'austria'],
  ['PRG', 'praga', 'prague', 'republica checa'],
  ['BUD', 'budapest', 'hungria'],
  ['WAW', 'varsovia', 'warsaw', 'polonia'],
  ['KRK', 'cracovia', 'krakow'],
  ['CPH', 'copenhague', 'copenhagen', 'dinamarca'],
  ['ARN', 'estocolmo', 'stockholm', 'suecia'],
  ['OSL', 'oslo', 'noruega'],
  ['HEL', 'helsinki', 'finlandia'],
  ['KEF', 'reikiavik', 'reykjavik', 'islandia'],
  ['ATH', 'atenas', 'athens', 'grecia'],
  ['JTR', 'santorini'],
  ['JMK', 'mykonos', 'miconos'],
  ['IST', 'estambul', 'istanbul', 'turquia'],
  ['DBV', 'dubrovnik', 'croacia'],
  ['SPU', 'split'],
  // Asia, Oriente Medio, África y Oceanía
  ['HND', 'tokio', 'tokyo', 'japon', 'japan'],
  ['KIX', 'osaka', 'kioto', 'kyoto'],
  ['ICN', 'seul', 'seoul', 'corea del sur', 'corea'],
  ['PEK', 'pekin', 'beijing', 'china'],
  ['PVG', 'shanghai'],
  ['HKG', 'hong kong'],
  ['TPE', 'taipei', 'taiwan'],
  ['BKK', 'bangkok', 'tailandia', 'thailand'],
  ['HKT', 'phuket'],
  ['SIN', 'singapur', 'singapore'],
  ['KUL', 'kuala lumpur', 'malasia'],
  ['DPS', 'bali', 'denpasar', 'ubud'],
  ['CGK', 'yakarta', 'jakarta', 'indonesia'],
  ['MNL', 'manila', 'filipinas'],
  ['SGN', 'ho chi minh', 'saigon', 'vietnam'],
  ['HAN', 'hanoi'],
  ['REP', 'siem reap', 'angkor', 'camboya'],
  ['DEL', 'nueva delhi', 'delhi', 'india'],
  ['BOM', 'bombay', 'mumbai'],
  ['KTM', 'katmandu', 'kathmandu', 'nepal'],
  ['MLE', 'maldivas', 'male'],
  ['DXB', 'dubai', 'emiratos arabes', 'emiratos'],
  ['AUH', 'abu dabi', 'abu dhabi'],
  ['DOH', 'doha', 'qatar'],
  ['TLV', 'tel aviv', 'israel'],
  ['CAI', 'el cairo', 'cairo', 'egipto'],
  ['RAK', 'marrakech', 'marrakesh', 'marruecos'],
  ['CMN', 'casablanca'],
  ['CPT', 'ciudad del cabo', 'cape town', 'sudafrica'],
  ['JNB', 'johannesburgo', 'johannesburg'],
  ['NBO', 'nairobi', 'kenia'],
  ['ZNZ', 'zanzibar'],
  ['SYD', 'sidney', 'sydney', 'australia'],
  ['MEL', 'melbourne'],
  ['AKL', 'auckland', 'nueva zelanda'],
]

const IATA_POR_LUGAR: ReadonlyMap<string, string> = new Map(
  AEROPUERTOS.flatMap(([codigo, ...nombres]) =>
    nombres.map((n) => [n, codigo] as const)
  )
)

/**
 * Código IATA del aeropuerto principal de una ciudad o país escrito en texto
 * libre ('Santo Domingo', 'Tokio, Japón', 'MAD'), o null si no se conoce.
 */
export function resolveIata(lugar: string): string | null {
  const crudo = lugar.trim()
  if (!crudo) return null
  // Ya viene como código: 'MAD' o 'Madrid (MAD)'.
  const codigo = /^([A-Z]{3})$/.exec(crudo) ?? /\(([A-Z]{3})\)/.exec(crudo)
  if (codigo?.[1]) return codigo[1]

  const norm = normalizar(crudo)
  if (!norm) return null
  const partes = norm.split(',').filter(Boolean)
  const ciudad = partes[0] ?? ''
  const pais = partes[partes.length - 1] ?? ''
  // Primer destino de una lista ('Tokio y Kioto', 'Madrid - Barcelona').
  const primeroCrudo =
    crudo.split(/\s+(?:y|e|and)\s+|\s[-–—]\s|[/;&+]/i)[0] ?? ''
  const primero = normalizar(primeroCrudo).split(',')[0] ?? ''

  const candidatos = [
    norm,
    partes.length > 1 ? `${ciudad},${pais}` : '',
    ciudad,
    primero,
    ciudad.replace(/^(?:ciudad de|ciudad del|city of) /, ''),
  ]
  for (const c of candidatos) {
    const hit = c ? IATA_POR_LUGAR.get(c) : undefined
    if (hit) return hit
  }
  return null
}

// ---------------------------------------------------------------------------
// Vuelos
// ---------------------------------------------------------------------------

export interface FlightsLinkInput {
  origen: string
  destino: string
  /** Fecha de ida 'YYYY-MM-DD'. */
  ida?: string | undefined
  /** Fecha de vuelta 'YYYY-MM-DD' (si falta, solo ida). */
  vuelta?: string | undefined
  personas?: number | undefined
}

export type FlightsProvider = 'skyscanner' | 'aviasales' | 'google_flights'

export interface FlightsLinkInfo {
  url: string
  proveedor: FlightsProvider
  origenIata: string | null
  destinoIata: string | null
}

/**
 * Enlace de búsqueda de vuelos, con la información de qué proveedor se usó
 * (útil para la analítica de clics de afiliado).
 *
 * - Si conocemos los códigos IATA: Skyscanner (con associateid si está
 *   configurado). Si no hay ID de Skyscanner pero sí marker de Travelpayouts,
 *   Aviasales con marker (así el clic genera comisión).
 * - Si no: Google Flights con la consulta en texto libre.
 */
export function describeFlightsLink(input: FlightsLinkInput): FlightsLinkInfo {
  const origenIata = resolveIata(input.origen)
  const destinoIata = resolveIata(input.destino)
  const ida = fechaValida(input.ida) ? input.ida : undefined
  const vuelta =
    ida && fechaValida(input.vuelta) && input.vuelta >= ida
      ? input.vuelta
      : undefined
  const adultos = entre(input.personas, 1, 9, 1)

  if (origenIata && destinoIata && origenIata !== destinoIata) {
    const associateId = skyscannerAssociateId()
    const marker = travelpayoutsMarker()

    if (!associateId && marker && ida) {
      const ruta = `${origenIata}${aDDMM(ida)}${destinoIata}${vuelta ? aDDMM(vuelta) : ''}${adultos}`
      return {
        url: `https://www.aviasales.com/search/${ruta}?${new URLSearchParams({ marker })}`,
        proveedor: 'aviasales',
        origenIata,
        destinoIata,
      }
    }

    const segmentos = [origenIata.toLowerCase(), destinoIata.toLowerCase()]
    if (ida) segmentos.push(aYYMMDD(ida))
    if (ida && vuelta) segmentos.push(aYYMMDD(vuelta))
    const params = new URLSearchParams({
      adultsv2: String(adultos),
      cabinclass: 'economy',
      rtn: vuelta ? '1' : '0',
    })
    if (associateId) params.set('associateid', associateId)
    return {
      url: `https://www.skyscanner.com/transport/flights/${segmentos.join('/')}/?${params}`,
      proveedor: 'skyscanner',
      origenIata,
      destinoIata,
    }
  }

  // Google Flights entiende consultas en inglés con fechas ISO.
  let q = `Flights to ${input.destino.trim()} from ${input.origen.trim()}`
  if (ida) q += ` on ${ida}`
  q += vuelta ? ` through ${vuelta}` : ' one way'
  return {
    url: `https://www.google.com/travel/flights?${new URLSearchParams({ q, hl: 'es' })}`,
    proveedor: 'google_flights',
    origenIata,
    destinoIata,
  }
}

/** URL de búsqueda de vuelos de ida y vuelta (ver describeFlightsLink). */
export function buildFlightsLink(input: FlightsLinkInput): string {
  return describeFlightsLink(input).url
}

/**
 * Alias compatible con la firma anterior. Ahora resuelve los códigos IATA y,
 * si se pasa `vuelta`, busca ida y vuelta.
 */
export function buildSkyscannerLink(
  origen: string,
  destino: string,
  fecha: string,
  vuelta?: string,
  personas?: number
): string {
  return buildFlightsLink({ origen, destino, ida: fecha, vuelta, personas })
}

// ---------------------------------------------------------------------------
// Hoteles, carros, actividades y eSIM
// ---------------------------------------------------------------------------

export interface BookingLinkOptions {
  /** Fecha de salida 'YYYY-MM-DD'. */
  checkOut?: string | undefined
  adultos?: number | undefined
  habitaciones?: number | undefined
}

/** Búsqueda de alojamiento en Booking.com para un destino y fechas. */
export function buildBookingLink(
  destino: string,
  checkIn?: string,
  opts: BookingLinkOptions = {}
): string {
  const params = new URLSearchParams({ ss: destino.trim(), lang: 'es' })
  const entrada = fechaValida(checkIn) ? checkIn : undefined
  if (entrada) params.set('checkin', entrada)
  if (entrada && fechaValida(opts.checkOut) && opts.checkOut > entrada) {
    params.set('checkout', opts.checkOut)
  }
  if (opts.adultos !== undefined) {
    params.set('group_adults', String(entre(opts.adultos, 1, 30, 2)))
    params.set('no_rooms', String(entre(opts.habitaciones, 1, 30, 1)))
    params.set('group_children', '0')
  }
  const aid = bookingAid()
  if (aid) params.set('aid', aid)
  return `https://www.booking.com/searchresults.html?${params}`
}

/** Alquiler de carros en Booking.com (sustituye al enlace escrito a mano). */
export function buildCarRentalLink(): string {
  const params = new URLSearchParams({ lang: 'es' })
  const aid = bookingAid()
  if (aid) params.set('aid', aid)
  return `https://www.booking.com/cars/index.html?${params}`
}

/**
 * Enlace de Viator para una actividad. Constrúyelo al renderizar a partir del
 * nombre de la actividad y la ciudad del día (no lo guardes en el viaje).
 */
export function buildActivityLink(nombre: string, ciudad = ''): string {
  const texto = [nombre, ciudad]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ')
  const params = new URLSearchParams({ text: texto })
  const pid = viatorPid()
  const mcid = viatorMcid()
  if (pid) params.set('pid', pid)
  if (mcid) params.set('mcid', mcid)
  if (pid || mcid) {
    params.set('medium', 'link')
    params.set('campaign', 'wayio')
  }
  return `https://www.viator.com/searchResults/all?${params}`
}

/** @deprecated Usa buildActivityLink al renderizar. Se mantiene por compatibilidad. */
export const buildViatorLink = buildActivityLink

/** eSIM de Airalo (con el código de referido si está configurado). */
export function buildAiraloLink(_pais?: string): string {
  const ref = airaloRef()
  return ref
    ? `https://ref.airalo.com/${encodeURIComponent(ref)}`
    : 'https://www.airalo.com/es'
}

// ---------------------------------------------------------------------------
// Navegación ("Llegar")
// ---------------------------------------------------------------------------

/**
 * Enlaces universales de navegación: abren la app si está instalada y, si no,
 * la web (funcionan en escritorio, Android e iOS).
 */
export function buildNavigationLinks(
  lat: number,
  lng: number,
  nombre?: string
): {
  google: string
  waze: string
  apple: string
  citymapper: string
} {
  const la = Number.isFinite(lat) ? Number(lat.toFixed(6)) : 0
  const lo = Number.isFinite(lng) ? Number(lng.toFixed(6)) : 0
  // Solo números, signo y coma: no hace falta codificar (y algunas apps no
  // decodifican "%2C").
  const punto = `${la},${lo}`
  const etiqueta = nombre?.trim()
  const endname = etiqueta ? `&endname=${encodeURIComponent(etiqueta)}` : ''
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${punto}`,
    waze: `https://waze.com/ul?ll=${punto}&navigate=yes`,
    apple: `https://maps.apple.com/?daddr=${punto}`,
    citymapper: `https://citymapper.com/directions?endcoord=${punto}${endname}`,
  }
}
