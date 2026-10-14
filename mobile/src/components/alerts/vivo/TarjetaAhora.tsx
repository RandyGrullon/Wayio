import { StyleSheet, View } from 'react-native'
import { alpha, useEstilos, useTheme, type Tema } from '../../../theme'
import { Txt } from '../../ui/Txt'
import { Button } from '../../ui/Button'
import { Card, CardKicker } from '../../ui/Card'
import { CalendarDays, CheckCircle2, Navigation } from '../../ui/iconos'
import { formatHora12 } from '../../ui/formato'
import { BotonInverso } from '../piezas'
import {
  finMin,
  inicioMin,
  minutosDelDia,
} from '../../../lib/geofencing/fechas'
import { distanciaMetros, minutosAPie } from '../../../lib/geofencing/geodesia'
import type { MomentoDelDia } from '../../../lib/geofencing/alertEngine'
import type { Activity } from '../../../types/activity'
import type { UserLocation } from '../../../types/geofencing'

interface Props {
  momento: MomentoDelDia
  ahora: Date
  ubicacion: UserLocation | null
  /** Primera actividad de mañana (para el día terminado). */
  manana: Activity | null
  onComoLlegar: (a: Activity) => void
  onMeLaPerdi: (a: Activity) => void
}

const aPie = (u: UserLocation | null, a: Activity | null): number | null => {
  if (!u || !a || (a.lat === 0 && a.lng === 0)) return null
  return minutosAPie(distanciaMetros(u.lat, u.lng, a.lat, a.lng))
}

/**
 * Tarjeta AHORA (§6.6): superficie invertida, la actividad en display, barra
 * del tiempo transcurrido y lo siguiente. «Cómo llegar» es el único magenta
 * de la vista; «Me la perdí» abre el flujo de 3 pasos. Tocar la tarjeta no
 * marca nada.
 */
export function TarjetaAhora({
  momento,
  ahora,
  ubicacion,
  manana,
  onComoLlegar,
  onMeLaPerdi,
}: Props): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const { colors } = useTheme()
  const { actual, tipo, siguiente } = momento

  if (!actual) {
    return (
      <Card variant="default" style={styles.terminado}>
        <CardKicker icon={CheckCircle2} color="successFg">
          Día completado
        </CardKicker>
        <Txt variant="h2">Terminaste el plan de hoy</Txt>
        <Txt variant="bodyS" color="fgMuted">
          {manana
            ? `Mañana empiezas con ${manana.nombre}${manana.horaInicio ? ` a las ${formatHora12(manana.horaInicio)}` : ''}.`
            : 'Descansa: no queda nada más en el itinerario.'}
        </Txt>
      </Card>
    )
  }

  const ahoraMin = minutosDelDia(ahora)
  const ini = inicioMin(actual)
  const fin = finMin(actual)
  const enMarcha = tipo === 'en_curso' || tipo === 'ahora'
  const progreso =
    enMarcha && ini !== null && fin !== null && fin > ini
      ? Math.min(1, Math.max(0, (ahoraMin - ini) / (fin - ini)))
      : null

  const kicker =
    tipo === 'siguiente'
      ? `A continuación · ${formatHora12(actual.horaInicio) || 'sin hora'}`
      : `Ahora · ${formatHora12(ahora)}`

  const lineaSiguiente = (): string => {
    if (tipo === 'siguiente') {
      const faltan = ini !== null ? ini - ahoraMin : null
      const pie = aPie(ubicacion, actual)
      return [
        faltan !== null && faltan > 0 ? `Empieza en ${faltan} min` : null,
        pie !== null ? `≈ ${pie} min a pie` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    }
    if (!siguiente) return 'Es lo último del día.'
    const iniSig = inicioMin(siguiente)
    const faltan = iniSig !== null ? iniSig - ahoraMin : null
    const pie = aPie(ubicacion, siguiente)
    return [
      faltan !== null && faltan > 0
        ? `Siguiente en ${faltan} min`
        : 'Siguiente',
      siguiente.nombre,
      pie !== null ? `≈ ${pie} min a pie` : null,
    ]
      .filter(Boolean)
      .join(' · ')
  }

  const estadoTexto =
    tipo === 'en_curso'
      ? actual.horaEntrada
        ? `Llegaste a las ${formatHora12(actual.horaEntrada)}`
        : 'Estás aquí'
      : null

  const destino = tipo === 'siguiente' ? actual : (siguiente ?? actual)

  return (
    <Card variant="inverse" style={styles.tarjeta}>
      <Txt variant="overline" color="fgInverse" style={styles.suave}>
        {kicker}
      </Txt>
      <Txt variant="h1" color="fgInverse">
        {actual.nombre}
      </Txt>
      <Txt variant="caption" color="fgInverse" style={styles.suave} tnum>
        {[
          formatHora12(actual.horaInicio) && formatHora12(actual.horaFin)
            ? `${formatHora12(actual.horaInicio)} – ${formatHora12(actual.horaFin)}`
            : formatHora12(actual.horaInicio),
          estadoTexto,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Txt>

      {progreso !== null ? (
        <View
          style={[
            styles.barra,
            { backgroundColor: alpha(colors.fgInverse, 0.22) },
          ]}
          accessibilityRole="progressbar"
          accessibilityLabel="Tiempo transcurrido de la actividad"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(progreso * 100),
          }}
        >
          <View
            style={[
              styles.relleno,
              {
                width: `${Math.round(progreso * 100)}%`,
                backgroundColor: colors.fgInverse,
              },
            ]}
          />
        </View>
      ) : null}

      <View style={styles.siguiente}>
        <CalendarDays
          size={16}
          color={colors.fgInverse}
          strokeWidth={1.75}
          accessible={false}
        />
        <Txt variant="bodyS" color="fgInverse" style={styles.flex}>
          {lineaSiguiente() || ' '}
        </Txt>
      </View>

      <View style={styles.botones}>
        <Button
          title={
            tipo === 'en_curso' && siguiente
              ? `Cómo llegar a ${siguiente.nombre}`
              : 'Cómo llegar'
          }
          icon={Navigation}
          variant="primary"
          size="lg"
          fullWidth
          onPress={() => onComoLlegar(destino)}
        />
        {actual.estado === 'pendiente' ? (
          <BotonInverso
            title="Me la perdí"
            onPress={() => onMeLaPerdi(actual)}
            accessibilityHint="Te pregunta antes de marcarla y busca otra hora"
          />
        ) : null}
      </View>
    </Card>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    tarjeta: { gap: t.space[2], padding: t.space[5] },
    terminado: { gap: t.space[2] },
    suave: { opacity: 0.86 },
    barra: {
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
      marginTop: t.space[2],
    },
    relleno: { height: 6, borderRadius: 3 },
    siguiente: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.space[2],
      marginTop: t.space[1],
    },
    flex: { flex: 1 },
    botones: { gap: t.space[2], marginTop: t.space[3] },
  })
