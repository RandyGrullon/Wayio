import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { colors } from '../theme'

type Mode = 'login' | 'signup'

export function AuthScreen(): React.ReactElement {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (): Promise<void> => {
    setError(null)
    setSuccess(false)
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error: e } = await signIn(email.trim(), password)
        if (e) setError(e)
      } else {
        const { error: e } = await signUp(email.trim(), password, nombre.trim())
        if (e) setError(e)
        else setSuccess(true)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.brand}>
            <Text style={styles.logo}>Wayio</Text>
            <Text style={styles.tagline}>
              {mode === 'login'
                ? 'Inicia sesión para planificar tus viajes'
                : 'Crea tu cuenta gratis'}
            </Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? (
            <Text style={styles.success}>
              Cuenta creada. Revisa tu email para confirmar.
            </Text>
          ) : null}

          <View style={styles.card}>
            {mode === 'signup' ? (
              <Input
                label="Nombre completo"
                placeholder="Tu nombre"
                value={nombre}
                onChangeText={setNombre}
                autoCapitalize="words"
              />
            ) : null}
            <Input
              label="Email"
              placeholder="tu@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label="Contraseña"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <Button
              title={mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              onPress={() => void handleSubmit()}
              loading={loading}
              size="lg"
              style={styles.submit}
            />
          </View>

          <TouchableOpacity
            onPress={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setError(null)
              setSuccess(false)
            }}
            style={styles.switch}
          >
            <Text style={styles.switchText}>
              {mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
              <Text style={styles.switchLink}>
                {mode === 'login' ? 'Crear cuenta' : 'Iniciar sesión'}
              </Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primaryLight },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brand: { alignItems: 'center', marginBottom: 28 },
  logo: { fontSize: 40, fontWeight: '800', color: colors.text },
  tagline: {
    fontSize: 15,
    color: colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  submit: { marginTop: 4 },
  error: {
    backgroundColor: colors.redBg,
    color: colors.red,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    fontSize: 13,
  },
  success: {
    backgroundColor: colors.greenBg,
    color: colors.green,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    fontSize: 13,
  },
  switch: { marginTop: 20, alignItems: 'center' },
  switchText: { fontSize: 14, color: colors.textMuted },
  switchLink: { color: colors.primary, fontWeight: '600' },
})
