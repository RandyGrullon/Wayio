import { useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as WebBrowser from 'expo-web-browser'
import {
  Badge,
  Button,
  Callout,
  Card,
  CardKicker,
  Pantalla,
  ScreenHeader,
  Skeleton,
  SkeletonRegion,
  Txt,
  useToast,
} from '../components/ui'
import {
  CalendarDays,
  Check,
  CreditCard,
  ExternalLink,
  RefreshCw,
} from '../components/ui/iconos'
import { formatCurrency, formatFecha } from '../components/ui/formato'
import { config } from '../config'
import { useAuth } from '../context/AuthContext'
import { BackendError, postJSON } from '../lib/api/http'
import { getCupo, type CupoDelMes, type UsoCupo } from '../lib/api/backend'
import {
  NOMBRE_TIENDA,
  comprar,
  comprasTiendaActivas,
  gestionarEnLaTienda,
  mensajeTienda,
  obtenerOfertas,
  pagoWebPermitido,
  paisDeLaTienda,
  restaurar,
  type OfertaTienda,
} from '../lib/compras/tienda'
import { conTope } from '../components/ui/conTope'
import {
  ACCIONES_CON_CUPO,
  ETIQUETA_USO,
  FREE_FEATURES,
  NOMBRE_PLAN,
  NOTA_USO_JUSTO,
  PLANS,
  PRO_FEATURES,
  RENOVACION_CUPO,
  type PlanId,
} from '../constants/pricing'
import { useEstilos, useTheme, type Tema } from '../theme'

interface RespuestaCheckout {
  url?: string
  portal?: boolean
  mensaje?: string
}

/** Uso del mes (GET /api/cupo). */
type EstadoUso =
  | { estado: 'sin_sesion' }
  | { estado: 'cargando' }
  | { estado: 'error' }
  | { estado: 'ok'; cupo: CupoDelMes }

/** Ofertas de la tienda (RevenueCat), solo con compras integradas. */
type EstadoOfertas =
  | { estado: 'cargando' }
  | { estado: 'error' }
  | { estado: 'ok'; lista: OfertaTienda[] }

/** Un plan tal como se vende en esta build (precio de la web o la tienda). */
interface OpcionVenta {
  id: PlanId
  nombre: string
  precio: string
  periodo: string
  detalle: string
  ahorro: string | null
  oferta: OfertaTienda | null
}

/** Vuelta a la app tras el pago (el navegador seguro se cierra al volver). */
const RETORNO = 'wayio://pago'

/** Sin respuesta del backend en este tiempo, se deja de esperar. */
const TOPE_PAGO_MS = 30_000

/**
 * Tras pagar en la tienda, el webhook de RevenueCat tarda unos segundos en
 * activar el plan en el servidor: se relee cada 2,5 s durante 30 s.
 */
const ESPERA_PLAN_MS = 30_000
const PAUSA_PLAN_MS = 2_500

/** ¿Esta build vende con la tienda? (bandera + clave de la plataforma) */
const MODO_TIENDA = comprasTiendaActivas()

const esperar = (ms: number): Promise<void> =>
  new Promise((resolver) => setTimeout(resolver, ms))

/** Mensaje amable de un error del pago (nunca el código técnico). */
function mensajePago(e: unknown): string {
  if (e instanceof BackendError) {
    const mensaje = e.data?.['mensaje']
    if (typeof mensaje === 'string' && mensaje.trim()) return mensaje
    if (e.data?.['code'] === 'already_pro') return 'Ya tienes un plan activo.'
    if (e.data?.['code'] === 'no_customer') {
      return 'Aún no tienes una suscripción que gestionar.'
    }
    if (e.message.includes(' ')) return e.message
  }
  return 'No pudimos abrir el pago ahora mismo. Inténtalo más tarde.'
}

/** Planes con los precios de la web (US$, pago web). */
function opcionesWeb(): OpcionVenta[] {
  return PLANS.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    precio: formatCurrency(p.precio, 'USD', { decimales: true }),
    periodo: p.periodo,
    detalle: p.detalle,
    ahorro: p.ahorro,
    oferta: null,
  }))
}

/**
 * Planes que la tienda ofrece de verdad, con el precio local del cliente.
 * El ahorro del anual se calcula con esos mismos precios.
 */
function opcionesTienda(lista: readonly OfertaTienda[]): OpcionVenta[] {
  const precioDe = (id: PlanId): number | null =>
    lista.find((o) => o.plan === id)?.paquete.product.price ?? null
  const mensual = precioDe('pro_mensual')
  const anual = precioDe('pro_anual')
  const ahorroAnual =
    mensual && anual ? Math.round((1 - anual / (mensual * 12)) * 100) : 0
  const opciones: OpcionVenta[] = []
  for (const p of PLANS) {
    const oferta = lista.find((o) => o.plan === p.id)
    if (!oferta) continue
    opciones.push({
      id: p.id,
      nombre: p.nombre,
      precio: oferta.precio,
      periodo: p.periodo,
      detalle: p.detalle,
      ahorro:
        p.id === 'pro_anual' && ahorroAnual >= 5 ? `${ahorroAnual} %` : null,
      oferta,
    })
  }
  return opciones
}

/** Una acción con cupo: rótulo, «1 de 2» y la barra de uso. */
function FilaUso({
  etiqueta,
  uso,
}: {
  etiqueta: string
  uso: UsoCupo
}): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const { colors } = useTheme()
  const agotado = uso.usados >= uso.limite
  const proporcion =
    uso.limite > 0 ? Math.min(1, uso.usados / uso.limite) : agotado ? 1 : 0
  return (
    <View
      style={styles.uso}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${etiqueta}: usaste ${uso.usados} de ${uso.limite}${agotado ? ', agotado' : ''}`}
      accessibilityValue={{ min: 0, max: uso.limite, now: uso.usados }}
    >
      <View style={styles.usoFila}>
        <Txt variant="label" style={styles.flex}>
          {etiqueta}
        </Txt>
        {agotado ? <Badge label="Agotado" variant="warning" /> : null}
        <Txt variant="bodyS" color="fgMuted" tnum>
          {uso.usados} de {uso.limite}
        </Txt>
      </View>
      <View style={[styles.pista, { backgroundColor: colors.surface2 }]}>
        <View
          style={[
            styles.relleno,
            {
              width: `${Math.round(proporcion * 100)}%`,
              backgroundColor: agotado ? colors.warning : colors.accent,
            },
          ]}
        />
      </View>
    </View>
  )
}

/** Lista de planes a elegir (radio). */
function SelectorDePlanes({
  opciones,
  elegido,
  onElegir,
}: {
  opciones: readonly OpcionVenta[]
  elegido: PlanId | null
  onElegir: (id: PlanId) => void
}): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const { colors } = useTheme()
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Planes">
      {opciones.map((p) => {
        const sel = p.id === elegido
        return (
          <Card
            key={p.id}
            variant={sel ? 'selected' : 'default'}
            onPress={() => onElegir(p.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: sel }}
            accessibilityLabel={`${p.nombre}, ${p.precio} ${p.periodo}. ${p.detalle}`}
            style={styles.plan}
          >
            <View style={styles.planFila}>
              <View
                style={[
                  styles.radio,
                  sel
                    ? {
                        backgroundColor: colors.fg,
                        borderColor: colors.fg,
                      }
                    : { borderColor: colors.borderStrong },
                ]}
              >
                {sel ? (
                  <Check size={14} color={colors.fgInverse} strokeWidth={2.5} />
                ) : null}
              </View>
              <View style={styles.flex}>
                <Txt variant="label">{p.nombre}</Txt>
                <Txt variant="caption" color="fgMuted">
                  {p.detalle}
                </Txt>
              </View>
              <View style={styles.precio}>
                <Txt variant="title" tnum>
                  {p.precio}
                </Txt>
                <Txt variant="caption" color="fgMuted">
                  {p.periodo}
                </Txt>
              </View>
            </View>
            {p.ahorro ? (
              <Badge
                label={`Ahorra ${p.ahorro} frente al mensual`}
                variant="laton"
                style={styles.ahorro}
              />
            ) : null}
          </Card>
        )
      })}
    </View>
  )
}

/**
 * Planes (M05): Gratis con sus cupos del mes y lo que Pro añade de verdad,
 * con el uso del mes de la cuenta (GET /api/cupo).
 *
 * Dos formas de cobrar, según la build:
 * - Compras integradas (EXPO_PUBLIC_COMPRAS_TIENDA=true, lib/compras/tienda):
 *   planes y precios de la oferta de RevenueCat, pago con la hoja de App
 *   Store o Google Play y, al pagar, se relee el plan del servidor (lo activa
 *   el webhook de RevenueCat) durante unos segundos. «Restaurar compras» y
 *   «Gestionar suscripción» van contra la tienda. En iOS con cuenta de
 *   EE. UU. y EXPO_PUBLIC_CHECKOUT_WEB_EEUU=true se ofrece también el pago
 *   web. Lleva el aviso de renovación y los enlaces a Términos y Privacidad
 *   que exige Apple (3.1.2).
 * - Pago web (por defecto): POST /api/pagos/checkout con el Bearer de la
 *   sesión y el pago en el navegador seguro de la app (Creem o Stripe, lo
 *   decide el servidor con PAYMENTS_PROVIDER; la app no nombra al
 *   procesador); al volver se relee el plan (`refreshTier`) y el uso. Con
 *   plan activo, «Gestionar suscripción» abre el portal de pagos (POST
 *   /api/pagos/portal), donde también se cancela.
 *
 * Pro Grupo no se vende (quien ya lo tiene lo sigue viendo como su plan).
 */
export function PaywallScreen(): React.ReactElement {
  const { tier, user, refreshTier } = useAuth()
  const toast = useToast()
  const { colors } = useTheme()
  const styles = useEstilos(crearEstilos)
  const insets = useSafeAreaInsets()
  const destacado = PLANS.find((p) => p.destacado) ?? PLANS[0]
  const [plan, setPlan] = useState<PlanId>(destacado?.id ?? 'pro_mensual')
  const [abriendo, setAbriendo] = useState(false)
  const [restaurando, setRestaurando] = useState(false)
  /** Pagado en la tienda, esperando a que el servidor active el plan. */
  const [activando, setActivando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Aviso que no es un error (pago pendiente, plan que tarda…). */
  const [aviso, setAviso] = useState<string | null>(null)
  const uid = user?.id ?? null
  const [uso, setUso] = useState<EstadoUso>(() =>
    uid ? { estado: 'cargando' } : { estado: 'sin_sesion' }
  )
  /** Sube para volver a pedir el uso (reintentar o al volver del pago). */
  const [recargaUso, setRecargaUso] = useState(0)
  const [ofertas, setOfertas] = useState<EstadoOfertas>({ estado: 'cargando' })
  const [recargaOfertas, setRecargaOfertas] = useState(0)
  /** País de la cuenta de la tienda (pago web solo en EE. UU.). */
  const [pais, setPais] = useState<string | null>(null)
  const montada = useRef(true)

  useEffect(() => {
    montada.current = true
    return () => {
      montada.current = false
    }
  }, [])

  useEffect(() => {
    if (!uid) return
    let vivo = true
    getCupo().then(
      (cupo) => {
        if (vivo) setUso({ estado: 'ok', cupo })
      },
      () => {
        if (vivo) setUso({ estado: 'error' })
      }
    )
    return () => {
      vivo = false
    }
  }, [uid, recargaUso])

  useEffect(() => {
    if (!MODO_TIENDA || !uid || tier !== 'free') return
    let vivo = true
    obtenerOfertas(uid).then(
      (lista) => {
        if (vivo) setOfertas({ estado: 'ok', lista })
      },
      () => {
        if (vivo) setOfertas({ estado: 'error' })
      }
    )
    return () => {
      vivo = false
    }
  }, [uid, tier, recargaOfertas])

  useEffect(() => {
    if (!MODO_TIENDA || !uid || !config.checkoutWebEeuu) return
    let vivo = true
    void paisDeLaTienda(uid).then((p) => {
      if (vivo) setPais(p)
    })
    return () => {
      vivo = false
    }
  }, [uid])

  /** Pago web: siempre sin tienda; con ella, solo iOS de EE. UU. */
  const webPermitido = !MODO_TIENDA || pagoWebPermitido(pais)

  const opciones: OpcionVenta[] = !MODO_TIENDA
    ? opcionesWeb()
    : ofertas.estado === 'ok'
      ? opcionesTienda(ofertas.lista)
      : []
  const elegida =
    opciones.find((o) => o.id === plan) ??
    opciones.find((o) => o.id === destacado?.id) ??
    opciones[0] ??
    null

  const abrir = async (url: string): Promise<void> => {
    await WebBrowser.openAuthSessionAsync(url, RETORNO)
    await refreshTier()
    setRecargaUso((n) => n + 1)
  }

  const pagar = async (): Promise<void> => {
    setAbriendo(true)
    setError(null)
    setAviso(null)
    try {
      const r = await conTope(
        postJSON<RespuestaCheckout>('/api/pagos/checkout', {
          planId: elegida?.id ?? plan,
        }),
        TOPE_PAGO_MS,
        'sin respuesta'
      )
      if (!r.url) throw new Error('sin url')
      if (r.portal && r.mensaje) toast.toast(r.mensaje)
      await abrir(r.url)
    } catch (e) {
      if (e instanceof BackendError && e.status === 409) await refreshTier()
      setError(mensajePago(e))
    } finally {
      setAbriendo(false)
    }
  }

  const gestionar = async (): Promise<void> => {
    setAbriendo(true)
    setError(null)
    setAviso(null)
    try {
      const r = await conTope(
        postJSON<RespuestaCheckout>('/api/pagos/portal', {}),
        TOPE_PAGO_MS,
        'sin respuesta'
      )
      if (!r.url) throw new Error('sin url')
      await abrir(r.url)
    } catch (e) {
      setError(mensajePago(e))
    } finally {
      setAbriendo(false)
    }
  }

  /** Relee el plan hasta que el servidor lo active (o se acabe la espera). */
  const esperarPlan = async (): Promise<boolean> => {
    const limite = Date.now() + ESPERA_PLAN_MS
    for (;;) {
      if ((await refreshTier()) !== 'free') return true
      if (!montada.current || Date.now() + PAUSA_PLAN_MS > limite) {
        return false
      }
      await esperar(PAUSA_PLAN_MS)
    }
  }

  /** Tras pagar o restaurar en la tienda: esperar el plan del servidor. */
  const trasCompra = async (): Promise<void> => {
    setActivando(true)
    const listo = await esperarPlan()
    if (!montada.current) return
    setActivando(false)
    setRecargaUso((n) => n + 1)
    if (listo) {
      toast.success('¡Listo! Ya tienes Wayio Pro.')
      return
    }
    setAviso(
      'Tu compra se hizo bien. Pro se activará en tu cuenta en unos minutos; si no aparece, toca «Restaurar compras».'
    )
  }

  const comprarEnTienda = async (): Promise<void> => {
    const oferta = elegida?.oferta
    if (!uid || !oferta) return
    setAbriendo(true)
    setError(null)
    setAviso(null)
    try {
      const r = await comprar(uid, oferta.paquete)
      if (r.estado === 'pendiente') {
        setAviso(
          'Tu pago quedó pendiente de aprobación en la tienda. Activaremos Pro en cuanto se apruebe.'
        )
      } else if (r.estado === 'comprada') {
        await trasCompra()
      }
    } catch (e) {
      setError(mensajeTienda(e))
    } finally {
      if (montada.current) setAbriendo(false)
    }
  }

  const restaurarCompras = async (): Promise<void> => {
    if (!uid) return
    setRestaurando(true)
    setError(null)
    setAviso(null)
    try {
      if (await restaurar(uid)) {
        await trasCompra()
      } else {
        await refreshTier()
        toast.toast(
          `No encontramos suscripciones de Wayio Pro en tu cuenta de ${NOMBRE_TIENDA}.`
        )
      }
    } catch (e) {
      setError(mensajeTienda(e))
    } finally {
      if (montada.current) setRestaurando(false)
    }
  }

  /** Con tienda: su gestión; si el plan no es de esta tienda, la web. */
  const gestionarPlan = async (): Promise<void> => {
    if (!MODO_TIENDA || !uid) return gestionar()
    setError(null)
    setAviso(null)
    let abierta = false
    try {
      abierta = await gestionarEnLaTienda(uid)
    } catch {
      abierta = false
    }
    if (abierta) {
      await refreshTier()
      return
    }
    if (webPermitido) return gestionar()
    setAviso(
      `Tu plan no se compró con ${NOMBRE_TIENDA}: lo gestionas en la web de Wayio, en «Cuenta».`
    )
  }

  const abrirLegal = (ruta: 'terminos' | 'privacidad'): void => {
    if (!config.webUrl) return
    WebBrowser.openBrowserAsync(`${config.webUrl}/${ruta}`).catch(
      () => undefined
    )
  }

  const reintentarUso = (): void => {
    setUso({ estado: 'cargando' })
    setRecargaUso((n) => n + 1)
  }

  const reintentarOfertas = (): void => {
    setOfertas({ estado: 'cargando' })
    setRecargaOfertas((n) => n + 1)
  }

  const nombrePlan =
    tier === 'grupo'
      ? NOMBRE_PLAN.pro_grupo
      : tier === 'pro'
        ? 'Pro'
        : NOMBRE_PLAN.free

  // El uso del mes solo tiene sentido con cupo: en Pro (cupos null) no se
  // muestra. Mientras carga o si falla, solo se enseña en Gratis.
  const mostrarUso =
    uso.estado === 'ok'
      ? uso.cupo.cupos !== null
      : uso.estado !== 'sin_sesion' && tier === 'free'
  const fechaRenueva =
    uso.estado === 'ok' && uso.cupo.renueva
      ? formatFecha(uso.cupo.renueva, { diaSemana: false })
      : ''

  const lista = (items: readonly string[]): React.ReactElement[] =>
    items.map((f) => (
      <View key={f} style={styles.feature}>
        <Check size={16} color={colors.success} strokeWidth={2.25} />
        <Txt variant="bodyS" style={styles.flex}>
          {f}
        </Txt>
      </View>
    ))

  const ocupado = abriendo || restaurando || activando

  const selector = (
    <SelectorDePlanes
      opciones={opciones}
      elegido={elegida?.id ?? null}
      onElegir={setPlan}
    />
  )

  /** Venta con la tienda: ofertas, botón de compra y aviso de renovación. */
  const ventaTienda = !uid ? (
    <Callout tone="info" style={styles.bloque}>
      Inicia sesión con tu cuenta de Wayio para comprar Pro: el plan queda
      guardado en tu cuenta y lo tienes también en la web.
    </Callout>
  ) : ofertas.estado === 'cargando' ? (
    <SkeletonRegion label="Cargando los planes de la tienda">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} width="100%" height={72} style={styles.plan} />
      ))}
    </SkeletonRegion>
  ) : ofertas.estado === 'error' || opciones.length === 0 ? (
    <View style={styles.nota}>
      <Txt variant="bodyS" color="fgMuted">
        No pudimos cargar los planes de {NOMBRE_TIENDA}.
      </Txt>
      <Button variant="link" title="Reintentar" onPress={reintentarOfertas} />
    </View>
  ) : (
    <>
      {selector}
      <Button
        title={`Continuar con ${NOMBRE_TIENDA}`}
        icon={CreditCard}
        size="lg"
        fullWidth
        loading={abriendo || activando}
        loadingText={activando ? 'Activando tu plan…' : 'Abriendo la tienda…'}
        disabled={ocupado}
        onPress={() => void comprarEnTienda()}
        style={styles.bloque}
      />
      <Txt variant="caption" color="fgSubtle" style={styles.nota}>
        El pago se carga a tu cuenta de {NOMBRE_TIENDA}. Las suscripciones se
        renuevan solas al mismo precio salvo que las canceles al menos 24 horas
        antes de que termine el periodo, desde las suscripciones de tu cuenta de{' '}
        {NOMBRE_TIENDA}. El Pase Pro de 30 días no se renueva.
      </Txt>
    </>
  )

  return (
    <Pantalla>
      <ScreenHeader title="Planes" kicker="Wayio Pro" />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 40 + insets.bottom },
        ]}
      >
        <View style={styles.fila}>
          <Txt variant="overline" color="fgMuted">
            Tu plan
          </Txt>
          <Badge
            label={nombrePlan}
            variant={tier === 'free' ? 'default' : 'laton'}
          />
        </View>
        <Txt variant="displayL" style={styles.h1}>
          Viaja con todo{' '}
          <Txt variant="displayL" italic color="primary">
            resuelto
          </Txt>
        </Txt>
        <Txt variant="body" color="fgMuted" style={styles.lead}>
          Con Gratis planificas tus viajes con un cupo de IA cada mes. Pro quita
          esos límites y suma las alertas de demora y el reagendar con IA.
        </Txt>

        {error ? (
          <Callout tone="danger" style={styles.bloque}>
            {error}
          </Callout>
        ) : null}

        {aviso ? (
          <Callout tone="info" style={styles.bloque}>
            {aviso}
          </Callout>
        ) : null}

        {tier !== 'free' ? (
          <Callout
            tone="success"
            title={`Tienes Wayio ${nombrePlan}`}
            style={styles.bloque}
          >
            Gracias por viajar con nosotros. Puedes cambiar o cancelar tu plan
            desde la gestión de la suscripción.
          </Callout>
        ) : null}

        {mostrarUso ? (
          <Card style={styles.bloque}>
            <CardKicker icon={CalendarDays}>Tu uso este mes</CardKicker>
            {uso.estado === 'ok' && uso.cupo.cupos ? (
              <>
                {ACCIONES_CON_CUPO.map((accion) => {
                  const fila = uso.cupo.cupos?.[accion]
                  return fila ? (
                    <FilaUso
                      key={accion}
                      etiqueta={ETIQUETA_USO[accion]}
                      uso={fila}
                    />
                  ) : null
                })}
                <Txt variant="caption" color="fgMuted" style={styles.nota}>
                  {fechaRenueva
                    ? `Se renuevan el ${fechaRenueva} a las 00:00 (hora de RD).`
                    : RENOVACION_CUPO}
                </Txt>
                {uso.cupo.aproximado ? (
                  <Txt variant="caption" color="fgSubtle" style={styles.nota}>
                    No pudimos leer tu uso exacto de este mes: las cifras pueden
                    no estar al día.
                  </Txt>
                ) : null}
              </>
            ) : uso.estado === 'error' ? (
              <View style={styles.nota}>
                <Txt variant="bodyS" color="fgMuted">
                  No pudimos cargar tu uso del mes.
                </Txt>
                <Button
                  variant="link"
                  title="Reintentar"
                  onPress={reintentarUso}
                />
              </View>
            ) : (
              <SkeletonRegion label="Cargando tu uso del mes">
                {ACCIONES_CON_CUPO.map((accion) => (
                  <View key={accion} style={styles.uso}>
                    <Skeleton width="45%" height={14} />
                    <Skeleton width="100%" height={6} style={styles.nota} />
                  </View>
                ))}
              </SkeletonRegion>
            )}
          </Card>
        ) : null}

        <Card style={styles.bloque}>
          <CardKicker>{NOMBRE_PLAN.free} · con tu cuenta</CardKicker>
          {lista(FREE_FEATURES)}
          <Txt variant="caption" color="fgMuted" style={styles.nota}>
            {RENOVACION_CUPO}
          </Txt>
        </Card>

        <Card variant="nota" style={styles.bloque}>
          <CardKicker color="brassText">
            Pro: todo lo de Gratis y además
          </CardKicker>
          {lista(PRO_FEATURES)}
          <Txt variant="caption" color="fgMuted" style={styles.nota}>
            {NOTA_USO_JUSTO}
          </Txt>
        </Card>

        {tier === 'free' ? (
          <>
            <Txt variant="h2" style={styles.seccion}>
              Elige tu plan
            </Txt>
            {MODO_TIENDA ? (
              ventaTienda
            ) : (
              <>
                {selector}
                <Button
                  title="Continuar al pago"
                  icon={CreditCard}
                  size="lg"
                  fullWidth
                  loading={abriendo}
                  loadingText="Abriendo el pago…"
                  onPress={() => void pagar()}
                  style={styles.bloque}
                />
                <Txt
                  variant="caption"
                  color="fgSubtle"
                  center
                  style={styles.nota}
                >
                  El pago se procesa en una ventana segura. Según tu país,
                  pueden sumarse impuestos locales.
                </Txt>
              </>
            )}
            {MODO_TIENDA && uid ? (
              <Button
                variant="link"
                title="Restaurar compras"
                icon={RefreshCw}
                loading={restaurando}
                loadingText="Buscando tus compras…"
                disabled={ocupado}
                onPress={() => void restaurarCompras()}
                style={styles.nota}
              />
            ) : null}
            {MODO_TIENDA && uid && webPermitido ? (
              <Button
                variant="outline"
                title="Pagar en la web de Wayio"
                iconEnd={ExternalLink}
                fullWidth
                disabled={ocupado}
                onPress={() => void pagar()}
                style={styles.bloque}
              />
            ) : null}
          </>
        ) : (
          <Button
            title="Gestionar suscripción"
            variant="outline"
            iconEnd={ExternalLink}
            size="lg"
            fullWidth
            loading={abriendo}
            loadingText="Abriendo…"
            onPress={() => void gestionarPlan()}
            style={styles.bloque}
          />
        )}

        {MODO_TIENDA && config.webUrl ? (
          <View style={styles.legales}>
            <Button
              variant="link"
              title="Términos de uso"
              onPress={() => abrirLegal('terminos')}
            />
            <Button
              variant="link"
              title="Privacidad"
              onPress={() => abrirLegal('privacidad')}
            />
          </View>
        ) : null}
      </ScrollView>
    </Pantalla>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    flex: { flex: 1 },
    scroll: { paddingHorizontal: 16, paddingTop: 16 },
    fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    h1: { marginTop: 12 },
    lead: { marginTop: 10 },
    bloque: { marginTop: 16 },
    seccion: { marginTop: 32, marginBottom: 4 },
    feature: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginTop: 10,
    },
    uso: { marginTop: 14 },
    usoFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pista: {
      height: 6,
      borderRadius: t.radius.pill,
      overflow: 'hidden',
      marginTop: 8,
    },
    relleno: { height: '100%', borderRadius: t.radius.pill },
    plan: { marginTop: 10 },
    planFila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    precio: { alignItems: 'flex-end' },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ahorro: { marginTop: 10, marginLeft: 34 },
    nota: { marginTop: 10 },
    legales: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 20,
      marginTop: 16,
    },
  })
