import { useEffect, useMemo, useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
  type TextInput,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { User } from '@supabase/supabase-js'
import {
  Avatar,
  AvatarStack,
  Badge,
  Button,
  Callout,
  Card,
  CardKicker,
  EmptyState,
  IconButton,
  Input,
  Pantalla,
  ScreenHeader,
  Skeleton,
  SkeletonRegion,
  Tabs,
  Txt,
} from '../components/ui'
import { Check, Plus, Send, UserPlus } from '../components/ui/iconos'
import {
  formatCurrency,
  formatFecha,
  formatHora12,
  formatViajeros,
  monedaDe,
  parseFecha,
} from '../components/ui/formato'
import { useAuth } from '../context/AuthContext'
import { useGroup, type UseGroupReturn } from '../hooks/useGroup'
import { getTrip } from '../lib/trips/repository'
import { config } from '../config'
import { useEstilos, useTheme, type Tema } from '../theme'
import type { GroupMessageRow, PlanningTrip, TripRow } from '../types/planning'

type Tab = 'chat' | 'votos' | 'gastos' | 'miembros'

const TEMPORAL = 'temp-'
const esPendiente = (id: string): boolean => id.startsWith(TEMPORAL)

/**
 * Sala del grupo (§6.8, móvil): chat, votos, gastos y miembros con Supabase
 * Realtime. Muestra los errores de carga y de cada acción, y marca lo que aún
 * se está enviando. Si llega sin viaje (deep link), lo carga.
 */
export function GroupScreen({
  trip: tripInicial,
  tripId,
}: {
  trip?: PlanningTrip
  tripId: string
}): React.ReactElement {
  const { user } = useAuth()
  const [fila, setFila] = useState<TripRow | null>(null)
  const [errorViaje, setErrorViaje] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    getTrip(tripId)
      .then((r) => {
        if (!vivo) return
        if (r) setFila(r)
        else if (!tripInicial) {
          setErrorViaje('No encontramos este viaje o ya no tienes acceso.')
        }
      })
      .catch(() => {
        if (vivo && !tripInicial) {
          setErrorViaje('No pudimos cargar el viaje. Revisa tu conexión.')
        }
      })
    return () => {
      vivo = false
    }
  }, [tripId, tripInicial])

  const trip = tripInicial ?? fila?.data ?? null

  if (!user) {
    return (
      <Pantalla>
        <ScreenHeader title="Sala del grupo" />
        <EmptyState
          ilustracion="icono"
          icon={UserPlus}
          title="Inicia sesión para entrar al grupo"
        />
      </Pantalla>
    )
  }

  if (!trip) {
    return (
      <Pantalla>
        <ScreenHeader title="Sala del grupo" />
        {errorViaje ? (
          <EmptyState
            ilustracion="error"
            title="No pudimos abrir el grupo"
            description={errorViaje}
          />
        ) : (
          <SkeletonRegion
            label="Cargando el grupo…"
            style={estilosFijos.margen}
          >
            <Skeleton width="60%" height={24} style={estilosFijos.hueco} />
            <Skeleton width="40%" height={14} style={estilosFijos.hueco} />
          </SkeletonRegion>
        )}
      </Pantalla>
    )
  }

  return (
    <Sala
      trip={trip}
      tripId={tripId}
      user={user}
      grupoLink={fila?.grupo_link ?? null}
    />
  )
}

function Sala({
  trip,
  tripId,
  user,
  grupoLink,
}: {
  trip: PlanningTrip
  tripId: string
  user: User
  grupoLink: string | null
}): React.ReactElement {
  const group = useGroup(tripId, user)
  const styles = useEstilos(crearEstilos)
  const [tab, setTab] = useState<Tab>('chat')
  const moneda = monedaDe(trip)

  const personas = group.members.map((m, i) => ({
    nombre: m.nombre,
    indice: i,
  }))

  const invitar = (): void => {
    if (!grupoLink) return
    const url = config.webUrl
      ? `${config.webUrl}/group/${grupoLink}`
      : `wayio://group/${grupoLink}`
    Share.share({
      message: `Únete a mi viaje a ${trip.destino} en Wayio: ${url}`,
    }).catch(() => undefined)
  }

  return (
    <Pantalla>
      <ScreenHeader
        kicker="Sala del grupo"
        title={trip.destino}
        {...(grupoLink
          ? {
              right: (
                <IconButton
                  label="Invitar al grupo"
                  icon={UserPlus}
                  onPress={invitar}
                />
              ),
            }
          : {})}
      />
      {group.members.length > 0 ? (
        <View style={styles.miembrosFila}>
          <AvatarStack personas={personas} size={28} />
          <Txt variant="caption" color="fgMuted">
            {formatViajeros(group.members.length)}
          </Txt>
        </View>
      ) : null}

      <Tabs<Tab>
        label="Secciones del grupo"
        value={tab}
        onValueChange={setTab}
        options={[
          { value: 'chat', label: 'Chat', count: group.messages.length },
          { value: 'votos', label: 'Votos' },
          { value: 'gastos', label: 'Gastos', count: group.expenses.length },
          { value: 'miembros', label: 'Miembros', count: group.members.length },
        ]}
      />

      {group.actionError ? (
        <Callout
          tone="danger"
          onDismiss={group.clearActionError}
          style={styles.errorAccion}
        >
          {group.actionError}
        </Callout>
      ) : null}

      {group.error ? (
        <EmptyState
          ilustracion="error"
          title="No pudimos cargar el grupo"
          description={group.error}
          action={{ label: 'Reintentar', onPress: () => void group.reload() }}
        />
      ) : group.loading ? (
        <SkeletonRegion label="Cargando el grupo…" style={styles.margen}>
          {[0, 1, 2].map((k) => (
            <Skeleton
              key={k}
              width={k % 2 ? '55%' : '70%'}
              height={44}
              radius={16}
              style={styles.hueco}
            />
          ))}
        </SkeletonRegion>
      ) : tab === 'chat' ? (
        <Chat group={group} userId={user.id} />
      ) : tab === 'votos' ? (
        <Votos group={group} trip={trip} userId={user.id} />
      ) : tab === 'gastos' ? (
        <Gastos group={group} moneda={moneda} userId={user.id} />
      ) : (
        <Miembros group={group} userId={user.id} />
      )}
    </Pantalla>
  )
}

// ── Chat ──────────────────────────────────────────────────────────────────

function etiquetaDia(iso: string): string {
  const f = parseFecha(iso)
  if (!f) return ''
  const hoy = new Date()
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1)
  const mismo = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  if (mismo(f, hoy)) return 'Hoy'
  if (mismo(f, ayer)) return 'Ayer'
  return formatFecha(f)
}

function Chat({
  group,
  userId,
}: {
  group: UseGroupReturn
  userId: string
}): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)
  const inputRef = useRef<TextInput>(null)
  const [msg, setMsg] = useState('')

  const enviar = (): void => {
    const t = msg.trim()
    if (!t) return
    setMsg('')
    void group.sendMessage(t)
  }

  const items = useMemo(() => {
    const out: (
      | { tipo: 'dia'; id: string; texto: string }
      | { tipo: 'msg'; m: GroupMessageRow }
    )[] = []
    let ultimo = ''
    for (const m of group.messages) {
      const dia = etiquetaDia(m.created_at)
      if (dia && dia !== ultimo) {
        out.push({ tipo: 'dia', id: `dia-${m.id}`, texto: dia })
        ultimo = dia
      }
      out.push({ tipo: 'msg', m })
    }
    return out
  }, [group.messages])

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.chatScroll}
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: true })
        }
        keyboardShouldPersistTaps="handled"
      >
        {group.messages.length === 0 ? (
          <EmptyState
            title="Nadie ha escrito todavía"
            description="Propón un plan, comparte una hora de encuentro o pregunta qué traer."
            action={{
              label: 'Escribe el primero',
              variant: 'outline',
              onPress: () => inputRef.current?.focus(),
            }}
          />
        ) : null}
        {items.map((it) =>
          it.tipo === 'dia' ? (
            <Txt
              key={it.id}
              variant="caption"
              color="fgSubtle"
              center
              style={styles.separador}
            >
              {it.texto}
            </Txt>
          ) : (
            <Burbuja key={it.m.id} m={it.m} propia={it.m.user_id === userId} />
          )
        )}
      </ScrollView>
      <View
        style={[
          styles.compositor,
          { paddingBottom: Math.max(10, insets.bottom) },
        ]}
      >
        <Input
          inputRef={inputRef}
          label="Mensaje"
          hideLabel
          placeholder="Escribe un mensaje…"
          value={msg}
          onChangeText={setMsg}
          multiline
          maxLength={1000}
          fieldSize="md"
          inputStyle={styles.chatInput}
          containerStyle={styles.chatCampo}
        />
        <IconButton
          label="Enviar mensaje"
          icon={Send}
          variant="primary"
          disabled={!msg.trim()}
          onPress={enviar}
        />
      </View>
    </KeyboardAvoidingView>
  )
}

function Burbuja({
  m,
  propia,
}: {
  m: GroupMessageRow
  propia: boolean
}): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const pendiente = esPendiente(m.id)
  const hora = formatHora12(parseFecha(m.created_at))
  if (m.tipo !== 'mensaje') {
    return (
      <Txt variant="caption" color="fgMuted" center style={styles.sistema}>
        {m.mensaje}
      </Txt>
    )
  }
  return (
    <View
      style={[styles.burbujaFila, propia ? styles.derecha : styles.izquierda]}
      accessible
      accessibilityLabel={`${propia ? 'Tú' : m.nombre_usuario}, ${hora}: ${m.mensaje}${pendiente ? '. Enviando' : ''}`}
    >
      <View
        style={[
          styles.burbuja,
          propia ? styles.propia : styles.ajena,
          pendiente ? styles.pendiente : null,
        ]}
      >
        {!propia ? (
          <Txt variant="caption" style={styles.autor}>
            {m.nombre_usuario}
          </Txt>
        ) : null}
        <Txt variant="bodyS" color={propia ? 'bubbleOwnFg' : 'fg'}>
          {m.mensaje}
        </Txt>
        <Txt
          variant="caption"
          tnum
          color={propia ? 'bubbleOwnFg' : 'fgSubtle'}
          style={styles.hora}
        >
          {pendiente ? 'Enviando…' : hora}
        </Txt>
      </View>
    </View>
  )
}

// ── Votos ─────────────────────────────────────────────────────────────────

function Votos({
  group,
  trip,
  userId,
}: {
  group: UseGroupReturn
  trip: PlanningTrip
  userId: string
}): React.ReactElement {
  const { colors } = useTheme()
  const styles = useEstilos(crearEstilos)
  const acts = trip.dias.flatMap((d) => d.actividades)

  if (acts.length === 0) {
    return <EmptyState title="Aún no hay actividades para votar" />
  }

  return (
    <ScrollView contentContainerStyle={styles.lista}>
      {acts.map((a) => {
        const av = group.votes.filter((v) => v.activity_id === a.id)
        const si = av.filter((v) => v.voto).length
        const no = av.length - si
        const total = si + no
        const mio = av.find((v) => v.user_id === userId)
        return (
          <Card key={a.id} style={styles.voto}>
            <Txt variant="label">¿Incluimos «{a.nombre}»?</Txt>
            <View style={styles.votoBotones} accessibilityRole="radiogroup">
              {[true, false].map((valor) => {
                const sel = mio?.voto === valor
                return (
                  <Pressable
                    key={String(valor)}
                    onPress={() => void group.castVote(a.id, valor)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: sel }}
                    accessibilityLabel={valor ? 'Sí' : 'No'}
                    style={[styles.votoBoton, sel ? styles.votoBotonSel : null]}
                  >
                    {sel ? (
                      <Check
                        size={16}
                        color={colors.fgInverse}
                        strokeWidth={2.5}
                      />
                    ) : null}
                    <Txt variant="label" color={sel ? 'fgInverse' : 'fg'}>
                      {valor ? 'Sí' : 'No'}
                    </Txt>
                  </Pressable>
                )
              })}
            </View>
            {total > 0 ? (
              <View style={styles.resultado}>
                <View style={styles.barraVotos}>
                  {si > 0 ? (
                    <View
                      style={[
                        styles.segmento,
                        { flex: si, backgroundColor: colors.accent },
                      ]}
                    />
                  ) : null}
                  {no > 0 ? (
                    <View
                      style={[
                        styles.segmento,
                        { flex: no, backgroundColor: colors.fgSubtle },
                      ]}
                    />
                  ) : null}
                </View>
                <Txt variant="caption" color="fgMuted" tnum>
                  {si} sí · {no} no
                  {mio && esPendiente(mio.id) ? ' · Guardando tu voto…' : ''}
                </Txt>
              </View>
            ) : (
              <Txt variant="caption" color="fgSubtle" style={styles.hueco}>
                Nadie ha votado todavía.
              </Txt>
            )}
          </Card>
        )
      })}
    </ScrollView>
  )
}

// ── Gastos ────────────────────────────────────────────────────────────────

function Gastos({
  group,
  moneda,
  userId,
}: {
  group: UseGroupReturn
  moneda: string
  userId: string
}): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [error, setError] = useState<string | null>(null)

  const nombreDe = (uid: string): string =>
    uid === userId
      ? 'Tú'
      : (group.members.find((m) => m.user_id === uid)?.nombre ?? 'Alguien')

  // Quién le debe a quién (todos los gastos se reparten entre todos).
  const deudas = useMemo(() => {
    const neto = new Map<string, number>()
    const ids = group.members.map((m) => m.user_id)
    for (const id of ids) neto.set(id, 0)
    for (const e of group.expenses) {
      const entre = e.entre_todos && ids.length > 0 ? ids : [e.pagado_por]
      const parte = e.monto / Math.max(1, entre.length)
      neto.set(e.pagado_por, (neto.get(e.pagado_por) ?? 0) + e.monto)
      for (const id of entre) neto.set(id, (neto.get(id) ?? 0) - parte)
    }
    const deudores = [...neto.entries()]
      .filter(([, v]) => v < -0.009)
      .map(([id, v]) => ({ id, v: -v }))
    const acreedores = [...neto.entries()]
      .filter(([, v]) => v > 0.009)
      .map(([id, v]) => ({ id, v }))
    const out: { de: string; a: string; monto: number }[] = []
    let i = 0
    let j = 0
    while (i < deudores.length && j < acreedores.length) {
      const d = deudores[i]
      const c = acreedores[j]
      if (!d || !c) break
      const x = Math.min(d.v, c.v)
      out.push({ de: d.id, a: c.id, monto: x })
      d.v -= x
      c.v -= x
      if (d.v < 0.01) i++
      if (c.v < 0.01) j++
    }
    return out
  }, [group.expenses, group.members])

  const anadir = async (): Promise<void> => {
    const n = Number(monto.replace(',', '.'))
    if (!concepto.trim()) {
      setError('Escribe el concepto del gasto.')
      return
    }
    if (!Number.isFinite(n) || n <= 0) {
      setError('El monto debe ser mayor que cero.')
      return
    }
    setError(null)
    const ok = await group.addExpense(concepto.trim(), n)
    if (ok) {
      setConcepto('')
      setMonto('')
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.lista}
      keyboardShouldPersistTaps="handled"
    >
      <Card style={styles.formGasto}>
        <CardKicker>Añadir gasto</CardKicker>
        <Input
          label="Concepto"
          placeholder="Ej.: cena en el malecón"
          value={concepto}
          onChangeText={setConcepto}
          maxLength={200}
          containerStyle={styles.hueco}
          error={error && !concepto.trim() ? error : null}
        />
        <Input
          label={`Monto (${moneda})`}
          placeholder="0"
          value={monto}
          onChangeText={(t) => setMonto(t.replace(/[^\d.,]/g, ''))}
          keyboardType="decimal-pad"
          error={error && concepto.trim() ? error : null}
          hint="Se reparte entre todos los miembros."
        />
        <Button
          title="Añadir gasto"
          variant="tinta"
          icon={Plus}
          onPress={() => void anadir()}
        />
      </Card>

      {group.expenses.length === 0 ? (
        <EmptyState
          title="Sin gastos todavía"
          description="Anota lo que pague cada uno y Wayio calcula quién le debe a quién."
        />
      ) : (
        <View style={styles.gastos}>
          {group.expenses.map((e) => (
            <View key={e.id} style={styles.gasto}>
              <View style={styles.flex}>
                <Txt variant="label" numberOfLines={2}>
                  {e.concepto}
                </Txt>
                <Txt variant="caption" color="fgMuted">
                  {esPendiente(e.id)
                    ? 'Guardando…'
                    : `${e.pagado_por === userId ? 'Pagaste tú' : `Pagó ${nombreDe(e.pagado_por)}`} · ${formatFecha(e.created_at, { diaSemana: false })}`}
                </Txt>
              </View>
              <Txt variant="label" tnum>
                {formatCurrency(e.monto, moneda, { decimales: true })}
              </Txt>
            </View>
          ))}
        </View>
      )}

      {deudas.length > 0 ? (
        <Card style={styles.balances}>
          <CardKicker>Balances</CardKicker>
          {deudas.map((d) => (
            <Txt key={`${d.de}-${d.a}`} variant="bodyS" style={styles.hueco}>
              {nombreDe(d.de)} {d.de === userId ? 'le debes' : 'le debe'}{' '}
              <Txt variant="label" tnum>
                {formatCurrency(d.monto, moneda, { decimales: true })}
              </Txt>{' '}
              a {nombreDe(d.a) === 'Tú' ? 'ti' : nombreDe(d.a)}
            </Txt>
          ))}
        </Card>
      ) : group.expenses.length > 0 ? (
        <Txt variant="caption" color="fgMuted" style={styles.hueco}>
          Están a mano: nadie le debe a nadie.
        </Txt>
      ) : null}
    </ScrollView>
  )
}

// ── Miembros ──────────────────────────────────────────────────────────────

function Miembros({
  group,
  userId,
}: {
  group: UseGroupReturn
  userId: string
}): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  if (group.members.length === 0) {
    return (
      <EmptyState
        title="Aún no hay miembros"
        description="Invita a tus acompañantes con el enlace del grupo."
      />
    )
  }
  return (
    <ScrollView contentContainerStyle={styles.lista}>
      {group.members.map((m, i) => (
        <View key={m.id} style={styles.miembro}>
          <Avatar nombre={m.nombre} indice={i} size={40} />
          <View style={styles.flex}>
            <Txt variant="label">{m.nombre}</Txt>
            <Txt variant="caption" color="fgMuted">
              {m.ultima_ubicacion
                ? `Ubicación actualizada ${formatHora12(parseFecha(m.ultima_ubicacion))}`
                : 'Sin ubicación'}
            </Txt>
          </View>
          {m.user_id === userId ? <Badge label="Tú" variant="brand" /> : null}
        </View>
      ))}
    </ScrollView>
  )
}

const estilosFijos = StyleSheet.create({
  margen: { paddingHorizontal: 16 },
  hueco: { marginTop: 12 },
})

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    flex: { flex: 1 },
    margen: { paddingHorizontal: 16 },
    hueco: { marginTop: 10 },
    miembrosFila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    errorAccion: { marginHorizontal: 16, marginTop: 12 },
    lista: { padding: 16, paddingBottom: 48 },
    chatScroll: { padding: 16, flexGrow: 1 },
    separador: { marginVertical: 10 },
    sistema: { marginVertical: 6 },
    burbujaFila: { flexDirection: 'row', marginBottom: 8 },
    izquierda: { justifyContent: 'flex-start' },
    derecha: { justifyContent: 'flex-end' },
    burbuja: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 9 },
    propia: {
      backgroundColor: t.colors.bubbleOwn,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 4,
    },
    ajena: {
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderBottomRightRadius: 16,
      borderBottomLeftRadius: 4,
    },
    pendiente: { opacity: 0.6 },
    autor: { fontFamily: t.fonts.sansSemiBold, marginBottom: 2 },
    hora: { fontSize: 12, marginTop: 2, alignSelf: 'flex-end', opacity: 0.85 },
    compositor: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    chatCampo: { flex: 1, marginBottom: 0 },
    chatInput: {
      minHeight: 44,
      maxHeight: 120,
      paddingTop: 10,
      paddingBottom: 10,
    },
    voto: { marginBottom: 12, padding: 16 },
    votoBotones: { flexDirection: 'row', gap: 8, marginTop: 12 },
    votoBoton: {
      flex: 1,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.colors.borderStrong,
      backgroundColor: t.colors.surface,
    },
    votoBotonSel: {
      backgroundColor: t.colors.surfaceInverse,
      borderColor: t.colors.surfaceInverse,
    },
    resultado: { marginTop: 12, gap: 6 },
    barraVotos: {
      flexDirection: 'row',
      gap: 2,
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
    },
    segmento: { height: 8 },
    formGasto: { padding: 16, marginBottom: 16 },
    gastos: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    gasto: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    balances: { marginTop: 16, padding: 16 },
    miembro: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
  })
