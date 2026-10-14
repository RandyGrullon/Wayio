import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { GenerateResult, PlanningTrip } from '../types/planning'
import type { FormularioViaje } from '../screens/crear/formulario'

export type Route =
  | { name: 'home' }
  | {
      name: 'create'
      initialDestino?: string
      /** Texto libre traído desde la caja de deseo de Home. */
      descripcion?: string
      /** Lugares detectados en un video (RecreateTrip). */
      lugaresDeseados?: string[]
      /** Rehidratar el formulario al volver de un error o de «Editar datos». */
      initialForm?: FormularioViaje
    }
  | { name: 'recreate' }
  | { name: 'packages'; result: GenerateResult; form: FormularioViaje }
  | { name: 'trip'; tripId: string }
  /** `tripId` = id de fila de `trips` (M04: activity_states.trip_id). */
  | { name: 'live'; trip: PlanningTrip; tripId?: string }
  /** Si falta `trip` (deep link), la pantalla lo carga con `tripId`. */
  | { name: 'group'; tripId: string; trip?: PlanningTrip }
  /** Unirse a un grupo desde wayio://group/<link>. */
  | { name: 'unirse'; link: string }
  | { name: 'paywall' }

export interface Entrada {
  key: number
  route: Route
}

interface NavigationValue {
  route: Route
  /** Pila completa (las pantallas de abajo siguen montadas y conservan su estado). */
  stack: readonly Entrada[]
  /** +1 al avanzar, −1 al volver (para la transición). */
  direccion: 1 | -1
  canGoBack: boolean
  navigate: (route: Route) => void
  goBack: () => void
  /** Sustituye la pantalla actual (sin dejarla en la pila). */
  replace: (route: Route) => void
  /** Reinicia la pila con una ruta o varias (la última queda arriba). */
  reset: (route: Route | readonly Route[]) => void
}

const NavigationContext = createContext<NavigationValue | null>(null)

let siguienteClave = 1
function entrada(route: Route): Entrada {
  return { key: siguienteClave++, route }
}

interface Estado {
  stack: Entrada[]
  direccion: 1 | -1
}

export function NavigationProvider({
  children,
}: {
  children: ReactNode
}): React.ReactElement {
  const [estado, setEstado] = useState<Estado>(() => ({
    stack: [entrada({ name: 'home' })],
    direccion: 1,
  }))

  const navigate = useCallback((route: Route) => {
    setEstado((s) => ({ stack: [...s.stack, entrada(route)], direccion: 1 }))
  }, [])

  const goBack = useCallback(() => {
    setEstado((s) =>
      s.stack.length > 1 ? { stack: s.stack.slice(0, -1), direccion: -1 } : s
    )
  }, [])

  const replace = useCallback((route: Route) => {
    setEstado((s) => ({
      stack: [...s.stack.slice(0, -1), entrada(route)],
      direccion: 1,
    }))
  }, [])

  const reset = useCallback((route: Route | readonly Route[]) => {
    const rutas: readonly Route[] = Array.isArray(route)
      ? (route as readonly Route[])
      : [route as Route]
    const lista = rutas.length > 0 ? rutas : [{ name: 'home' } as Route]
    setEstado({ stack: lista.map(entrada), direccion: 1 })
  }, [])

  const value = useMemo<NavigationValue>(() => {
    const top = estado.stack[estado.stack.length - 1]
    return {
      route: top?.route ?? { name: 'home' },
      stack: estado.stack,
      direccion: estado.direccion,
      canGoBack: estado.stack.length > 1,
      navigate,
      goBack,
      replace,
      reset,
    }
  }, [estado, navigate, goBack, replace, reset])

  return (
    <NavigationContext.Provider value={value}>
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
