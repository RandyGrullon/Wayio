import { StyleSheet, View } from 'react-native'
import { useEstilos, useTheme, type Tema } from '../../../theme'
import { Txt } from '../../ui/Txt'
import { formatCurrency, formatHora12 } from '../../ui/formato'
import { ESTADO_VISUAL } from './estados'
import type { Activity } from '../../../types/activity'
import type { Moneda } from '../../../types/trip'

interface Props {
  actividad: Activity
  moneda: Moneda
  /** Es la de la tarjeta AHORA. */
  destacada?: boolean
  ultima?: boolean
}

/** Fila de solo lectura de la línea de tiempo (tocarla no marca nada). */
export function FilaActividad({
  actividad,
  moneda,
  destacada = false,
  ultima = false,
}: Props): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const { colors } = useTheme()
  const estado = ESTADO_VISUAL[actividad.estado]
  const Icono = estado.icon
  const hora = formatHora12(actividad.horaInicio)
  const perdida = actividad.estado === 'perdida'
  const precio =
    actividad.precio !== undefined && actividad.precio > 0
      ? formatCurrency(actividad.precio, moneda)
      : null

  return (
    <View
      style={[styles.fila, destacada ? styles.destacada : null]}
      accessible
      accessibilityLabel={[
        hora,
        actividad.nombre,
        estado.etiqueta,
        precio ? `estimado ${precio}` : '',
      ]
        .filter(Boolean)
        .join(', ')}
    >
      <View style={styles.hora}>
        <Txt variant="caption" color="fgMuted" tnum>
          {hora || '—'}
        </Txt>
      </View>
      <View style={styles.riel}>
        <Icono
          size={18}
          color={colors[estado.color]}
          strokeWidth={1.75}
          accessible={false}
        />
        {!ultima ? <View style={styles.linea} /> : null}
      </View>
      <View style={styles.cuerpo}>
        <Txt
          variant="label"
          color={perdida ? 'fgSubtle' : 'fg'}
          style={perdida ? styles.tachado : null}
        >
          {actividad.nombre}
        </Txt>
        <View style={styles.meta}>
          <Txt variant="caption" color={estado.color}>
            {estado.etiqueta}
          </Txt>
          {precio ? (
            <Txt variant="caption" color="fgMuted" tnum>
              · {precio}
            </Txt>
          ) : null}
        </View>
      </View>
    </View>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    fila: {
      flexDirection: 'row',
      gap: t.space[3],
      paddingHorizontal: t.space[2],
      borderRadius: t.radius.control,
    },
    destacada: { backgroundColor: t.colors.surface2 },
    hora: { width: 76, paddingTop: t.space[3] },
    riel: { alignItems: 'center', paddingTop: t.space[3], width: 18 },
    linea: {
      flex: 1,
      width: 2,
      marginTop: t.space[1],
      backgroundColor: t.colors.border,
      borderRadius: 1,
    },
    cuerpo: { flex: 1, paddingVertical: t.space[3], gap: 2 },
    meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    tachado: { textDecorationLine: 'line-through' },
  })
