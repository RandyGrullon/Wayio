import type { Metadata } from 'next'
import { Encabezado } from '@/components/admin/Encabezado'
import { EstadoEntorno } from '@/components/admin/EstadoEntorno'
import {
  AjusteMantenimiento,
  AjusteProveedorIa,
} from '@/components/admin/SettingsPanel'
import { aiProvider } from '@/lib/ai/config'
import { exigirAdmin } from '../_lib/acceso'
import { datosAjustes } from '../_lib/datos'

export const metadata: Metadata = { title: 'Ajustes · Admin' }

export default async function SettingsPage() {
  if (!(await exigirAdmin())) return null
  const settings = await datosAjustes()
  const maintenance = settings['maintenance_mode'] ?? {}
  const proveedor = settings['ai_provider'] ?? {}

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Ajustes"
        descripcion="Configuración global que comparten la web y la app."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)] xl:items-start">
        <div className="space-y-6">
          <AjusteMantenimiento
            enabled={maintenance['enabled'] === true}
            message={
              typeof maintenance['message'] === 'string'
                ? maintenance['message']
                : ''
            }
          />
          <AjusteProveedorIa
            provider={
              typeof proveedor['provider'] === 'string'
                ? proveedor['provider']
                : aiProvider()
            }
            proveedorEntorno={aiProvider()}
          />
        </div>
        <EstadoEntorno />
      </div>
    </div>
  )
}
