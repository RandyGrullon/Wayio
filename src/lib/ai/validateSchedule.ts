import { aiClient } from '@/lib/ai/client'
import { extractJson } from '@/lib/ai/extractJson'
import type { Day } from '@/types/trip'
import type {
  Conflict,
  ConflictType,
  ConflictSeverity,
} from '@/types/conflicts'
import type { Activity } from '@/types/activity'

interface RawConflict {
  tipo: ConflictType
  severidad: ConflictSeverity
  titulo: string
  descripcion: string
  actividadIds: string[]
}

function minutesFromTime(hhmm: string): number {
  const [h = '0', m = '0'] = hhmm.split(':')
  return parseInt(h, 10) * 60 + parseInt(m, 10)
}

function detectLocalConflicts(dias: Day[]): RawConflict[] {
  const conflicts: RawConflict[] = []

  for (const day of dias) {
    const acts = day.actividades

    for (let i = 0; i < acts.length; i++) {
      const a = acts[i]
      if (!a) continue
      const aStart = minutesFromTime(a.horaInicio)
      const aEnd = minutesFromTime(a.horaFin)

      // Overlap
      for (let j = i + 1; j < acts.length; j++) {
        const b = acts[j]
        if (!b) continue
        const bStart = minutesFromTime(b.horaInicio)
        const bEnd = minutesFromTime(b.horaFin)
        if (aStart < bEnd && bStart < aEnd) {
          conflicts.push({
            tipo: 'overlap_horario',
            severidad: 'critico',
            titulo: 'Horarios se solapan',
            descripcion: `"${a.nombre}" (${a.horaInicio}–${a.horaFin}) se superpone con "${b.nombre}" (${b.horaInicio}–${b.horaFin}) en día ${day.numero}.`,
            actividadIds: [a.id, b.id],
          })
        }
      }

      // Insufficient transfer time
      const next = acts[i + 1]
      if (next) {
        const gap = minutesFromTime(next.horaInicio) - aEnd
        const needed = a.tiempoHastaSiguiente
        if (gap < needed && gap >= 0) {
          conflicts.push({
            tipo: 'tiempo_traslado_insuficiente',
            severidad: gap < needed / 2 ? 'critico' : 'advertencia',
            titulo: 'Tiempo de traslado insuficiente',
            descripcion: `Solo ${gap} min entre "${a.nombre}" y "${next.nombre}", se necesitan ${needed} min.`,
            actividadIds: [a.id, next.id],
          })
        }
      }

      // Cruise boarding alert (90 min)
      if (a.puertoCrucero && a.tiempoEmbarqueMinutos) {
        const boardingDeadline = aStart - 90
        const prevAct = acts[i - 1]
        if (prevAct) {
          const prevEnd = minutesFromTime(prevAct.horaFin)
          if (prevEnd > boardingDeadline) {
            conflicts.push({
              tipo: 'embarque_crucero',
              severidad: 'critico',
              titulo: 'Riesgo de perder el crucero',
              descripcion: `"${prevAct.nombre}" termina a las ${prevAct.horaFin}, pero debes estar en el puerto 90 min antes del embarque (${a.horaInicio}).`,
              actividadIds: [prevAct.id, a.id],
            })
          }
        }
      }

      // Lost activity without rescheduling
      if (a.esPerdida && !a.reagendadaDesdeDia) {
        conflicts.push({
          tipo: 'actividad_perdida_sin_reagendar',
          severidad: 'sugerencia',
          titulo: 'Actividad perdida sin reagendar',
          descripcion: `"${a.nombre}" fue marcada como perdida. La IA puede sugerir una alternativa.`,
          actividadIds: [a.id],
        })
      }
    }
  }

  return conflicts
}

export async function validateSchedule(dias: Day[]): Promise<Conflict[]> {
  const localConflicts = detectLocalConflicts(dias)

  const prompt = `Analiza este itinerario de viaje e identifica conflictos adicionales no detectados por reglas básicas.
Tipos a detectar: lugar_cerrado (horarios reales), presupuesto_excedido, reserva_requerida, ruta_ineficiente, hora_inadecuada.
Ignora: overlap_horario, tiempo_traslado_insuficiente, embarque_crucero, actividad_perdida_sin_reagendar (ya detectados).

Para cada conflicto responde con un objeto JSON con estos campos exactos:
- tipo: uno de los tipos listados arriba
- severidad: "critico" | "advertencia" | "sugerencia" | "info"
- titulo: string corto
- descripcion: string explicando el problema
- actividadIds: string[] (IDs de actividades afectadas)

Responde SOLO con un array JSON válido. Sin texto. Sin bloques de código.
Si no hay conflictos adicionales responde [].

ITINERARIO:
${JSON.stringify(dias, null, 2)}`

  let aiConflicts: RawConflict[] = []
  try {
    const message = await aiClient.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })
    const content = message.content[0]
    if (content?.type === 'text' && content.text.trim()) {
      const parsed = extractJson<RawConflict[]>(content.text)
      if (Array.isArray(parsed)) aiConflicts = parsed
    }
  } catch {
    // AI validation is best-effort; local conflicts still returned
  }

  const allRaw = [...localConflicts, ...aiConflicts]
  const allActivities = dias.flatMap((d) => d.actividades)

  function findActs(ids: string[]): Activity[] {
    return ids
      .map((id) => allActivities.find((a) => a.id === id))
      .filter((a): a is Activity => a !== undefined)
  }

  return allRaw.map((raw, idx) => ({
    id: `conflict-${idx}-${raw.tipo}`,
    tipo: raw.tipo,
    severidad: raw.severidad,
    titulo: raw.titulo,
    descripcion: raw.descripcion,
    actividadesAfectadas: findActs(raw.actividadIds),
    soluciones: [],
  }))
}
