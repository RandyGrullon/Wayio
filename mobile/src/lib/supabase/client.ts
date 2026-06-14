import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from '../../config'

let client: SupabaseClient | null = null

/**
 * Singleton Supabase client for React Native.
 *
 * Unlike the web (cookie-based SSR), mobile persists the session in
 * AsyncStorage and talks to Supabase directly for all data + realtime.
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
    },
  })
  return client
}
