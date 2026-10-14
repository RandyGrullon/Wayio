import { useState, type ReactNode } from 'react'
import { Linking, StyleSheet, Switch, View } from 'react-native'
import { ReserveButton } from './ReserveButton'
import {
  searchFlights,
  searchHotels,
  type SearchResponse,
} from '../../lib/api/search'
import { colorDia, useEstilos, useTheme, type Tema } from '../../theme'
import { Button } from '../ui/Button'
import { Card, CardFranja, CardKicker } from '../ui/Card'
import { Txt } from '../ui/Txt'
import {
  BedDouble,
  Car,
  ExternalLink,
  Plane,
  type LucideIcon,
} from '../ui/iconos'
import { contarNoches, formatCurrency, formatNoches } from '../ui/formato'
import type { Moneda, Paquete, PlanningTrip } from '../../types/planning'

interface Props {
  trip: PlanningTrip
  /** Moneda del viaje. */
  moneda?: Moneda
  /** Id de fila de `trips` (para la reserva). */
  tripId?: string
}

// Estimaciones de respaldo en USD por nivel (mismas que la web).
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

const enc = encodeURIComponent

/** Abre el enlace de afiliado del backend (data.enlace) o la búsqueda genérica. */
async function abrirBusqueda(
  pedir: () => Promise<SearchResponse>,
  respaldo: string
): Promise<void> {
  let url = respaldo
  try {
    const { enlace } = await pedir()
    if (typeof enlace === 'string' && enlace.startsWith('https://')) {
      url = enlace
    }
  } catch {
    // Sin backend o con límite: la búsqueda genérica sigue sirviendo.
  }
  await Linking.openURL(url).catch(() => undefined)
}

/**
 * «Completa tu viaje» (§6.5): vuelo, hospedaje y carro como boletos con
 * interruptor y una ÚNICA tarjeta «TOTAL ESTIMADO» con barra apilada. El
 * vuelo no está en el total del plan: se suma solo si el interruptor está
 * activo. Sin estimación en la moneda del viaje, no se inventa un número.
 */
export function TripEssentials({
  trip,
  moneda = 'USD',
  tripId,
}: Props): React.ReactElement {
  const { colors, days } = useTheme()
  const styles = useEstilos(crearEstilos)
  const tier: Paquete = trip.paquete ?? 'confort'
  const noches = Math.max(1, contarNoches(trip.fechaInicio, trip.fechaFin))
  const personas = Math.max(1, trip.personas)
  const habitaciones = Math.max(1, Math.ceil(personas / 2))
  const enUsd = moneda === 'USD'

  const vueloPp = trip.vueloEstimadoPorPersona
  const vueloEst =
    typeof vueloPp === 'number'
      ? vueloPp * personas
      : enUsd
        ? FLIGHT_PP[tier] * personas
        : null
  const sinVuelo = typeof vueloPp === 'number' && vueloPp === 0
  const hotelIncluido = trip.dias.some((d) =>
    d.actividades.some((a) => /^check-?in\b/i.test(a.nombre))
  )
  const hotelEst =
    hotelIncluido || !enUsd ? null : noches * habitaciones * HOTEL_NIGHTLY[tier]
  const carroEst = enUsd ? (noches + 1) * CAR_DAILY[tier] : null

  const [vuelo, setVuelo] = useState(!sinVuelo && vueloEst !== null)
  const [hotel, setHotel] = useState(false)
  const [carro, setCarro] = useState(false)

  const partes = [
    {
      id: 'plan',
      label: 'Plan en destino',
      valor: trip.presupuestoTotal,
      color: colorDia(days, 2),
    },
    ...(vuelo && vueloEst
      ? [
          {
            id: 'vuelo',
            label: 'Vuelo',
            valor: vueloEst,
            color: colorDia(days, 7),
          },
        ]
      : []),
    ...(hotel && hotelEst
      ? [
          {
            id: 'hotel',
            label: 'Hospedaje',
            valor: hotelEst,
            color: colorDia(days, 3),
          },
        ]
      : []),
    ...(carro && carroEst
      ? [
          {
            id: 'carro',
            label: 'Carro',
            valor: carroEst,
            color: colorDia(days, 6),
          },
        ]
      : []),
  ]
  const total = partes.reduce((s, p) => s + p.valor, 0)
  const porPersona = Math.round(total / personas)
  const fmt = (n: number): string => formatCurrency(n, moneda)

  return (
    <View>
      <Txt variant="overline" color="fgMuted">
        Completa tu viaje
      </Txt>
      <Txt variant="h2" style={styles.h2}>
        Cómo llegar y dónde dormir
      </Txt>
      <Txt variant="bodyS" color="fgMuted" style={styles.sub}>
        El itinerario cubre qué hacer. Suma lo que te falte para ver el total.
      </Txt>

      {!sinVuelo ? (
        <Extra
          icono={Plane}
          titulo="Vuelo de ida y vuelta"
          detalle={`${personas === 1 ? '1 pasajero' : `${personas} pasajeros`} · estimado`}
          precio={vueloEst !== null ? fmt(vueloEst) : null}
          activo={vuelo}
          onCambiar={vueloEst !== null ? setVuelo : null}
          enlace="Ver vuelos"
          onEnlace={() =>
            void abrirBusqueda(
              () =>
                searchFlights(
                  trip.origen,
                  trip.destino,
                  trip.fechaInicio,
                  personas,
                  { returnDate: trip.fechaFin, currency: moneda }
                ),
              `https://www.skyscanner.com/transport/flights/${enc(trip.origen)}/${enc(trip.destino)}/`
            )
          }
        />
      ) : (
        <Card style={styles.extra}>
          <CardKicker icon={Plane}>Vuelo</CardKicker>
          <Txt variant="bodyS" style={styles.sub}>
            No hace falta volar para este viaje.
          </Txt>
        </Card>
      )}

      <Extra
        icono={BedDouble}
        titulo="Hospedaje"
        detalle={
          hotelIncluido
            ? 'Incluido en el plan (check-in en el itinerario)'
            : `${formatNoches(noches)} · ${habitaciones === 1 ? '1 habitación' : `${habitaciones} habitaciones`} · estimado`
        }
        precio={
          hotelIncluido ? 'Incluido' : hotelEst !== null ? fmt(hotelEst) : null
        }
        activo={hotelIncluido || hotel}
        onCambiar={hotelIncluido || hotelEst === null ? null : setHotel}
        enlace="Ver hoteles"
        onEnlace={() =>
          void abrirBusqueda(
            () =>
              searchHotels(
                trip.destino,
                trip.fechaInicio,
                trip.fechaFin,
                personas
              ),
            `https://www.booking.com/searchresults.html?ss=${enc(trip.destino)}&checkin=${enc(trip.fechaInicio)}&checkout=${enc(trip.fechaFin)}&group_adults=${personas}`
          )
        }
      />

      <Extra
        icono={Car}
        titulo="Alquiler de carro"
        detalle={`${noches + 1} días · estimado`}
        precio={carroEst !== null ? fmt(carroEst) : null}
        activo={carro}
        onCambiar={carroEst !== null ? setCarro : null}
        enlace="Ver carros"
        onEnlace={() => {
          Linking.openURL(
            `https://www.booking.com/cars/index.html?ss=${enc(trip.destino)}`
          ).catch(() => undefined)
        }}
      />

      {/* TOTAL ESTIMADO único */}
      <Card variant="boleto" style={styles.total}>
        <CardFranja
          extra={`${personas === 1 ? '1 viajero' : `${personas} viajeros`}`}
        >
          Total estimado
        </CardFranja>
        <View style={styles.totalCuerpo}>
          <Txt
            variant="numXL"
            accessibilityLabel={`Total estimado ${fmt(total)}`}
          >
            {fmt(total)}
          </Txt>
          <Txt variant="caption" color="fgMuted" tnum>
            {fmt(porPersona)} por persona
          </Txt>
          <View
            style={[styles.barra, { backgroundColor: colors.surface2 }]}
            accessible={false}
          >
            {partes.map((p) => (
              <View
                key={p.id}
                style={{
                  flex: total > 0 ? p.valor / total : 0,
                  backgroundColor: p.color,
                }}
              />
            ))}
          </View>
          <View style={styles.leyenda}>
            {partes.map((p) => (
              <View key={p.id} style={styles.leyendaFila}>
                <View
                  style={[styles.leyendaPunto, { backgroundColor: p.color }]}
                />
                <Txt variant="bodyS" style={styles.flex}>
                  {p.label}
                </Txt>
                <Txt variant="label" tnum>
                  {fmt(p.valor)}
                </Txt>
              </View>
            ))}
          </View>
          <ReserveButton tripId={tripId ?? trip.id} />
        </View>
      </Card>
    </View>
  )
}

function Extra({
  icono: Icono,
  titulo,
  detalle,
  precio,
  activo,
  onCambiar,
  enlace,
  onEnlace,
}: {
  icono: LucideIcon
  titulo: string
  detalle: string
  precio: string | null
  activo: boolean
  onCambiar: ((v: boolean) => void) | null
  enlace: string
  onEnlace: () => void
}): ReactNode {
  const { colors } = useTheme()
  const styles = useEstilos(crearEstilos)
  return (
    <Card style={styles.extra}>
      <View style={styles.extraFila}>
        <View style={[styles.extraIcono, { backgroundColor: colors.surface2 }]}>
          <Icono
            size={20}
            color={colors.fg}
            strokeWidth={1.75}
            accessible={false}
          />
        </View>
        <View style={styles.flex}>
          <Txt variant="label">{titulo}</Txt>
          <Txt variant="caption" color="fgMuted">
            {detalle}
          </Txt>
        </View>
        <Txt variant="label" tnum color={precio ? 'fg' : 'fgSubtle'}>
          {precio ?? 'Sin estimación'}
        </Txt>
      </View>
      <View style={styles.extraAcciones}>
        <Button
          title={enlace}
          variant="link"
          iconEnd={ExternalLink}
          accessibilityHint="Abre la búsqueda en el sitio del proveedor (enlace patrocinado)"
          onPress={onEnlace}
        />
        {onCambiar ? (
          <View style={styles.switch}>
            <Txt variant="caption" color="fgMuted">
              {activo ? 'Sumado al total' : 'Sumar al total'}
            </Txt>
            <Switch
              value={activo}
              onValueChange={onCambiar}
              accessibilityLabel={`Sumar ${titulo.toLowerCase()} al total`}
              trackColor={{ false: colors.borderStrong, true: colors.accent }}
              thumbColor={colors.surface}
              ios_backgroundColor={colors.borderStrong}
            />
          </View>
        ) : null}
      </View>
    </Card>
  )
}

const crearEstilos = (_t: Tema) =>
  StyleSheet.create({
    flex: { flex: 1 },
    h2: { marginTop: 4 },
    sub: { marginTop: 6 },
    extra: { marginTop: 12, padding: 16 },
    extraFila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    extraIcono: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    extraAcciones: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginTop: 10,
    },
    switch: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    total: { marginTop: 16 },
    totalCuerpo: { padding: 20 },
    barra: {
      flexDirection: 'row',
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
      marginTop: 16,
      gap: 2,
    },
    leyenda: { marginTop: 12, gap: 8 },
    leyendaFila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    leyendaPunto: { width: 10, height: 10, borderRadius: 5 },
  })
