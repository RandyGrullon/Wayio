import { Platform, Vibration } from 'react-native'
import * as Haptics from 'expo-haptics'
import type { AlertLevel } from '../../types/alert'

/**
 * Hápticos del modo en vivo. Cada patrón se lanza UNA vez (al subir de nivel
 * o al confirmar algo); nunca en bucle. Ninguna función lanza: en web o en un
 * dispositivo sin motor háptico simplemente no vibra.
 */

async function impacto(estilo: Haptics.ImpactFeedbackStyle): Promise<void> {
  try {
    await Haptics.impactAsync(estilo)
  } catch {
    // Sin motor háptico.
  }
}

async function aviso(tipo: Haptics.NotificationFeedbackType): Promise<void> {
  try {
    await Haptics.notificationAsync(tipo)
  } catch {
    // Sin motor háptico.
  }
}

function vibrar(patron: number | number[]): void {
  try {
    Vibration.vibrate(patron)
  } catch {
    // Sin vibrador.
  }
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Embarque: tres cortos, tres largos y tres cortos (una sola vez). */
async function patronEmbarqueIOS(): Promise<void> {
  for (const [estilo, pausa] of [
    [Haptics.ImpactFeedbackStyle.Light, 100],
    [Haptics.ImpactFeedbackStyle.Heavy, 300],
    [Haptics.ImpactFeedbackStyle.Light, 100],
  ] as const) {
    for (let i = 0; i < 3; i++) {
      await impacto(estilo)
      await esperar(pausa)
    }
    await esperar(200)
  }
}

export async function triggerAlertHaptic(level: AlertLevel): Promise<void> {
  const ios = Platform.OS === 'ios'
  switch (level) {
    case 1:
      if (ios) await impacto(Haptics.ImpactFeedbackStyle.Light)
      else vibrar(80)
      break
    case 2:
      if (ios) {
        await impacto(Haptics.ImpactFeedbackStyle.Medium)
        await esperar(100)
        await impacto(Haptics.ImpactFeedbackStyle.Medium)
      } else {
        vibrar([0, 100, 100, 100])
      }
      break
    case 3:
      if (ios) await aviso(Haptics.NotificationFeedbackType.Warning)
      else vibrar(400)
      break
    case 4:
      if (ios) {
        await aviso(Haptics.NotificationFeedbackType.Error)
        await esperar(200)
        await aviso(Haptics.NotificationFeedbackType.Error)
      } else {
        vibrar([0, 400, 200, 400])
      }
      break
    case 5:
      if (ios) await patronEmbarqueIOS()
      else
        vibrar([
          0, 100, 100, 100, 100, 100, 200, 300, 200, 300, 200, 300, 200, 100,
          100, 100, 100, 100,
        ])
      break
    default:
      break
  }
}

/** Confirmación suave (aceptar, guardar, activar la ubicación). */
export async function hapticConfirmar(): Promise<void> {
  await aviso(Haptics.NotificationFeedbackType.Success)
}

/** Toque de selección (cambiar de pestaña, elegir una opción). */
export async function hapticSeleccion(): Promise<void> {
  try {
    await Haptics.selectionAsync()
  } catch {
    // Sin motor háptico.
  }
}

/** Llegada a una actividad detectada por el GPS. */
export async function hapticLlegada(): Promise<void> {
  await impacto(Haptics.ImpactFeedbackStyle.Light)
}

export function stopHaptics(): void {
  try {
    Vibration.cancel()
  } catch {
    // Nada que cancelar.
  }
}
