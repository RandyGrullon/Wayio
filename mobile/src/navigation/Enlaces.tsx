import { useEffect, useRef } from 'react'
import { BackHandler, Linking } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { useNavigation, type Route } from './NavigationContext'

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
 * Vista pública de un viaje: wayio://viaje-compartido/<id> (el respaldo que
 * comparte TripDetailScreen sin EXPO_PUBLIC_WEB_URL) o la URL web
 * https://…/viaje-compartido/<id>. Devuelve el id (uuid) o null.
 */
export function idDeViajeCompartido(
  url: string | null | undefined
): string | null {
  if (!url) return null
  const m =
    /^(?:wayio:\/\/\/?|https?:\/\/[^/]+\/)viaje-compartido\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i.exec(
      url.trim()
    )
  return m?.[1]?.toLowerCase() ?? null
}

/** Ya se leyó el enlace inicial en este arranque (ver EnlacesProfundos). */
let enlaceInicialLeido = false

/** Pantalla que abre un deep link de la app, o null si no es uno nuestro. */
export function rutaDeEnlace(url: string | null | undefined): Route | null {
  const link = linkDeGrupo(url)
  if (link) return { name: 'unirse', link }
  const id = idDeViajeCompartido(url)
  if (id) return { name: 'viajeCompartido', id }
  return null
}

/**
 * Deep links de la app (M09/DA-25): wayio://group/<link> abre «Unirse al
 * grupo» y wayio://viaje-compartido/<id> la vista de solo lectura con
 * «Copiar a mis viajes». Si no hay sesión, el enlace se guarda y se procesa
 * al iniciarla. Los de auth (wayio://auth/callback) los trata AuthContext.
 */
export function EnlacesProfundos(): null {
  const { user } = useAuth()
  const { navigate } = useNavigation()
  const pendiente = useRef<Route | null>(null)
  const conSesion = useRef(false)
  const uid = user?.id ?? null

  useEffect(() => {
    conSesion.current = uid !== null
    if (uid && pendiente.current) {
      const ruta = pendiente.current
      pendiente.current = null
      navigate(ruta)
    }
  }, [uid, navigate])

  useEffect(() => {
    const abrir = (url: string | null): void => {
      const ruta = rutaDeEnlace(url)
      if (!ruta) return
      if (conSesion.current) navigate(ruta)
      else pendiente.current = ruta
    }
    // El enlace con el que se abrió la app se procesa UNA vez por arranque:
    // si el árbol se vuelve a montar («Reintentar» de la pantalla de error),
    // getInitialURL devuelve el mismo enlace y volvería a abrir la pantalla.
    if (!enlaceInicialLeido) {
      enlaceInicialLeido = true
      Linking.getInitialURL()
        .then(abrir)
        .catch(() => undefined)
    }
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
