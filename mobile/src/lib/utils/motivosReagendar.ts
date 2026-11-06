/**
 * Motivos de «Me la perdí» (los mismos chips y textos que la web,
 * src/app/trip/[id]/_componentes/ReagendarSheet.tsx). El texto es el `reason`
 * que se manda a /api/reschedule para que la IA proponga mejor la nueva hora.
 */

export type MotivoReagendar = 'tarde' | 'cerrado' | 'planes' | 'otro'

export const MOTIVOS_REAGENDAR: readonly {
  value: MotivoReagendar
  label: string
}[] = [
  { value: 'tarde', label: 'Llegué tarde' },
  { value: 'cerrado', label: 'Estaba cerrado' },
  { value: 'planes', label: 'Cambio de planes' },
  { value: 'otro', label: 'Otro motivo' },
]

/** Motivo marcado al abrir (igual que la web). */
export const MOTIVO_POR_DEFECTO: MotivoReagendar = 'tarde'

const MOTIVO_OTRO = 'El viajero la perdió o no pudo asistir.'

const TEXTO_MOTIVO: Record<MotivoReagendar, string> = {
  tarde: 'El viajero llegó tarde y se la perdió.',
  cerrado: 'El lugar estaba cerrado.',
  planes: 'El viajero cambió de planes.',
  otro: MOTIVO_OTRO,
}

/** Texto del motivo para /api/reschedule (`reason`). */
export function textoMotivoReagendar(motivo: MotivoReagendar | null): string {
  return motivo ? TEXTO_MOTIVO[motivo] : MOTIVO_OTRO
}
