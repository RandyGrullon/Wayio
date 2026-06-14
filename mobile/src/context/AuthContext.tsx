import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabase } from '../lib/supabase/client'
import type { PlanTier } from '../types/planning'

interface AuthContextValue {
  user: User | null
  session: Session | null
  tier: PlanTier
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (
    email: string,
    password: string,
    nombre: string
  ) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({
  children,
}: {
  children: ReactNode
}): React.ReactElement {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [tier, setTier] = useState<PlanTier>('free')
  const [loading, setLoading] = useState(true)

  const loadTier = useCallback(async (uid: string | null) => {
    if (!uid) {
      setTier('free')
      return
    }
    try {
      const { data } = await getSupabase()
        .from('subscriptions')
        .select('tier, status')
        .eq('user_id', uid)
        .eq('status', 'active')
        .single()
      setTier(
        data?.tier === 'grupo' ? 'grupo' : data?.tier === 'pro' ? 'pro' : 'free'
      )
    } catch {
      setTier('free')
    }
  }, [])

  useEffect(() => {
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
      void loadTier(newSession?.user.id ?? null)
    })

    return () => subscription.unsubscribe()
  }, [loadTier])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({
      email,
      password,
    })
    return { error: error?.message ?? null }
  }, [])

  const signUp = useCallback(
    async (email: string, password: string, nombre: string) => {
      const { error } = await getSupabase().auth.signUp({
        email,
        password,
        options: { data: { full_name: nombre } },
      })
      return { error: error?.message ?? null }
    },
    []
  )

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut()
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, session, tier, loading, signIn, signUp, signOut }}
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
