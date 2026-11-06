import { useCallback, useRef, useState } from 'react'
import CalendarPlus from 'lucide-react-native/icons/calendar-plus'
import Printer from 'lucide-react-native/icons/printer'
import { Button } from '../ui/Button'
import { useToast } from '../ui/Toast'
import { compartirCalendario } from '../../lib/exportar/calendario'
import { ErrorExportar } from '../../lib/exportar/nativos'
import { exportarPdf, type OpcionesPdf } from '../../lib/exportar/pdf'
import type { PlanningTrip } from '../../types/planning'

/** Iconos de «Añadir al calendario» y «Exportar PDF» (también para menús). */
export const IconoCalendario = CalendarPlus
export const IconoPdf = Printer

export type Exportando = 'pdf' | 'calendario' | null

/**
 * «Exportar PDF» y «Añadir al calendario» del viaje guardado (web:
 * VistaViaje.tsx, menú «Más»). Funcionan sin conexión: todo se genera en el
 * dispositivo. Un solo trabajo a la vez; los fallos salen en un toast.
 */
export function useExportarViaje(): {
  exportando: Exportando
  alCalendario: (trip: PlanningTrip) => Promise<void>
  aPdf: (trip: PlanningTrip, opciones: OpcionesPdf) => Promise<void>
} {
  const toast = useToast()
  const [exportando, setExportando] = useState<Exportando>(null)
  const ocupado = useRef(false)

  const ejecutar = useCallback(
    async (
      tipo: 'pdf' | 'calendario',
      trabajo: () => Promise<unknown>
    ): Promise<void> => {
      if (ocupado.current) return
      ocupado.current = true
      setExportando(tipo)
      try {
        await trabajo()
      } catch (e) {
        toast.error(
          e instanceof ErrorExportar
            ? e.message
            : tipo === 'pdf'
              ? 'No pudimos exportar el PDF. Inténtalo de nuevo.'
              : 'No pudimos preparar el calendario. Inténtalo de nuevo.'
        )
      } finally {
        ocupado.current = false
        setExportando(null)
      }
    },
    [toast]
  )

  const alCalendario = useCallback(
    (trip: PlanningTrip) =>
      ejecutar('calendario', () => compartirCalendario(trip)),
    [ejecutar]
  )

  const aPdf = useCallback(
    (trip: PlanningTrip, opciones: OpcionesPdf) =>
      ejecutar('pdf', () => exportarPdf(trip, opciones)),
    [ejecutar]
  )

  return { exportando, alCalendario, aPdf }
}

/** Los dos botones para la fila de acciones del viaje. */
export function BotonesExportar({
  exportando,
  onCalendario,
  onPdf,
}: {
  exportando: Exportando
  onCalendario: () => void
  onPdf: () => void
}): React.ReactElement {
  return (
    <>
      <Button
        title="Calendario"
        variant="outline"
        icon={IconoCalendario}
        loading={exportando === 'calendario'}
        loadingText="Preparando…"
        disabled={exportando !== null && exportando !== 'calendario'}
        accessibilityLabel="Añadir al calendario"
        accessibilityHint="Comparte un archivo .ics con todas las actividades"
        onPress={onCalendario}
      />
      <Button
        title="PDF"
        variant="outline"
        icon={IconoPdf}
        loading={exportando === 'pdf'}
        loadingText="Creando PDF…"
        disabled={exportando !== null && exportando !== 'pdf'}
        accessibilityLabel="Exportar PDF"
        accessibilityHint="Crea un PDF del itinerario para guardarlo o imprimirlo"
        onPress={onPdf}
      />
    </>
  )
}
