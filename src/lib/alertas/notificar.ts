/**
 * Notificación del sistema para el modo en vivo de la web. Nunca pide
 * permiso: solo avisa si el usuario YA lo dio y la pestaña está oculta (con
 * la pestaña a la vista basta el aviso de la página). Best-effort: nunca
 * lanza.
 */

const ICONO = '/icons/icon-192.png'

/** ¿Se puede (y tiene sentido) mostrar una notificación ahora? */
export function puedeNotificar(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted' &&
    document.visibilityState === 'hidden'
  )
}

export interface DatosNotificacion {
  cuerpo: string
  /** Misma etiqueta = sustituye a la anterior en vez de apilarse. */
  etiqueta: string
}

/** Devuelve true si se mostró. */
export async function notificarSiOculta(
  titulo: string,
  { cuerpo, etiqueta }: DatosNotificacion
): Promise<boolean> {
  if (!puedeNotificar()) return false
  const opciones: NotificationOptions = {
    body: cuerpo,
    tag: etiqueta,
    icon: ICONO,
    lang: 'es',
    // Para que el service worker pueda volver a esta página al tocarla.
    data: { url: window.location.pathname },
  }
  try {
    const n = new Notification(titulo, opciones)
    n.onclick = () => {
      window.focus()
      n.close()
    }
    return true
  } catch {
    // Chrome en Android solo permite notificar desde el service worker.
  }
  try {
    const registro = await navigator.serviceWorker?.getRegistration()
    if (!registro) return false
    await registro.showNotification(titulo, opciones)
    return true
  } catch {
    return false
  }
}
