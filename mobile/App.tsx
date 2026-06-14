import { useEffect } from 'react'
import { BackHandler } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import './src/tasks/backgroundLocation'
import { AuthProvider } from './src/context/AuthContext'
import {
  NavigationProvider,
  useNavigation,
} from './src/navigation/NavigationContext'
import { RootNavigator } from './src/navigation/RootNavigator'

function AndroidBackHandler(): null {
  const { canGoBack, goBack } = useNavigation()
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
        goBack()
        return true
      }
      return false
    })
    return () => sub.remove()
  }, [canGoBack, goBack])
  return null
}

export default function App(): React.ReactElement {
  return (
    <AuthProvider>
      <NavigationProvider>
        <StatusBar style="dark" />
        <AndroidBackHandler />
        <RootNavigator />
      </NavigationProvider>
    </AuthProvider>
  )
}
