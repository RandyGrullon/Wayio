import type { Metadata } from 'next'
import { CopiarTexto } from '@/components/admin/CopiarTexto'
import { DataTable } from '@/components/admin/DataTable'
import type { Columna } from '@/components/admin/DataTable'
import { Encabezado } from '@/components/admin/Encabezado'
import {
  AccionesFuncion,
  BotonNuevaFuncion,
} from '@/components/admin/FlagCreateForm'
import { ToggleAction } from '@/components/admin/ToggleAction'
import {
  ETIQUETA_PLATAFORMA,
  cantidad,
  etiqueta,
  fecha,
} from '@/components/admin/etiquetas'
import { Badge } from '@/components/ui/Badge'
import { Callout } from '@/components/ui/Callout'
import { EmptyState } from '@/components/ui/EmptyState'
import { deleteFlag, toggleFlag } from '@/lib/admin/actions'
import type { FeatureFlagRow } from '@/types/admin'
import { exigirAdmin } from '../_lib/acceso'
import { datosFunciones } from '../_lib/datos'

export const metadata: Metadata = { title: 'Funciones · Admin' }

function valorJson(valor: Record<string, unknown> | null | undefined): string {
  if (!valor || Object.keys(valor).length === 0) return ''
  try {
    return JSON.stringify(valor)
  } catch {
    return ''
  }
}

const COLUMNAS: readonly Columna<FeatureFlagRow>[] = [
  {
    id: 'estado',
    encabezado: 'Estado',
    tarjeta: 'meta',
    className: 'w-24',
    celda: (f) => (
      <ToggleAction
        enabled={f.enabled}
        action={toggleFlag.bind(null, f.key)}
        label={`Activar la función ${f.key}`}
        exitoActivar={`«${f.key}» activada`}
        exitoDesactivar={`«${f.key}» desactivada`}
        error="No se pudo cambiar la función"
      />
    ),
  },
  {
    id: 'clave',
    encabezado: 'Clave',
    tarjeta: 'titulo',
    celda: (f) => (
      <span className="block min-w-0">
        <CopiarTexto
          valor={f.key}
          etiqueta="Copiar clave"
          aviso="Clave copiada"
          className="[&_code]:text-fg"
        />
        <span className="block text-caption text-fg-muted">
          {f.enabled ? 'Activa' : 'Inactiva'}
        </span>
      </span>
    ),
  },
  {
    id: 'descripcion',
    encabezado: 'Descripción',
    className: 'min-w-[200px] max-w-[320px] text-fg-muted',
    celda: (f) => f.description ?? '—',
  },
  {
    id: 'plataforma',
    encabezado: 'Plataforma',
    tarjeta: 'meta',
    celda: (f) => (
      <Badge variant="brand">{etiqueta(ETIQUETA_PLATAFORMA, f.platform)}</Badge>
    ),
  },
  {
    id: 'valor',
    encabezado: 'Valor',
    className: 'max-lg:hidden',
    celda: (f) => {
      const json = valorJson(f.value)
      return json ? (
        <code
          className="block max-w-[220px] truncate font-mono text-[12px] text-fg-muted"
          title={json}
        >
          {json}
        </code>
      ) : (
        <span className="text-fg-subtle">—</span>
      )
    },
  },
  {
    id: 'actualizada',
    encabezado: 'Actualizada',
    className: 'whitespace-nowrap text-fg-muted',
    celda: (f) => fecha(f.updated_at),
  },
]

export default async function FlagsPage() {
  if (!(await exigirAdmin())) return null
  const flags = await datosFunciones()
  const activas = flags.filter((f) => f.enabled).length

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Funciones"
        descripcion="Interruptores remotos por plataforma (feature flags)."
        acciones={<BotonNuevaFuncion />}
      />

      <Callout
        tone="info"
        title="La web y la app aún no consumen estas funciones"
      >
        Se publican con la configuración remota, pero ninguna pantalla las lee
        todavía: cambiarlas no tiene efecto visible por ahora.
      </Callout>

      <DataTable
        etiqueta="Funciones"
        cabecera={
          <span className="tnum">
            {cantidad(flags.length, 'función', 'funciones')} ·{' '}
            {cantidad(activas, 'activa', 'activas')}
          </span>
        }
        columnas={COLUMNAS}
        filas={flags}
        clave={(f) => f.key}
        acciones={(f) => (
          <AccionesFuncion flag={f} eliminar={deleteFlag.bind(null, f.key)} />
        )}
        vacio={
          <EmptyState
            illustration="sello"
            title="Aún no hay funciones"
            description="Crea la primera con «Nueva función»."
          />
        }
      />
    </div>
  )
}
