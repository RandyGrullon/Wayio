import { forwardRef, useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type TextInput,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'
import * as WebBrowser from 'expo-web-browser'
import { useAuth } from '../context/AuthContext'
import { config } from '../config'
import { Logo } from '../components/brand/Logo'
import { PostalArte } from '../components/brand/PostalArte'
import {
  Button,
  Callout,
  IconButton,
  Input,
  Pantalla,
  Txt,
} from '../components/ui'
import { useTheme } from '../theme'
import {
  ArrowLeft,
  Eye,
  EyeOff,
  MailCheck,
  type LucideIcon,
  type LucideProps,
} from '../components/ui/iconos'

type Mode = 'login' | 'signup' | 'recuperar'

/** Qué botón está trabajando (cada uno con su propio «cargando»). */
type Accion = 'email' | 'google' | 'magia'

/**
 * «G» oficial de Google para el botón «Continuar con Google». Lleva los
 * colores de marca de Google (sus normas de marca lo exigen), no los del
 * tema, igual que la web (src/app/(auth)/login/GoogleG.tsx). Con la firma de
 * un icono lucide para usarse como `icon` de Button (ignora color y trazo).
 */
const GoogleG = forwardRef<Svg, LucideProps>(function GoogleG(
  { size = 18 },
  ref
) {
  return (
    <Svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      accessible={false}
    >
      <Path
        fill="#4285F4"
        d="M47.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h13.2c-.6 3-2.4 5.6-5 7.3v6h8.1c4.7-4.4 7.2-10.8 7.2-17.6z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-8.1-6c-2.1 1.4-4.8 2.2-7.7 2.2-5.9 0-10.9-4-12.7-9.3H3v6.2C7 42.9 15 48 24 48z"
      />
      <Path
        fill="#FBBC05"
        d="M11.3 29.1c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4V14H3c-1.6 3.1-2.5 6.6-2.5 10.3S1.4 31.5 3 34.6l8.3-5.5z"
      />
      <Path
        fill="#EA4335"
        d="M24 9.5c3.3 0 6.3 1.1 8.6 3.4l6.4-6.4C35.9 2.9 30.5.5 24 .5 15 .5 7 5.6 3 14l8.3 5.5C13.1 14 18 9.5 24 9.5z"
      />
    </Svg>
  )
}) as LucideIcon

const TITULOS: Record<Mode, { h1: string; sub: string }> = {
  login: {
    h1: 'Bienvenido de vuelta',
    sub: 'Entra para ver tus viajes y seguir trazando rutas.',
  },
  signup: {
    h1: 'Crea tu cuenta',
    sub: 'Gratis para empezar. Guarda tus viajes y compártelos con tu grupo.',
  },
  recuperar: {
    h1: 'Recupera tu contraseña',
    sub: 'Te enviamos un enlace para crear una contraseña nueva.',
  },
}

const BOTON: Record<Mode, { label: string; cargando: string }> = {
  login: { label: 'Iniciar sesión', cargando: 'Entrando…' },
  signup: { label: 'Crear cuenta', cargando: 'Creando tu cuenta…' },
  recuperar: { label: 'Enviar enlace', cargando: 'Enviando…' },
}

/**
 * Login, registro y recuperación (§6.9, versión móvil): banda de postal
 * arriba, wordmark, H1, campos con label, errores en Callout y «Revisa tu
 * email» tras registrarse. Conserva los modos y el aviso de configuración.
 * Como la web (LoginForm): «Continuar con Google» en entrar y crear cuenta, y
 * «Prefiero recibir un enlace por email» (enlace mágico) al entrar.
 */
export function AuthScreen(): React.ReactElement {
  const {
    signIn,
    signUp,
    resetPassword,
    signInWithGoogle,
    sendMagicLink,
    configured,
    authLinkError,
    clearAuthLinkError,
  } = useAuth()
  const { colors } = useTheme()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [revisaEmail, setRevisaEmail] = useState<string | null>(null)
  const [accion, setAccion] = useState<Accion | null>(null)
  const loading = accion !== null
  const emailRef = useRef<TextInput>(null)
  const claveRef = useRef<TextInput>(null)

  const cambiarModo = (nuevo: Mode): void => {
    setMode(nuevo)
    setError(null)
    setSuccess(null)
    setRevisaEmail(null)
    clearAuthLinkError()
  }

  const limpiarMensajes = (): void => {
    setError(null)
    setSuccess(null)
    clearAuthLinkError()
  }

  /** Como la web (LoginForm handleGoogle): el error vuelve en el Callout. */
  const handleGoogle = async (): Promise<void> => {
    if (loading) return
    limpiarMensajes()
    setAccion('google')
    try {
      const r = await signInWithGoogle()
      if (r.error) setError(r.error)
    } finally {
      setAccion(null)
    }
  }

  /** «Prefiero recibir un enlace por email» (LoginForm handleMagicLink). */
  const handleMagicLink = async (): Promise<void> => {
    if (loading) return
    limpiarMensajes()
    if (!email.trim()) {
      setError('Escribe tu email y te enviamos un enlace para entrar.')
      emailRef.current?.focus()
      return
    }
    setAccion('magia')
    try {
      const r = await sendMagicLink(email)
      if (r.error) setError(r.error)
      else if (r.message) setSuccess(r.message)
    } finally {
      setAccion(null)
    }
  }

  const handleSubmit = async (): Promise<void> => {
    if (loading) return
    limpiarMensajes()
    setAccion('email')
    try {
      if (mode === 'login') {
        const r = await signIn(email, password)
        if (r.error) setError(r.error)
      } else if (mode === 'signup') {
        const r = await signUp(email, password, nombre)
        if (r.error) setError(r.error)
        else if (r.message) setRevisaEmail(r.message)
      } else {
        const r = await resetPassword(email)
        if (r.error) setError(r.error)
        else setSuccess(r.message ?? 'Revisa tu bandeja de entrada.')
      }
    } finally {
      setAccion(null)
    }
  }

  const abrirLegal = (ruta: 'terminos' | 'privacidad'): void => {
    if (!config.webUrl) return
    WebBrowser.openBrowserAsync(`${config.webUrl}/${ruta}`).catch(
      () => undefined
    )
  }

  if (!configured) {
    return (
      <Pantalla edges={['top', 'bottom', 'left', 'right']}>
        <PostalArte semilla="login" />
        <View style={styles.columna}>
          <Logo height={30} title="Wayio" destinoIntro style={styles.logo} />
          <Txt variant="h1">Configuración incompleta</Txt>
          <Callout tone="warning" style={styles.bloque}>
            Esta versión de la app todavía no puede iniciar sesión. Estamos
            terminando de prepararla: inténtalo de nuevo más tarde.
          </Callout>
        </View>
      </Pantalla>
    )
  }

  const avisoError = error ?? authLinkError
  const titulos = TITULOS[mode]

  return (
    <Pantalla edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <PostalArte semilla="login" />
          <View style={styles.columna}>
            <Logo height={30} title="Wayio" destinoIntro style={styles.logo} />

            {revisaEmail ? (
              <View style={styles.revisa} accessibilityLiveRegion="polite">
                <View
                  style={[
                    styles.revisaIcono,
                    {
                      backgroundColor: colors.successBg,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <MailCheck
                    size={28}
                    color={colors.successFg}
                    strokeWidth={1.75}
                    accessible={false}
                  />
                </View>
                <Txt variant="h1" style={styles.bloque}>
                  Revisa tu email
                </Txt>
                <Txt variant="body" color="fgMuted" style={styles.sub}>
                  {revisaEmail}
                </Txt>
                <Button
                  title="Volver a iniciar sesión"
                  variant="outline"
                  size="lg"
                  fullWidth
                  icon={ArrowLeft}
                  onPress={() => cambiarModo('login')}
                  style={styles.bloque}
                />
              </View>
            ) : (
              <>
                <Txt variant="h1">{titulos.h1}</Txt>
                <Txt variant="body" color="fgMuted" style={styles.sub}>
                  {titulos.sub}
                </Txt>

                {avisoError ? (
                  <Callout
                    tone="danger"
                    style={styles.bloque}
                    {...(authLinkError && !error
                      ? { onDismiss: clearAuthLinkError }
                      : {})}
                  >
                    {avisoError}
                  </Callout>
                ) : null}
                {success ? (
                  <Callout tone="success" style={styles.bloque}>
                    {success}
                  </Callout>
                ) : null}

                {mode !== 'recuperar' ? (
                  <>
                    <Button
                      title="Continuar con Google"
                      variant="outline"
                      size="lg"
                      fullWidth
                      icon={GoogleG}
                      loading={accion === 'google'}
                      loadingText="Abriendo Google…"
                      disabled={loading}
                      onPress={() => void handleGoogle()}
                      style={styles.google}
                    />
                    <View
                      style={styles.separador}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    >
                      <View
                        style={[
                          styles.linea,
                          { backgroundColor: colors.border },
                        ]}
                      />
                      <Txt variant="caption" color="fgSubtle">
                        o con tu email
                      </Txt>
                      <View
                        style={[
                          styles.linea,
                          { backgroundColor: colors.border },
                        ]}
                      />
                    </View>
                  </>
                ) : null}

                <View
                  style={
                    mode === 'recuperar' ? styles.form : styles.formTrasGoogle
                  }
                >
                  {mode === 'signup' ? (
                    <Input
                      label="Nombre"
                      placeholder="Cómo te llamas"
                      value={nombre}
                      onChangeText={setNombre}
                      autoCapitalize="words"
                      autoComplete="name"
                      textContentType="name"
                      returnKeyType="next"
                      onSubmitEditing={() => emailRef.current?.focus()}
                    />
                  ) : null}
                  <Input
                    inputRef={emailRef}
                    label="Email"
                    placeholder="tu@email.com"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType={mode === 'recuperar' ? 'send' : 'next'}
                    onSubmitEditing={() =>
                      mode === 'recuperar'
                        ? void handleSubmit()
                        : claveRef.current?.focus()
                    }
                  />
                  {mode !== 'recuperar' ? (
                    <Input
                      inputRef={claveRef}
                      label="Contraseña"
                      {...(mode === 'signup'
                        ? { hint: 'Mínimo 8 caracteres.' }
                        : {})}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!verClave}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete={
                        mode === 'signup' ? 'new-password' : 'current-password'
                      }
                      textContentType={
                        mode === 'signup' ? 'newPassword' : 'password'
                      }
                      returnKeyType="go"
                      onSubmitEditing={() => void handleSubmit()}
                      suffix={
                        <IconButton
                          label={
                            verClave
                              ? 'Ocultar contraseña'
                              : 'Mostrar contraseña'
                          }
                          icon={verClave ? EyeOff : Eye}
                          color={colors.fgMuted}
                          onPress={() => setVerClave((v) => !v)}
                        />
                      }
                    />
                  ) : null}

                  {mode === 'login' ? (
                    <Button
                      variant="link"
                      title="¿Olvidaste tu contraseña?"
                      onPress={() => cambiarModo('recuperar')}
                      style={styles.olvido}
                    />
                  ) : null}

                  <Button
                    title={BOTON[mode].label}
                    loadingText={BOTON[mode].cargando}
                    loading={accion === 'email'}
                    disabled={loading}
                    size="lg"
                    fullWidth
                    onPress={() => void handleSubmit()}
                    style={styles.enviar}
                  />

                  {mode === 'login' ? (
                    <Button
                      title="Prefiero recibir un enlace por email"
                      variant="ghost"
                      fullWidth
                      loading={accion === 'magia'}
                      loadingText="Enviando el enlace…"
                      disabled={loading}
                      onPress={() => void handleMagicLink()}
                      style={styles.magia}
                    />
                  ) : null}
                </View>

                <View style={styles.alternar}>
                  <Txt variant="bodyS" color="fgMuted">
                    {mode === 'login'
                      ? '¿No tienes cuenta?'
                      : mode === 'signup'
                        ? '¿Ya tienes cuenta?'
                        : '¿Te acordaste?'}
                  </Txt>
                  <Button
                    variant="link"
                    title={
                      mode === 'login'
                        ? 'Crear cuenta'
                        : mode === 'signup'
                          ? 'Iniciar sesión'
                          : 'Volver a iniciar sesión'
                    }
                    onPress={() =>
                      cambiarModo(mode === 'login' ? 'signup' : 'login')
                    }
                  />
                </View>

                {config.webUrl ? (
                  <View style={styles.legal}>
                    <Txt variant="caption" color="fgSubtle">
                      Al continuar aceptas los
                    </Txt>
                    <Button
                      variant="link"
                      title="Términos"
                      onPress={() => abrirLegal('terminos')}
                    />
                    <Txt variant="caption" color="fgSubtle">
                      y la
                    </Txt>
                    <Button
                      variant="link"
                      title="Privacidad"
                      onPress={() => abrirLegal('privacidad')}
                    />
                  </View>
                ) : null}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Pantalla>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 40 },
  columna: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  logo: { marginBottom: 24 },
  sub: { marginTop: 8 },
  bloque: { marginTop: 16 },
  form: { marginTop: 24 },
  formTrasGoogle: { marginTop: 0 },
  google: { marginTop: 24 },
  separador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 20,
  },
  linea: { flex: 1, height: StyleSheet.hairlineWidth },
  olvido: { alignSelf: 'flex-end', marginTop: -6, marginBottom: 4 },
  enviar: { marginTop: 12 },
  magia: { marginTop: 8 },
  alternar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 6,
    marginTop: 20,
  },
  legal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 4,
    marginTop: 12,
  },
  revisa: { alignItems: 'flex-start' },
  revisaIcono: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
