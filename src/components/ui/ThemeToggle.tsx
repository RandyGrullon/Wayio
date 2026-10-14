'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { buttonClasses } from './Button'
import { Menu } from './Menu'

/**
 * Tema claro / oscuro / sistema (docs/DISENO.md §5.11 y §9.4).
 *
 * Coherente con el script del <head>: guarda 'light' | 'dark' | 'system' en
 * localStorage['wayio-theme'], alterna html.dark y emite el evento
 * 'wayio-theme-change' (el mapa lo escucha para cambiar de estilo).
 */

export type ThemePreference = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'wayio-theme'
export const THEME_EVENT = 'wayio-theme-change'

const COLOR_CLARO = '#F7F4EE'
const COLOR_OSCURO = '#0B1622'

function leerPreferencia(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

function sistemaOscuro(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Ajusta <meta name="theme-color"> al tema elegido (barra del navegador). */
function actualizarThemeColor(pref: ThemePreference, oscuro: boolean): void {
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((meta) => {
      const media = meta.getAttribute('media') ?? ''
      const porMedia = media.includes('dark') ? COLOR_OSCURO : COLOR_CLARO
      meta.content =
        pref === 'system' ? porMedia : oscuro ? COLOR_OSCURO : COLOR_CLARO
    })
}

/** Aplica una preferencia al documento sin guardarla. */
export function applyTheme(pref: ThemePreference): void {
  const oscuro = pref === 'system' ? sistemaOscuro() : pref === 'dark'
  document.documentElement.classList.toggle('dark', oscuro)
  actualizarThemeColor(pref, oscuro)
}

/** Guarda la preferencia, la aplica y avisa con 'wayio-theme-change'. */
export function setThemePreference(pref: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref)
  } catch {
    // Almacenamiento bloqueado: el tema se aplica igual en esta visita.
  }
  applyTheme(pref)
  window.dispatchEvent(new Event(THEME_EVENT))
}

function subscribe(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(THEME_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

// El servidor (y la primera pasada de hidratación) pinta «sistema».
const preferenciaServidor = (): ThemePreference => 'system'

/** Preferencia de tema actual (se actualiza con el evento). */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, leerPreferencia, preferenciaServidor)
}

const OPCIONES = [
  { valor: 'light', label: 'Claro', Icono: Sun },
  { valor: 'dark', label: 'Oscuro', Icono: Moon },
  { valor: 'system', label: 'Sistema', Icono: Monitor },
] as const

export function ThemeToggle({ className }: { className?: string }) {
  const pref = useThemePreference()

  // Sincroniza theme-color al montar y sigue al sistema si toca.
  useEffect(() => {
    // Se lee del almacenamiento (en la hidratación `pref` vale 'system').
    const real = leerPreferencia()
    applyTheme(real)
    if (real !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onCambio = () => {
      applyTheme('system')
      window.dispatchEvent(new Event(THEME_EVENT))
    }
    mq.addEventListener('change', onCambio)
    return () => mq.removeEventListener('change', onCambio)
  }, [pref])

  const actual = OPCIONES.find((o) => o.valor === pref) ?? OPCIONES[2]
  const Icono = actual.Icono

  return (
    <Menu
      label={`Tema: ${actual.label}`}
      trigger={
        <Icono aria-hidden="true" strokeWidth={1.75} className="size-[18px]" />
      }
      triggerClassName={cn(
        buttonClasses({ variant: 'ghost', size: 'icon' }),
        'size-10 text-fg-muted hover:text-fg',
        className
      )}
      items={OPCIONES.map((o) => ({
        key: o.valor,
        label: o.label,
        icon: <o.Icono />,
        checked: o.valor === pref,
        onSelect: () => setThemePreference(o.valor),
      }))}
    />
  )
}
