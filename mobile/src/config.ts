/**
 * Configuración central leída de las variables públicas de Expo (.env).
 *
 * - API_URL   → el backend web de Wayio (Next.js): endpoints de IA (generate,
 *               adjust, reschedule, validate, interpret, analyze-video…),
 *               búsquedas (hotels, activities, flights) y pagos. TODAS las
 *               llamadas llevan `Authorization: Bearer <access_token>` de la
 *               sesión de Supabase (lib/api/http.ts). En desarrollo apúntalo a
 *               la IP LAN de tu PC (p. ej. http://192.168.1.50:3000):
 *               «localhost» no resuelve desde un teléfono físico.
 * - WEB_URL   → la web pública: recuperar contraseña, páginas legales y
 *               enlaces para compartir el viaje o el grupo.
 * - RESERVAS_ENABLED → 'true' muestra «Reservar con depósito (15 %)». Por
 *               defecto apagado; debe coincidir con NEXT_PUBLIC_RESERVAS_ENABLED
 *               del servidor (si no, el checkout responde 403).
 * - GEO_PROVEEDOR → quién geocodifica en el backend. Por defecto 'geoapify':
 *               el mapa muestra «Powered by Geoapify», que su plan Free exige
 *               donde se ven sus coordenadas. Pon 'osm' solo si el servidor no
 *               tiene GEOAPIFY_API_KEY.
 * - Afiliados  → los mismos IDs que NEXT_PUBLIC_* de la web, para los enlaces
 *               de respaldo (cuando el backend no responde) y para la eSIM y
 *               el seguro. Sin ID se omite el parámetro (sin comisión).
 * - REVENUECAT_IOS_KEY / REVENUECAT_ANDROID_KEY → claves PÚBLICAS de
 *               RevenueCat de cada tienda (Project settings → API keys). Con
 *               la clave de la plataforma, la app vende Pro con compras
 *               integradas (App Store / Google Play) en vez del pago web; sin
 *               ella, esa build sigue con el pago web. Necesita un development
 *               build (no Expo Go).
 * - COMPRAS_TIENDA → 'false' fuerza el pago web aunque haya clave. Por defecto
 *               (vacío) las compras integradas se activan solas con la clave.
 * - REVENUECAT_ENTITLEMENT (por defecto 'pro'), REVENUECAT_OFERTA (vacío = la
 *               oferta marcada como actual en RevenueCat) y
 *               REVENUECAT_PAQUETE_PASE (por defecto 'pase_30_dias'): solo si
 *               en RevenueCat usas otros identificadores.
 * - CHECKOUT_WEB_EEUU → 'true' ofrece ADEMÁS el pago web en iOS cuando la
 *               cuenta del App Store es de EE. UU. (allí Apple lo permite).
 *               Fuera de EE. UU. y en Android siempre se usa la tienda.
 */

/** ID de afiliado limpio, o undefined si falta o es un marcador de ejemplo. */
function idAfiliado(valor: string | undefined): string | undefined {
  const v = valor?.trim()
  if (!v) return undefined
  if (/^(?:tu[_-]|your[_-]|xxx|changeme|todo\b|<)/i.test(v)) return undefined
  return v
}

export const config = {
  apiUrl: (process.env['EXPO_PUBLIC_API_URL'] ?? '').replace(/\/$/, ''),
  webUrl: (process.env['EXPO_PUBLIC_WEB_URL'] ?? '').replace(/\/$/, ''),
  supabaseUrl: process.env['EXPO_PUBLIC_SUPABASE_URL'] ?? '',
  supabaseAnonKey: process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] ?? '',
  mapboxToken: process.env['EXPO_PUBLIC_MAPBOX_TOKEN'] ?? '',
  /** Reservas con depósito (solo con Stripe en el servidor) activas en esta build. */
  reservasActivas: process.env['EXPO_PUBLIC_RESERVAS_ENABLED'] === 'true',
  /** Créditos de Geoapify en el mapa (salvo que el backend use solo OSM). */
  creditosGeoapify: process.env['EXPO_PUBLIC_GEO_PROVEEDOR'] !== 'osm',
  /** IDs de afiliado (ver components/trip/enlacesAfiliado.ts). */
  afiliados: {
    bookingAid: idAfiliado(process.env['EXPO_PUBLIC_BOOKING_AID']),
    skyscannerAssociateId: idAfiliado(
      process.env['EXPO_PUBLIC_SKYSCANNER_ASSOCIATE_ID']
    ),
    tpMarker: idAfiliado(process.env['EXPO_PUBLIC_TP_MARKER']),
    tpTrs: idAfiliado(process.env['EXPO_PUBLIC_TP_TRS']),
    /** Programa Trip.com conectado en Travelpayouts. */
    tpTripcom: /^(?:1|true|s[ií])$/i.test(
      process.env['EXPO_PUBLIC_TP_TRIPCOM']?.trim() ?? ''
    ),
    discoverCarsAid: idAfiliado(process.env['EXPO_PUBLIC_DISCOVERCARS_AID']),
    airaloRef: idAfiliado(process.env['EXPO_PUBLIC_AIRALO_REF']),
    iatiRef: idAfiliado(process.env['EXPO_PUBLIC_IATI_REF']),
  },
  /** Compras integradas (RevenueCat) si hay clave; 'false' las apaga. */
  comprasTienda: !['false', '0', 'no'].includes(
    (process.env['EXPO_PUBLIC_COMPRAS_TIENDA'] ?? '').trim().toLowerCase()
  ),
  /** Clave pública de RevenueCat del App Store (appl_…). */
  revenuecatIos: (process.env['EXPO_PUBLIC_REVENUECAT_IOS_KEY'] ?? '').trim(),
  /** Clave pública de RevenueCat de Google Play (goog_…). */
  revenuecatAndroid: (
    process.env['EXPO_PUBLIC_REVENUECAT_ANDROID_KEY'] ?? ''
  ).trim(),
  /** Entitlement de RevenueCat que da Pro. */
  revenuecatEntitlement:
    process.env['EXPO_PUBLIC_REVENUECAT_ENTITLEMENT']?.trim() || 'pro',
  /** Oferta de RevenueCat a mostrar ('' = la actual). */
  revenuecatOferta: process.env['EXPO_PUBLIC_REVENUECAT_OFERTA']?.trim() || '',
  /** Paquete a medida del Pase Pro de 30 días en la oferta. */
  revenuecatPaquetePase:
    process.env['EXPO_PUBLIC_REVENUECAT_PAQUETE_PASE']?.trim() ||
    'pase_30_dias',
  /** Pago web también para cuentas de la tienda de EE. UU. */
  checkoutWebEeuu: process.env['EXPO_PUBLIC_CHECKOUT_WEB_EEUU'] === 'true',
} as const

export function assertBackendConfigured(): void {
  if (!config.apiUrl) {
    throw new Error(
      'EXPO_PUBLIC_API_URL no está configurado. Apúntalo a tu servidor web Wayio.'
    )
  }
}
