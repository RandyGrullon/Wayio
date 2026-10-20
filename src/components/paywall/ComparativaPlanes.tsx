import { Check, Minus } from 'lucide-react'
import {
  COMPARATIVA,
  NOTA_USO_JUSTO,
  type FilaComparativa,
} from '@/constants/planes'
import { cn } from '@/lib/utils/cn'

/**
 * Comparativa Gratis vs Pro desde el catálogo público (COMPARATIVA). Tabla
 * accesible desde md; en móvil, una lista por función. Incluido / no incluido
 * se dice con icono Y texto (nunca solo con color).
 */

type Valor = FilaComparativa['gratis']

function Celda({
  valor,
  compacta = false,
}: {
  valor: Valor
  compacta?: boolean
}) {
  if (typeof valor === 'string') {
    return <span className="font-medium text-fg tnum">{valor}</span>
  }
  const Icono = valor ? Check : Minus
  const texto = valor ? 'Incluido' : 'No incluido'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5',
        valor ? 'text-fg' : 'text-fg-subtle'
      )}
    >
      <Icono
        aria-hidden="true"
        strokeWidth={1.75}
        className={cn('size-4 shrink-0', valor && 'text-success')}
      />
      <span className={compacta ? undefined : 'sr-only'}>{texto}</span>
    </span>
  )
}

export function ComparativaPlanes({ className }: { className?: string }) {
  return (
    <div className={className}>
      {/* Escritorio y tableta: tabla */}
      <table className="hidden w-full border-collapse text-left text-body-s md:table">
        <caption className="sr-only">
          Qué incluye el plan Gratis y qué suma Pro
        </caption>
        <thead>
          <tr className="border-b border-border-strong">
            <th scope="col" className="py-3 pr-4 text-label text-fg-muted">
              Función
            </th>
            <th scope="col" className="w-[22%] px-4 py-3 text-label text-fg">
              Gratis
            </th>
            <th scope="col" className="w-[22%] py-3 pl-4 text-label text-fg">
              Pro
            </th>
          </tr>
        </thead>
        <tbody>
          {COMPARATIVA.map((f) => (
            <tr key={f.funcion} className="border-b border-border align-top">
              <th scope="row" className="py-3.5 pr-4 font-normal text-fg">
                {f.funcion}
                {f.nota ? (
                  <span className="mt-0.5 block text-caption text-fg-muted">
                    {f.nota}
                  </span>
                ) : null}
              </th>
              <td className="px-4 py-3.5">
                <Celda valor={f.gratis} />
              </td>
              <td className="py-3.5 pl-4">
                <Celda valor={f.pro} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Móvil: lista */}
      <ul className="divide-y divide-border border-y border-border md:hidden">
        {COMPARATIVA.map((f) => (
          <li key={f.funcion} className="py-4">
            <p className="text-body-s font-semibold text-fg">{f.funcion}</p>
            {f.nota ? (
              <p className="mt-0.5 text-caption text-fg-muted">{f.nota}</p>
            ) : null}
            <dl className="mt-2 grid grid-cols-2 gap-3 text-body-s">
              <div>
                <dt className="kicker">Gratis</dt>
                <dd className="mt-1">
                  <Celda valor={f.gratis} compacta />
                </dd>
              </div>
              <div>
                <dt className="kicker">Pro</dt>
                <dd className="mt-1">
                  <Celda valor={f.pro} compacta />
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-caption text-fg-subtle">{NOTA_USO_JUSTO}</p>
      <p className="mt-1.5 text-caption text-fg-subtle">
        Pro es lo mismo con el plan mensual, el anual o el pase de 30 días.
      </p>
    </div>
  )
}
