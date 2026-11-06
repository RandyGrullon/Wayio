import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { Callout, Pantalla, ScreenHeader } from '../components/ui'
import { TripForm } from '../components/trip/TripForm'
import { formatRangoFechas } from '../components/ui/formato'
import { LoadingScreen } from './LoadingScreen'
import { useNavigation } from '../navigation/NavigationContext'
import type { ErroresFormulario, FormularioViaje } from './crear/formulario'
import { useTrazado } from './crear/useTrazado'
import { useMantenimiento } from '../hooks/useConfigRemota'

/**
 * Planificador (§6.2–§6.3 en móvil): formulario por estaciones y, al enviar,
 * la pantalla «Trazando tu viaje» con las fases reales del SSE. Cancelar
 * aborta la petición y vuelve al formulario con los datos; un error de
 * validación del servidor se asigna a cada campo.
 *
 * Modo mantenimiento (/api/config): «Trazar» no llama a la IA y muestra el
 * mensaje del admin sobre el formulario (con los datos intactos). Si el
 * servidor responde 503 code 'mantenimiento' a mitad, se vuelve igual al
 * formulario con su mensaje, sin reintentar.
 *
 * El trazado y sus errores (402 «Ver planes», 429 con espera, tope diario,
 * mantenimiento) viven en `useTrazado` (crear/useTrazado.ts), que también usa
 * «Otra versión» en PackagesScreen.
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
  const mantenimiento = useMantenimiento()
  const enMantenimiento = mantenimiento.activo
  /** «Trazar» se topó con el mantenimiento: aviso sobre el formulario. */
  const [avisoMantenimiento, setAvisoMantenimiento] = useState(false)
  const [ultimoForm, setUltimoForm] = useState<FormularioViaje | null>(
    initialForm ?? null
  )
  const [erroresServidor, setErroresServidor] = useState<ErroresFormulario>({})
  const [versionForm, setVersionForm] = useState(0)

  const { trazado, trazar, cancelar, cerrar } = useTrazado({
    onListo: (result, payload) =>
      navigate({ name: 'packages', result, form: payload }),
    onCampos: (campos) => {
      // Errores de validación del servidor: de vuelta al formulario.
      setErroresServidor(campos)
      setVersionForm((v) => v + 1)
    },
    onMantenimiento: () => setAvisoMantenimiento(true),
  })

  const enviar = (form: FormularioViaje): void => {
    setUltimoForm(form)
    setErroresServidor({})
    setAvisoMantenimiento(false)
    void trazar(form)
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
        onRetry={() => enviar(trazado.form)}
        onEdit={() => {
          setVersionForm((v) => v + 1)
          cerrar()
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
      {avisoMantenimiento && enMantenimiento ? (
        <Callout
          tone="warning"
          title="No podemos trazar viajes ahora"
          onDismiss={() => setAvisoMantenimiento(false)}
          style={styles.aviso}
        >
          {`${mantenimiento.mensaje} Tus datos siguen aquí para cuando volvamos.`}
        </Callout>
      ) : null}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TripForm
          key={versionForm}
          initial={inicial}
          autoInterpretar={!ultimoForm && Boolean(inicial.descripcion)}
          erroresServidor={erroresServidor}
          onSubmit={enviar}
        />
      </KeyboardAvoidingView>
    </Pantalla>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  aviso: { marginHorizontal: 16, marginBottom: 8 },
})
