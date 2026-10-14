'use client'

import { Card } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Segmented'
import { formatPorcentaje } from '@/lib/utils/formatters'

type Opcion = 'si' | 'no'

interface VotingPanelProps {
  /** «¿Incluimos Islas del Rosario?» */
  question: string
  /** Contexto bajo la pregunta («Día 2 · 10:00 a. m.»). */
  detalle?: string
  si: number
  no: number
  /** Voto propio cargado de activity_votes (null si aún no votó). */
  miVoto: boolean | null
  onVote: (voto: boolean) => void
}

/**
 * Votación de una actividad (docs/DISENO.md §6.8): Segmented Sí/No y barra
 * de resultado con Sí en `accent` y No en `fg-subtle`, separadas por 2 px y
 * siempre con etiqueta y conteo (el color nunca va solo). El voto es
 * optimista (useGroup) y se puede cambiar cuando se quiera.
 */
export function VotingPanel({
  question,
  detalle,
  si,
  no,
  miVoto,
  onVote,
}: VotingPanelProps) {
  const total = si + no
  const pctSi = total > 0 ? Math.round((si / total) * 100) : 0
  const pctNo = total > 0 ? 100 - pctSi : 0
  const valor: Opcion | '' = miVoto === null ? '' : miVoto ? 'si' : 'no'

  return (
    <Card as="article" className="flex flex-col gap-4 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-title text-fg">{question}</h3>
          {detalle ? (
            <p className="mt-0.5 text-caption text-fg-muted tnum">{detalle}</p>
          ) : null}
        </div>
        <Segmented<Opcion | ''>
          label={`Tu voto: ${question}`}
          value={valor}
          onValueChange={(v) => {
            if (v) onVote(v === 'si')
          }}
          options={[
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No' },
          ]}
        />
      </div>

      <div>
        {total > 0 ? (
          <div aria-hidden="true" className="flex h-2 gap-0.5 overflow-hidden">
            {si > 0 ? (
              <span
                className="h-full rounded-full bg-accent"
                style={{ width: `${pctSi}%` }}
              />
            ) : null}
            {no > 0 ? (
              <span
                className="h-full rounded-full bg-fg-subtle"
                style={{ width: `${pctNo}%` }}
              />
            ) : null}
          </div>
        ) : (
          <div aria-hidden="true" className="h-2 rounded-full bg-surface-2" />
        )}
        <p className="mt-2 flex flex-wrap justify-between gap-2 text-caption text-fg-muted tnum">
          <span>
            {total > 0 ? `${si} sí · ${no} no` : 'Nadie ha votado todavía'}
          </span>
          {total > 0 ? (
            <span>
              {formatPorcentaje(pctSi)} a favor
              {miVoto !== null ? ` · Votaste ${miVoto ? 'sí' : 'no'}` : ''}
            </span>
          ) : null}
        </p>
      </div>
    </Card>
  )
}
