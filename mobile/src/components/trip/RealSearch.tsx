import { useCallback, useState } from 'react'
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native'
import {
  BackendError,
  searchActivities,
  searchFlights,
  searchHotels,
  type SearchResponse,
  type SearchResult,
} from '../../lib/api/search'
import { useEstilos, useTheme, type Tema } from '../../theme'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { Input } from '../ui/Input'
import { Tabs } from '../ui/Tabs'
import { Txt } from '../ui/Txt'
import { ExternalLink, PlaneTakeoff, MapPin, Search, Star } from '../ui/iconos'
import { formatCurrency, formatDuracion, formatNumero } from '../ui/formato'
import type { Moneda } from '../../types/planning'

interface Props {
  destino: string
  origen?: string
  fechaInicio: string
  fechaFin: string
  personas: number
  /** Moneda del viaje (precios de actividades en esa moneda). */
  moneda?: Moneda
}

type Pestana = 'hoteles' | 'actividades' | 'vuelos'

interface Seccion {
  estado: 'inactiva' | 'cargando' | 'lista' | 'error'
  data: SearchResponse | null
  error: string | null
}

const INICIAL: Seccion = { estado: 'inactiva', data: null, error: null }

const NOMBRE_SITIO: Record<Pestana, string> = {
  hoteles: 'Booking',
  actividades: 'Viator',
  vuelos: 'el buscador de vuelos',
}

/** Nombre visible del proveedor de cada resultado (nunca uno fijo). */
const NOMBRE_PROVEEDOR: Record<string, string> = {
  viator: 'Viator',
}

function abrir(url: string): void {
  if (!url.startsWith('https://')) return
  Linking.openURL(url).catch(() => undefined)
}

function ResultadoFila({ r }: { r: SearchResult }): React.ReactElement {
  const { colors } = useTheme()
  const styles = useEstilos(crearEstilos)
  const precio =
    r.price !== undefined && r.price !== null
      ? formatCurrency(r.price, r.currency ?? 'USD')
      : null
  return (
    <Card style={styles.resultado}>
      <Txt variant="label" numberOfLines={2}>
        {r.title}
      </Txt>
      {r.subtitle ? (
        <Txt variant="caption" color="fgMuted" numberOfLines={2}>
          {r.subtitle}
        </Txt>
      ) : null}
      <View style={styles.meta}>
        {typeof r.rating === 'number' ? (
          <View style={styles.metaItem}>
            <Star
              size={14}
              color={colors.brass}
              fill={colors.brass}
              strokeWidth={1.5}
              accessible={false}
            />
            <Txt variant="caption" color="fgMuted" tnum>
              {formatNumero(r.rating, 1)}
              {r.reviews ? ` (${formatNumero(r.reviews)})` : ''}
            </Txt>
          </View>
        ) : null}
        {r.durationMinutes ? (
          <Txt variant="caption" color="fgMuted">
            {formatDuracion(r.durationMinutes)}
          </Txt>
        ) : null}
        {NOMBRE_PROVEEDOR[r.provider] ? (
          <Txt variant="caption" color="fgSubtle">
            {NOMBRE_PROVEEDOR[r.provider]}
          </Txt>
        ) : null}
      </View>
      <View style={styles.pie}>
        {precio ? (
          <Txt variant="title" tnum>
            {precio}
          </Txt>
        ) : (
          <View />
        )}
        {r.url ? (
          <Button
            title="Ver y reservar"
            variant="outline"
            size="sm"
            iconEnd={ExternalLink}
            accessibilityHint="Enlace patrocinado: abre la web del proveedor"
            onPress={() => abrir(r.url ?? '')}
          />
        ) : null}
      </View>
    </Card>
  )
}

/**
 * «Disponibilidad real» (§6.5): pestañas Hoteles | Actividades | Vuelos con
 * búsquedas BAJO DEMANDA. Si un proveedor no está configurado, vacío honesto
 * con el enlace de búsqueda del socio (sin textos para desarrolladores).
 */
export function RealSearch({
  destino,
  origen = '',
  fechaInicio,
  fechaFin,
  personas,
  moneda = 'USD',
}: Props): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const { colors } = useTheme()
  const [tab, setTab] = useState<Pestana>('hoteles')
  const [secciones, setSecciones] = useState<Record<Pestana, Seccion>>({
    hoteles: INICIAL,
    actividades: INICIAL,
    vuelos: INICIAL,
  })
  const [vueloOrigen, setVueloOrigen] = useState(origen)
  const [vueloDestino, setVueloDestino] = useState(destino)

  const buscar = useCallback(
    async (p: Pestana): Promise<void> => {
      setSecciones((s) => ({
        ...s,
        [p]: { estado: 'cargando', data: null, error: null },
      }))
      try {
        const data = await (p === 'hoteles'
          ? searchHotels(destino, fechaInicio, fechaFin, personas)
          : p === 'actividades'
            ? searchActivities(destino, fechaInicio, {
                returnDate: fechaFin,
                currency: moneda,
              })
            : searchFlights(
                vueloOrigen.trim(),
                vueloDestino.trim(),
                fechaInicio,
                personas,
                { returnDate: fechaFin, currency: moneda }
              ))
        setSecciones((s) => ({
          ...s,
          [p]: { estado: 'lista', data, error: null },
        }))
      } catch (e) {
        const d = e instanceof BackendError ? e.data : null
        const enlace =
          typeof d?.['enlace'] === 'string' ? d['enlace'] : undefined
        const mensaje =
          typeof d?.['mensaje'] === 'string'
            ? d['mensaje']
            : e instanceof Error
              ? e.message
              : 'La búsqueda no está disponible ahora.'
        setSecciones((s) => ({
          ...s,
          [p]: {
            estado: 'error',
            data: enlace
              ? { configured: false, results: [], enlace, mensaje }
              : null,
            error: mensaje,
          },
        }))
      }
    },
    [
      destino,
      fechaInicio,
      fechaFin,
      personas,
      moneda,
      vueloOrigen,
      vueloDestino,
    ]
  )

  const sec = secciones[tab]
  const resultados = sec.data?.results ?? []
  const enlace = sec.data?.enlace

  return (
    <View>
      <Txt variant="overline" color="fgMuted">
        Disponibilidad real
      </Txt>
      <Txt variant="h2" style={styles.h2}>
        Precios de hoy
      </Txt>
      <Tabs<Pestana>
        label="Tipo de búsqueda"
        value={tab}
        onValueChange={setTab}
        options={[
          { value: 'hoteles', label: 'Hoteles' },
          { value: 'actividades', label: 'Actividades' },
          { value: 'vuelos', label: 'Vuelos' },
        ]}
        style={styles.tabs}
      />

      <View style={styles.panel}>
        {tab === 'vuelos' ? (
          <View style={styles.vuelos}>
            <Input
              label="Desde"
              icon={PlaneTakeoff}
              value={vueloOrigen}
              onChangeText={setVueloOrigen}
              placeholder="Ciudad o código IATA"
              autoCapitalize="words"
              containerStyle={styles.flex}
            />
            <Input
              label="Hasta"
              icon={MapPin}
              value={vueloDestino}
              onChangeText={setVueloDestino}
              placeholder="Ciudad o código IATA"
              autoCapitalize="words"
              containerStyle={styles.flex}
            />
          </View>
        ) : null}

        {sec.estado === 'inactiva' ? (
          <Button
            title={`Buscar ${tab}`}
            variant="outline"
            icon={Search}
            disabled={
              tab === 'vuelos' &&
              (vueloOrigen.trim().length < 2 || vueloDestino.trim().length < 2)
            }
            onPress={() => void buscar(tab)}
          />
        ) : null}

        {sec.estado === 'cargando' ? (
          <View
            style={styles.cargando}
            accessible
            accessibilityLabel="Buscando…"
          >
            <ActivityIndicator color={colors.fg} />
            <Txt variant="bodyS" color="fgMuted">
              Buscando {tab}…
            </Txt>
          </View>
        ) : null}

        {sec.estado === 'lista' || sec.estado === 'error' ? (
          resultados.length > 0 ? (
            <View>
              {resultados.map((r) => (
                <ResultadoFila key={r.id} r={r} />
              ))}
              <Button
                title="Buscar de nuevo"
                variant="ghost"
                size="sm"
                onPress={() => void buscar(tab)}
              />
            </View>
          ) : (
            <View>
              <EmptyState
                ilustracion={
                  sec.estado === 'error' && !enlace ? 'error' : 'ruta'
                }
                title={
                  enlace
                    ? `Mira los precios en ${NOMBRE_SITIO[tab]}`
                    : sec.estado === 'error'
                      ? 'No pudimos buscar ahora'
                      : 'Sin resultados por ahora'
                }
                description={
                  sec.data?.mensaje ??
                  sec.error ??
                  'Prueba otra vez más tarde o con otras fechas.'
                }
                style={styles.vacio}
              />
              {enlace ? (
                <Button
                  title={`Abrir ${NOMBRE_SITIO[tab]}`}
                  variant="outline"
                  iconEnd={ExternalLink}
                  accessibilityHint="Enlace patrocinado: abre la búsqueda del socio"
                  onPress={() => abrir(enlace)}
                  style={styles.centrado}
                />
              ) : (
                <Button
                  title="Reintentar"
                  variant="ghost"
                  onPress={() => void buscar(tab)}
                  style={styles.centrado}
                />
              )}
            </View>
          )
        ) : null}
      </View>
    </View>
  )
}

const crearEstilos = (_t: Tema) =>
  StyleSheet.create({
    flex: { flex: 1 },
    h2: { marginTop: 4 },
    tabs: { marginTop: 8, marginHorizontal: -16 },
    panel: { paddingTop: 16 },
    vuelos: { flexDirection: 'row', gap: 12 },
    cargando: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 16,
    },
    resultado: { padding: 16, marginBottom: 10 },
    meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    pie: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginTop: 12,
    },
    vacio: { paddingVertical: 16 },
    centrado: { alignSelf: 'center' },
  })
