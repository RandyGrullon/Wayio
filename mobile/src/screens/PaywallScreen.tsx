import { useEffect, useState } from 'react'
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
} from '../components/ui/iconos'
import { formatCurrency, formatFecha } from '../components/ui/formato'
import { useAuth } from '../context/AuthContext'
import { BackendError, postJSON } from '../lib/api/http'
import { getCupo, type CupoDelMes, type UsoCupo } from '../lib/api/backend'
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

/** Vuelta a la app tras el pago (el navegador seguro se cierra al volver). */
const RETORNO = 'wayio://pago'

/** Sin respuesta del backend en este tiempo, se deja de esperar. */
const TOPE_PAGO_MS = 30_000

/** Mensaje amable de un error de Stripe (nunca el código técnico). */
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

/**
 * Planes (M05): Gratis con sus cupos del mes y lo que Pro añade de verdad,
 * con el uso del mes de la cuenta (GET /api/cupo). El cobro va por POST
 * /api/stripe/checkout con el Bearer de la sesión y Stripe en el navegador
 * seguro de la app; al volver se relee el plan (`refreshTier`) y el uso. Con
 * plan activo, «Gestionar suscripción» abre el portal. Pro Grupo no se vende
 * (quien ya lo tiene lo sigue viendo como su plan).
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
  const [error, setError] = useState<string | null>(null)
  const uid = user?.id ?? null
  const [uso, setUso] = useState<EstadoUso>(() =>
    uid ? { estado: 'cargando' } : { estado: 'sin_sesion' }
  )
  /** Sube para volver a pedir el uso (reintentar o al volver del pago). */
  const [recargaUso, setRecargaUso] = useState(0)

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

  const abrir = async (url: string): Promise<void> => {
    await WebBrowser.openAuthSessionAsync(url, RETORNO)
    await refreshTier()
    setRecargaUso((n) => n + 1)
  }

  const pagar = async (): Promise<void> => {
    setAbriendo(true)
    setError(null)
    try {
      const r = await conTope(
        postJSON<RespuestaCheckout>('/api/stripe/checkout', { planId: plan }),
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
    try {
      const r = await conTope(
        postJSON<RespuestaCheckout>('/api/stripe/portal', {}),
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

  const reintentarUso = (): void => {
    setUso({ estado: 'cargando' })
    setRecargaUso((n) => n + 1)
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
            <View accessibilityRole="radiogroup" accessibilityLabel="Planes">
              {PLANS.map((p) => {
                const sel = p.id === plan
                const precio = formatCurrency(p.precio, 'USD', {
                  decimales: true,
                })
                return (
                  <Card
                    key={p.id}
                    variant={sel ? 'selected' : 'default'}
                    onPress={() => setPlan(p.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: sel }}
                    accessibilityLabel={`${p.nombre}, ${precio} ${p.periodo}. ${p.detalle}`}
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
                          <Check
                            size={14}
                            color={colors.fgInverse}
                            strokeWidth={2.5}
                          />
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
                          {precio}
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
            <Txt variant="caption" color="fgSubtle" center style={styles.nota}>
              El pago se procesa con Stripe en una ventana segura.
            </Txt>
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
            onPress={() => void gestionar()}
            style={styles.bloque}
          />
        )}
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
  })
