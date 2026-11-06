import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from '../../config'

let client: SupabaseClient | null = null

/**
 * Singleton Supabase client for React Native.
 *
 * Unlike the web (cookie-based SSR), mobile persists the session in
 * AsyncStorage and talks to Supabase directly for all data + realtime.
 *
 * flowType 'pkce' (como @supabase/ssr en la web): la vuelta de Google trae un
 * `code` de un solo uso que solo se canjea con el verificador guardado en este
 * teléfono (otra app que capture wayio:// no puede usarlo), nunca los tokens
 * en el fragmento del deep link. Los correos (registro, enlace mágico,
 * recuperación) no dependen del verificador: las plantillas de
 * supabase/templates usan token_hash y se canjean con verifyOtp (en la app o
 * en la web /auth/confirm), aunque se abran en otro dispositivo.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error(
      'Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY en .env'
    )
  }
  client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  })
  return client
}
