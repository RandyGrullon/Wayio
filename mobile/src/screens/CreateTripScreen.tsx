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
import { ErrorGeneracion, MENSAJE_GENERICO, type Fase } from '../lib/api/stream'
import {
  cupoAgotadoDe,
  datosDeLimite,
  mensajeDeLimite,
} from '../lib/api/limites'

/**
 * Texto del error de trazado. Tope diario de IA → el del servidor; límite de
 * la cuenta (429) con espera → cuánto falta («Vuelve a intentarlo en 40
 * min.» o «… en 3 horas.»), para no gastar reintentos en balde.
 */
function mensajeDeFallo(e: unknown): string {
  if (!(e instanceof Error) || !e.message) return MENSAJE_GENERICO
  if (e instanceof ErrorGeneracion) {
    const limite = mensajeDeLimite(
      {
        status: e.status,
        code: e.code,
        data: e.data,
        retryAfter: e.retryAfter,
        mensaje: e.message,
      },
      'Has trazado varios viajes seguidos.'
    )
    if (limite) return limite
  }
  return e.message
}

interface Trazado {
  form: FormularioViaje
  fase: Fase | null
  label: string
  inicio: number
  error: string | null
  /** El error es el cupo del mes agotado: «Ver planes», sin reintento. */
  cupoAgotado: boolean
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
        cupoAgotado: false,
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
        // Cupo del mes agotado (402): el texto del servidor y «Ver planes».
        // generarViaje ya no lo repite ni cae a POST /api/generate.
        const cupo = cupoAgotadoDe(datosDeLimite(e))
        setTrazado((t) =>
          t
            ? {
                ...t,
                error: cupo ? cupo.mensaje : mensajeDeFallo(e),
                cupoAgotado: cupo !== null,
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
        onVerPlanes={
          trazado.cupoAgotado ? () => navigate({ name: 'paywall' }) : undefined
        }
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
