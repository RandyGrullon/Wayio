import { Callout } from '@/components/ui/Callout'
import { Card, CardKicker } from '@/components/ui/Card'
import { cn } from '@/lib/utils/cn'

/**
 * «Antes de ir» (advertencias, Callout warning) y «Notas de ruta» (consejos,
 * Card nota). docs/DISENO.md §1.4 y §6.5. Sin estado: valen en el servidor.
 */

export function AntesDeIr({
  advertencias,
  className,
}: {
  advertencias: readonly string[]
  className?: string
}) {
  const lista = (advertencias ?? [])
    .filter((a): a is string => typeof a === 'string')
    .map((a) => a.trim())
    .filter(Boolean)
  if (lista.length === 0) return null
  return (
    <section aria-label="Antes de ir" className={className}>
      <Callout tone="warning" title="Antes de ir" role="note">
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {lista.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </Callout>
    </section>
  )
}

export function NotasDeRuta({
  consejos,
  className,
}: {
  consejos: readonly string[]
  className?: string
}) {
  const lista = (consejos ?? [])
    .filter((c): c is string => typeof c === 'string')
    .map((c) => c.trim())
    .filter(Boolean)
  if (lista.length === 0) return null
  return (
    <section aria-label="Notas de ruta" className={className}>
      <Card variant="nota">
        <CardKicker>Notas de ruta</CardKicker>
        <ul
          className={cn(
            'mt-3 space-y-2 text-body-s',
            'list-disc pl-5 marker:text-brass'
          )}
        >
          {lista.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </Card>
    </section>
  )
}
