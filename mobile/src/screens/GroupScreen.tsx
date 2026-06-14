import { useMemo, useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native'
import { ScreenHeader } from '../components/ui/ScreenHeader'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../hooks/useGroup'
import { colors, radius } from '../theme'
import { formatCurrency } from '../lib/utils/format'
import type { PlanningTrip } from '../types/planning'

type Tab = 'chat' | 'votos' | 'gastos' | 'miembros'
const TABS: { key: Tab; label: string }[] = [
  { key: 'chat', label: 'Chat' },
  { key: 'votos', label: 'Votos' },
  { key: 'gastos', label: 'Gastos' },
  { key: 'miembros', label: 'Miembros' },
]

export function GroupScreen({
  trip,
  tripId,
}: {
  trip: PlanningTrip
  tripId: string
}): React.ReactElement {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('chat')

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Sala grupal" />
        <View style={styles.center}>
          <Text style={styles.muted}>Inicia sesión para usar el grupo.</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title={trip.destino} subtitle="Sala grupal" />
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.tab, tab === t.key && styles.tabActive]}
          >
            <Text
              style={[styles.tabText, tab === t.key && styles.tabTextActive]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <GroupBody tab={tab} trip={trip} tripId={tripId} user={user} />
    </SafeAreaView>
  )
}

function GroupBody({
  tab,
  trip,
  tripId,
  user,
}: {
  tab: Tab
  trip: PlanningTrip
  tripId: string
  user: NonNullable<ReturnType<typeof useAuth>['user']>
}): React.ReactElement {
  const group = useGroup(tripId, user)
  const scrollRef = useRef<ScrollView>(null)
  const [msg, setMsg] = useState('')
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')

  const balances = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of group.members) map.set(m.user_id, 0)
    for (const e of group.expenses) {
      const sharers = e.entre_todos
        ? group.members.map((m) => m.user_id)
        : [e.pagado_por]
      const share = e.monto / Math.max(sharers.length, 1)
      map.set(e.pagado_por, (map.get(e.pagado_por) ?? 0) + e.monto)
      for (const uid of sharers) map.set(uid, (map.get(uid) ?? 0) - share)
    }
    return map
  }, [group.expenses, group.members])

  const nameOf = (uid: string): string =>
    group.members.find((m) => m.user_id === uid)?.nombre ?? 'Viajero'

  if (tab === 'chat') {
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.chatScroll}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: true })
          }
        >
          {group.messages.map((m) => {
            const own = m.user_id === user.id
            return (
              <View
                key={m.id}
                style={[styles.bubbleRow, own ? styles.right : styles.left]}
              >
                <View
                  style={[
                    styles.bubble,
                    own ? styles.bubbleOwn : styles.bubbleOther,
                  ]}
                >
                  {!own ? (
                    <Text style={styles.bubbleName}>{m.nombre_usuario}</Text>
                  ) : null}
                  <Text
                    style={[styles.bubbleText, own && styles.bubbleTextOwn]}
                  >
                    {m.mensaje}
                  </Text>
                </View>
              </View>
            )
          })}
          {group.messages.length === 0 ? (
            <Text style={styles.muted}>Sé el primero en escribir.</Text>
          ) : null}
        </ScrollView>
        <View style={styles.inputBar}>
          <TextInput
            style={styles.chatInput}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={colors.textFaint}
            value={msg}
            onChangeText={setMsg}
          />
          <Button
            title="Enviar"
            size="sm"
            onPress={() => {
              const t = msg.trim()
              if (!t) return
              void group.sendMessage(t)
              setMsg('')
            }}
          />
        </View>
      </KeyboardAvoidingView>
    )
  }

  if (tab === 'votos') {
    const acts = trip.dias.flatMap((d) => d.actividades)
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        {acts.map((a) => {
          const av = group.votes.filter((v) => v.activity_id === a.id)
          const si = av.filter((v) => v.voto).length
          const no = av.filter((v) => !v.voto).length
          const total = si + no
          return (
            <View key={a.id} style={styles.voteCard}>
              <Text style={styles.voteQ}>¿Incluir &quot;{a.nombre}&quot;?</Text>
              <View style={styles.voteRow}>
                <TouchableOpacity
                  style={[styles.voteBtn, styles.voteYes]}
                  onPress={() => void group.castVote(a.id, true)}
                >
                  <Text style={styles.voteBtnText}>
                    Sí {total > 0 ? `· ${Math.round((si / total) * 100)}%` : ''}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.voteBtn, styles.voteNo]}
                  onPress={() => void group.castVote(a.id, false)}
                >
                  <Text style={styles.voteBtnText}>
                    No {total > 0 ? `· ${Math.round((no / total) * 100)}%` : ''}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        })}
        <View style={styles.bottom} />
      </ScrollView>
    )
  }

  if (tab === 'gastos') {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.expenseForm}>
          <TextInput
            style={[styles.chatInput, styles.flex]}
            placeholder="Concepto"
            placeholderTextColor={colors.textFaint}
            value={concepto}
            onChangeText={setConcepto}
          />
          <TextInput
            style={[styles.chatInput, styles.montoInput]}
            placeholder="Monto"
            placeholderTextColor={colors.textFaint}
            keyboardType="numeric"
            value={monto}
            onChangeText={setMonto}
          />
          <Button
            title="+"
            size="sm"
            onPress={() => {
              const n = parseFloat(monto)
              if (!concepto.trim() || isNaN(n) || n <= 0) return
              void group.addExpense(concepto.trim(), n)
              setConcepto('')
              setMonto('')
            }}
          />
        </View>

        {group.expenses.map((e) => (
          <View key={e.id} style={styles.expenseRow}>
            <Text style={styles.expenseDesc}>{e.concepto}</Text>
            <Text style={styles.expenseAmt}>{formatCurrency(e.monto)}</Text>
          </View>
        ))}

        {group.members.length > 0 ? (
          <View style={styles.balances}>
            <Text style={styles.balTitle}>Balances</Text>
            {Array.from(balances.entries()).map(([uid, bal]) => (
              <View key={uid} style={styles.balRow}>
                <Text style={styles.balName}>{nameOf(uid)}</Text>
                <Text
                  style={[
                    styles.balVal,
                    { color: bal >= 0 ? colors.green : colors.red },
                  ]}
                >
                  {bal >= 0 ? '+' : ''}
                  {formatCurrency(bal)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.bottom} />
      </ScrollView>
    )
  }

  // miembros
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {group.members.map((m) => (
        <View key={m.id} style={styles.memberRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {m.nombre[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.memberName}>{m.nombre}</Text>
            <Text style={styles.memberLoc}>
              {m.ultima_ubicacion ? 'Ubicación compartida' : 'Sin ubicación'}
            </Text>
          </View>
          {m.user_id === user.id ? (
            <View style={styles.youPill}>
              <Text style={styles.youText}>Tú</Text>
            </View>
          ) : null}
        </View>
      ))}
      {group.members.length === 0 ? (
        <Text style={styles.muted}>Aún no hay miembros.</Text>
      ) : null}
      <View style={styles.bottom} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  scroll: { padding: 16 },
  bottom: { height: 40 },

  chatScroll: { padding: 16, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row', marginBottom: 8 },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleOwn: { backgroundColor: colors.primary },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 2,
  },
  bubbleText: { fontSize: 14, color: colors.text },
  bubbleTextOwn: { color: '#FFFFFF' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },

  voteCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  voteQ: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
  voteRow: { flexDirection: 'row', gap: 10 },
  voteBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  voteYes: { backgroundColor: '#DCFCE7' },
  voteNo: { backgroundColor: '#FEE2E2' },
  voteBtnText: { fontSize: 13, fontWeight: '700', color: colors.text },

  expenseForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  montoInput: { width: 90, flex: 0 },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  expenseDesc: { fontSize: 14, color: colors.text },
  expenseAmt: { fontSize: 14, fontWeight: '600', color: colors.text },
  balances: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  balTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  balRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  balName: { fontSize: 14, color: colors.textMuted },
  balVal: { fontSize: 14, fontWeight: '600' },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  memberName: { fontSize: 14, fontWeight: '600', color: colors.text },
  memberLoc: { fontSize: 12, color: colors.textFaint, marginTop: 1 },
  youPill: {
    backgroundColor: colors.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  youText: { fontSize: 12, color: colors.primary, fontWeight: '700' },
})
