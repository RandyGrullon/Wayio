import { useEffect, useRef, useState } from 'react'
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native'
import {
  Button,
  Callout,
  Card,
  CardKicker,
  Pantalla,
  Skeleton,
  SkeletonRegion,
  Txt,
} from '../components/ui'
import { RutaDeFases, type EstadoSello } from '../components/trip/RutaDeFases'
import { Compass, PenLine, RefreshCw, X } from '../components/ui/iconos'
import { formatCronometro } from '../components/ui/formato'
import { useEstilos, type Tema } from '../theme'
import type { Fase } from '../lib/api/stream'

/** Consejos «Mientras tanto»: uno por fase (sin temporizador, §6.3). */
const CONSEJOS: Record<
  'contexto' | 'itinerario' | 'coords' | 'listo',
  string[]
> = {
  contexto: [
    'Miramos el clima y la temporada para no mandarte a la playa en plena lluvia.',
    'Si viajas en temporada alta, reserva los hoteles con antelación: suben rápido.',
  ],
  itinerario: [
    'Cada versión equilibra distinto el presupuesto: Básico ahorra, Premium consiente.',
    'Las actividades cercanas se agrupan por día para que camines menos.',
    'Después podrás ajustar cualquier día con IA: «hazlo más relajado», «más playa»…',
  ],
  coords: [
    'Ubicamos cada lugar en el mapa para calcular los traslados entre actividades.',
    'Con el modo en vivo, Wayio te avisa si vas tarde a la siguiente parada.',
  ],
  listo: ['Tu cuaderno de ruta está listo. Elige la versión que más te guste.'],
}

/** Índice del sello (0..3) para una fase real del SSE. */
export function selloDeFase(fase: Fase | null): number {
  switch (fase) {
    case 'contexto':
      return 0
    case 'plan':
    case 'ia':
    case 'dias':
      return 1
    case 'coords':
      return 2
    case 'listo':
    case 'cache':
    case 'demo':
      return 3
    default:
      return 0
  }
}

interface Props {
  /** Kicker: «TRAZANDO TU VIAJE · CARTAGENA · 12–18 NOV». */
  kicker: string
  fase: Fase | null
  label: string
  /** Instante (ms) en que empezó la generación. */
  inicio: number
  error: string | null
  onCancel: () => void
  onRetry: () => void
  onEdit: () => void
}

/**
 * Pantalla de carga «Trazando tu viaje» (§6.3, móvil): RutaDeFases con las
 * fases reales, el texto de la fase en vivo, cronómetro real y aviso a los
 * 45 s. Sin barra ni temporizador falsos.
 */
export function LoadingScreen({
  kicker,
  fase,
  label,
  inicio,
  error,
  onCancel,
  onRetry,
  onEdit,
}: Props): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const [segundos, setSegundos] = useState(0)
  const [consejo, setConsejo] = useState(0)

  // «Atrás» de Android = Cancelar (o Editar datos tras un error): vuelve al
  // formulario con los datos en vez de salir del planificador (§6.3).
  const volverRef = useRef<() => void>(onCancel)
  useEffect(() => {
    volverRef.current = error ? onEdit : onCancel
  })
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      volverRef.current()
      return true
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    if (error) return
    const id = setInterval(() => {
      setSegundos(Math.floor((Date.now() - inicio) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [inicio, error])

  const actual = selloDeFase(fase)
  const completo = fase === 'listo' || fase === 'cache' || fase === 'demo'
  const estados: EstadoSello[] = [0, 1, 2, 3].map((i) => {
    if (completo) return 'hecho'
    if (i < actual) return 'hecho'
    if (i === actual) return error ? 'error' : 'activo'
    return 'pendiente'
  })
  const clave =
    (['contexto', 'itinerario', 'coords', 'listo'] as const)[actual] ??
    'contexto'
  const lista = CONSEJOS[clave]
  const textoConsejo = lista[consejo % lista.length] ?? lista[0] ?? ''

  return (
    <Pantalla edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.barra}>
        {!error ? (
          <Button
            title="Cancelar"
            variant="ghost"
            size="sm"
            icon={X}
            onPress={onCancel}
          />
        ) : null}
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Txt variant="overline" color="fgMuted">
          {kicker}
        </Txt>

        <View style={styles.ruta}>
          <RutaDeFases estados={estados} />
        </View>

        <View accessibilityLiveRegion="polite" style={styles.fase}>
          <Txt variant="h2">
            {error
              ? 'No pudimos trazar tu viaje'
              : label || 'Trazando tu viaje…'}
          </Txt>
        </View>

        {error ? (
          <>
            <Callout tone="danger" style={styles.bloque}>
              {error}
            </Callout>
            <View style={styles.acciones}>
              <Button
                title="Reintentar"
                icon={RefreshCw}
                size="lg"
                onPress={onRetry}
              />
              <Button
                title="Editar datos"
                variant="outline"
                icon={PenLine}
                size="lg"
                onPress={onEdit}
              />
            </View>
          </>
        ) : (
          <>
            <View style={styles.tiempo}>
              <Txt variant="caption" color="fgMuted" style={styles.flex}>
                Suele tardar entre 20 y 60 segundos
              </Txt>
              <Txt
                variant="data"
                color="fgSubtle"
                tnum
                accessibilityLabel={`${segundos} segundos`}
              >
                {formatCronometro(segundos)}
              </Txt>
            </View>
            {segundos >= 45 ? (
              <Callout tone="info" style={styles.bloque}>
                Está tardando más de lo normal; seguimos trabajando.
              </Callout>
            ) : null}

            <Card variant="nota" style={styles.bloque}>
              <CardKicker color="brassText" icon={Compass}>
                Mientras tanto
              </CardKicker>
              <Txt variant="bodyS" style={styles.consejo}>
                {textoConsejo}
              </Txt>
              {lista.length > 1 ? (
                <Button
                  variant="link"
                  title="Otro consejo"
                  onPress={() => setConsejo((c) => c + 1)}
                  style={styles.otro}
                />
              ) : null}
            </Card>

            <SkeletonRegion
              label="Preparando las tres versiones"
              style={styles.bloque}
            >
              {[0, 1, 2].map((k) => (
                <View key={k} style={styles.version}>
                  <Skeleton width="30%" height={12} />
                  <Skeleton width="55%" height={28} style={styles.hueco} />
                  <Skeleton width="80%" height={12} style={styles.hueco} />
                </View>
              ))}
            </SkeletonRegion>
          </>
        )}
      </ScrollView>
    </Pantalla>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    flex: { flex: 1 },
    barra: {
      minHeight: 52,
      paddingHorizontal: 8,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    scroll: {
      paddingHorizontal: 16,
      paddingBottom: 40,
      width: '100%',
      maxWidth: 560,
      alignSelf: 'center',
    },
    ruta: { marginTop: 24 },
    fase: { marginTop: 24 },
    tiempo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 8,
    },
    bloque: { marginTop: 20 },
    acciones: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 20,
    },
    consejo: { marginTop: 8 },
    otro: { marginTop: 4 },
    version: {
      borderRadius: t.radius.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      padding: 16,
      marginBottom: 12,
    },
    hueco: { marginTop: 10 },
  })
