import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { colorDia, useEstilos, useTheme, type Tema } from '../../theme'
import { Button } from '../ui/Button'
import { ChipGroup, type OpcionChip } from '../ui/Chip'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { IconButton } from '../ui/IconButton'
import { Input } from '../ui/Input'
import { Sheet } from '../ui/Sheet'
import { Txt } from '../ui/Txt'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from '../ui/iconos'
import { formatCurrency, formatHora12, minutosDelDia } from '../ui/formato'
import { TIPO_LABEL } from './DayCard'
import type {
  PlanningActivity,
  PlanningActivityType,
  PlanningDay,
} from '../../types/planning'

const TIPOS: readonly OpcionChip<PlanningActivityType>[] = (
  [
    'actividad',
    'museo',
    'restaurante',
    'templo',
    'parque',
    'barrio',
    'playa',
    'traslado',
  ] as const
).map((t) => ({ value: t, label: TIPO_LABEL[t] }))

interface Props {
  dias: PlanningDay[]
  onChange: (dias: PlanningDay[]) => void
  moneda?: string
}

function uid(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  return uuid ?? `act-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function nuevaActividad(): PlanningActivity {
  return {
    id: uid(),
    nombre: '',
    descripcion: '',
    horaInicio: '09:00',
    horaFin: '10:00',
    duracionMinutos: 60,
    tipo: 'actividad',
    direccion: '',
    lat: 0,
    lng: 0,
    radioGeofencingMetros: 150,
    precioEstimado: 0,
    reservaRequerida: false,
    reservaPagada: false,
    mejorHoraVisita: '',
    consejos: [],
    tiempoHastaSiguiente: 0,
    estado: 'pendiente',
    esPerdida: false,
  }
}

/** Minutos entre dos 'HH:MM'; 0 si no se pueden leer o el fin es anterior. */
function minutosEntre(inicio: string, fin: string): number {
  const a = minutosDelDia(inicio)
  const b = minutosDelDia(fin)
  if (a === null || b === null) return 0
  return b > a ? b - a : 0
}

function clonar(dias: PlanningDay[]): PlanningDay[] {
  return dias.map((d) => ({ ...d, actividades: [...d.actividades] }))
}

/**
 * Modo edición del itinerario (§6.5): mover ↑/↓ (cruzando días), editar,
 * borrar con confirmación y añadir. Controles de 44. El editor va en una
 * hoja; cancelar una actividad nueva la elimina. Componente controlado: el
 * padre guarda.
 */
export function EditableDays({
  dias,
  onChange,
  moneda = 'USD',
}: Props): React.ReactElement {
  const { days } = useTheme()
  const styles = useEstilos(crearEstilos)
  const [draft, setDraft] = useState<PlanningActivity | null>(null)
  const [nuevaId, setNuevaId] = useState<string | null>(null)
  const [borrar, setBorrar] = useState<{
    dia: number
    id: string
    nombre: string
  } | null>(null)
  const [errorHora, setErrorHora] = useState<string | null>(null)

  const cerrarEditor = (): void => {
    if (draft && nuevaId === draft.id) {
      // Cancelar una actividad nueva la elimina.
      onChange(
        dias.map((d) => ({
          ...d,
          actividades: d.actividades.filter((a) => a.id !== draft.id),
        }))
      )
    }
    setDraft(null)
    setNuevaId(null)
    setErrorHora(null)
  }

  const guardarDraft = (): void => {
    if (!draft) return
    const ini = minutosDelDia(draft.horaInicio)
    const fin = minutosDelDia(draft.horaFin)
    if (ini === null || fin === null) {
      setErrorHora('Usa el formato 24 h, por ejemplo 09:30 o 14:00.')
      return
    }
    if (fin <= ini) {
      setErrorHora('La hora de fin debe ser posterior a la de inicio.')
      return
    }
    const conDuracion: PlanningActivity = {
      ...draft,
      nombre: draft.nombre.trim() || 'Actividad sin nombre',
      duracionMinutos:
        minutosEntre(draft.horaInicio, draft.horaFin) || draft.duracionMinutos,
    }
    onChange(
      dias.map((d) => ({
        ...d,
        actividades: d.actividades.map((a) =>
          a.id === conDuracion.id ? conDuracion : a
        ),
      }))
    )
    setDraft(null)
    setNuevaId(null)
    setErrorHora(null)
  }

  const quitar = (dayIdx: number, actId: string): void => {
    const copy = clonar(dias)
    const day = copy[dayIdx]
    if (!day) return
    day.actividades = day.actividades.filter((a) => a.id !== actId)
    onChange(copy)
  }

  // dir -1 = arriba, +1 = abajo. En los bordes salta al día anterior/siguiente.
  const mover = (dayIdx: number, actIdx: number, dir: -1 | 1): void => {
    const copy = clonar(dias)
    const day = copy[dayIdx]
    if (!day) return
    const acts = day.actividades
    const actual = acts[actIdx]
    if (actual === undefined) return
    const target = actIdx + dir
    if (target >= 0 && target < acts.length) {
      const otra = acts[target]
      if (otra === undefined) return
      acts[actIdx] = otra
      acts[target] = actual
    } else if (dir === -1 && dayIdx > 0) {
      const anterior = copy[dayIdx - 1]
      if (!anterior) return
      acts.splice(actIdx, 1)
      anterior.actividades.push(actual)
    } else if (dir === 1 && dayIdx < copy.length - 1) {
      const siguiente = copy[dayIdx + 1]
      if (!siguiente) return
      acts.splice(actIdx, 1)
      siguiente.actividades.unshift(actual)
    } else {
      return
    }
    onChange(copy)
  }

  const anadir = (dayIdx: number): void => {
    const copy = clonar(dias)
    const day = copy[dayIdx]
    if (!day) return
    const act = nuevaActividad()
    day.actividades.push(act)
    onChange(copy)
    setNuevaId(act.id)
    setDraft({ ...act })
  }

  const ultimoDia = dias.length - 1

  return (
    <View>
      {dias.map((dia, dayIdx) => {
        const color = colorDia(days, dia.numero)
        return (
          <View key={dia.numero} style={styles.dia}>
            <View style={styles.diaCabecera}>
              <View style={[styles.diaNumero, { backgroundColor: color }]}>
                <Txt variant="label" color="dayNumeral" tnum>
                  {dia.numero}
                </Txt>
              </View>
              <View style={styles.flex}>
                <Txt variant="overline" style={{ color }}>
                  Día {String(dia.numero).padStart(2, '0')}
                </Txt>
                <Txt variant="title" numberOfLines={2}>
                  {dia.titulo}
                </Txt>
              </View>
            </View>

            {dia.actividades.length === 0 ? (
              <Txt variant="bodyS" color="fgMuted" style={styles.vacio}>
                Sin actividades este día.
              </Txt>
            ) : null}

            {dia.actividades.map((act, actIdx) => {
              const primera = dayIdx === 0 && actIdx === 0
              const ultima =
                dayIdx === ultimoDia && actIdx === dia.actividades.length - 1
              const nombre = act.nombre || 'Sin nombre'
              return (
                <View key={act.id} style={styles.fila}>
                  <View style={styles.flex}>
                    <Txt variant="label" numberOfLines={2}>
                      {nombre}
                    </Txt>
                    <Txt variant="caption" color="fgMuted" tnum>
                      {formatHora12(act.horaInicio)} –{' '}
                      {formatHora12(act.horaFin)}
                      {act.precioEstimado > 0
                        ? ` · ${formatCurrency(act.precioEstimado, moneda)}`
                        : ''}
                      {` · ${TIPO_LABEL[act.tipo] ?? 'Actividad'}`}
                    </Txt>
                  </View>
                  <View style={styles.controles}>
                    <IconButton
                      label={`Subir ${nombre}`}
                      icon={ArrowUp}
                      disabled={primera}
                      onPress={() => mover(dayIdx, actIdx, -1)}
                    />
                    <IconButton
                      label={`Bajar ${nombre}`}
                      icon={ArrowDown}
                      disabled={ultima}
                      onPress={() => mover(dayIdx, actIdx, 1)}
                    />
                    <IconButton
                      label={`Editar ${nombre}`}
                      icon={Pencil}
                      onPress={() => setDraft({ ...act })}
                    />
                    <IconButton
                      label={`Borrar ${nombre}`}
                      icon={Trash2}
                      onPress={() =>
                        setBorrar({ dia: dayIdx, id: act.id, nombre })
                      }
                    />
                  </View>
                </View>
              )
            })}

            <Button
              title="Añadir actividad"
              variant="ghost"
              size="sm"
              icon={Plus}
              onPress={() => anadir(dayIdx)}
              style={styles.anadir}
            />
          </View>
        )
      })}

      <Sheet
        visible={draft !== null}
        onClose={cerrarEditor}
        title={
          draft && nuevaId === draft.id ? 'Nueva actividad' : 'Editar actividad'
        }
        footer={
          <>
            <Button title="Cancelar" variant="outline" onPress={cerrarEditor} />
            <Button title="Guardar" variant="tinta" onPress={guardarDraft} />
          </>
        }
      >
        {draft ? (
          <View>
            <Input
              label="Nombre"
              placeholder="Nombre de la actividad"
              value={draft.nombre}
              onChangeText={(t) => setDraft({ ...draft, nombre: t })}
              autoCapitalize="sentences"
            />
            <Input
              label="Dirección"
              optional
              placeholder="Dirección o lugar"
              value={draft.direccion}
              onChangeText={(t) => setDraft({ ...draft, direccion: t })}
            />
            <View style={styles.horas}>
              <Input
                label="Inicio"
                placeholder="09:00"
                value={draft.horaInicio}
                onChangeText={(t) => setDraft({ ...draft, horaInicio: t })}
                keyboardType="numbers-and-punctuation"
                hint={formatHora12(draft.horaInicio) || 'HH:MM'}
                containerStyle={styles.flex}
              />
              <Input
                label="Fin"
                placeholder="10:00"
                value={draft.horaFin}
                onChangeText={(t) => setDraft({ ...draft, horaFin: t })}
                keyboardType="numbers-and-punctuation"
                hint={formatHora12(draft.horaFin) || 'HH:MM'}
                error={errorHora}
                containerStyle={styles.flex}
              />
            </View>
            <Input
              label={`Precio estimado (${moneda})`}
              value={draft.precioEstimado ? String(draft.precioEstimado) : ''}
              placeholder="0"
              onChangeText={(t) =>
                setDraft({
                  ...draft,
                  precioEstimado: parseInt(t.replace(/[^\d]/g, ''), 10) || 0,
                })
              }
              keyboardType="number-pad"
            />
            <Txt variant="label" style={styles.tipoLabel}>
              Tipo
            </Txt>
            <ChipGroup<PlanningActivityType>
              label="Tipo de actividad"
              size="sm"
              options={TIPOS}
              value={draft.tipo}
              onValueChange={(t) => setDraft({ ...draft, tipo: t })}
            />
          </View>
        ) : null}
      </Sheet>

      <ConfirmDialog
        visible={borrar !== null}
        onClose={() => setBorrar(null)}
        title="¿Borrar esta actividad?"
        {...(borrar
          ? {
              description: `«${borrar.nombre}» desaparece del itinerario cuando guardes los cambios.`,
            }
          : {})}
        confirmLabel="Borrar actividad"
        onConfirm={() => {
          if (borrar) quitar(borrar.dia, borrar.id)
        }}
      />
    </View>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    flex: { flex: 1 },
    dia: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      marginBottom: 12,
      paddingTop: 14,
      paddingBottom: 6,
    },
    diaCabecera: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingBottom: 10,
    },
    diaNumero: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    vacio: { paddingHorizontal: 14, paddingVertical: 8 },
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingLeft: 14,
      paddingRight: 4,
      paddingVertical: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    controles: { flexDirection: 'row' },
    anadir: { marginLeft: 6, marginTop: 4 },
    horas: { flexDirection: 'row', gap: 12 },
    tipoLabel: { marginBottom: 8 },
  })
