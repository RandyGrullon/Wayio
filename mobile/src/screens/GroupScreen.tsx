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
  Callout,
  Card,
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
import { Check, Send, UserPlus } from '../components/ui/iconos'
import {
  formatFecha,
  formatHora12,
  formatViajeros,
  monedaDe,
  parseFecha,
} from '../components/ui/formato'
import { useAuth } from '../context/AuthContext'
import { useGroup, type UseGroupReturn } from '../hooks/useGroup'
import { GastosGrupo } from '../components/group/GastosGrupo'
import { useGastosGrupo } from '../components/group/useGastosGrupo'
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
  // Gastos con «Pagó» y «Entre quiénes» (aquí y no en la pestaña para no
  // perder un gasto en camino al cambiar de pestaña).
  const gastos = useGastosGrupo(tripId, group.expenses, group.members, user.id)
  const errorAccion = group.actionError ?? gastos.error
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
          { value: 'gastos', label: 'Gastos', count: gastos.gastos.length },
          { value: 'miembros', label: 'Miembros', count: group.members.length },
        ]}
      />

      {errorAccion ? (
        <Callout
          tone="danger"
          onDismiss={() => {
            group.clearActionError()
            gastos.limpiarError()
          }}
          style={styles.errorAccion}
        >
          {errorAccion}
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
        <GastosGrupo
          gastos={gastos.gastos}
          pendientes={gastos.pendientes}
          miembros={group.members}
          userId={user.id}
          moneda={moneda}
          onAnadir={gastos.anadir}
        />
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
    miembro: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
  })
