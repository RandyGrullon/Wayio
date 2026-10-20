'use client'

import { ArrowRight, RotateCcw } from 'lucide-react'
import {
  ACCIONES_CON_CUPO,
  RUTA_PLANES,
  textoRenovacion,
} from '@/components/trip/limitesIA'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SkeletonRegion, SkeletonText } from '@/components/ui/Skeleton'
import { NOMBRE_ACCION, NOTA_USO_JUSTO } from '@/constants/planes'
import { useCupo } from '@/hooks/useCupo'
import { cn } from '@/lib/utils/cn'

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/**
 * «Tu uso este mes» de /cuenta con GET /api/cupo: los cupos del plan Gratis
 * (usados de límite, con barra) o «Sin límite con Pro», y el enlace a planes.
 */
export function UsoDelMes() {
  const { cupo, loading, refresh } = useCupo()
  const renueva = textoRenovacion(cupo?.renueva)
  const cupos = cupo?.cupos ?? null

  return (
    <Card as="section" aria-labelledby="cuenta-uso">
      <p className="kicker">Uso de la IA</p>
      <h2 id="cuenta-uso" className="mt-2 font-display text-h3 text-fg">
        Tu uso este mes
      </h2>

      {loading ? (
        <SkeletonRegion label="Cargando tu uso…" className="mt-5">
          <SkeletonText lines={3} className="max-w-sm" />
        </SkeletonRegion>
      ) : !cupo ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-body-s text-fg-muted">
            No pudimos cargar tu uso ahora mismo.
          </p>
          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw />}
            onClick={() => void refresh()}
          >
            Reintentar
          </Button>
        </div>
      ) : cupos === null ? (
        <div className="mt-3 flex flex-col gap-2 text-body-s">
          <p className="text-title text-fg">Sin límite con Pro</p>
          <p className="max-w-[60ch] text-fg-muted">
            {NOTA_USO_JUSTO.replace(/^\*/, '')}
          </p>
        </div>
      ) : (
        <>
          <dl className="mt-5 flex flex-col gap-4">
            {ACCIONES_CON_CUPO.map((a) => {
              const { usados, limite } = cupos[a]
              const agotado = limite > 0 && usados >= limite
              const ancho =
                limite > 0
                  ? Math.min(100, Math.round((usados / limite) * 100))
                  : 0
              return (
                <div
                  key={a}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-2 text-body-s"
                >
                  <dt className="text-fg">
                    {mayuscula(NOMBRE_ACCION[a].varios)}
                  </dt>
                  <dd className="flex items-center gap-2 text-fg tnum">
                    {agotado ? <Badge variant="warning">Agotado</Badge> : null}
                    <span>
                      {usados} de {limite}
                    </span>
                  </dd>
                  {/* La barra repite la cifra: solo visual. */}
                  <dd
                    aria-hidden="true"
                    className="col-span-2 mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"
                  >
                    <div
                      className={cn(
                        'h-full rounded-full',
                        agotado ? 'bg-warning' : 'bg-fg'
                      )}
                      style={{ width: `${ancho}%` }}
                    />
                  </dd>
                </div>
              )
            })}
          </dl>
          <p className="mt-4 text-caption text-fg-muted">
            {renueva
              ? `Tu cupo se renueva ${renueva}.`
              : 'Tu cupo se renueva el día 1 de cada mes.'}
            {cupo.aproximado
              ? ' Ahora mismo no pudimos leer tu uso exacto: las cifras pueden no estar al día.'
              : ''}
          </p>
        </>
      )}

      <ButtonLink
        href={RUTA_PLANES}
        variant="link"
        iconEnd={<ArrowRight />}
        className="mt-5"
      >
        Ver planes
      </ButtonLink>
    </Card>
  )
}
