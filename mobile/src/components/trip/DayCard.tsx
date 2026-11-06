import { useState } from 'react'
import { Linking, StyleSheet, View } from 'react-native'
import Svg, { Line } from 'react-native-svg'
import { colorDia, useEstilos, useTheme, type Tema } from '../../theme'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Txt } from '../ui/Txt'
import {
  Clock,
  ExternalLink,
  MapPin,
  Navigation,
  Ticket,
  Wallet,
  X,
} from '../ui/iconos'
import { track } from '../../lib/analytics'
import { reservaDeActividad } from './enlacesAfiliado'
import {
  formatCurrency,
  formatDuracion,
  formatFecha,
  formatHora12,
  formatHora12Partes,
  sumarDias,
} from '../ui/formato'
import type {
  PlanningActivity,
  PlanningActivityType,
  PlanningDay,
} from '../../types/planning'

export const TIPO_LABEL: Record<PlanningActivityType, string> = {
  museo: 'Museo',
  restaurante: 'Restaurante',
  templo: 'Templo',
  parque: 'Parque',
  barrio: 'Barrio',
  playa: 'Playa',
  actividad: 'Actividad',
  traslado: 'Traslado',
}

export type ModoDayCard = 'completo' | 'lectura'

function ActivityRow({
  activity,
  color,
  moneda,
  ultima,
  onMarkLost,
  resaltada,
  ciudad,
  destino,
  tripId,
  modo,
}: {
  activity: PlanningActivity
  color: string
  moneda: string
  ultima: boolean
  onMarkLost?: (a: PlanningActivity) => void
  resaltada: boolean
  /** Ciudad del día (o el destino): texto del enlace de reserva. */
  ciudad: string
  destino: string | undefined
  tripId: string | undefined
  modo: ModoDayCard
}): React.ReactElement {
  const { colors } = useTheme()
  const styles = useEstilos(crearEstilos)
  const [abierta, setAbierta] = useState(false)
  const hora = formatHora12Partes(activity.horaInicio)
  const fin = formatHora12(activity.horaFin)
  const hasCoords = activity.lat !== 0 || activity.lng !== 0
  const lost = activity.estado === 'perdida' || activity.esPerdida
  // El enlace se construye AL RENDERIZAR; nunca se usa el `linkAfiliado`
  // guardado (como ActivityItem de la web).
  const reserva =
    modo === 'completo' ? reservaDeActividad(activity, ciudad) : null
  const hayMas =
    activity.consejos.length > 0 ||
    Boolean(activity.mejorHoraVisita) ||
    activity.descripcion.length > 90

  return (
    <View>
      <View
        style={[
          styles.fila,
          resaltada ? { backgroundColor: colors.primarySoft } : null,
        ]}
      >
        {/* Columna de hora (64) */}
        <View
          style={styles.hora}
          accessible
          accessibilityLabel={`${formatHora12(activity.horaInicio)}${fin ? ` a ${fin}` : ''}`}
        >
          <Txt variant="label" tnum style={styles.horaTexto}>
            {hora?.hora ?? '—'}
          </Txt>
          {hora ? (
            <Txt variant="caption" color="fgMuted">
              {hora.periodo}
            </Txt>
          ) : null}
          {fin ? (
            <Txt variant="caption" color="fgSubtle" tnum style={styles.fin}>
              {fin}
            </Txt>
          ) : null}
        </View>

        {/* Riel punteado + punto del día */}
        <View style={styles.riel}>
          <View
            style={[
              styles.punto,
              {
                backgroundColor: lost ? colors.surface2 : color,
                borderColor: color,
              },
            ]}
          />
          {!ultima ? (
            <Svg width={2} height="100%" style={styles.rielLinea}>
              <Line
                x1={1}
                y1={0}
                x2={1}
                y2="100%"
                stroke={colors.rule}
                strokeWidth={2}
                strokeLinecap="round"
                strokeDasharray="0.1 5"
              />
            </Svg>
          ) : null}
        </View>

        {/* Contenido */}
        <View style={styles.cuerpo}>
          <View style={styles.titulo}>
            <Txt
              variant="title"
              style={[styles.flexShrink, lost ? styles.tachado : null]}
            >
              {activity.nombre}
            </Txt>
          </View>
          <View style={styles.etiquetas}>
            <Badge label={TIPO_LABEL[activity.tipo] ?? 'Actividad'} />
            {lost ? <Badge label="Perdida" variant="error" icon={X} /> : null}
            {activity.reagendadaDesdeDia ? (
              <Badge
                label={`Reagendada desde el día ${activity.reagendadaDesdeDia}`}
                variant="info"
              />
            ) : null}
            {activity.reservaRequerida ? (
              <Badge
                label={
                  activity.reservaPagada ? 'Reservada' : 'Requiere reserva'
                }
                variant={activity.reservaPagada ? 'success' : 'warning'}
              />
            ) : null}
          </View>
          {activity.descripcion ? (
            <Txt
              variant="bodyS"
              color="fgMuted"
              numberOfLines={abierta ? undefined : 2}
              style={styles.desc}
            >
              {activity.descripcion}
            </Txt>
          ) : null}
          {abierta ? (
            <View style={styles.mas}>
              {activity.mejorHoraVisita ? (
                <Txt variant="caption" color="fgMuted">
                  Mejor hora: {activity.mejorHoraVisita}
                </Txt>
              ) : null}
              {activity.consejos.map((c) => (
                <Txt key={c} variant="bodyS" style={styles.consejo}>
                  · {c}
                </Txt>
              ))}
            </View>
          ) : null}
          {hayMas ? (
            <Button
              variant="link"
              title={abierta ? 'Ver menos' : 'Ver más'}
              onPress={() => setAbierta((v) => !v)}
            />
          ) : null}

          <View style={styles.meta}>
            {activity.duracionMinutos > 0 ? (
              <Meta
                icono={Clock}
                texto={formatDuracion(activity.duracionMinutos)}
              />
            ) : null}
            {activity.precioEstimado > 0 ? (
              <Meta
                icono={Wallet}
                texto={formatCurrency(activity.precioEstimado, moneda)}
              />
            ) : null}
            {activity.direccion ? (
              <Meta icono={MapPin} texto={activity.direccion} linea />
            ) : null}
          </View>

          <View style={styles.acciones}>
            {hasCoords ? (
              <Button
                title="Cómo llegar"
                variant="ghost"
                size="sm"
                icon={Navigation}
                accessibilityHint="Abre la ruta en el mapa"
                onPress={() => {
                  Linking.openURL(
                    `https://www.google.com/maps/dir/?api=1&destination=${activity.lat},${activity.lng}`
                  ).catch(() => undefined)
                }}
              />
            ) : null}
            {reserva ? (
              <Button
                title={reserva.etiqueta}
                variant="outline"
                size="sm"
                icon={reserva.categoria === 'hotel' ? ExternalLink : Ticket}
                accessibilityLabel={`${reserva.etiqueta}: ${activity.nombre} (enlace patrocinado)`}
                accessibilityHint="Abre el sitio del socio"
                onPress={() => {
                  track('click_afiliado', {
                    proveedor: reserva.proveedor,
                    categoria: reserva.categoria,
                    destino,
                    tripId,
                    ubicacion: 'actividad',
                  })
                  Linking.openURL(reserva.url).catch(() => undefined)
                }}
              />
            ) : null}
            {reserva ? (
              // El botón ya dice «enlace patrocinado» a los lectores.
              <Txt
                variant="caption"
                color="fgSubtle"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                Patrocinado
              </Txt>
            ) : null}
            {onMarkLost && !lost ? (
              <Button
                title="Me la perdí"
                variant="ghost"
                size="sm"
                onPress={() => onMarkLost(activity)}
              />
            ) : null}
          </View>
        </View>
      </View>
      {!ultima && activity.tiempoHastaSiguiente > 0 ? (
        <Txt variant="caption" color="fgSubtle" style={styles.conector}>
          {formatDuracion(activity.tiempoHastaSiguiente)} hasta la siguiente
        </Txt>
      ) : null}
    </View>
  )
}

function Meta({
  icono: Icono,
  texto,
  linea = false,
}: {
  icono: typeof Clock
  texto: string
  linea?: boolean
}): React.ReactElement {
  const { colors } = useTheme()
  return (
    <View style={[estilosMeta.item, linea ? estilosMeta.linea : null]}>
      <Icono
        size={14}
        color={colors.fgMuted}
        strokeWidth={1.75}
        accessible={false}
      />
      <Txt
        variant="caption"
        color="fgMuted"
        tnum
        numberOfLines={1}
        style={linea ? estilosMeta.flex : null}
      >
        {texto}
      </Txt>
    </View>
  )
}

const estilosMeta = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linea: { flexBasis: '100%', flexShrink: 1 },
  flex: { flex: 1 },
})

/**
 * Día como capítulo (§6.5): kicker en el color del día, título en Newsreader,
 * meta con la moneda del viaje y una línea de tiempo con hora en 12 h, riel
 * punteado y punto del día. El color nunca va solo: siempre «Día N».
 */
export function DayCard({
  day,
  fechaInicio,
  moneda = 'USD',
  onMarkLost,
  resaltadas,
  destino,
  tripId,
  modo = 'completo',
}: {
  day: PlanningDay
  /** Fecha de salida del viaje ('YYYY-MM-DD') para fechar el día. */
  fechaInicio?: string
  moneda?: string
  onMarkLost?: (a: PlanningActivity) => void
  /** Ids recién cambiados por la IA (se resaltan). */
  resaltadas?: ReadonlySet<string>
  /**
   * Destino del viaje: ciudad de respaldo del enlace de reserva si el día no
   * trae la suya, y propiedad de la analítica.
   */
  destino?: string
  /** Id de fila de `trips` (analítica). */
  tripId?: string
  /**
   * completo: «Cómo llegar» y «Reservar» / «Ver hotel» (patrocinado).
   * lectura: sin enlaces de reserva (vista compartida).
   */
  modo?: ModoDayCard
}): React.ReactElement {
  const { days } = useTheme()
  const styles = useEstilos(crearEstilos)
  const color = colorDia(days, day.numero)
  const fecha = fechaInicio ? sumarDias(fechaInicio, day.numero - 1) : ''
  const numero = String(day.numero).padStart(2, '0')
  // Viajes antiguos pueden traer el día sin ciudad.
  const ciudad = day.ciudad?.trim() || destino?.trim() || ''

  return (
    <View style={styles.dia}>
      <Txt variant="overline" style={{ color }}>
        Día {numero}
        {fecha ? ` · ${formatFecha(fecha)}` : ''}
      </Txt>
      <Txt variant="h2" style={styles.diaTitulo}>
        {day.titulo}
      </Txt>
      <Txt variant="caption" color="fgMuted" tnum style={styles.diaMeta}>
        {[
          day.ciudad,
          day.presupuestoDia > 0
            ? `${formatCurrency(day.presupuestoDia, moneda)} estimado`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Txt>
      <View style={styles.timeline}>
        {day.actividades.length === 0 ? (
          <Txt variant="bodyS" color="fgMuted">
            Día libre: sin actividades planificadas.
          </Txt>
        ) : null}
        {day.actividades.map((a, i) => (
          <ActivityRow
            key={a.id}
            activity={a}
            color={color}
            moneda={moneda}
            ultima={i === day.actividades.length - 1}
            resaltada={resaltadas?.has(a.id) ?? false}
            ciudad={ciudad}
            destino={destino}
            tripId={tripId}
            modo={modo}
            {...(onMarkLost ? { onMarkLost } : {})}
          />
        ))}
      </View>
    </View>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    dia: {
      paddingTop: 28,
      paddingBottom: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    diaTitulo: { marginTop: 4 },
    diaMeta: { marginTop: 4 },
    timeline: { marginTop: 16 },
    fila: { flexDirection: 'row', borderRadius: 12 },
    hora: { width: 64, paddingTop: 1 },
    horaTexto: { fontSize: 15 },
    fin: { marginTop: 2 },
    riel: { width: 20, alignItems: 'center' },
    punto: {
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 2,
      marginTop: 5,
    },
    rielLinea: { flex: 1, marginTop: 4 },
    cuerpo: {
      flex: 1,
      paddingLeft: 8,
      paddingBottom: 16,
    },
    titulo: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    flexShrink: { flexShrink: 1 },
    tachado: { textDecorationLine: 'line-through' },
    etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
    desc: { marginTop: 6 },
    mas: { marginTop: 6, gap: 4 },
    consejo: { marginTop: 2 },
    meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
    acciones: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 4,
      marginTop: 6,
      marginLeft: -12,
    },
    conector: { marginLeft: 92, marginBottom: 12, marginTop: -6 },
  })
