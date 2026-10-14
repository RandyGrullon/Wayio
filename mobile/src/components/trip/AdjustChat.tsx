import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { adjustTripDetailed, BackendError } from '../../lib/api/backend'
import { useEstilos, type Tema } from '../../theme'
import { Callout } from '../ui/Callout'
import { Chip } from '../ui/Chip'
import { IconButton } from '../ui/IconButton'
import { Input } from '../ui/Input'
import { Txt } from '../ui/Txt'
import { Compass, Send, Undo2 } from '../ui/iconos'
import { Button } from '../ui/Button'
import type { PlanningTrip } from '../../types/planning'

interface Props {
  trip: PlanningTrip
  /** El viaje ajustado y el resumen de cambios de la IA. */
  onAdjusted: (trip: PlanningTrip, resumen: string) => void
  /** Deshacer el último ajuste (si lo hay). */
  onUndo?: () => void
  /** Sugerir la edición manual cuando la IA no está disponible. */
  onEditarAMano?: () => void
}

const SUGERENCIAS = [
  'Hazlo más relajado',
  'Añade un día de playa',
  'Más barato',
  'Más actividades culturales',
  'Menos traslados',
] as const

interface Mensaje {
  id: number
  propio: boolean
  texto: string
}

/**
 * «Ajustar con IA» (§6.5): sugerencias, historial (burbujas propias en tinta,
 * respuestas con el resumen del cambio) y «Deshacer último ajuste». Ante 429
 * respeta `retryAfter`; ante 503 ofrece la edición manual.
 */
export function AdjustChat({
  trip,
  onAdjusted,
  onUndo,
  onEditarAMano,
}: Props): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ msg: string; manual: boolean } | null>(
    null
  )
  const [historial, setHistorial] = useState<Mensaje[]>([])

  const enviar = async (instruccion: string): Promise<void> => {
    const limpio = instruccion.trim().slice(0, 500)
    if (limpio.length < 2 || loading) return
    setLoading(true)
    setError(null)
    setHistorial((h) => [
      ...h,
      { id: h.length + 1, propio: true, texto: limpio },
    ])
    try {
      const r = await adjustTripDetailed(trip, limpio)
      const resumen = r.resumenCambios || 'Listo: ajusté tu itinerario.'
      onAdjusted(r.trip, resumen)
      setHistorial((h) => [
        ...h,
        { id: h.length + 1, propio: false, texto: resumen },
      ])
      setTexto('')
    } catch (err) {
      if (err instanceof BackendError) {
        const manual =
          err.code === 'unavailable' ||
          err.data?.['code'] === 'ia_no_disponible'
        const msg =
          err.code === 'rate_limit' && err.retryAfter
            ? `${err.message} Vuelve a intentarlo en ${Math.ceil(err.retryAfter / 60)} min.`
            : err.message
        setError({ msg, manual })
      } else {
        setError({
          msg: 'No pudimos ajustar el itinerario. Inténtalo de nuevo.',
          manual: false,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <View>
      <View style={styles.chips}>
        {SUGERENCIAS.map((s) => (
          <Chip
            key={s}
            label={s}
            role="button"
            size="sm"
            disabled={loading}
            onPress={() => void enviar(s)}
          />
        ))}
      </View>

      {historial.length > 0 ? (
        <View style={styles.historial} accessibilityLiveRegion="polite">
          {historial.map((m) => (
            <View
              key={m.id}
              style={[styles.burbuja, m.propio ? styles.propia : styles.ajena]}
            >
              {!m.propio ? (
                <View style={styles.autor}>
                  <Compass
                    size={14}
                    strokeWidth={1.75}
                    color={styles.icono.color}
                  />
                  <Txt variant="caption" color="fgMuted">
                    Wayio
                  </Txt>
                </View>
              ) : null}
              <Txt variant="bodyS" color={m.propio ? 'bubbleOwnFg' : 'fg'}>
                {m.texto}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}

      {loading ? (
        <Txt variant="caption" color="fgMuted" style={styles.nota}>
          La IA está reescribiendo tu itinerario. Puede tardar unos segundos.
        </Txt>
      ) : null}

      {error ? (
        <Callout
          tone="danger"
          style={styles.nota}
          {...(error.manual && onEditarAMano
            ? { action: { label: 'Editar a mano', onPress: onEditarAMano } }
            : {})}
        >
          {error.msg}
        </Callout>
      ) : null}

      <View style={styles.compositor}>
        <Input
          label="¿Qué quieres cambiar?"
          hideLabel
          value={texto}
          onChangeText={setTexto}
          disabled={loading}
          placeholder="Ej.: añade un mercado local el día 2"
          returnKeyType="send"
          onSubmitEditing={() => void enviar(texto)}
          maxLength={500}
          containerStyle={styles.flex}
        />
        <IconButton
          label="Enviar ajuste"
          icon={Send}
          variant="tinta"
          disabled={loading || texto.trim().length < 2}
          onPress={() => void enviar(texto)}
          style={styles.enviar}
        />
      </View>

      {onUndo ? (
        <Button
          title="Deshacer último ajuste"
          variant="ghost"
          size="sm"
          icon={Undo2}
          onPress={onUndo}
          disabled={loading}
        />
      ) : null}
    </View>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    flex: { flex: 1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    historial: { marginTop: 16, gap: 8 },
    burbuja: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 10 },
    propia: {
      alignSelf: 'flex-end',
      backgroundColor: t.colors.bubbleOwn,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 4,
    },
    ajena: {
      alignSelf: 'flex-start',
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderBottomRightRadius: 16,
      borderBottomLeftRadius: 4,
    },
    autor: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 2,
    },
    icono: { color: t.colors.fgMuted },
    nota: { marginTop: 12 },
    compositor: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 16,
    },
    enviar: { marginTop: 4 },
  })
