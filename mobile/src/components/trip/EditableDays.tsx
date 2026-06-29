import { useState } from 'react'
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Button } from '../ui/Button'
import { colors, radius } from '../../theme'
import type {
  PlanningActivity,
  PlanningActivityType,
  PlanningDay,
} from '../../types/planning'

const TIPOS: PlanningActivityType[] = [
  'actividad',
  'museo',
  'restaurante',
  'templo',
  'parque',
  'barrio',
  'playa',
  'traslado',
]

interface Props {
  dias: PlanningDay[]
  onChange: (dias: PlanningDay[]) => void
}

function uid(): string {
  return `act-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

/** Minutes between two "HH:MM" strings; 0 when unparseable or negative. */
function minutosEntre(inicio: string, fin: string): number {
  const a = /^(\d{1,2}):(\d{2})$/.exec(inicio)
  const b = /^(\d{1,2}):(\d{2})$/.exec(fin)
  if (!a || !b) return 0
  const min =
    Number(b[1]) * 60 + Number(b[2]) - (Number(a[1]) * 60 + Number(a[2]))
  return min > 0 ? min : 0
}

function clonar(dias: PlanningDay[]): PlanningDay[] {
  return dias.map((d) => ({ ...d, actividades: [...d.actividades] }))
}

/**
 * Mobile counterpart of the web `EditableDays`: reorder (↑/↓ across days),
 * delete, edit and add activities. Pure controlled component — the parent owns
 * the days array and persists on save.
 */
export function EditableDays({ dias, onChange }: Props): React.ReactElement {
  const [draft, setDraft] = useState<PlanningActivity | null>(null)

  const guardarDraft = (): void => {
    if (!draft) return
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
  }

  const borrar = (dayIdx: number, actId: string): void => {
    const copy = clonar(dias)
    const day = copy[dayIdx]
    if (!day) return
    day.actividades = day.actividades.filter((a) => a.id !== actId)
    onChange(copy)
  }

  // dir -1 = up, +1 = down. At the edges, hops to the prev/next day.
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
    setDraft({ ...act })
  }

  return (
    <View>
      {dias.map((dia, dayIdx) => (
        <View key={dia.numero} style={styles.dayCard}>
          <View style={styles.dayHeader}>
            <View style={styles.dayBadge}>
              <Text style={styles.dayBadgeText}>{dia.numero}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.dayTitle}>{dia.titulo}</Text>
              <Text style={styles.dayCity}>{dia.ciudad}</Text>
            </View>
            <Text style={styles.dayBudget}>${dia.presupuestoDia}</Text>
          </View>

          {dia.actividades.length === 0 ? (
            <Text style={styles.empty}>Sin actividades este día.</Text>
          ) : null}

          {dia.actividades.map((act, actIdx) => (
            <View key={act.id} style={styles.actRow}>
              <View style={styles.flex}>
                <Text style={styles.actName} numberOfLines={1}>
                  {act.nombre || 'Sin nombre'}
                </Text>
                <Text style={styles.actMeta}>
                  {act.horaInicio}–{act.horaFin} · ${act.precioEstimado} ·{' '}
                  {act.tipo}
                </Text>
              </View>
              <View style={styles.controls}>
                <Ctrl label="↑" onPress={() => mover(dayIdx, actIdx, -1)} />
                <Ctrl label="✎" onPress={() => setDraft({ ...act })} />
                <Ctrl
                  label="🗑"
                  onPress={() => borrar(dayIdx, act.id)}
                  danger
                />
                <Ctrl label="↓" onPress={() => mover(dayIdx, actIdx, 1)} />
              </View>
            </View>
          ))}

          <TouchableOpacity
            onPress={() => anadir(dayIdx)}
            style={styles.addBtn}
          >
            <Text style={styles.addText}>+ Añadir actividad</Text>
          </TouchableOpacity>
        </View>
      ))}

      <Modal
        visible={draft !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDraft(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {draft ? (
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>Editar actividad</Text>

                <Field label="Nombre">
                  <TextInput
                    value={draft.nombre}
                    onChangeText={(t) => setDraft({ ...draft, nombre: t })}
                    placeholder="Nombre de la actividad"
                    placeholderTextColor={colors.textFaint}
                    style={styles.input}
                  />
                </Field>

                <Field label="Dirección">
                  <TextInput
                    value={draft.direccion}
                    onChangeText={(t) => setDraft({ ...draft, direccion: t })}
                    placeholder="Dirección o lugar"
                    placeholderTextColor={colors.textFaint}
                    style={styles.input}
                  />
                </Field>

                <View style={styles.row}>
                  <Field label="Hora inicio" style={styles.flex}>
                    <TextInput
                      value={draft.horaInicio}
                      onChangeText={(t) =>
                        setDraft({ ...draft, horaInicio: t })
                      }
                      placeholder="09:00"
                      placeholderTextColor={colors.textFaint}
                      style={styles.input}
                    />
                  </Field>
                  <Field label="Hora fin" style={styles.flex}>
                    <TextInput
                      value={draft.horaFin}
                      onChangeText={(t) => setDraft({ ...draft, horaFin: t })}
                      placeholder="10:00"
                      placeholderTextColor={colors.textFaint}
                      style={styles.input}
                    />
                  </Field>
                </View>

                <Field label="Precio estimado ($)">
                  <TextInput
                    value={String(draft.precioEstimado)}
                    onChangeText={(t) =>
                      setDraft({
                        ...draft,
                        precioEstimado: parseInt(t, 10) || 0,
                      })
                    }
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </Field>

                <Field label="Tipo">
                  <View style={styles.tipos}>
                    {TIPOS.map((t) => (
                      <TouchableOpacity
                        key={t}
                        onPress={() => setDraft({ ...draft, tipo: t })}
                        style={[
                          styles.tipo,
                          draft.tipo === t && styles.tipoActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.tipoText,
                            draft.tipo === t && styles.tipoTextActive,
                          ]}
                        >
                          {t}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Field>

                <View style={styles.modalActions}>
                  <Button
                    title="Cancelar"
                    variant="secondary"
                    onPress={() => setDraft(null)}
                    style={styles.flex}
                  />
                  <Button
                    title="Guardar"
                    onPress={guardarDraft}
                    style={styles.flex}
                  />
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  )
}

function Ctrl({
  label,
  onPress,
  danger,
}: {
  label: string
  onPress: () => void
  danger?: boolean
}): React.ReactElement {
  return (
    <TouchableOpacity onPress={onPress} style={styles.ctrl} hitSlop={4}>
      <Text style={[styles.ctrlText, danger && styles.ctrlDanger]}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

function Field({
  label,
  children,
  style,
}: {
  label: string
  children: React.ReactNode
  style?: object
}): React.ReactElement {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  dayTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  dayCity: { fontSize: 12, color: colors.textFaint },
  dayBudget: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  empty: { fontSize: 13, color: colors.textFaint, padding: 12 },
  actRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  actName: { fontSize: 13, fontWeight: '600', color: colors.text },
  actMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  controls: { flexDirection: 'row', gap: 2 },
  ctrl: { paddingHorizontal: 6, paddingVertical: 4 },
  ctrlText: { fontSize: 16, color: colors.primary },
  ctrlDanger: { color: colors.red },
  addBtn: { padding: 12 },
  addText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '88%',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 14,
  },
  field: { marginBottom: 12 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  row: { flexDirection: 'row', gap: 12 },
  tipos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tipo: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tipoActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tipoText: { fontSize: 12, color: colors.textMuted },
  tipoTextActive: { color: '#FFFFFF', fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
})
