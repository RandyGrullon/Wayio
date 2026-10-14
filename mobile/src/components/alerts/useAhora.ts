import { useEffect, useState } from 'react'
import { AppState } from 'react-native'

/**
 * La hora actual como estado, actualizada cada `cadaMs` (y al volver a la
 * app). Mantiene el render puro: nada de `new Date()` al pintar.
 */
export function useAhora(cadaMs = 30_000): Date {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), cadaMs)
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') setAhora(new Date())
    })
    return () => {
      clearInterval(id)
      sub.remove()
    }
  }, [cadaMs])
  return ahora
}
