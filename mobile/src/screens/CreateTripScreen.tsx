import { useCallback, useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { Pantalla, ScreenHeader } from '../components/ui'
import { TripForm } from '../components/trip/TripForm'
import { formatRangoFechas } from '../components/ui/formato'
import { LoadingScreen } from './LoadingScreen'
import { useNavigation } from '../navigation/NavigationContext'
import {
  aPayload,
  erroresDelServidor,
  type ErroresFormulario,
  type FormularioViaje,
} from './crear/formulario'
import { generarViaje } from './crear/generar'
import { ErrorGeneracion, type Fase } from '../lib/api/stream'

interface Trazado {
  form: FormularioViaje
  fase: Fase | null
  label: string
  inicio: number
  error: string | null
}

/**
 * Planificador (§6.2–§6.3 en móvil): formulario por estaciones y, al enviar,
 * la pantalla «Trazando tu viaje» con las fases reales del SSE. Cancelar
 * aborta la petición y vuelve al formulario con los datos; un error de
 * validación del servidor se asigna a cada campo.
 */
export function CreateTripScreen({
  initialDestino,
  descripcion,
  lugaresDeseados,
  initialForm,
}: {
  initialDestino?: string
  descripcion?: string
  lugaresDeseados?: string[]
  initialForm?: FormularioViaje
} = {}): React.ReactElement {
  const { navigate } = useNavigation()
  const [trazado, setTrazado] = useState<Trazado | null>(null)
  const [ultimoForm, setUltimoForm] = useState<FormularioViaje | null>(
    initialForm ?? null
  )
  const [erroresServidor, setErroresServidor] = useState<ErroresFormulario>({})
  const [versionForm, setVersionForm] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const trazar = useCallback(
    async (form: FormularioViaje): Promise<void> => {
      abortRef.current?.abort()
      const control = new AbortController()
      abortRef.current = control
      const payload = aPayload(form)
      setUltimoForm(form)
      setErroresServidor({})
      setTrazado({
        form,
        fase: null,
        label: 'Preparando tu viaje…',
        inicio: Date.now(),
        error: null,
      })
      try {
        const result = await generarViaje(payload, {
          signal: control.signal,
          onProgress: (e) =>
            setTrazado((t) =>
              t ? { ...t, fase: e.fase, label: e.label || t.label } : t
            ),
        })
        if (control.signal.aborted) return
        setTrazado(null)
        navigate({ name: 'packages', result, form: payload })
      } catch (e) {
        if (control.signal.aborted) return
        if (e instanceof ErrorGeneracion && e.cancelado) return
        const campos =
          e instanceof ErrorGeneracion ? erroresDelServidor(e.data) : {}
        if (Object.keys(campos).length > 0) {
          // Errores de validación del servidor: de vuelta al formulario.
          setErroresServidor(campos)
          setVersionForm((v) => v + 1)
          setTrazado(null)
          return
        }
        setTrazado((t) =>
          t
            ? {
                ...t,
                error:
                  e instanceof Error && e.message
                    ? e.message
                    : 'No pudimos trazar tu viaje. Inténtalo de nuevo.',
              }
            : t
        )
      }
    },
    [navigate]
  )

  const cancelar = (): void => {
    abortRef.current?.abort()
    abortRef.current = null
    setTrazado(null)
  }

  if (trazado) {
    const destino = trazado.form.destinoSorpresa
      ? 'Destino sorpresa'
      : trazado.form.destino
    return (
      <LoadingScreen
        kicker={`Trazando tu viaje · ${destino} · ${formatRangoFechas(trazado.form.fechaInicio, trazado.form.fechaFin)}`}
        fase={trazado.fase}
        label={trazado.label}
        inicio={trazado.inicio}
        error={trazado.error}
        onCancel={cancelar}
        onRetry={() => void trazar(trazado.form)}
        onEdit={() => {
          setVersionForm((v) => v + 1)
          setTrazado(null)
        }}
      />
    )
  }

  const inicial: Partial<FormularioViaje> = ultimoForm ?? {
    ...(initialDestino ? { destino: initialDestino } : {}),
    ...(descripcion ? { descripcion } : {}),
    ...(lugaresDeseados && lugaresDeseados.length > 0
      ? {
          lugaresDeseados,
          descripcion:
            descripcion ??
            `Quiero visitar: ${lugaresDeseados.slice(0, 8).join(', ')}.`,
        }
      : {}),
  }

  return (
    <Pantalla edges={['top', 'left', 'right']}>
      <ScreenHeader title="Nuevo viaje" kicker="Planificar" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TripForm
          key={versionForm}
          initial={inicial}
          autoInterpretar={!ultimoForm && Boolean(inicial.descripcion)}
          erroresServidor={erroresServidor}
          onSubmit={(f) => void trazar(f)}
        />
      </KeyboardAvoidingView>
    </Pantalla>
  )
}

const styles = StyleSheet.create({ flex: { flex: 1 } })
