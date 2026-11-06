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
import * as WebBrowser from 'expo-web-browser'
import type { EmailOtpType, Session, User } from '@supabase/supabase-js'
import { config } from '../config'
import { sincronizarUsuarioTienda } from '../lib/compras/tienda'
import { getSupabase } from '../lib/supabase/client'
import { limpiarModoEnVivo } from '../tasks/limpiar'
import type { PlanTier } from '../types/planning'

/**
 * Deep link al que vuelven los correos de auth pedidos desde la app (registro
 * y enlace mágico) y el inicio de sesión con Google. Debe estar en las
 * Redirect URLs de Supabase (wayio://**). En los correos la web hace de
 * puente: /auth/confirm → /auth/abrir-app → wayio://auth/callback?token_hash=...
 * Google vuelve directo de Supabase con el code de PKCE:
 * wayio://auth/callback?code=... (ver lib/supabase/client.ts).
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
const MENSAJE_GOOGLE =
  'No se pudo completar el inicio de sesión con Google. Si lo cancelaste, puedes intentarlo de nuevo.'
const MENSAJE_MAGIC_ENVIADO =
  'Si tu email está registrado, te enviamos un enlace para entrar sin contraseña. Ábrelo en este teléfono para entrar directo a la app (revisa también la carpeta de spam).'

/**
 * Tipos de enlace que la web pasa a la app (/auth/confirm → /auth/abrir-app).
 * Recuperación e invitación terminan siempre en la web eligiendo contraseña:
 * la app no los acepta.
 */
const TIPOS_OTP: readonly string[] = [
  'email',
  'signup',
  'magiclink',
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
  /**
   * Entrar con Google en el navegador seguro de la app. Si la persona cierra
   * el navegador devuelve `{ error: null }` sin mensaje; al entrar, la sesión
   * llega por onAuthStateChange.
   */
  signInWithGoogle: () => Promise<AuthActionResult>
  /** Enlace mágico para cuentas ya registradas (respuesta siempre genérica). */
  sendMagicLink: (email: string) => Promise<AuthActionResult>
  /** Vuelve a leer el plan (p. ej. al volver del pago) y lo devuelve. */
  refreshTier: () => Promise<PlanTier>
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

/** 'ignorado' = no era un enlace de auth o no traía nada que canjear. */
type ResultadoEnlace = 'ok' | 'error' | 'ignorado'

/**
 * Crea la sesión con lo que traiga el enlace: token_hash de un correo
 * (verifyOtp, sirve aunque se pidiera en otro dispositivo) o `code` de PKCE
 * (exchangeCodeForSession: solo vale con el verificador que guardó ESTE
 * cliente al empezar, así que un code ajeno o robado no sirve). Nunca se
 * aceptan tokens sueltos en el enlace (#access_token=…): cualquiera podría
 * mandarlos. Nunca lanza.
 */
async function canjearEnSupabase(url: string): Promise<ResultadoEnlace> {
  const p = leerParametros(url)
  try {
    const supabase = getSupabase()
    if (p['error'] || p['error_code'] || p['error_description']) {
      return 'error'
    }
    const tokenHash = p['token_hash']
    const tipo = p['type']
    if (tokenHash && tipo && TIPOS_OTP.includes(tipo)) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: tipo as EmailOtpType,
      })
      return error ? 'error' : 'ok'
    }
    const code = p['code']
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      return error ? 'error' : 'ok'
    }
    return 'ignorado'
  } catch {
    return 'error'
  }
}

/** ¿Ya hay una sesión guardada en el teléfono? (lee el almacenamiento). */
async function haySesion(): Promise<boolean> {
  try {
    const { data } = await getSupabase().auth.getSession()
    return data.session !== null
  } catch {
    return false
  }
}

/**
 * El enlace inicial (app abierta en frío desde un enlace) se procesa UNA vez
 * por arranque: si el árbol se vuelve a montar (p. ej. «Reintentar» de la
 * pantalla de error) getInitialURL devuelve el mismo enlace.
 */
let enlaceInicialLeido = false

function esTier(v: unknown): v is PlanTier {
  return v === 'free' || v === 'pro' || v === 'grupo'
}

interface FilaSuscripcion {
  tier: unknown
  status: unknown
  stripe_subscription_id: unknown
  current_period_end: unknown
  source?: unknown
}

/** Margen tras el fin del periodo en las compras de la tienda (3 h). */
const GRACIA_TIENDA_MS = 3 * 3_600_000

/**
 * Misma regla que la RPC my_effective_tier (y `tierEfectivo` de la web):
 * - active, trialing y past_due (gracia mientras se reintenta el cobro) dan
 *   acceso;
 * - compra de la tienda (source app_store / play_store): hasta
 *   current_period_end + 3 h (lo escribe el webhook de RevenueCat);
 * - suscripción recurrente web (con stripe_subscription_id, que guarda el id
 *   del proveedor de cobro: Creem o Stripe): manda el proveedor;
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
  if (fila.source === 'app_store' || fila.source === 'play_store') {
    const fin =
      typeof fila.current_period_end === 'string'
        ? Date.parse(fila.current_period_end)
        : Number.NaN
    return Number.isFinite(fin) && fin + GRACIA_TIENDA_MS > Date.now()
      ? fila.tier
      : 'free'
  }
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
      .select('*')
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
  /** Enlaces de auth ya canjeados (o en curso) y su resultado. */
  const enlacesProcesados = useRef(new Map<string, Promise<ResultadoEnlace>>())
  /** Hay un inicio de sesión con Google abierto en el navegador. */
  const googleEnCurso = useRef(false)
  /**
   * Última cuenta con sesión en este arranque (no se borra al perder la
   * sesión): si entra OTRA, se limpia el modo en vivo de la anterior.
   */
  const ultimoUid = useRef<string | null>(null)
  /** Último plan leído y de qué usuario (respaldo si la lectura falla). */
  const tierConocido = useRef<{ uid: string; tier: PlanTier } | null>(null)
  /** Lectura vigente: una respuesta vieja no pisa a una más nueva. */
  const lecturaTier = useRef(0)

  const loadTier = useCallback(
    async (uid: string | null): Promise<PlanTier> => {
      const lectura = ++lecturaTier.current
      if (!uid || !configured) {
        tierConocido.current = null
        setTier('free')
        return 'free'
      }
      const leido = await leerTier(uid)
      if (lectura !== lecturaTier.current) {
        return leido ?? tierConocido.current?.tier ?? 'free'
      }
      if (leido !== null) {
        tierConocido.current = { uid, tier: leido }
        setTier(leido)
        return leido
      }
      // No se pudo leer (sin red…): se conserva el último plan conocido de
      // ESTE usuario para no quitarle Pro a quien paga por un fallo pasajero;
      // si no hay ninguno, Gratis. El servidor decide igual en cada llamada.
      const previo = tierConocido.current
      const respaldo = previo && previo.uid === uid ? previo.tier : 'free'
      setTier(respaldo)
      return respaldo
    },
    [configured]
  )

  /**
   * Canjea un enlace de auth (correo o vuelta de Google) UNA sola vez: los
   * tokens son de un solo uso. En Android la vuelta de Google llega a la vez
   * por el evento de Linking y por openAuthSessionAsync; los dos esperan la
   * misma promesa.
   */
  const canjearEnlace = useCallback(
    (url: string | null): Promise<ResultadoEnlace> => {
      if (!url || !configured || !esCallbackDeAuth(url)) {
        return Promise.resolve('ignorado')
      }
      const previo = enlacesProcesados.current.get(url)
      if (previo) return previo
      const tarea = canjearEnSupabase(url)
      enlacesProcesados.current.set(url, tarea)
      return tarea
    },
    [configured]
  )

  /** Inicia sesión con el enlace de un correo abierto en la app. */
  const procesarEnlace = useCallback(
    async (url: string | null): Promise<void> => {
      if (!url || !configured || !esCallbackDeAuth(url)) return
      // Con una sesión abierta, un enlace que llegue por Linking nunca cambia
      // de cuenta en silencio (podría ser de otra persona). La vuelta de
      // Google solo existe sin sesión (se pide desde AuthScreen).
      if (!googleEnCurso.current && (await haySesion())) return
      const r = await canjearEnlace(url)
      // Durante el inicio con Google el error lo muestra signInWithGoogle.
      if (r === 'error' && !googleEnCurso.current) {
        setAuthLinkError(MENSAJE_ENLACE)
      }
    },
    [canjearEnlace, configured]
  )

  useEffect(() => {
    if (!configured) return
    const supabase = getSupabase()

    void supabase.auth.getSession().then(({ data }) => {
      const uidGuardado = data.session?.user.id ?? null
      if (uidGuardado && !ultimoUid.current) ultimoUid.current = uidGuardado
      setSession(data.session)
      setUser(data.session?.user ?? null)
      void loadTier(uidGuardado)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      const nuevoUid = newSession?.user.id ?? null
      if (nuevoUid) {
        // Otra cuenta sin pasar por signOut (o tras caducar la sesión de la
        // anterior): se para el rastreo y se borra la cola wayio:pendingSync
        // y las copias del viaje de la cuenta anterior ANTES de que la app
        // use la sesión nueva, para no subirlas con ella. Nunca lanza y no
        // llama a Supabase (no bloquea el cliente de auth).
        const anterior = ultimoUid.current
        ultimoUid.current = nuevoUid
        if (anterior && anterior !== nuevoUid) await limpiarModoEnVivo()
      }
      setSession(newSession)
      setUser(newSession?.user ?? null)
      if (newSession) setAuthLinkError(null)
      void loadTier(nuevoUid)
    })

    // Enlaces de email: app cerrada (URL inicial, una vez por arranque) o en
    // segundo plano (evento).
    if (!enlaceInicialLeido) {
      enlaceInicialLeido = true
      void Linking.getInitialURL()
        .then((url) => procesarEnlace(url))
        .catch(() => undefined)
    }
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

  const signInWithGoogle = useCallback(async (): Promise<AuthActionResult> => {
    if (!configured) return { error: MENSAJE_NO_CONFIGURADO }
    if (googleEnCurso.current) return { error: null }
    googleEnCurso.current = true
    try {
      // Como la web (signInWithGoogle): Google → Supabase → vuelta. Aquí la
      // vuelta es el deep link de la app, que captura el navegador seguro.
      const { data, error } = await getSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: AUTH_CALLBACK_URL, skipBrowserRedirect: true },
      })
      if (error || !data.url) {
        return { error: error ? traducirError(error) : MENSAJE_GOOGLE }
      }
      const r = await WebBrowser.openAuthSessionAsync(
        data.url,
        AUTH_CALLBACK_URL
      )
      // Cerró el navegador o volvió sin terminar: sin mensaje (si el deep
      // link llega igual por Linking, la sesión se crea con procesarEnlace).
      if (r.type !== 'success') return { error: null }
      const canje = await canjearEnlace(r.url)
      return { error: canje === 'ok' ? null : MENSAJE_GOOGLE }
    } catch {
      return { error: MENSAJE_GOOGLE }
    } finally {
      googleEnCurso.current = false
    }
  }, [configured, canjearEnlace])

  const sendMagicLink = useCallback(
    async (email: string): Promise<AuthActionResult> => {
      if (!configured) return { error: MENSAJE_NO_CONFIGURADO }
      const correo = email.trim().toLowerCase()
      if (!emailValido(correo)) return { error: 'Escribe un email válido.' }
      // Plantilla magic_link: /auth/confirm?…&next=wayio://auth/callback →
      // /auth/abrir-app → la app inicia sesión con verifyOtp (procesarEnlace).
      const { error } = await getSupabase().auth.signInWithOtp({
        email: correo,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: AUTH_CALLBACK_URL,
        },
      })
      // Igual que la web: solo se avisa de fallos de red/servidor; el resto
      // se responde igual para no revelar si el email tiene cuenta.
      if (error && (!error.status || error.status >= 500)) {
        return { error: MENSAJE_ENVIO_FALLIDO }
      }
      return { error: null, message: MENSAJE_MAGIC_ENVIADO }
    },
    [configured]
  )

  const refreshTier = useCallback(
    () => loadTier(user?.id ?? null),
    [loadTier, user]
  )

  // Compras integradas: RevenueCat usa el id de la cuenta de Wayio (el
  // webhook del servidor le da Pro a esa cuenta). No hace nada si la build
  // no tiene compras en la tienda.
  const uid = user?.id ?? null
  useEffect(() => {
    void sincronizarUsuarioTienda(uid)
  }, [uid])

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
        signInWithGoogle,
        sendMagicLink,
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
