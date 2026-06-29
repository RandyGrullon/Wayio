import { useState } from 'react'
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { ReserveButton } from './ReserveButton'
import { formatCurrency } from '../../lib/utils/format'
import { colors, radius } from '../../theme'
import type { Paquete, PlanningTrip } from '../../types/planning'

interface Props {
  trip: PlanningTrip
  moneda?: string
}

// Per-tier estimates — same table as the web `TripEssentials`.
const FLIGHT_PP: Record<Paquete, number> = {
  basico: 480,
  confort: 720,
  premium: 1400,
}
const HOTEL_NIGHTLY: Record<Paquete, number> = {
  basico: 55,
  confort: 120,
  premium: 260,
}
const CAR_DAILY: Record<Paquete, number> = {
  basico: 35,
  confort: 55,
  premium: 95,
}

function nightsBetween(inicio: string, fin: string): number {
  const a = Date.parse(inicio)
  const b = Date.parse(fin)
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 1
  return Math.max(1, Math.round((b - a) / 86_400_000))
}

const enc = encodeURIComponent

/**
 * "Completa tu viaje" (mobile): the itinerary covers what to do; this covers how
 * to get there and stay. The flight is included in the total by default, and the
 * app asks whether the traveler already has lodging / needs a car, adding each
 * as a priced extra and linking to the real booking. Mirrors the web component.
 */
export function TripEssentials({
  trip,
  moneda = 'USD',
}: Props): React.ReactElement {
  const tier: Paquete = trip.paquete ?? 'confort'
  const nights = nightsBetween(trip.fechaInicio, trip.fechaFin)
  const rooms = Math.max(1, Math.ceil(trip.personas / 2))

  const flightEst = trip.personas * FLIGHT_PP[tier]
  const hotelEst = nights * rooms * HOTEL_NIGHTLY[tier]
  const carEst = (nights + 1) * CAR_DAILY[tier]

  const [flight, setFlight] = useState(true)
  const [lodging, setLodging] = useState<'have' | 'add' | null>(null)
  const [car, setCar] = useState<'add' | 'no' | null>(null)

  const extras =
    (flight ? flightEst : 0) +
    (lodging === 'add' ? hotelEst : 0) +
    (car === 'add' ? carEst : 0)
  const total = trip.presupuestoTotal + extras
  const perPerson = Math.round(total / Math.max(1, trip.personas))
  const fmt = (n: number): string => formatCurrency(n, moneda)

  const includeParts = ['plan']
  if (flight) includeParts.push('vuelo')
  if (lodging === 'add') includeParts.push('hospedaje')
  if (car === 'add') includeParts.push('carro')

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Completa tu viaje</Text>
      <Text style={styles.sub}>
        El itinerario cubre qué hacer. Esto cubre cómo llegar y dónde dormir.
      </Text>

      <EssentialCard
        emoji="✈️"
        title="Vuelo (ida y vuelta)"
        subtitle={`${trip.personas} ${
          trip.personas === 1 ? 'pasajero' : 'pasajeros'
        } · estimado`}
        price={fmt(flightEst)}
        active={flight}
        searchLabel="Ver vuelos reales"
        searchUrl={`https://www.skyscanner.com/transport/flights/${enc(
          trip.origen
        )}/${enc(trip.destino)}/${enc(trip.fechaInicio)}/`}
      >
        <Toggle
          on={flight}
          onLabel="✓ Incluido"
          offLabel="Ya lo tengo"
          onToggle={() => setFlight((v) => !v)}
        />
      </EssentialCard>

      <EssentialCard
        emoji="🏨"
        title="Hospedaje"
        subtitle={`${nights} ${nights === 1 ? 'noche' : 'noches'} · ${rooms} ${
          rooms === 1 ? 'hab.' : 'habs.'
        } · estimado`}
        price={fmt(hotelEst)}
        active={lodging === 'add'}
        searchLabel="Ver hoteles reales"
        searchUrl={`https://www.booking.com/searchresults.html?ss=${enc(
          trip.destino
        )}&checkin=${enc(trip.fechaInicio)}`}
      >
        {lodging === null ? (
          <Ask
            question="¿Ya tienes hospedaje?"
            noLabel="No, agrégalo"
            yesLabel="Sí, ya tengo"
            onNo={() => setLodging('add')}
            onYes={() => setLodging('have')}
          />
        ) : (
          <Toggle
            on={lodging === 'add'}
            onLabel="✓ Agregado"
            offLabel="Ya tengo"
            onToggle={() => setLodging((v) => (v === 'add' ? 'have' : 'add'))}
          />
        )}
      </EssentialCard>

      <EssentialCard
        emoji="🚗"
        title="Alquiler de carro"
        subtitle={`${nights + 1} ${nights + 1 === 1 ? 'día' : 'días'} · estimado`}
        price={fmt(carEst)}
        active={car === 'add'}
        searchLabel="Ver carros reales"
        searchUrl={`https://www.booking.com/cars/index.html?ss=${enc(
          trip.destino
        )}`}
      >
        {car === null ? (
          <Ask
            question="¿Necesitas carro?"
            noLabel="Sí, agrégalo"
            yesLabel="No hace falta"
            onNo={() => setCar('add')}
            onYes={() => setCar('no')}
          />
        ) : (
          <Toggle
            on={car === 'add'}
            onLabel="✓ Agregado"
            offLabel="No hace falta"
            onToggle={() => setCar((v) => (v === 'add' ? 'no' : 'add'))}
          />
        )}
      </EssentialCard>

      <View style={styles.totalBox}>
        <View style={styles.flex}>
          <Text style={styles.totalLabel}>Total estimado del viaje</Text>
          <Text style={styles.totalValue}>{fmt(total)}</Text>
          <Text style={styles.totalSub}>
            {fmt(perPerson)} / persona · incluye {includeParts.join(' + ')}
          </Text>
        </View>
        <ReserveButton tripId={trip.id} />
      </View>
    </View>
  )
}

function EssentialCard({
  emoji,
  title,
  subtitle,
  price,
  active,
  searchLabel,
  searchUrl,
  children,
}: {
  emoji: string
  title: string
  subtitle: string
  price: string
  active: boolean
  searchLabel: string
  searchUrl: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <View style={[styles.card, active && styles.cardActive]}>
      <View style={styles.cardTop}>
        <Text style={styles.emoji}>{emoji}</Text>
        <View style={styles.flex}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardPrice}>{price}</Text>
          </View>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
          <View style={styles.cardActions}>
            {children}
            <TouchableOpacity onPress={() => void Linking.openURL(searchUrl)}>
              <Text style={styles.searchLink}>{searchLabel} ↗</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  )
}

function Ask({
  question,
  noLabel,
  yesLabel,
  onNo,
  onYes,
}: {
  question: string
  noLabel: string
  yesLabel: string
  onNo: () => void
  onYes: () => void
}): React.ReactElement {
  return (
    <View style={styles.ask}>
      <Text style={styles.askQ}>{question}</Text>
      <TouchableOpacity onPress={onNo} style={styles.askPrimary}>
        <Text style={styles.askPrimaryText}>{noLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onYes} style={styles.askGhost}>
        <Text style={styles.askGhostText}>{yesLabel}</Text>
      </TouchableOpacity>
    </View>
  )
}

function Toggle({
  on,
  onLabel,
  offLabel,
  onToggle,
}: {
  on: boolean
  onLabel: string
  offLabel: string
  onToggle: () => void
}): React.ReactElement {
  return (
    <TouchableOpacity
      onPress={onToggle}
      style={[styles.toggle, on ? styles.toggleOn : styles.toggleOff]}
    >
      <Text style={on ? styles.toggleOnText : styles.toggleOffText}>
        {on ? onLabel : offLabel}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
  },
  heading: { fontSize: 16, fontWeight: '800', color: colors.text },
  sub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 10,
  },
  cardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  cardTop: { flexDirection: 'row', gap: 10 },
  emoji: { fontSize: 22 },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text, flex: 1 },
  cardPrice: { fontSize: 14, fontWeight: '700', color: colors.text },
  cardSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  ask: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  askQ: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  askPrimary: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  askPrimaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  askGhost: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  askGhostText: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  toggle: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  toggleOn: { backgroundColor: colors.primary },
  toggleOff: { borderWidth: 1, borderColor: colors.border },
  toggleOnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  toggleOffText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  searchLink: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  totalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 14,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textFaint,
    textTransform: 'uppercase',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  totalSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
})
