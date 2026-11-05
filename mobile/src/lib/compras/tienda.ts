import { Linking, Platform } from 'react-native'
import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  PRODUCT_CATEGORY,
  PRODUCT_TYPE,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesPackage,
} from 'react-native-purchases'
import { config } from '../../config'
import type { PlanId } from '../../constants/pricing'

/**
 * Compras integradas (App Store y Google Play) con RevenueCat.
 *
 * - Se activa sola con la clave pública de RevenueCat de la plataforma
 *   (EXPO_PUBLIC_REVENUECAT_IOS_KEY / _ANDROID_KEY);
 *   EXPO_PUBLIC_COMPRAS_TIENDA=false la apaga. Sin clave, la app sigue con el
 *   pago web (`comprasTiendaActivas()` es false y nada de aquí toca el SDK).
 * - El app_user_id de RevenueCat es el id de Supabase de la cuenta
 *   (`sincronizarUsuarioTienda`): así el webhook del servidor sabe a quién
 *   darle Pro. Sin sesión no se configura y no se vende nada.
 * - El plan lo decide SIEMPRE el servidor (tabla subscriptions, que escribe
 *   el webhook de RevenueCat). Aquí solo se compra y se restaura; después la
 *   pantalla vuelve a leer el plan (`refreshTier`).
 *
 * Productos y ofertas: API-KEYS-GUIA.md, sección 6b. La oferta actual
 * lleva los paquetes $rc_monthly, $rc_annual y uno a medida para el pase
 * (`pase_30_dias`). Los planes se reconocen por el TIPO de paquete y de
 * producto, no por sus ids: funcionan con los ids que elijas en las tiendas.
 */

/** Entitlement de RevenueCat que da Wayio Pro (solo las suscripciones). */
export const ENTITLEMENT_PRO = config.revenuecatEntitlement

function claveDeLaPlataforma(): string {
  if (Platform.OS === 'ios') return config.revenuecatIos
  if (Platform.OS === 'android') return config.revenuecatAndroid
  return ''
}

/** ¿Esta build vende Pro con la tienda (y no con el pago web)? */
export function comprasTiendaActivas(): boolean {
  return config.comprasTienda && claveDeLaPlataforma() !== ''
}

/** Nombre de la tienda de esta plataforma, para los textos. */
export const NOMBRE_TIENDA = Platform.OS === 'ios' ? 'App Store' : 'Google Play'

// ─── Cuenta ───────────────────────────────────────────────────────────────

let configurado = false
/** Cuenta con la que está identificado el SDK de RevenueCat. */
let idEnRevenueCat: string | null = null
/** Cuenta de Wayio con sesión para la que se puede comprar (null: ninguna). */
let usuarioActual: string | null = null
/** Los cambios de cuenta se aplican en orden, de uno en uno. */
let cola: Promise<void> = Promise.resolve()

async function aplicarUsuario(uid: string | null): Promise<void> {
  usuarioActual = null
  // Al cerrar sesión NO se llama a Purchases.logOut(): con ids propios
  // RevenueCat aconseja no crear clientes anónimos. Solo se deja de vender
  // hasta que entre una cuenta (y entonces logIn cambia de cliente).
  if (!uid) return
  if (!configurado) {
    if (__DEV__) void Purchases.setLogLevel(LOG_LEVEL.WARN)
    Purchases.configure({ apiKey: claveDeLaPlataforma(), appUserID: uid })
    configurado = true
    idEnRevenueCat = uid
  } else if (idEnRevenueCat !== uid) {
    await Purchases.logIn(uid)
    idEnRevenueCat = uid
  }
  usuarioActual = uid
}

/**
 * Asocia RevenueCat con la cuenta de Wayio (o la suelta al cerrar sesión).
 * Nunca lanza: un fallo aquí no puede romper el inicio de sesión.
 */
export function sincronizarUsuarioTienda(uid: string | null): Promise<void> {
  if (!comprasTiendaActivas()) return Promise.resolve()
  cola = cola.then(
    () => aplicarUsuario(uid).catch(() => undefined),
    () => undefined
  )
  return cola
}

/** ¿RevenueCat está listo para comprar con ESTA cuenta? */
async function listoPara(uid: string): Promise<boolean> {
  await sincronizarUsuarioTienda(uid)
  return configurado && usuarioActual === uid
}

// ─── Ofertas ──────────────────────────────────────────────────────────────

export interface OfertaTienda {
  plan: PlanId
  paquete: PurchasesPackage
  /** Precio con la moneda de la tienda del cliente («US$4.99», «RD$…»). */
  precio: string
}

/** Productos que no se renuevan (el pase), sea cual sea su id. */
const TIPOS_SIN_RENOVACION: readonly PRODUCT_TYPE[] = [
  PRODUCT_TYPE.NON_RENEWABLE_SUBSCRIPTION,
  PRODUCT_TYPE.CONSUMABLE,
  PRODUCT_TYPE.NON_CONSUMABLE,
  PRODUCT_TYPE.PREPAID_SUBSCRIPTION,
]

/**
 * Plan de un paquete: por el tipo de paquete ($rc_monthly, $rc_annual), por
 * el id del paquete del pase y, si no, por el tipo y periodo del producto.
 */
function planDePaquete(p: PurchasesPackage): PlanId | null {
  if (p.packageType === PACKAGE_TYPE.MONTHLY) return 'pro_mensual'
  if (p.packageType === PACKAGE_TYPE.ANNUAL) return 'pro_anual'
  if (p.identifier === config.revenuecatPaquetePase) return 'pro_por_viaje'
  const producto = p.product
  if (
    producto.productCategory === PRODUCT_CATEGORY.NON_SUBSCRIPTION ||
    TIPOS_SIN_RENOVACION.includes(producto.productType)
  ) {
    return 'pro_por_viaje'
  }
  if (producto.subscriptionPeriod === 'P1M') return 'pro_mensual'
  if (producto.subscriptionPeriod === 'P1Y') return 'pro_anual'
  return null
}

/** Paquetes de la oferta actual que corresponden a planes a la venta. */
export async function obtenerOfertas(uid: string): Promise<OfertaTienda[]> {
  if (!(await listoPara(uid))) throw new Error('tienda no disponible')
  const ofertas = await Purchases.getOfferings()
  const oferta = config.revenuecatOferta
    ? (ofertas.all[config.revenuecatOferta] ?? null)
    : ofertas.current
  const paquetes = oferta?.availablePackages ?? []
  const vistas = new Set<PlanId>()
  const lista: OfertaTienda[] = []
  for (const paquete of paquetes) {
    const plan = planDePaquete(paquete)
    if (!plan || vistas.has(plan)) continue
    vistas.add(plan)
    lista.push({ plan, paquete, precio: paquete.product.priceString })
  }
  return lista
}

/**
 * País de la cuenta de la tienda (ISO; el App Store lo da con 3 letras y
 * Google Play con 2), o null si no se sabe.
 */
export async function paisDeLaTienda(uid: string): Promise<string | null> {
  try {
    if (!(await listoPara(uid))) return null
    const tienda = await Purchases.getStorefront()
    return tienda?.countryCode?.toUpperCase() ?? null
  } catch {
    return null
  }
}

/** ¿La cuenta de la tienda es de EE. UU.? */
export const esDeEeuu = (pais: string | null): boolean =>
  pais === 'US' || pais === 'USA'

/**
 * ¿Se puede ofrecer el pago web además de la tienda? Solo en iOS con cuenta
 * del App Store de EE. UU. (allí Apple permite enlazar a otro medio de pago
 * sin permiso especial). En Google Play el pago externo en EE. UU. exige
 * inscribirse en su programa y pagarle comisión: no se ofrece.
 */
export const pagoWebPermitido = (pais: string | null): boolean =>
  Platform.OS === 'ios' && config.checkoutWebEeuu && esDeEeuu(pais)

// ─── Compra, restauración y gestión ───────────────────────────────────────

const tienePro = (info: CustomerInfo): boolean =>
  Boolean(info.entitlements.active[ENTITLEMENT_PRO])

export type ResultadoCompra =
  /** La tienda cobró: falta que el servidor active el plan (webhook). */
  | { estado: 'comprada' }
  /** El cliente cerró la hoja de pago: no es un error. */
  | { estado: 'cancelada' }
  /** Pago pendiente (p. ej. aprobación familiar o efectivo en Google). */
  | { estado: 'pendiente' }

function esErrorDeCompras(e: unknown): e is PurchasesError {
  return typeof e === 'object' && e !== null && 'code' in e
}

/** Mensaje amable de un error de la tienda (nunca el código técnico). */
export function mensajeTienda(e: unknown): string {
  if (esErrorDeCompras(e)) {
    switch (e.code) {
      case PURCHASES_ERROR_CODE.NETWORK_ERROR:
      case PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR:
        return 'Sin conexión con la tienda. Revisa tu internet e inténtalo de nuevo.'
      case PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR:
        return `Este dispositivo no permite compras en ${NOMBRE_TIENDA} (revisa las restricciones o el control parental).`
      case PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR:
        return 'Ese plan no está disponible en tu país ahora mismo.'
      case PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR:
        return 'Ya compraste este plan con tu cuenta de la tienda. Toca «Restaurar compras».'
      case PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR:
      case PURCHASES_ERROR_CODE.RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR:
      case PURCHASES_ERROR_CODE.PURCHASE_BELONGS_TO_OTHER_USER:
        return 'Esta compra está asociada a otra cuenta de Wayio. Entra con esa cuenta o escríbenos.'
      case PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR:
        return `${NOMBRE_TIENDA} tuvo un problema. Inténtalo de nuevo en unos minutos.`
      default:
        break
    }
  }
  return 'No pudimos completar la compra ahora mismo. Inténtalo más tarde.'
}

/** Compra un paquete con la hoja de pago de la tienda. */
export async function comprar(
  uid: string,
  paquete: PurchasesPackage
): Promise<ResultadoCompra> {
  if (!(await listoPara(uid))) throw new Error('tienda no disponible')
  try {
    // El pase de 30 días NO va adjunto al entitlement (RevenueCat lo daría
    // para siempre): su acceso lo calcula el servidor. Por eso aquí no se
    // mira el entitlement: si purchasePackage resuelve, la tienda cobró.
    await Purchases.purchasePackage(paquete)
    return { estado: 'comprada' }
  } catch (e) {
    if (esErrorDeCompras(e)) {
      if (e.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        return { estado: 'cancelada' }
      }
      if (e.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
        return { estado: 'pendiente' }
      }
    }
    throw e
  }
}

/**
 * Restaura las compras de la cuenta de la tienda en esta cuenta de Wayio.
 * Devuelve si la tienda tiene Pro activo para ella (suscripciones: el pase
 * de 30 días no se restaura, queda en la cuenta con la que se compró).
 */
export async function restaurar(uid: string): Promise<boolean> {
  if (!(await listoPara(uid))) throw new Error('tienda no disponible')
  return tienePro(await Purchases.restorePurchases())
}

/**
 * Abre la gestión de la suscripción de la tienda (cancelar, cambiar de
 * plan). Devuelve false si no hay nada que gestionar desde aquí.
 */
export async function gestionarEnLaTienda(uid: string): Promise<boolean> {
  if (!(await listoPara(uid))) return false
  const info = await Purchases.getCustomerInfo()
  if (!info.managementURL) return false
  // iOS: la hoja nativa del App Store; Android: la página de suscripciones
  // de Google Play (managementURL).
  if (Platform.OS === 'ios') {
    try {
      await Purchases.showManageSubscriptions()
      return true
    } catch {
      // iOS < 13 o sin hoja: se abre el enlace.
    }
  }
  await Linking.openURL(info.managementURL)
  return true
}
