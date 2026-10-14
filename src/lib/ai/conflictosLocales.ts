import type { Activity } from '@/types/activity'
import type {
  Conflict,
  ConflictSeverity,
  ConflictType,
} from '@/types/conflicts'
import type { Day } from '@/types/trip'

/**
 * Detección LOCAL de conflictos de horario (reglas deterministas, sin IA).
 *
 * Es pura y no importa nada del servidor: la UI puede usarla directamente en
 * el cliente para mostrar los conflictos al instante, sin llamar a la API.
 */

export interface ConflictoCrudo {
  tipo: ConflictType
  severidad: ConflictSeverity
  titulo: string
  descripcion: string
  actividadIds: string[]
}

/** "HH:MM" → minutos; null si no es una hora válida. */
function minutos(v: unknown): number | null {
  if (typeof v !== 'string') return null
  const m = /^(\d{1,2}):(\d{2})/.exec(v.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

const actividadesDe = (d: Day): Activity[] =>
  Array.isArray(d.actividades)
    ? d.actividades.filter(
        (a): a is Activity => Boolean(a) && typeof a === 'object'
      )
    : []

/** Una actividad perdida ya no ocupa su horario. */
const ocupaHorario = (a: Activity): boolean =>
  !a.esPerdida && a.estado !== 'perdida'

interface Tramo {
  a: Activity
  ini: number
  fin: number
}

export function detectarConflictosCrudos(dias: Day[]): ConflictoCrudo[] {
  const out: ConflictoCrudo[] = []

  dias.forEach((day, idx) => {
    const numero = idx + 1
    const acts = actividadesDe(day)

    const tramos: Tramo[] = acts
      .filter(ocupaHorario)
      .flatMap((a) => {
        const ini = minutos(a.horaInicio)
        const finRaw = minutos(a.horaFin)
        if (ini === null) return []
        // Cruza medianoche: lo tratamos como fin de día.
        const fin = finRaw === null || finRaw <= ini ? 24 * 60 : finRaw
        return [{ a, ini, fin }]
      })
      .sort((x, y) => x.ini - y.ini)

    // Solapes entre cualquier par de actividades del día.
    for (let i = 0; i < tramos.length; i++) {
      const x = tramos[i]
      if (!x) continue
      for (let j = i + 1; j < tramos.length; j++) {
        const y = tramos[j]
        if (!y || y.ini >= x.fin) continue
        out.push({
          tipo: 'overlap_horario',
          severidad: 'critico',
          titulo: 'Horarios que se solapan',
          descripcion: `"${x.a.nombre}" (${x.a.horaInicio}–${x.a.horaFin}) se cruza con "${y.a.nombre}" (${y.a.horaInicio}–${y.a.horaFin}) el día ${numero}.`,
          actividadIds: [x.a.id, y.a.id],
        })
      }
    }

    // Traslado insuficiente entre actividades consecutivas.
    for (let i = 0; i < tramos.length - 1; i++) {
      const x = tramos[i]
      const y = tramos[i + 1]
      if (!x || !y) continue
      const hueco = y.ini - x.fin
      const necesario = Math.max(0, Number(x.a.tiempoHastaSiguiente) || 0)
      if (hueco >= 0 && hueco < necesario) {
        out.push({
          tipo: 'tiempo_traslado_insuficiente',
          severidad: hueco < necesario / 2 ? 'critico' : 'advertencia',
          titulo: 'Poco tiempo para el traslado',
          descripcion: `Solo hay ${hueco} min entre "${x.a.nombre}" y "${y.a.nombre}", y el traslado lleva unos ${necesario} min.`,
          actividadIds: [x.a.id, y.a.id],
        })
      }
    }

    // Embarque de crucero: hay que estar en el puerto con antelación.
    tramos.forEach((t, i) => {
      if (!t.a.puertoCrucero) return
      const antelacion = Math.max(0, Number(t.a.tiempoEmbarqueMinutos) || 90)
      const limite = t.ini - antelacion
      const previa = tramos[i - 1]
      if (previa && previa.fin > limite) {
        out.push({
          tipo: 'embarque_crucero',
          severidad: 'critico',
          titulo: 'Riesgo de perder el crucero',
          descripcion: `"${previa.a.nombre}" termina a las ${previa.a.horaFin}, pero debes estar en el puerto ${antelacion} min antes del embarque (${t.a.horaInicio}).`,
          actividadIds: [previa.a.id, t.a.id],
        })
      }
    })

    // Actividades perdidas que nadie ha reagendado.
    for (const a of acts) {
      if (a.esPerdida && !a.reagendadaDesdeDia) {
        out.push({
          tipo: 'actividad_perdida_sin_reagendar',
          severidad: 'sugerencia',
          titulo: 'Actividad perdida sin reagendar',
          descripcion: `"${a.nombre}" quedó como perdida. Podemos buscarle otro hueco en el viaje.`,
          actividadIds: [a.id],
        })
      }
    }
  })

  return out
}

/** Convierte conflictos crudos (con ids) al tipo Conflict de la UI. */
export function aConflictos(
  crudos: ConflictoCrudo[],
  dias: Day[],
  prefijo = 'local'
): Conflict[] {
  const porId = new Map<string, Activity>()
  for (const d of dias) for (const a of actividadesDe(d)) porId.set(a.id, a)

  const vistos = new Set<string>()
  const idsUsados = new Set<string>()
  const out: Conflict[] = []
  for (const c of crudos) {
    const ids = [...new Set(c.actividadIds)].filter((id) => porId.has(id))
    const clave = `${c.tipo}:${ids.join(',')}:${c.titulo}`
    if (vistos.has(clave)) continue
    vistos.add(clave)
    // Id estable (tipo + actividades) y único dentro de la lista.
    const base = `${prefijo}-${c.tipo}-${ids.join('-') || 'general'}`
    let id = base
    for (let n = 2; idsUsados.has(id); n++) id = `${base}-${n}`
    idsUsados.add(id)
    out.push({
      id,
      tipo: c.tipo,
      severidad: c.severidad,
      titulo: c.titulo,
      descripcion: c.descripcion,
      actividadesAfectadas: ids
        .map((id) => porId.get(id))
        .filter((a): a is Activity => a !== undefined),
      soluciones: [],
    })
  }
  return out
}

/** Conflictos locales listos para la UI. */
export function detectarConflictosLocales(dias: Day[]): Conflict[] {
  return aConflictos(detectarConflictosCrudos(dias), dias, 'local')
}
