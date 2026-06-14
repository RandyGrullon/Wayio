import { Platform, Vibration } from 'react-native'
import * as Haptics from 'expo-haptics'
import type { AlertLevel } from '../../types/alert'

async function hapticImpact(style: Haptics.ImpactFeedbackStyle): Promise<void> {
  await Haptics.impactAsync(style)
}

async function hapticNotification(
  type: Haptics.NotificationFeedbackType
): Promise<void> {
  await Haptics.notificationAsync(type)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function sosPatternIOS(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await hapticImpact(Haptics.ImpactFeedbackStyle.Light)
    await sleep(100)
  }
  await sleep(200)
  for (let i = 0; i < 3; i++) {
    await hapticImpact(Haptics.ImpactFeedbackStyle.Heavy)
    await sleep(300)
  }
  await sleep(200)
  for (let i = 0; i < 3; i++) {
    await hapticImpact(Haptics.ImpactFeedbackStyle.Light)
    await sleep(100)
  }
}

export async function triggerAlertHaptic(level: AlertLevel): Promise<void> {
  switch (level) {
    case 1:
      if (Platform.OS === 'ios') {
        await hapticImpact(Haptics.ImpactFeedbackStyle.Light)
      } else {
        Vibration.vibrate(100)
      }
      break

    case 2:
      if (Platform.OS === 'ios') {
        await hapticImpact(Haptics.ImpactFeedbackStyle.Medium)
        await sleep(100)
        await hapticImpact(Haptics.ImpactFeedbackStyle.Medium)
      } else {
        Vibration.vibrate([0, 100, 100, 100])
      }
      break

    case 3:
      if (Platform.OS === 'ios') {
        await hapticNotification(Haptics.NotificationFeedbackType.Warning)
      } else {
        Vibration.vibrate(500)
      }
      break

    case 4:
      if (Platform.OS === 'ios') {
        await hapticNotification(Haptics.NotificationFeedbackType.Error)
        await sleep(200)
        await hapticNotification(Haptics.NotificationFeedbackType.Error)
        await sleep(200)
        await hapticNotification(Haptics.NotificationFeedbackType.Error)
      } else {
        Vibration.vibrate([0, 500, 200, 500, 200, 500])
      }
      break

    case 5:
      if (Platform.OS === 'ios') {
        await sosPatternIOS()
      } else {
        Vibration.vibrate(
          [
            0, 100, 100, 100, 100, 100, 200, 300, 200, 300, 200, 300, 200, 100,
            100, 100, 100, 100,
          ],
          false
        )
      }
      break

    default:
      break
  }
}

export function stopHaptics(): void {
  Vibration.cancel()
}
