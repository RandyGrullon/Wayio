import { useState } from 'react'
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
  Txt,
  useToast,
} from '../components/ui'
import { Check, CreditCard, ExternalLink } from '../components/ui/iconos'
import { formatCurrency } from '../components/ui/formato'
import { useAuth } from '../context/AuthContext'
import { BackendError, postJSON } from '../lib/api/http'
import { conTope } from '../components/ui/conTope'
import { PLANS, PRO_FEATURES, GROUP_FEATURES } from '../constants/pricing'
import { useEstilos, useTheme, type Tema } from '../theme'

interface RespuestaCheckout {
  url?: string
  portal?: boolean
  mensaje?: string
}

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

/**
 * Planes (M05): POST /api/stripe/checkout con el Bearer de la sesión y
 * Stripe en el navegador seguro de la app; al volver se relee el plan
 * (`refreshTier`). Con plan activo, «Gestionar suscripción» abre el portal.
 */
export function PaywallScreen(): React.ReactElement {
  const { tier, refreshTier } = useAuth()
  const toast = useToast()
  const { colors } = useTheme()
  const styles = useEstilos(crearEstilos)
  const insets = useSafeAreaInsets()
  const destacado = PLANS.find((p) => p.destacado) ?? PLANS[0]
  const [plan, setPlan] = useState<string>(destacado?.id ?? 'pro_mensual')
  const [abriendo, setAbriendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abrir = async (url: string): Promise<void> => {
    await WebBrowser.openAuthSessionAsync(url, RETORNO)
    await refreshTier()
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

  const nombrePlan =
    tier === 'grupo' ? 'Pro Grupo' : tier === 'pro' ? 'Pro' : 'Gratis'

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
          Alertas con IA, reagendar lo que te pierdas, modo sin conexión y la
          sala del grupo sin límites.
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

        <Card variant="nota" style={styles.bloque}>
          <CardKicker color="brassText">Pro Viajero</CardKicker>
          {PRO_FEATURES.map((f) => (
            <View key={f} style={styles.feature}>
              <Check size={16} color={colors.success} strokeWidth={2.25} />
              <Txt variant="bodyS" style={styles.flex}>
                {f}
              </Txt>
            </View>
          ))}
        </Card>
        <Card style={styles.bloque}>
          <CardKicker>Pro Grupo, además</CardKicker>
          {GROUP_FEATURES.map((f) => (
            <View key={f} style={styles.feature}>
              <Check size={16} color={colors.success} strokeWidth={2.25} />
              <Txt variant="bodyS" style={styles.flex}>
                {f}
              </Txt>
            </View>
          ))}
        </Card>

        {tier === 'free' ? (
          <>
            <Txt variant="h2" style={styles.seccion}>
              Elige tu plan
            </Txt>
            <View accessibilityRole="radiogroup" accessibilityLabel="Planes">
              {PLANS.map((p) => {
                const sel = p.id === plan
                return (
                  <Card
                    key={p.id}
                    variant={sel ? 'selected' : 'default'}
                    onPress={() => setPlan(p.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: sel }}
                    accessibilityLabel={`${p.nombre}, ${formatCurrency(p.precio, 'USD', { decimales: true })}, ${p.periodo}`}
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
                          {/* El ahorro ya va en su sello: no se repite aquí. */}
                          {p.periodo.replace(/\s*·\s*ahorra.*$/i, '')}
                        </Txt>
                      </View>
                      <Txt variant="title" tnum>
                        {formatCurrency(p.precio, 'USD', { decimales: true })}
                      </Txt>
                    </View>
                    {p.id === 'pro_anual' ? (
                      <Badge
                        label="Ahorra 40 % frente al mensual"
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

const crearEstilos = (_t: Tema) =>
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
    plan: { marginTop: 10 },
    planFila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
