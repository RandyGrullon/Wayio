/** Shared design tokens, matching the Wayio web palette (blue/indigo + grays). */
export const colors = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#EFF6FF',
  indigo: '#4F46E5',
  purple: '#7C3AED',
  bg: '#F9FAFB',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  text: '#111827',
  textMuted: '#6B7280',
  textFaint: '#9CA3AF',
  green: '#16A34A',
  greenBg: '#F0FDF4',
  amber: '#D97706',
  amberBg: '#FFFBEB',
  red: '#DC2626',
  redBg: '#FEF2F2',
  skyBg: '#F0F9FF',
} as const

export const radius = { sm: 8, md: 12, lg: 16, xl: 20 } as const

export const DAY_COLORS = [
  '#2563EB',
  '#16A34A',
  '#D97706',
  '#DC2626',
  '#7C3AED',
  '#0891B2',
  '#BE185D',
] as const
