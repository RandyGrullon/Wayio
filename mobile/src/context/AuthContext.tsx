import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { Linking } from 'react-native'
import type { EmailOtpType, Session, User } from '@supabase/supabase-js'
import { config } from '../config'
import { getSupabase } from '../lib/supabase/client'
import { limpiarModoEnVivo } from '../tasks/limpiar'
import type { PlanTier } from '../types/planning'

/**
 * Deep link al que vuelven los correos de auth pedidos desde la app. Debe
 * estar en las Redirect URLs de Supabase (wayio://**). La web hace de puente:
 * /auth/confirm → /auth/abrir-app → wayio://auth/callback?token_hash=...
 */
export const AUTH_CALLBACK_URL = 'wayio://auth/callback'

/** ¿Están las variables de Supabase de la app? Sin ellas no hay login. */
const SUPABASE_CONFIGURADO = Boolean(
  config.supabaseUrl && config.supabaseAnonKey
)

if (__DEV__ && !SUPABASE_CONFIGURADO) {
  // Aviso solo para desarrolladores: al usuario se le muestra un mensaje amable.
  // eslint-disable-next-line no-console
  console.warn(
    '[Wayio] Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY: el login queda desactivado.'
  )
}

const PASSWORD_MIN = 8

const MENSAJE_NO_CONFIGURADO =
  'Esta versión de Wayio todavía no puede iniciar sesión. Inténtalo más tarde.'
const MENSAJE_ENLACE =
  'El enlace no es válido o ya caducó. Inicia sesión con tu contraseña o pide un enlace nuevo.'
const MENSAJE_LIMITE =
  'Hiciste demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.'
const MENSAJE_GENERICO = 'Algo salió mal. Inténtalo de nuevo en unos minutos.'
const MENSAJE_ENVIO_FALLIDO =
  'No pudimos enviar el correo ahora mismo. Revisa tu conexión e inténtalo de nuevo.'

const TIPOS_OTP: readonly string[] = [
  'email',
  'signup',
  'magiclink',
  'recovery',
  'invite',
  'email_change',
]

export interface AuthActionResult {
  /** Mensaje de error apto para el usuario, o null si salió bien. */
  error: string | null
  /** Mensaje informativo cuando salió bien (p. ej. "Revisa tu email"). */
  message?: string
}

interface AuthContextValue {
  user: User | null
  session: Session | null
  tier: PlanTier
  loading: boolean
  /** false si faltan las variables de Supabase: mostrar "configuración incompleta". */
  configured: boolean
  /** Error al abrir un enlace de email en la app (caducado, ya usado...). */
  authLinkError: string | null
  clearAuthLinkError: () => void
  signIn: (email: string, password: string) => Promise<AuthActionResult>
  signUp: (
    email: string,
    password: string,
    nombre: string
  ) => Promise<AuthActionResult>
  /** "Olvidé mi contraseña": respuesta siempre genérica (no revela si existe). */
  resetPassword: (email: string) => Promise<AuthActionResult>
  /** Vuelve a leer el plan (p. ej. al volver del pago). */
  refreshTier: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface ErrorLike {
  code?: string | undefined
  message?: string | undefined
  status?: number | undefined
}

function traducirError(error: ErrorLike): string {
  const code = error.code ?? ''
  const msg = (error.message ?? '').toLowerCase()
  if (
    code === 'invalid_credentials' ||
    msg.includes('invalid login credentials')
  ) {
    return 'El email o la contraseña no son correctos.'
  }
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
    return 'Todavía no confirmaste tu email. Revisa tu bandeja de entrada (y la carpeta de spam).'
  }
  if (code === 'user_already_exists' || code === 'email_exists') {
    return 'Ya existe una cuenta con ese email. Inicia sesión o recupera tu contraseña.'
  }
  if (code === 'weak_password') {
    return 'Esa contraseña es fácil de adivinar. Prueba con una más larga o que mezcle letras, números y símbolos.'
  }
  if (code === 'email_address_invalid' || code === 'validation_failed') {
    return 'Revisa que el email esté bien escrito.'
  }
  if (
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit' ||
    error.status === 429
  ) {
    return MENSAJE_LIMITE
  }
  if (code === 'signup_disabled' || code === 'email_provider_disabled') {
    return 'Esta forma de acceso no está disponible en este momento.'
  }
  return MENSAJE_GENERICO
}

function emailValido(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function decodificar(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '))
  } catch {
    return s
  }
}

/** Parámetros de la query y del fragmento (#access_token=...) de un enlace. */
function leerParametros(url: string): Record<string, string> {
  const out: Record<string, string> = {}
  const iHash = url.indexOf('#')
  const base = iHash >= 0 ? url.slice(0, iHash) : url
  const hash = iHash >= 0 ? url.slice(iHash + 1) : ''
  const iQuery = base.indexOf('?')
  const query = iQuery >= 0 ? base.slice(iQuery + 1) : ''
  for (const parte of [query, hash]) {
    for (const par of parte.split('&')) {
      if (!par) continue
      const eq = par.indexOf('=')
      const clave = decodificar(eq >= 0 ? par.slice(0, eq) : par)
      if (clave) out[clave] = decodificar(eq >= 0 ? par.slice(eq + 1) : '')
    }
  }
  return out
}

/** ¿Es el deep link de auth de la app (wayio://auth/callback...)? */
function esCallbackDeAuth(url: string): boolean {
  return /^wayio:\/\/\/?auth\/callback(?:[/?#]|$)/i.test(url)
}

function esTier(v: unknown): v is PlanTier {
  return v === 'free' || v === 'pro' || v === 'grupo'
}

interface FilaSuscripcion {
  tier: unknown
  status: unknown
  stripe_subscription_id: unknown
  current_period_end: unknown
}

/**
 * Misma regla que la RPC my_effective_tier (y `tierEfectivo` de la web):
 * - suscripción recurrente (con stripe_subscription_id): manda Stripe;
 *   active, trialing y past_due (gracia mientras reintenta el cobro) dan
 *   acceso;
 * - pago único («Pase Pro de 30 días») o concedido a mano: además caduca al
 *   llegar current_period_end.
 */
function tierDeFila(fila: FilaSuscripcion | null): PlanTier {
  if (!fila || !esTier(fila.tier)) return 'free'
  const conAcceso =
    fila.status === 'active' ||
    fila.status === 'trialing' ||
    fila.status === 'past_due'
  if (!conAcceso) return 'free'
  if (fila.stripe_subscription_id) return fila.tier
  if (typeof fila.current_period_end !== 'string') return fila.tier
  const fin = Date.parse(fila.current_period_end)
  return Number.isFinite(fin) && fin > Date.now() ? fila.tier : 'free'
}

/**
 * Plan efectivo del usuario con la sesión actual: la RPC my_effective_tier
 * de la BD (como usePro de la web). Si la RPC falla, se aplica la misma regla
 * sobre su fila de subscriptions (la RLS deja leerla al propio usuario).
 * null = no se pudo saber (sin red, Supabase caído…). Solo sirve para la UI:
 * el servidor decide siempre con su propio cálculo.
 */
async function leerTier(uid: string): Promise<PlanTier | null> {
  const supabase = getSupabase()
  try {
    const { data, error } = await supabase.rpc('my_effective_tier')
    if (!error && esTier(data)) return data
  } catch {
    // Se intenta con la fila.
  }
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('tier, status, stripe_subscription_id, current_period_end')
      .eq('user_id', uid)
      .maybeSingle()
    if (error) return null
    return tierDeFila((data as FilaSuscripcion | null) ?? null)
  } catch {
    return null
  }
}

export function AuthProvider({
  children,
}: {
  children: ReactNode
}): React.ReactElement {
  const configured = SUPABASE_CONFIGURADO
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [tier, setTier] = useState<PlanTier>('free')
  // Sin configuración no hay nada que cargar: se muestra el aviso al momento.
  const [loading, setLoading] = useState(configured)
  const [authLinkError, setAuthLinkError] = useState<string | null>(null)
  const enlacesProcesados = useRef(new Set<string>())
  /** Último plan leído y de qué usuario (respaldo si la lectura falla). */
  const tierConocido = useRef<{ uid: string; tier: PlanTier } | null>(null)
  /** Lectura vigente: una respuesta vieja no pisa a una más nueva. */
  const lecturaTier = useRef(0)

  const loadTier = useCallback(
    async (uid: string | null) => {
      const lectura = ++lecturaTier.current
      if (!uid || !configured) {
        tierConocido.current = null
        setTier('free')
        return
      }
      const leido = await leerTier(uid)
      if (lectura !== lecturaTier.current) return
      if (leido !== null) {
        tierConocido.current = { uid, tier: leido }
        setTier(leido)
        return
      }
      // No se pudo leer (sin red…): se conserva el último plan conocido de
      // ESTE usuario para no quitarle Pro a quien paga por un fallo pasajero;
      // si no hay ninguno, Gratis. El servidor decide igual en cada llamada.
      const previo = tierConocido.current
      setTier(previo && previo.uid === uid ? previo.tier : 'free')
    },
    [configured]
  )

  /** Inicia sesión con el enlace de un correo abierto en la app. */
  const procesarEnlace = useCallback(
    async (url: string | null): Promise<void> => {
      if (!url || !configured || !esCallbackDeAuth(url)) return
      // Los tokens son de un solo uso: no reprocesar el mismo enlace.
      if (enlacesProcesados.current.has(url)) return
      enlacesProcesados.current.add(url)

      const p = leerParametros(url)
      const supabase = getSupabase()
      try {
        if (p['error'] || p['error_code'] || p['error_description']) {
          setAuthLinkError(MENSAJE_ENLACE)
          return
        }
        const tokenHash = p['token_hash']
        const tipo = p['type']
        if (tokenHash && tipo && TIPOS_OTP.includes(tipo)) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: tipo as EmailOtpType,
          })
          if (error) setAuthLinkError(MENSAJE_ENLACE)
          return
        }
        const code = p['code']
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) setAuthLinkError(MENSAJE_ENLACE)
          return
        }
        const accessToken = p['access_token']
        const refreshToken = p['refresh_token']
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) setAuthLinkError(MENSAJE_ENLACE)
        }
      } catch {
        setAuthLinkError(MENSAJE_ENLACE)
      }
    },
    [configured]
  )

  useEffect(() => {
    if (!configured) return
    const supabase = getSupabase()

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      void loadTier(data.session?.user.id ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      if (newSession) setAuthLinkError(null)
      void loadTier(newSession?.user.id ?? null)
    })

    // Enlaces de email: app cerrada (URL inicial) o en segundo plano (evento).
    void Linking.getInitialURL().then((url) => procesarEnlace(url))
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      void procesarEnlace(url)
    })

    return () => {
      subscription.unsubscribe()
      linkSub.remove()
    }
  }, [configured, loadTier, procesarEnlace])

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      if (!configured) return { error: MENSAJE_NO_CONFIGURADO }
      const correo = email.trim().toLowerCase()
      if (!emailValido(correo)) return { error: 'Escribe un email válido.' }
      if (!password) return { error: 'Escribe tu contraseña.' }
      const { error } = await getSupabase().auth.signInWithPassword({
        email: correo,
        password,
      })
      return { error: error ? traducirError(error) : null }
    },
    [configured]
  )

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      nombre: string
    ): Promise<AuthActionResult> => {
      if (!configured) return { error: MENSAJE_NO_CONFIGURADO }
      const nombreLimpio = nombre.trim()
      if (!nombreLimpio) return { error: 'Escribe tu nombre.' }
      const correo = email.trim().toLowerCase()
      if (!emailValido(correo)) return { error: 'Escribe un email válido.' }
      if (password.length < PASSWORD_MIN) {
        return {
          error: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`,
        }
      }
      const { data, error } = await getSupabase().auth.signUp({
        email: correo,
        password,
        options: {
          data: { full_name: nombreLimpio },
          emailRedirectTo: AUTH_CALLBACK_URL,
        },
      })
      if (error) return { error: traducirError(error) }
      // Si el proyecto no exige confirmar el email, la sesión ya está creada.
      if (data.session) return { error: null }
      return {
        error: null,
        message:
          'Cuenta creada. Te enviamos un correo: ábrelo en este teléfono para entrar directo a la app.',
      }
    },
    [configured]
  )

  const resetPassword = useCallback(
    async (email: string): Promise<AuthActionResult> => {
      if (!configured) return { error: MENSAJE_NO_CONFIGURADO }
      const correo = email.trim().toLowerCase()
      if (!emailValido(correo)) return { error: 'Escribe un email válido.' }
      // La contraseña nueva se elige en la web (/auth/nueva-clave): funciona
      // en cualquier dispositivo. Después se vuelve a la app a iniciar sesión.
      const { error } = await getSupabase().auth.resetPasswordForEmail(
        correo,
        config.webUrl
          ? {
              redirectTo: `${config.webUrl}/auth/confirm?next=${encodeURIComponent('/auth/nueva-clave')}`,
            }
          : {}
      )
      // Solo avisamos de fallos de red/servidor; el resto se responde igual
      // para no revelar si el email tiene cuenta. Sin red, Supabase devuelve
      // status 0.
      if (error && (!error.status || error.status >= 500)) {
        return { error: MENSAJE_ENVIO_FALLIDO }
      }
      return {
        error: null,
        message:
          'Si existe una cuenta con ese email, te enviamos un enlace para crear una contraseña nueva. Después vuelve aquí para iniciar sesión.',
      }
    },
    [configured]
  )

  const refreshTier = useCallback(
    () => loadTier(user?.id ?? null),
    [loadTier, user]
  )

  const signOut = useCallback(async () => {
    setAuthLinkError(null)
    // Al salir de la cuenta se para el rastreo en segundo plano y se borran
    // las claves wayio:* del modo en vivo (viaje activo, copias del viaje,
    // cola de sync, avisos enviados…). Nunca lanza.
    await limpiarModoEnVivo()
    if (!configured) return
    await getSupabase().auth.signOut()
  }, [configured])

  const clearAuthLinkError = useCallback(() => setAuthLinkError(null), [])

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        tier,
        loading,
        configured,
        authLinkError,
        clearAuthLinkError,
        signIn,
        signUp,
        resetPassword,
        refreshTier,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
