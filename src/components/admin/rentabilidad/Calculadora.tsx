'use client'

import { useMemo, useState } from 'react'
import { Callout } from '@/components/ui/Callout'
import { Segmented } from '@/components/ui/Segmented'
import { guardarSupuestosRentabilidad } from '@/lib/admin/rentabilidad/actions'
import { calcularRentabilidad, usoDe } from '@/lib/rentabilidad/calculo'
import type {
  ClavePeriodo,
  PropsRentabilidad,
  Supuestos,
} from '@/lib/rentabilidad/tipos'
import { formatNumero } from '@/lib/utils/formatters'
import { fechaHora } from '../etiquetas'
import { useAccion } from '../useAccion'
import { PanelSupuestos } from './PanelSupuestos'
import {
  AccionesPorUsuario,
  Alertas,
  EconomiaPlanes,
  Escenarios,
  IaPorAccion,
  IaPorGrupo,
  PlanGratis,
  ProyeccionMes,
  PuntoEquilibrio,
  ResumenMes,
} from './Resultados'

/**
 * Isla cliente de /admin/rentabilidad (solo el dueño). Recibe los datos
 * reales y los supuestos como props del Server Component (tras requireOwner)
 * y recalcula al momento con la función pura calcularRentabilidad. Nada de
 * este archivo lleva cifras propias: todo llega por props.
 */
export function CalculadoraRentabilidad({
  datos,
  supuestos: iniciales,
  porDefecto,
  referencias,
}: PropsRentabilidad) {
  const ejecutar = useAccion()
  const [guardados, setGuardados] = useState<Supuestos>(iniciales)
  const [s, setS] = useState<Supuestos>(iniciales)
  const [version, setVersion] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [periodo, setPeriodo] = useState<ClavePeriodo>('mes')

  const r = useMemo(
    () => calcularRentabilidad(datos, s, referencias, periodo),
    [datos, s, referencias, periodo]
  )
  const hayCambios = JSON.stringify(s) !== JSON.stringify(guardados)

  const cambiar = (nuevo: Supuestos, rehacerCampos = false) => {
    setS(nuevo)
    if (rehacerCampos) setVersion((v) => v + 1)
  }

  const guardar = async () => {
    const enviados = s
    setGuardando(true)
    const ok = await ejecutar(() => guardarSupuestosRentabilidad(enviados), {
      exito: 'Supuestos guardados',
      error: 'No se pudieron guardar los supuestos',
    })
    setGuardando(false)
    if (ok) setGuardados(enviados)
  }

  const p = datos.periodos[periodo]
  const avisos = [
    datos.supuestos.estado === 'sin_tabla'
      ? {
          id: 'tabla',
          tono: 'warning' as const,
          titulo: 'Falta la tabla privada de supuestos',
          texto:
            'Aplica la migración 20261017130000_cupos_y_rentabilidad.sql en Supabase para guardar los supuestos. Mientras tanto se usan los del informe.',
        }
      : null,
    datos.supuestos.estado === 'invalidos'
      ? {
          id: 'invalidos',
          tono: 'warning' as const,
          titulo: 'Los supuestos guardados no son válidos',
          texto:
            'Se muestran los valores por defecto. Guarda de nuevo para corregirlos.',
        }
      : null,
    !datos.contadores.disponible
      ? {
          id: 'contadores',
          tono: 'info' as const,
          titulo: 'Aún no existe usage_counters',
          texto:
            'Las acciones por usuario salen de ai_logs (aproximadas) hasta aplicar la migración 20261017130000.',
        }
      : null,
    datos.truncado
      ? {
          id: 'truncado',
          tono: 'warning' as const,
          titulo: 'Hay más de 50,000 filas en alguna tabla',
          texto:
            'Los totales se quedan cortos: hace falta agregar en SQL (una RPC) para este volumen.',
        }
      : null,
    p.ia.llamadas === 0
      ? {
          id: 'sin-ia',
          tono: 'info' as const,
          titulo: 'Sin llamadas de IA registradas en el periodo',
          texto:
            'Los costos por acción y los perfiles salen del informe (marcados «supuesto»).',
        }
      : null,
  ].filter((a) => a !== null)

  return (
    <div className="space-y-8">
      {avisos.length > 0 ? (
        <div className="space-y-3">
          {avisos.map((a) => (
            <Callout key={a.id} tone={a.tono} title={a.titulo}>
              {a.texto}
            </Callout>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Periodo de los datos reales"
          options={[
            { value: 'mes', label: 'Mes en curso' },
            { value: '30d', label: 'Últimos 30 días' },
          ]}
          value={periodo}
          onValueChange={setPeriodo}
          className="max-sm:w-full"
          fullWidth={false}
        />
        <p className="text-caption text-fg-muted">
          {p.factorMes > 1.01
            ? `IA proyectada a un mes completo desde ${formatNumero(p.dias, 1)} días. `
            : ''}
          Datos leídos el {fechaHora(datos.generadoEn)}
        </p>
      </div>

      <ResumenMes r={r} datos={datos} s={s} />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)] xl:items-start">
        <aside
          aria-label="Supuestos editables"
          className="xl:sticky xl:top-20 xl:order-2 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto xl:overscroll-contain"
        >
          <PanelSupuestos
            s={s}
            onCambio={cambiar}
            datos={datos}
            referencias={referencias}
            usoDisponible={usoDe(datos, p)}
            hayCambios={hayCambios}
            guardando={guardando}
            onGuardar={() => void guardar()}
            onRestablecer={() => cambiar(porDefecto, true)}
            version={version}
          />
        </aside>
        <div className="min-w-0 space-y-8 xl:order-1">
          <Alertas alertas={r.alertas} />
          <EconomiaPlanes r={r} s={s} />
          <PlanGratis r={r} s={s} />
          <PuntoEquilibrio r={r} s={s} />
          <ProyeccionMes r={r} s={s} />
          <Escenarios r={r} s={s} datos={datos} referencias={referencias} />
          <IaPorAccion r={r} s={s} />
          <IaPorGrupo r={r} s={s} />
          <AccionesPorUsuario r={r} />
          <p className="text-caption text-fg-subtle">
            Fuente de los supuestos: {referencias.fuente}. Cifras de IA
            estimadas con los precios de src/lib/ai/pricing.ts.
          </p>
        </div>
      </div>
    </div>
  )
}
