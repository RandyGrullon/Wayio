import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/**
 * ¿Pidió el sistema reducir el movimiento? Se actualiza en vivo. Con movimiento
 * reducido no hay traslaciones, escalas ni trazos: solo fundidos y cambios de
 * color (§7.5).
 */
export function useReduceMotion(): boolean {
  const [reducir, setReducir] = useState(false)

  useEffect(() => {
    let vivo = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (vivo) setReducir(v)
      })
      .catch(() => undefined)
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (v: boolean) => setReducir(v)
    )
    return () => {
      vivo = false
      sub.remove()
    }
  }, [])

  return reducir
}
