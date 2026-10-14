/**
 * Primitivas del sistema «Cuaderno de Ruta» (docs/DISENO.md §5).
 * Importa desde '@/components/ui' o desde cada archivo.
 */

export {
  Button,
  ButtonLink,
  IconButton,
  Spinner,
  buttonClasses,
  type ButtonProps,
  type ButtonLinkProps,
  type ButtonSize,
  type ButtonStyleOptions,
  type ButtonVariant,
  type IconButtonProps,
} from './Button'

export {
  Field,
  FieldLabel,
  FieldMessage,
  fieldClasses,
  useFieldIds,
  type FieldIds,
  type FieldProps,
  type FieldSize,
} from './Field'
export { Input, type InputProps } from './Input'
export { Textarea, type TextareaProps } from './Textarea'
export { Select, type SelectOption, type SelectProps } from './Select'
export {
  DateField,
  DateRangeField,
  type DateFieldProps,
  type DateRangeFieldProps,
  type DateRangeValue,
} from './DateField'
export { StepCounter, type StepCounterProps } from './StepCounter'

export {
  Chip,
  ChipGroup,
  type ChipGroupProps,
  type ChipOption,
  type ChipProps,
  type ChipSize,
} from './Chip'
export {
  Segmented,
  type SegmentedOption,
  type SegmentedProps,
} from './Segmented'
export { Switch, type SwitchProps } from './Switch'

export {
  Card,
  CardFila,
  CardFilas,
  CardFranja,
  CardKicker,
  CardPerforado,
  type CardProps,
  type CardVariant,
} from './Card'
export { Callout, type CalloutProps, type CalloutTone } from './Callout'
export {
  BADGE_SUSCRIPCION,
  BADGE_VIAJE,
  Badge,
  EstadoBadge,
  SelloInfo,
  type BadgeProps,
  type BadgeVariant,
  type EstadoBadgeDef,
  type SelloInfoProps,
  type SelloTone,
} from './Badge'

export {
  ConfirmDialog,
  Drawer,
  Modal,
  Sheet,
  type ConfirmDialogProps,
  type ModalProps,
  type ModalVariant,
} from './Modal'
export { Menu, type MenuItem, type MenuProps } from './Menu'
export { Tooltip, type TooltipProps } from './Tooltip'
export {
  Tab,
  TabList,
  TabPanel,
  Tabs,
  type TabListProps,
  type TabPanelProps,
  type TabProps,
  type TabsProps,
} from './Tabs'
export {
  ToastProvider,
  useToast,
  useToastOffset,
  type ToastAction,
  type ToastApi,
  type ToastOptions,
  type ToastTone,
} from './Toast'

export {
  Skeleton,
  SkeletonFilaTabla,
  SkeletonMapa,
  SkeletonPortada,
  SkeletonRegion,
  SkeletonStat,
  SkeletonText,
  SkeletonTimeline,
  SkeletonVersion,
} from './Skeleton'
export {
  EmptyState,
  type EmptyIlustracion,
  type EmptyStateProps,
} from './EmptyState'
export {
  Avatar,
  AvatarStack,
  iniciales,
  indiceDesdeId,
  type AvatarProps,
  type AvatarSize,
  type AvatarStackProps,
} from './Avatar'

export {
  THEME_EVENT,
  THEME_STORAGE_KEY,
  ThemeToggle,
  applyTheme,
  setThemePreference,
  useThemePreference,
  type ThemePreference,
} from './ThemeToggle'
export { Logo, type LogoProps, type LogoTone, type LogoVariant } from './Logo'
export { DUR, EASE, SPRING } from './motion'
