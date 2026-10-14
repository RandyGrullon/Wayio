import {
  CheckCircle2,
  Circle,
  CircleDot,
  XCircle,
  type LucideIcon,
} from '../../ui/iconos'
import type { ColorTexto } from '../../ui/Txt'
import type { ActivityStatus } from '../../../types/activity'

/** Estado de una actividad: siempre icono + texto (nunca solo color). */
export const ESTADO_VISUAL: Record<
  ActivityStatus,
  { etiqueta: string; icon: LucideIcon; color: ColorTexto }
> = {
  pendiente: { etiqueta: 'Pendiente', icon: Circle, color: 'fgMuted' },
  en_curso: { etiqueta: 'En curso', icon: CircleDot, color: 'accent' },
  completada: {
    etiqueta: 'Completada',
    icon: CheckCircle2,
    color: 'successFg',
  },
  perdida: { etiqueta: 'Perdida', icon: XCircle, color: 'fgSubtle' },
}
