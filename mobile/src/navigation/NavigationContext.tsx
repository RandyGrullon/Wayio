import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type {
  GenerateResult,
  PlanningTrip,
  TripFormValues,
} from '../types/planning'

export type Route =
  | { name: 'home' }
  | { name: 'create' }
  | { name: 'packages'; result: GenerateResult; form: TripFormValues }
  | { name: 'trip'; tripId: string }
  | { name: 'live'; trip: PlanningTrip }
  | { name: 'group'; trip: PlanningTrip; tripId: string }
  | { name: 'paywall' }

interface NavigationValue {
  route: Route
  canGoBack: boolean
  navigate: (route: Route) => void
  goBack: () => void
  reset: (route: Route) => void
}

const NavigationContext = createContext<NavigationValue | null>(null)

export function NavigationProvider({
  children,
}: {
  children: ReactNode
}): React.ReactElement {
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }])

  const navigate = useCallback((route: Route) => {
    setStack((s) => [...s, route])
  }, [])

  const goBack = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
  }, [])

  const reset = useCallback((route: Route) => {
    setStack([route])
  }, [])

  const route = stack[stack.length - 1] ?? { name: 'home' }

  return (
    <NavigationContext.Provider
      value={{ route, canGoBack: stack.length > 1, navigate, goBack, reset }}
    >
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation(): NavigationValue {
  const ctx = useContext(NavigationContext)
  if (!ctx)
    throw new Error('useNavigation debe usarse dentro de <NavigationProvider>')
  return ctx
}
