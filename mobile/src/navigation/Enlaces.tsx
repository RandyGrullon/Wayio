import { useEffect, useRef } from 'react'
import { BackHandler, Linking } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { useNavigation } from './NavigationContext'

/**
 * Enlace de invitación a un grupo: wayio://group/<link> (o la URL web
 * https://…/group/<link>). Devuelve el <link> o null.
 */
export function linkDeGrupo(url: string | null | undefined): string | null {
  if (!url) return null
  const m = /^(?:wayio:\/\/\/?|https?:\/\/[^/]+\/)group\/([^/?#]+)/i.exec(
    url.trim()
  )
  const crudo = m?.[1]
  if (!crudo) return null
  try {
    const link = decodeURIComponent(crudo).trim()
    return link.length >= 8 && link.length <= 200 ? link : null
  } catch {
    return null
  }
}

/**
 * Deep links de la app (M09/DA-25): wayio://group/<link> abre «Unirse al
 * grupo». Si no hay sesión, el enlace se guarda y se procesa al iniciarla.
 */
export function EnlacesProfundos(): null {
  const { user } = useAuth()
  const { navigate } = useNavigation()
  const pendiente = useRef<string | null>(null)
  const conSesion = useRef(false)
  const uid = user?.id ?? null

  useEffect(() => {
    conSesion.current = uid !== null
    if (uid && pendiente.current) {
      const link = pendiente.current
      pendiente.current = null
      navigate({ name: 'unirse', link })
    }
  }, [uid, navigate])

  useEffect(() => {
    const abrir = (url: string | null): void => {
      const link = linkDeGrupo(url)
      if (!link) return
      if (conSesion.current) navigate({ name: 'unirse', link })
      else pendiente.current = link
    }
    Linking.getInitialURL()
      .then(abrir)
      .catch(() => undefined)
    const sub = Linking.addEventListener('url', ({ url }) => abrir(url))
    return () => sub.remove()
  }, [navigate])

  return null
}

/** Botón «atrás» de Android: vuelve en la pila propia antes de salir. */
export function AtrasAndroid(): null {
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
