import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import { useEstilos, useTheme, type Tema } from '../theme'
import { Txt } from './ui/Txt'
import { Button } from './ui/Button'
import { CalendarDays, Check, Compass } from './ui/iconos'
import { formatDuracion, formatFecha, formatHora12 } from './ui/formato'
import { Aviso, Hoja } from './alerts/piezas'
import { hapticConfirmar, hapticSeleccion } from '../lib/haptics/patterns'
import {
  findRescheduleOptions,
  type OpcionReagendar,
} from '../lib/scheduling/reschedule'
import { rescheduleActivityDetailed } from '../lib/api/backend'
import { conTiempoLimite } from '../lib/scheduling/tiempoLimite'
import { fechaDeDia, fechaYHora } from '../lib/geofencing/fechas'
import type { Activity } from '../types/activity'
import type { Day } from '../types/trip'

/**
 * «Me la perdí» en 3 pasos (DISENO §6.6):
 * 1. «¿Te la perdiste?» (confirmar),
 * 2. «Buscando nueva hora…»,
 * 3. sugerencia con «Aceptar» y «Descartar».
 * Tocar la tarjeta de la actividad nunca marca nada: solo este flujo.
 */

export interface PropuestaReagendar {
  /** Índice 0-based del día destino. */
  dia: number
  horaInicio: string
  horaFin: string
  posicion?: number
}

type Paso = 'confirmar' | 'buscando' | 'sugerencia'

interface Opcion extends OpcionReagendar {
  clave: string
  /** Nota de la IA (solo si la propuso la IA). */
  nota?: string
}

interface Props {
  visible: boolean
  actividad: Activity | null
  dias: Day[]
  /** id de la fila del viaje (trips.id): habilita la propuesta con IA. */
  filaId?: string | undefined
  /**
   * Empieza en «buscando»: el viajero ya eligió «Mover a otro día» y el
   * padre ya la marcó como perdida.
   */
  saltarConfirmacion?: boolean
  /** Paso 1 confirmado: marcar como perdida. */
  onConfirmarPerdida: (actividad: Activity) => void
  onAceptar: (actividad: Activity, propuesta: PropuestaReagendar) => void
  /** Sin nueva hora: queda perdida y va a «Para tu próxima visita». */
  onDescartar: (actividad: Activity) => void
  onCerrar: () => void
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** La propuesta de la IA no sirve si su día y hora ya pasaron. */
function yaPaso(fecha: string | null, hora: string): boolean {
  if (!fecha) return false
  const cuando = fechaYHora(fecha, hora)
  return cuando !== null && cuando.getTime() <= Date.now()
}

export function ReschedulePanel({
  visible,
  actividad,
  dias,
  filaId,
  saltarConfirmacion = false,
  onConfirmarPerdida,
  onAceptar,
  onDescartar,
  onCerrar,
}: Props): React.ReactElement | null {
  const styles = useEstilos(crearEstilos)
  const { colors } = useTheme()
  // El padre monta el panel con una `key` por actividad: el estado empieza
  // de cero cada vez que se abre.
  const [paso, setPaso] = useState<Paso>(
    saltarConfirmacion ? 'buscando' : 'confirmar'
  )
  const [opciones, setOpciones] = useState<Opcion[]>([])
  const [elegida, setElegida] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const diasRef = useRef(dias)
  const busqueda = useRef(0)
  const iniciada = useRef(false)

  useEffect(() => {
    diasRef.current = dias
  }, [dias])

  /** Busca huecos (IA si hay fila, y locales). Solo fija estado al final. */
  const buscar = useCallback(
    async (act: Activity) => {
      const id = ++busqueda.current
      const encontradas: Opcion[] = []

      if (filaId && UUID_RE.test(filaId)) {
        try {
          const r = await conTiempoLimite(
            rescheduleActivityDetailed(
              act.id,
              filaId,
              'El viajero se la perdió durante el viaje'
            ),
            25_000
          )
          const diaIdx = r.dia - 1
          const dia = diasRef.current.find((d) => d.index === diaIdx)
          const fecha = dia ? fechaDeDia(dia) : null
          if (
            dia &&
            r.activity.horaInicio &&
            r.activity.horaFin &&
            !yaPaso(fecha, r.activity.horaInicio)
          ) {
            encontradas.push({
              clave: `ia-${diaIdx}-${r.activity.horaInicio}`,
              dia: diaIdx,
              posicion: 0,
              impactoMinutos: 0,
              descripcion: '',
              esOptima: true,
              horaInicio: r.activity.horaInicio,
              horaFin: r.activity.horaFin,
              fecha,
              ...(r.nota ? { nota: r.nota } : {}),
            })
          }
        } catch {
          // Sin IA, sin sesión o sin red: se usan los huecos locales.
        }
      }

      try {
        const locales = await findRescheduleOptions(act, diasRef.current)
        for (const o of locales) {
          const clave = `${o.dia}-${o.horaInicio}`
          if (encontradas.some((e) => `${e.dia}-${e.horaInicio}` === clave))
            continue
          encontradas.push({
            ...o,
            clave,
            esOptima: encontradas.length === 0 && o.esOptima,
          })
        }
      } catch {
        // Sin almacenamiento local: quedan las opciones de la IA (si hay).
      }

      if (id !== busqueda.current) return
      const lista = encontradas.slice(0, 3)
      setOpciones(lista)
      setElegida(lista[0]?.clave ?? null)
      setPaso('sugerencia')
      setAviso(
        lista.length === 0
          ? 'No encontramos un hueco libre en lo que queda de viaje. La guardamos en «Para tu próxima visita».'
          : null
      )
    },
    [filaId]
  )

  // Abierto desde «Mover a otro día»: el padre ya la marcó como perdida y
  // se busca directamente (una sola vez por apertura).
  useEffect(() => {
    if (!visible || !actividad || !saltarConfirmacion || iniciada.current) {
      return
    }
    iniciada.current = true
    void buscar(actividad)
  }, [visible, actividad, saltarConfirmacion, buscar])

  if (!actividad) return null

  const confirmar = (): void => {
    void hapticSeleccion()
    onConfirmarPerdida(actividad)
    setPaso('buscando')
    setAviso(null)
    setOpciones([])
    void buscar(actividad)
  }

  const aceptar = (): void => {
    const o = opciones.find((x) => x.clave === elegida)
    if (!o) return
    void hapticConfirmar()
    onAceptar(actividad, {
      dia: o.dia,
      horaInicio: o.horaInicio,
      horaFin: o.horaFin,
      posicion: o.posicion,
    })
  }

  const cerrar = (): void => {
    // Cerrar tras confirmar equivale a «Descartar»: sigue perdida.
    if (paso === 'confirmar') onCerrar()
    else onDescartar(actividad)
  }

  const rango = [
    formatHora12(actividad.horaInicio),
    formatHora12(actividad.horaFin),
  ]
    .filter(Boolean)
    .join(' – ')

  const titulo =
    paso === 'confirmar'
      ? '¿Te la perdiste?'
      : paso === 'buscando'
        ? 'Buscando nueva hora…'
        : opciones.length > 0
          ? 'Te proponemos'
          : 'Sin hueco por ahora'

  const etiquetaDia = (o: Opcion): string => {
    const dia = dias.find((d) => d.index === o.dia)
    const base = `Día ${o.dia + 1}`
    const fecha = o.fecha ?? (dia ? dia.fecha.slice(0, 10) : '')
    const texto = formatFecha(fecha)
    return texto ? `${base} · ${texto}` : base
  }

  return (
    <Hoja
      visible={visible}
      onClose={cerrar}
      kicker={paso === 'confirmar' ? 'Me la perdí' : 'Reagendar'}
      kickerIcon={CalendarDays}
      titulo={titulo}
      acciones={
        paso === 'confirmar' ? (
          <>
            <Button
              title="Sí, buscar nueva hora"
              variant="tinta"
              size="lg"
              fullWidth
              onPress={confirmar}
            />
            <Button
              title="No, cancelar"
              variant="ghost"
              size="lg"
              fullWidth
              onPress={onCerrar}
            />
          </>
        ) : paso === 'sugerencia' ? (
          opciones.length > 0 ? (
            <>
              <Button
                title="Aceptar"
                icon={Check}
                variant="tinta"
                size="lg"
                fullWidth
                disabled={!elegida}
                onPress={aceptar}
              />
              <Button
                title="Descartar"
                variant="ghost"
                size="lg"
                fullWidth
                onPress={() => onDescartar(actividad)}
              />
            </>
          ) : (
            <Button
              title="Entendido"
              variant="tinta"
              size="lg"
              fullWidth
              onPress={() => onDescartar(actividad)}
            />
          )
        ) : undefined
      }
    >
      <View style={styles.actividad} accessible>
        <Txt variant="title">{actividad.nombre}</Txt>
        <Txt variant="caption" color="fgMuted">
          {[rango, formatDuracion(actividad.duracionMinutos)]
            .filter(Boolean)
            .join(' · ')}
        </Txt>
      </View>

      {paso === 'confirmar' ? (
        <Txt variant="bodyS" color="fgMuted">
          La marcamos como perdida y buscamos un hueco más tarde o en los
          próximos días. Tú decides si la aceptas.
        </Txt>
      ) : null}

      {paso === 'buscando' ? (
        <View
          style={styles.buscando}
          accessible
          accessibilityLabel="Buscando nueva hora"
          accessibilityState={{ busy: true }}
        >
          <ActivityIndicator color={colors.fg} />
          <Txt variant="bodyS" color="fgMuted">
            Revisando los huecos libres de tu itinerario…
          </Txt>
        </View>
      ) : null}

      {paso === 'sugerencia' && aviso ? (
        <Aviso tono="info" icon={CalendarDays} vivo>
          {aviso}
        </Aviso>
      ) : null}

      {paso === 'sugerencia' && opciones.length > 0 ? (
        <View
          style={styles.opciones}
          accessibilityRole="radiogroup"
          accessibilityLabel="Horarios propuestos"
        >
          {opciones.map((o) => {
            const activa = o.clave === elegida
            return (
              <Pressable
                key={o.clave}
                onPress={() => {
                  void hapticSeleccion()
                  setElegida(o.clave)
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: activa }}
                accessibilityLabel={`${etiquetaDia(o)}, ${formatHora12(o.horaInicio)} a ${formatHora12(o.horaFin)}`}
                style={({ pressed }) => [
                  styles.opcion,
                  activa ? styles.opcionActiva : null,
                  pressed ? styles.pulsada : null,
                ]}
              >
                <View style={styles.opcionCabecera}>
                  <Txt variant="label">{etiquetaDia(o)}</Txt>
                  {o.esOptima ? (
                    <View style={styles.mejor}>
                      <Txt variant="overline" color="accentSoftFg">
                        Mejor opción
                      </Txt>
                    </View>
                  ) : null}
                </View>
                <Txt variant="bodyS" tnum>
                  {formatHora12(o.horaInicio)} – {formatHora12(o.horaFin)}
                </Txt>
                {o.nota ? (
                  <View style={styles.nota}>
                    <Compass
                      size={14}
                      color={colors.fgMuted}
                      strokeWidth={1.75}
                      accessible={false}
                    />
                    <Txt variant="caption" color="fgMuted" style={styles.flex}>
                      {o.nota}
                    </Txt>
                  </View>
                ) : o.impactoMinutos > 0 ? (
                  <Txt variant="caption" color="fgMuted">
                    Unos {o.impactoMinutos} min de desvío a pie
                  </Txt>
                ) : null}
              </Pressable>
            )
          })}
        </View>
      ) : null}
    </Hoja>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    actividad: {
      gap: 2,
      paddingVertical: t.space[2],
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    buscando: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.space[3],
      paddingVertical: t.space[5],
    },
    opciones: { gap: t.space[2] },
    opcion: {
      gap: 2,
      padding: t.space[4],
      borderRadius: t.radius.card,
      borderWidth: 1,
      borderColor: t.colors.borderStrong,
      backgroundColor: t.colors.surface,
    },
    opcionActiva: {
      borderWidth: 2,
      borderColor: t.colors.fg,
      padding: t.space[4] - 1,
    },
    opcionCabecera: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: t.space[2],
    },
    mejor: {
      backgroundColor: t.colors.accentSoft,
      borderRadius: t.radius.stamp,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    nota: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
      marginTop: t.space[1],
    },
    flex: { flex: 1 },
    pulsada: { opacity: 0.9 },
  })
