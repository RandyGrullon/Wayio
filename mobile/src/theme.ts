/**
 * Tokens del sistema «Cuaderno de Ruta» para la app móvil (docs/DISENO.md §11).
 *
 * - `light` / `dark`: colores semánticos EXACTOS de la spec (más unas pocas
 *   extensiones tomadas de §2.1, marcadas abajo).
 * - `useTheme()`: tema resuelto (claro u oscuro) según la preferencia guardada
 *   en AsyncStorage 'wayio-theme' ('light' | 'dark' | 'system').
 * - `useEstilos(fabrica)`: StyleSheet memoizado por tema.
 *
 * Los nombres antiguos (`colors`, `radius.sm|md|lg|xl`, `DAY_COLORS`) se
 * conservan como alias del tema claro para no romper archivos que aún no se
 * han migrado.
 */
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import {
  Appearance,
  Easing,
  useColorScheme,
  type FontVariant,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const palette = {
  rosa: {
    50: '#FFF0F6',
    100: '#FFDDEB',
    200: '#FFBAD6',
    300: '#FF8AB8',
    400: '#F55A9A',
    500: '#E0307D',
    600: '#C21A66',
    700: '#A11254',
    800: '#800F45',
    900: '#640E39',
    950: '#3D0520',
  },
  mar: {
    50: '#EFF7F5',
    100: '#D6ECE8',
    200: '#AED8D1',
    300: '#7FBFB6',
    400: '#519F96',
    500: '#33827A',
    600: '#246B66',
    700: '#1E5A57',
    800: '#1A4A48',
    900: '#173E3C',
    950: '#0B2423',
  },
  tinta: {
    50: '#F2F5F8',
    100: '#E1E8EF',
    200: '#B6C2CE',
    300: '#9AAABB',
    400: '#7088A0',
    500: '#767D86',
    600: '#56626F',
    700: '#46525F',
    800: '#2C4258',
    900: '#142435',
    950: '#0F1E2E',
  },
  noche: {
    600: '#2E4760',
    700: '#22384D',
    800: '#1F344A',
    850: '#18293B',
    900: '#112131',
    950: '#0B1622',
  },
  papel: {
    50: '#FBF9F5',
    100: '#F7F4EE',
    150: '#F1EEE8',
    200: '#EFEAE1',
    300: '#E2DCD0',
    400: '#C9C1B2',
  },
  laton: {
    50: '#FAF5EA',
    300: '#D9B468',
    600: '#9A7531',
    700: '#7E5F22',
    800: '#654B1E',
  },
} as const

export const light = {
  bg: '#F7F4EE',
  surface: '#FFFFFF',
  surface2: '#EFEAE1',
  surfaceRaised: '#FFFFFF',
  surfaceInverse: '#142435',
  fg: '#0F1E2E',
  fgMuted: '#46525F',
  fgSubtle: '#56626F',
  fgInverse: '#F7F4EE',
  border: '#E2DCD0',
  rule: '#C9C1B2',
  borderStrong: '#767D86',
  primary: '#C21A66',
  primaryPressed: '#A11254',
  primaryFg: '#FFFFFF',
  primarySoft: '#FFF0F6',
  primarySoftFg: '#800F45',
  primaryText: '#A11254',
  accent: '#1E5A57',
  accentFg: '#FFFFFF',
  accentSoft: '#EFF7F5',
  accentSoftFg: '#1A4A48',
  brass: '#9A7531',
  brassText: '#7E5F22',
  brassSoft: '#FAF5EA',
  success: '#2E6B3F',
  successBg: '#EDF5EE',
  successFg: '#23582F',
  warning: '#7A5200',
  warningBg: '#FBF1D9',
  warningFg: '#6B4800',
  danger: '#B42318',
  onDanger: '#FFFFFF',
  dangerBg: '#FDEEEC',
  dangerFg: '#912018',
  info: '#1E5A57',
  infoBg: '#EFF7F5',
  infoFg: '#1A4A48',
  ring: '#246B66',
  overlay: 'rgba(11,22,34,0.55)',
  toastSuccess: '#9AE0B4',
  toastAction: '#FF8AB8',
  gps: '#C21A66',
  gpsRing: '#FFFFFF',
  mapCasing: '#FFFFFF',
  dayNumeral: '#FFFFFF',
  // ── Extensiones tomadas de §2.1 (mismos valores que la web) ──────────────
  brassSoftFg: '#654B1E',
  toastDanger: '#FFA899',
  ringInverse: '#7FBFB6',
  /** Burbuja propia del chat (§6.8): tinta en claro, tinta-800 en oscuro. */
  bubbleOwn: '#142435',
  bubbleOwnFg: '#F7F4EE',
  shimmer: '#F7F4EE',
}

export type ThemeColors = typeof light

export const dark: ThemeColors = {
  bg: '#0B1622',
  surface: '#112131',
  surface2: '#18293B',
  surfaceRaised: '#1F344A',
  surfaceInverse: '#F1EEE8',
  fg: '#F1EEE8',
  fgMuted: '#B6C2CE',
  fgSubtle: '#9AAABB',
  fgInverse: '#0F1E2E',
  border: '#22384D',
  rule: '#2E4760',
  borderStrong: '#7088A0',
  primary: '#F55A9A',
  primaryPressed: '#FF8AB8',
  primaryFg: '#0B1622',
  primarySoft: '#3A1D35',
  primarySoftFg: '#FFBAD6',
  primaryText: '#FF8AB8',
  accent: '#7FBFB6',
  accentFg: '#0B1622',
  accentSoft: '#133038',
  accentSoftFg: '#AED8D1',
  brass: '#D9B468',
  brassText: '#E9C88A',
  brassSoft: '#2C2A24',
  success: '#93D6A6',
  successBg: '#15302A',
  successFg: '#A8E8C4',
  warning: '#F2C76E',
  warningBg: '#2D2C22',
  warningFg: '#FBD48C',
  danger: '#FF9C85',
  onDanger: '#0B1622',
  dangerBg: '#35212A',
  dangerFg: '#FFC2B5',
  info: '#7FBFB6',
  infoBg: '#133038',
  infoFg: '#AED8D1',
  ring: '#7FBFB6',
  overlay: 'rgba(3,8,14,0.70)',
  toastSuccess: '#23582F',
  toastAction: '#A11254',
  gps: '#F55A9A',
  gpsRing: '#0B1622',
  mapCasing: '#0B1622',
  dayNumeral: '#0B1622',
  brassSoftFg: '#E9C88A',
  toastDanger: '#B42318',
  ringInverse: '#1E5A57',
  bubbleOwn: '#2C4258',
  bubbleOwnFg: '#F1EEE8',
  shimmer: '#1F344A',
}

/** Nombres registrados con `useFonts` en App.tsx (ver FUENTES_APP). */
export const fonts = {
  display: 'Newsreader_500Medium',
  displayItalic: 'Newsreader_500Medium_Italic',
  displayBold: 'Newsreader_600SemiBold',
  sans: 'InstrumentSans_400Regular',
  sansMedium: 'InstrumentSans_500Medium',
  sansSemiBold: 'InstrumentSans_600SemiBold',
  sansBold: 'InstrumentSans_700Bold',
  mono: 'GeistMono_500Medium',
} as const

/** Cifras tabulares (importes, totales, contadores). */
const TNUM: FontVariant[] = ['tabular-nums']

// En RN letterSpacing y lineHeight van en px; con familias custom no se usa fontWeight.
export const type = {
  displayXL: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -1.2,
  },
  displayL: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -0.85,
  },
  h1: {
    fontFamily: fonts.displayBold,
    fontSize: 28,
    lineHeight: 31,
    letterSpacing: -0.56,
  },
  h2: {
    fontFamily: fonts.displayBold,
    fontSize: 23,
    lineHeight: 27,
    letterSpacing: -0.35,
  },
  h3: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.2,
  },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 25 },
  bodyS: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18 },
  overline: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 1.7,
    textTransform: 'uppercase' as const,
  },
  data: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.3,
  },
  numXL: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: -0.7,
    fontVariant: TNUM,
  },
  num: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 24,
    lineHeight: 28,
    fontVariant: TNUM,
  },
} as const

export type TypeVariant = keyof typeof type

export const radius = {
  stamp: 4,
  control: 12,
  card: 16,
  sheet: 24,
  pill: 999,
  // Alias antiguos (no usar en código nuevo).
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
} as const

export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  12: 48,
  gutter: 16,
} as const

export const control = {
  sm: 36,
  md: 44,
  lg: 52,
  xl: 60,
  hit: 44,
  bottomBar: 72,
} as const

export const motion = {
  instant: 80,
  fast: 140,
  base: 200,
  medium: 280,
  slow: 420,
  page: 520,
  easing: {
    papel: Easing.bezier(0.22, 1, 0.36, 1),
    salida: Easing.bezier(0.4, 0, 1, 1),
    tinta: Easing.bezier(0.65, 0, 0.35, 1),
    sello: Easing.bezier(0.34, 1.56, 0.64, 1),
    portal: Easing.bezier(0.76, 0, 0.24, 1),
  },
  spring: {
    suave: { stiffness: 260, damping: 30 },
    firme: { stiffness: 500, damping: 38 },
    sello: { stiffness: 600, damping: 18 },
  },
} as const

export const elevation = {
  card: { borderWidth: 1 },
  elev: {
    shadowColor: '#0F1E2E',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  float: {
    shadowColor: '#0F1E2E',
    shadowOpacity: 0.24,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
} as const // en oscuro: superficie más clara + borde hairline en lugar de sombra

export const DAY_COLORS = [
  '#A63F26',
  '#1E5A57',
  '#7E5F22',
  '#3B4C8C',
  '#7A3B69',
  '#4F6427',
  '#1F6F95',
  '#8A2F3C',
  '#4A5560',
  '#9A5B13',
] as const
export const DAY_COLORS_DARK = [
  '#E58A68',
  '#6FB8AE',
  '#D9B468',
  '#8E9EE0',
  '#D08BC0',
  '#A9C26B',
  '#6CB8DE',
  '#E07F8C',
  '#A9B6C2',
  '#E3A15A',
] as const

/** Color del día N (1…): cíclico; nunca va solo, siempre con «Día N». */
export function colorDia(days: readonly string[], numero: number): string {
  const i = (((Math.max(1, Math.round(numero)) - 1) % 10) + 10) % 10
  return days[i] ?? days[0] ?? light.accent
}

/** `rgba()` a partir de un token hex (#RRGGBB) y una opacidad 0..1. */
export function alpha(hex: string, opacidad: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!m) return hex
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h ?? '0', 16))
  return `rgba(${r},${g},${b},${Math.min(1, Math.max(0, opacidad))})`
}

// ── Tema resuelto ──────────────────────────────────────────────────────────

export interface Tema {
  isDark: boolean
  colors: ThemeColors
  days: readonly string[]
  type: typeof type
  fonts: typeof fonts
  radius: typeof radius
  space: typeof space
  control: typeof control
  motion: typeof motion
  elevation: typeof elevation
}

const TEMA_CLARO: Tema = {
  isDark: false,
  colors: light,
  days: DAY_COLORS,
  type,
  fonts,
  radius,
  space,
  control,
  motion,
  elevation,
}

const TEMA_OSCURO: Tema = {
  ...TEMA_CLARO,
  isDark: true,
  colors: dark,
  days: DAY_COLORS_DARK,
}

export type PreferenciaTema = 'light' | 'dark' | 'system'

const CLAVE_TEMA = 'wayio-theme'

interface ContextoTema {
  preferencia: PreferenciaTema
  setPreferencia: (p: PreferenciaTema) => void
  /** true cuando ya se leyó la preferencia guardada. */
  listo: boolean
}

const TemaContext = createContext<ContextoTema | null>(null)

function esPreferencia(v: unknown): v is PreferenciaTema {
  return v === 'light' || v === 'dark' || v === 'system'
}

/** Guarda y aplica la preferencia de tema ('wayio-theme'). */
export function ThemeProvider({
  children,
}: {
  children: ReactNode
}): React.ReactElement {
  const [preferencia, setPref] = useState<PreferenciaTema>('system')
  const [listo, setListo] = useState(false)

  useEffect(() => {
    let vivo = true
    AsyncStorage.getItem(CLAVE_TEMA)
      .then((v) => {
        if (!vivo) return
        if (esPreferencia(v)) {
          setPref(v)
          try {
            Appearance.setColorScheme(v === 'system' ? null : v)
          } catch {
            // Plataformas sin soporte: el tema propio sigue funcionando.
          }
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (vivo) setListo(true)
      })
    return () => {
      vivo = false
    }
  }, [])

  const setPreferencia = useCallback((p: PreferenciaTema) => {
    setPref(p)
    try {
      // Teclado, diálogos nativos y selectores siguen el tema elegido.
      Appearance.setColorScheme(p === 'system' ? null : p)
    } catch {
      // Sin soporte nativo: no pasa nada.
    }
    AsyncStorage.setItem(CLAVE_TEMA, p).catch(() => undefined)
  }, [])

  const value = useMemo(
    () => ({ preferencia, setPreferencia, listo }),
    [preferencia, setPreferencia, listo]
  )
  return createElement(TemaContext.Provider, { value }, children)
}

/** Preferencia de tema del usuario y su setter. */
export function useThemePreference(): ContextoTema {
  const ctx = useContext(TemaContext)
  return (
    ctx ?? {
      preferencia: 'system',
      setPreferencia: () => undefined,
      listo: true,
    }
  )
}

/** Tema resuelto (objeto estable por esquema: sirve como dependencia). */
export function useTheme(): Tema {
  const sistema = useColorScheme()
  const ctx = useContext(TemaContext)
  const pref = ctx?.preferencia ?? 'system'
  const esquema = pref === 'system' ? sistema : pref
  return esquema === 'dark' ? TEMA_OSCURO : TEMA_CLARO
}

/**
 * Estilos que dependen del tema. `fabrica` debe declararse a nivel de módulo
 * (estable) y normalmente devuelve `StyleSheet.create(...)`.
 */
export function useEstilos<T>(fabrica: (tema: Tema) => T): T {
  const tema = useTheme()
  return useMemo(() => fabrica(tema), [fabrica, tema])
}

// ── Alias antiguos (tema claro) ────────────────────────────────────────────

/** @deprecated Usa `useTheme().colors`: estos valores no cambian en oscuro. */
export const colors = {
  primary: light.primary,
  primaryDark: light.primaryPressed,
  primaryLight: light.primarySoft,
  indigo: light.accent,
  purple: light.primaryText,
  bg: light.bg,
  surface: light.surface,
  border: light.border,
  text: light.fg,
  textMuted: light.fgMuted,
  textFaint: light.fgSubtle,
  green: light.success,
  greenBg: light.successBg,
  amber: light.warning,
  amberBg: light.warningBg,
  red: light.danger,
  redBg: light.dangerBg,
  skyBg: light.infoBg,
} as const
