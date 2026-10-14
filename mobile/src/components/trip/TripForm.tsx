import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextInput,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Line } from 'react-native-svg'
import { useEstilos, useTheme, type Tema } from '../../theme'
import {
  Badge,
  Button,
  Callout,
  Card,
  CardKicker,
  Chip,
  ChipGroup,
  Input,
  Segmented,
  StepCounter,
  TextArea,
  Txt,
  type OpcionChip,
} from '../ui'
import {
  ArrowRight,
  CalendarDays,
  Check,
  Compass,
  Dices,
  Heart,
  Landmark,
  MapPin,
  Mountain,
  PlaneTakeoff,
  Ship,
  Sun,
  Users,
  UtensilsCrossed,
} from '../ui/iconos'
import {
  contarNoches,
  formatCurrency,
  formatFecha,
  formatNoches,
  formatRangoFechas,
  formatResumenFechas,
  formatViajeros,
  hoyLocal,
} from '../ui/formato'
import { conTope } from '../ui/conTope'
import { CalendarioSheet } from './CalendarioSheet'
import { BackendError, postJSON } from '../../lib/api/http'
import {
  MAX_DESCRIPCION,
  validarFormulario,
  type CampoFaltante,
  type ErroresFormulario,
  type FormularioViaje,
  type InterpretResult,
  type TipoViaje,
} from '../../screens/crear/formulario'
import type { Moneda, Paquete } from '../../types/planning'

const TIPOS: readonly OpcionChip<TipoViaje>[] = [
  { value: 'aventura', label: 'Aventura', icon: Mountain },
  { value: 'relax', label: 'Relax', icon: Sun },
  { value: 'cultura', label: 'Cultura', icon: Landmark },
  { value: 'familia', label: 'Familia', icon: Users },
  { value: 'crucero', label: 'Crucero', icon: Ship },
  { value: 'romantico', label: 'Romántico', icon: Heart },
  { value: 'gastronomia', label: 'Gastronomía', icon: UtensilsCrossed },
]

const ETIQUETA_TIPO: Record<TipoViaje, string> = {
  aventura: 'Aventura',
  relax: 'Relax',
  cultura: 'Cultura',
  familia: 'Familia',
  crucero: 'Crucero',
  romantico: 'Romántico',
  gastronomia: 'Gastronomía',
}

const ETIQUETA_PAQUETE: Record<Paquete, string> = {
  basico: 'Básico',
  confort: 'Confort',
  premium: 'Premium',
}

const FRASES = [
  { label: 'Viajo con niños', texto: 'Viajo con niños.' },
  { label: 'Sin madrugar', texto: 'No queremos madrugar.' },
  { label: 'Comida local', texto: 'Queremos probar comida local.' },
  { label: 'Accesible', texto: 'Necesitamos lugares accesibles.' },
  { label: 'Naturaleza', texto: 'Nos encanta la naturaleza.' },
  { label: 'Vida nocturna', texto: 'Queremos algo de vida nocturna.' },
] as const

type Campo =
  | 'descripcion'
  | 'destino'
  | 'destinoSorpresa'
  | 'origen'
  | 'fechas'
  | 'personas'
  | 'presupuesto'
  | 'moneda'
  | 'tipo'
  | 'paquete'
  | 'zona'

type EstadoIA =
  | { estado: 'inactivo' }
  | { estado: 'cargando' }
  | { estado: 'listo'; resultado: InterpretResult; aplicado: boolean }
  | { estado: 'error'; mensaje: string }
  | { estado: 'no_disponible' }

const NOMBRE_FALTANTE: Record<CampoFaltante, string> = {
  destino: 'destino',
  origen: 'ciudad de origen',
  fechas: 'fechas',
  personas: 'viajeros',
  presupuesto: 'presupuesto',
}

const NOMBRE_CAMPO: Record<keyof ErroresFormulario, string> = {
  descripcion: 'Descripción',
  destino: 'Destino',
  origen: 'Ciudad de origen',
  fechaInicio: 'Salida',
  fechaFin: 'Regreso',
  personas: 'Viajeros',
  presupuesto: 'Presupuesto',
  tipo: 'Estilo',
  zona: 'Zona del crucero',
}

/** Estación a la que pertenece cada campo (para saltar al primer error). */
const ESTACION_DE: Record<keyof ErroresFormulario, number> = {
  descripcion: 0,
  destino: 1,
  origen: 1,
  fechaInicio: 2,
  fechaFin: 2,
  personas: 3,
  presupuesto: 3,
  tipo: 4,
  zona: 4,
}

/** Campo «tocado» que invalida el error del servidor de cada campo. */
const CAMPO_TOCADO: Record<keyof ErroresFormulario, Campo> = {
  descripcion: 'descripcion',
  destino: 'destino',
  origen: 'origen',
  fechaInicio: 'fechas',
  fechaFin: 'fechas',
  personas: 'personas',
  presupuesto: 'presupuesto',
  tipo: 'tipo',
  zona: 'zona',
}

interface Props {
  initial?: Partial<FormularioViaje>
  onSubmit: (form: FormularioViaje) => void
  /** Errores por campo devueltos por el servidor (400). */
  erroresServidor?: ErroresFormulario
  /** Interpretar la descripción inicial con IA al montar. */
  autoInterpretar?: boolean
}

/**
 * Formulario «Diseña tu viaje» (§6.2, móvil): estaciones numeradas unidas por
 * una línea punteada; cada estación cambia de forma al completarse (hueco con
 * número → relleno de tinta con Check). La descripción libre se interpreta con
 * IA («Lo que entendimos») y solo rellena lo que el viajero no tocó. Barra
 * inferior fija con el resumen y «Trazar».
 */
export function TripForm({
  initial,
  onSubmit,
  erroresServidor,
  autoInterpretar = false,
}: Props): React.ReactElement {
  const { colors } = useTheme()
  const styles = useEstilos(crearEstilos)
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)
  const posiciones = useRef<Record<number, number>>({})
  const origenRef = useRef<TextInput>(null)

  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '')
  const [destino, setDestino] = useState(
    initial?.destinoSorpresa ? '' : (initial?.destino ?? '')
  )
  const [sorpresa, setSorpresa] = useState(initial?.destinoSorpresa ?? false)
  const [origen, setOrigen] = useState(initial?.origen ?? '')
  const [fechas, setFechas] = useState({
    inicio: initial?.fechaInicio ?? '',
    fin: initial?.fechaFin ?? '',
  })
  const [personas, setPersonas] = useState(initial?.personas ?? 2)
  const [presupuesto, setPresupuesto] = useState(
    initial?.presupuesto ? String(initial.presupuesto) : ''
  )
  const [moneda, setMoneda] = useState<Moneda>(initial?.moneda ?? 'USD')
  const [tipo, setTipo] = useState<TipoViaje | null>(initial?.tipo ?? null)
  const [paquete, setPaquete] = useState<Paquete>(initial?.paquete ?? 'confort')
  const [zona, setZona] = useState(initial?.zona ?? '')
  const [lugares] = useState<string[]>(initial?.lugaresDeseados ?? [])
  const [preferencias, setPreferencias] = useState<string[]>(
    initial?.preferencias ?? []
  )

  const [tocados, setTocados] = useState<ReadonlySet<Campo>>(() => {
    const s = new Set<Campo>()
    if (initial?.destino) s.add('destino')
    if (initial?.fechaInicio) s.add('fechas')
    return s
  })
  const [errores, setErrores] = useState<ErroresFormulario>(
    erroresServidor ?? {}
  )
  const [intentado, setIntentado] = useState(
    Boolean(erroresServidor && Object.keys(erroresServidor).length > 0)
  )
  const [calendario, setCalendario] = useState(false)
  const [ia, setIa] = useState<EstadoIA>({ estado: 'inactivo' })
  const ultimoInterpretado = useRef('')

  const tocar = (c: Campo): void => {
    setTocados((s) => (s.has(c) ? s : new Set(s).add(c)))
  }

  const presupuestoNum = Number(presupuesto.replace(/[^\d.]/g, ''))

  const form: FormularioViaje = useMemo(
    () => ({
      destino: sorpresa ? 'Sorpresa' : destino,
      destinoSorpresa: sorpresa,
      origen,
      personas,
      fechaInicio: fechas.inicio,
      fechaFin: fechas.fin,
      presupuesto: Number.isFinite(presupuestoNum) ? presupuestoNum : 0,
      moneda,
      tipo: tipo ?? 'aventura',
      paquete,
      ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
      ...(zona.trim() ? { zona: zona.trim() } : {}),
      ...(lugares.length > 0 ? { lugaresDeseados: lugares } : {}),
      ...(preferencias.length > 0 ? { preferencias } : {}),
    }),
    [
      sorpresa,
      destino,
      origen,
      personas,
      fechas,
      presupuestoNum,
      moneda,
      tipo,
      paquete,
      descripcion,
      zona,
      lugares,
      preferencias,
    ]
  )

  // Errores del servidor (400): siguen visibles hasta que se toca su campo.
  const servidorVigente: ErroresFormulario = {}
  for (const [k, v] of Object.entries(erroresServidor ?? {}) as [
    keyof ErroresFormulario,
    string,
  ][]) {
    if (!tocados.has(CAMPO_TOCADO[k])) servidorVigente[k] = v
  }

  // Errores en vivo tras el primer intento (para que desaparezcan al corregir).
  const erroresVivos: ErroresFormulario = intentado
    ? {
        ...servidorVigente,
        ...validarFormulario(form),
        ...(tipo === null ? { tipo: 'Elige un estilo de viaje.' } : {}),
      }
    : errores

  const faltantes: readonly CampoFaltante[] =
    ia.estado === 'listo' ? ia.resultado.faltantes : []

  const completas = [
    descripcion.trim().length > 0,
    (sorpresa || destino.trim().length >= 2) && origen.trim().length >= 2,
    Boolean(fechas.inicio && fechas.fin),
    presupuestoNum >= 100,
    tipo !== null && (tipo !== 'crucero' || zona.trim().length > 0),
    true,
  ]

  // ── Interpretación con IA (POST /api/interpret) ─────────────────────────
  const interpretar = async (): Promise<void> => {
    const texto = descripcion.trim()
    if (texto.length < 3 || ia.estado === 'cargando') return
    ultimoInterpretado.current = texto
    setIa({ estado: 'cargando' })
    try {
      const resultado = await conTope(
        postJSON<InterpretResult>('/api/interpret', {
          texto: texto.slice(0, 2000),
          hoy: hoyLocal(),
        }),
        25_000,
        'No pudimos entender la descripción ahora mismo.'
      )
      setIa({ estado: 'listo', resultado, aplicado: false })
    } catch (e) {
      if (
        e instanceof BackendError &&
        (e.code === 'unavailable' || e.code === 'no_config')
      ) {
        // IA no configurada: el bloque no aparece y el formulario va a mano.
        setIa({ estado: 'no_disponible' })
        return
      }
      setIa({
        estado: 'error',
        mensaje:
          e instanceof Error
            ? e.message
            : 'No pudimos entender la descripción ahora mismo.',
      })
    }
  }

  // Descripción traída desde Inicio: se interpreta sola al abrir.
  const interpretarRef = useRef(interpretar)
  useEffect(() => {
    interpretarRef.current = interpretar
  })
  useEffect(() => {
    if (!autoInterpretar) return
    const id = setTimeout(() => void interpretarRef.current(), 300)
    return () => clearTimeout(id)
  }, [autoInterpretar])

  const aplicar = (): void => {
    if (ia.estado !== 'listo') return
    const c = ia.resultado.campos
    if (c.destinoSorpresa && !tocados.has('destino')) {
      setSorpresa(true)
    } else if (c.destino && !tocados.has('destino')) {
      setSorpresa(false)
      setDestino(c.destino)
    }
    if (c.origen && !tocados.has('origen')) setOrigen(c.origen)
    if (c.fechaInicio && c.fechaFin && !tocados.has('fechas')) {
      setFechas({ inicio: c.fechaInicio, fin: c.fechaFin })
    }
    if (c.personas && !tocados.has('personas')) setPersonas(c.personas)
    if (c.presupuesto && c.presupuesto >= 100 && !tocados.has('presupuesto')) {
      setPresupuesto(String(Math.round(c.presupuesto)))
    }
    if (c.moneda && !tocados.has('moneda')) setMoneda(c.moneda)
    if (c.tipo && !tocados.has('tipo')) setTipo(c.tipo)
    if (c.paquete && !tocados.has('paquete')) setPaquete(c.paquete)
    if (c.zona && !tocados.has('zona')) setZona(c.zona)
    if (c.preferencias && c.preferencias.length > 0) {
      setPreferencias(c.preferencias.slice(0, 20))
    }
    setIa({ ...ia, aplicado: true })
  }

  const enviar = (): void => {
    const e: ErroresFormulario = {
      ...validarFormulario(form),
      ...(tipo === null ? { tipo: 'Elige un estilo de viaje.' } : {}),
    }
    setIntentado(true)
    setErrores(e)
    const claves = Object.keys(e) as (keyof ErroresFormulario)[]
    if (claves.length > 0) {
      const primera = Math.min(...claves.map((k) => ESTACION_DE[k]))
      const y = posiciones.current[primera]
      if (y !== undefined) {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true })
      }
      return
    }
    onSubmit(form)
  }

  const listaErrores = Object.keys(erroresVivos) as (keyof ErroresFormulario)[]
  const noches = contarNoches(fechas.inicio, fechas.fin)
  const resumenBarra = [
    sorpresa ? 'Sorpresa' : destino.trim() || null,
    fechas.inicio && fechas.fin ? formatNoches(noches) : null,
    formatViajeros(personas),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <View style={styles.flex}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 96 + insets.bottom },
        ]}
      >
        <Txt variant="displayL">Diseña tu viaje</Txt>
        <Txt variant="body" color="fgMuted" style={styles.lead}>
          Trazamos 3 versiones · tarda entre 20 y 60 s
        </Txt>

        {intentado && listaErrores.length > 0 ? (
          <Callout
            tone="danger"
            title={
              listaErrores.length === 1
                ? 'Revisa 1 campo'
                : `Revisa ${listaErrores.length} campos`
            }
            style={styles.resumenErrores}
          >
            {listaErrores.map((k) => NOMBRE_CAMPO[k]).join(' · ')}
          </Callout>
        ) : null}

        {/* 00 · Cuéntanos tu viaje ideal */}
        <Estacion
          numero={0}
          titulo="Cuéntanos tu viaje ideal"
          opcional
          completa={completas[0] ?? false}
          onLayoutY={(y) => {
            posiciones.current[0] = y
          }}
        >
          <TextArea
            label="Tu viaje en tus palabras"
            hideLabel
            placeholder="Ej.: 6 días en Cartagena con mi pareja, playa tranquila y buena comida, unos US$1,800"
            value={descripcion}
            onChangeText={(t) => {
              tocar('descripcion')
              setDescripcion(t.slice(0, MAX_DESCRIPCION))
            }}
            maxLength={MAX_DESCRIPCION}
            showCount
            hint="Escríbelo como se lo contarías a un amigo. La IA lo usa para afinar ritmo, intereses y restricciones."
            error={erroresVivos.descripcion ?? null}
            onBlur={() => {
              const t = descripcion.trim()
              if (t.length >= 12 && t !== ultimoInterpretado.current) {
                void interpretar()
              }
            }}
          />
          <View style={styles.chips}>
            {FRASES.map((f) => (
              <Chip
                key={f.label}
                label={f.label}
                role="button"
                size="sm"
                accessibilityHint="Añade esta frase a la descripción"
                onPress={() =>
                  setDescripcion((d) =>
                    (d.trim() ? `${d.trim()} ${f.texto}` : f.texto).slice(
                      0,
                      MAX_DESCRIPCION
                    )
                  )
                }
              />
            ))}
          </View>
          {descripcion.trim().length >= 3 && ia.estado !== 'no_disponible' ? (
            <Button
              title={
                ia.estado === 'listo'
                  ? 'Volver a entender'
                  : 'Entender mi viaje'
              }
              variant="ghost"
              size="sm"
              icon={Compass}
              loading={ia.estado === 'cargando'}
              loadingText="Leyendo tu descripción…"
              onPress={() => void interpretar()}
              style={styles.entender}
            />
          ) : null}
          {ia.estado === 'error' ? (
            <Txt variant="caption" color="fgMuted" style={styles.iaError}>
              {ia.mensaje} Puedes seguir con el formulario.
            </Txt>
          ) : null}
          {ia.estado === 'listo' ? (
            <LoQueEntendimos
              resultado={ia.resultado}
              aplicado={ia.aplicado}
              onAplicar={aplicar}
            />
          ) : null}
        </Estacion>

        {/* 01 · Destino */}
        <Estacion
          numero={1}
          titulo="Destino"
          completa={completas[1] ?? false}
          falta={faltantes.includes('destino') || faltantes.includes('origen')}
          onLayoutY={(y) => {
            posiciones.current[1] = y
          }}
        >
          <Segmented<'elijo' | 'sorpresa'>
            label="¿Eliges tú el destino?"
            fullWidth
            value={sorpresa ? 'sorpresa' : 'elijo'}
            onValueChange={(v) => {
              tocar('destino')
              setSorpresa(v === 'sorpresa')
            }}
            options={[
              { value: 'elijo', label: 'Lo elijo yo', icon: MapPin },
              { value: 'sorpresa', label: 'Sorpréndeme', icon: Dices },
            ]}
            style={styles.segmento}
          />
          {sorpresa ? (
            <Txt variant="bodyS" color="fgMuted" style={styles.nota}>
              La IA elegirá un destino que encaje con tu estilo y tu
              presupuesto.
            </Txt>
          ) : (
            <Input
              label="Destino"
              icon={MapPin}
              placeholder="Ej.: Cartagena, Colombia"
              value={destino}
              onChangeText={(t) => {
                tocar('destino')
                setDestino(t)
              }}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => origenRef.current?.focus()}
              error={erroresVivos.destino ?? null}
            />
          )}
          <Input
            inputRef={origenRef}
            label="Ciudad de origen"
            icon={PlaneTakeoff}
            placeholder="Ej.: Santo Domingo"
            value={origen}
            onChangeText={(t) => {
              tocar('origen')
              setOrigen(t)
            }}
            autoCapitalize="words"
            error={erroresVivos.origen ?? null}
          />
        </Estacion>

        {/* 02 · Fechas */}
        <Estacion
          numero={2}
          titulo="Fechas"
          completa={completas[2] ?? false}
          falta={faltantes.includes('fechas')}
          onLayoutY={(y) => {
            posiciones.current[2] = y
          }}
        >
          <View style={styles.fechas}>
            <CampoFecha
              etiqueta="Salida"
              valor={fechas.inicio}
              error={erroresVivos.fechaInicio ?? null}
              onPress={() => setCalendario(true)}
            />
            <CampoFecha
              etiqueta="Regreso"
              valor={fechas.fin}
              error={erroresVivos.fechaFin ?? null}
              onPress={() => setCalendario(true)}
            />
          </View>
          <Txt
            variant="caption"
            color="fgMuted"
            accessibilityLiveRegion="polite"
            style={styles.resumenFechas}
          >
            {formatResumenFechas(fechas.inicio, fechas.fin) ||
              'Elige salida y regreso en el calendario.'}
          </Txt>
          {erroresVivos.fechaInicio || erroresVivos.fechaFin ? (
            <Txt variant="bodyS" color="danger" style={styles.errorFecha}>
              {erroresVivos.fechaInicio ?? erroresVivos.fechaFin}
            </Txt>
          ) : null}
        </Estacion>

        {/* 03 · Viajeros y presupuesto */}
        <Estacion
          numero={3}
          titulo="Viajeros y presupuesto"
          completa={completas[3] ?? false}
          falta={
            faltantes.includes('personas') || faltantes.includes('presupuesto')
          }
          onLayoutY={(y) => {
            posiciones.current[3] = y
          }}
        >
          <StepCounter
            label="Viajeros"
            value={personas}
            onChange={(n) => {
              tocar('personas')
              setPersonas(n)
            }}
            unidad={formatViajeros}
          />
          <Input
            label="Presupuesto total"
            placeholder="1800"
            value={presupuesto}
            onChangeText={(t) => {
              tocar('presupuesto')
              setPresupuesto(t.replace(/[^\d]/g, '').slice(0, 9))
            }}
            keyboardType="number-pad"
            inputMode="numeric"
            hint={
              presupuestoNum >= 100
                ? `${formatCurrency(presupuestoNum, moneda)} · Para hospedaje, actividades y comidas. El vuelo se estima aparte.`
                : 'Para hospedaje, actividades y comidas. El vuelo se estima aparte.'
            }
            error={erroresVivos.presupuesto ?? null}
            inputStyle={styles.tnum}
            containerStyle={styles.presupuesto}
            suffix={
              <Segmented<Moneda>
                label="Moneda"
                size="sm"
                value={moneda}
                onValueChange={(m) => {
                  tocar('moneda')
                  setMoneda(m)
                }}
                options={[
                  { value: 'USD', label: 'USD', accessibilityLabel: 'Dólares' },
                  { value: 'EUR', label: 'EUR', accessibilityLabel: 'Euros' },
                  {
                    value: 'DOP',
                    label: 'DOP',
                    accessibilityLabel: 'Pesos dominicanos',
                  },
                ]}
              />
            }
          />
        </Estacion>

        {/* 04 · Estilo */}
        <Estacion
          numero={4}
          titulo="Estilo"
          completa={completas[4] ?? false}
          onLayoutY={(y) => {
            posiciones.current[4] = y
          }}
        >
          <ChipGroup<TipoViaje>
            label="Estilo de viaje"
            options={TIPOS}
            value={tipo}
            onValueChange={(v) => {
              tocar('tipo')
              setTipo(v)
            }}
          />
          {erroresVivos.tipo ? (
            <Txt variant="bodyS" color="danger" style={styles.errorFecha}>
              {erroresVivos.tipo}
            </Txt>
          ) : null}
          {tipo === 'crucero' ? (
            <Input
              label="Zona del crucero"
              icon={Ship}
              placeholder="Ej.: Caribe oriental"
              value={zona}
              onChangeText={(t) => {
                tocar('zona')
                setZona(t)
              }}
              error={erroresVivos.zona ?? null}
              containerStyle={styles.zona}
            />
          ) : null}
        </Estacion>

        {/* 05 · Nivel preferido */}
        <Estacion
          numero={5}
          titulo="Nivel preferido"
          completa
          ultima
          onLayoutY={(y) => {
            posiciones.current[5] = y
          }}
        >
          <Segmented<Paquete>
            label="Nivel preferido"
            fullWidth
            value={paquete}
            onValueChange={(p) => {
              tocar('paquete')
              setPaquete(p)
            }}
            options={[
              {
                value: 'basico',
                label: 'Básico 3★',
                accessibilityLabel: 'Básico, hoteles de 3 estrellas',
              },
              {
                value: 'confort',
                label: 'Confort 4★',
                accessibilityLabel: 'Confort, hoteles de 4 estrellas',
              },
              {
                value: 'premium',
                label: 'Premium 5★',
                accessibilityLabel: 'Premium, hoteles de 5 estrellas',
              },
            ]}
          />
          <Txt variant="caption" color="fgMuted" style={styles.nota}>
            Igual verás las tres versiones para comparar.
          </Txt>
        </Estacion>
      </ScrollView>

      {/* Barra fija inferior: resumen + «Trazar» */}
      <View
        style={[
          styles.barra,
          {
            paddingBottom: Math.max(12, insets.bottom),
            borderTopColor: colors.border,
          },
        ]}
      >
        <View style={styles.flex}>
          <Txt variant="label" numberOfLines={1}>
            {resumenBarra || 'Tu viaje'}
          </Txt>
          <Txt variant="caption" color="fgMuted" numberOfLines={1}>
            {fechas.inicio && fechas.fin
              ? formatRangoFechas(fechas.inicio, fechas.fin)
              : presupuestoNum >= 100
                ? formatCurrency(presupuestoNum, moneda)
                : 'Completa las estaciones'}
          </Txt>
        </View>
        <Button
          title="Trazar"
          iconEnd={ArrowRight}
          accessibilityLabel="Trazar mi viaje"
          onPress={enviar}
        />
      </View>

      <CalendarioSheet
        // Se vuelve a montar al abrir: el mes visible parte de la salida elegida.
        key={calendario ? 'abierto' : 'cerrado'}
        visible={calendario}
        onClose={() => setCalendario(false)}
        value={fechas}
        onChange={(r) => {
          tocar('fechas')
          setFechas(r)
        }}
      />
    </View>
  )
}

/** Estación numerada del formulario con su riel punteado. */
function Estacion({
  numero,
  titulo,
  opcional = false,
  completa,
  falta = false,
  ultima = false,
  onLayoutY,
  children,
}: {
  numero: number
  titulo: string
  opcional?: boolean
  completa: boolean
  falta?: boolean
  ultima?: boolean
  onLayoutY: (y: number) => void
  children: ReactNode
}): React.ReactElement {
  const { colors } = useTheme()
  const styles = useEstilos(crearEstilos)
  const etiqueta = String(numero).padStart(2, '0')
  return (
    <View
      style={styles.estacion}
      onLayout={(e) => onLayoutY(e.nativeEvent.layout.y)}
    >
      <View style={styles.riel}>
        <View
          style={[
            styles.circulo,
            completa
              ? { backgroundColor: colors.fg, borderColor: colors.fg }
              : { borderColor: colors.borderStrong },
          ]}
          accessible={false}
        >
          {completa ? (
            <Check size={14} color={colors.fgInverse} strokeWidth={2.5} />
          ) : (
            <Txt variant="caption" color="fgMuted" tnum style={styles.numero}>
              {numero}
            </Txt>
          )}
        </View>
        {!ultima ? (
          <View style={styles.linea}>
            <Svg width={2} height="100%">
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
          </View>
        ) : null}
      </View>
      <View style={styles.cuerpo}>
        <View style={styles.tituloFila}>
          <Txt
            variant="title"
            accessibilityRole="header"
            accessibilityLabel={`Estación ${numero}: ${titulo}${opcional ? ', opcional' : ''}${completa ? ', completa' : ''}`}
          >
            <Txt variant="title" color="fgSubtle" tnum>
              {etiqueta} ·{' '}
            </Txt>
            {titulo}
          </Txt>
          {opcional ? <Badge label="Opcional" /> : null}
          {falta && !completa ? (
            <Badge label="Falta" variant="warning" />
          ) : null}
        </View>
        <View style={styles.contenido}>{children}</View>
      </View>
    </View>
  )
}

function CampoFecha({
  etiqueta,
  valor,
  error,
  onPress,
}: {
  etiqueta: string
  valor: string
  error: string | null
  onPress: () => void
}): React.ReactElement {
  const { colors } = useTheme()
  const styles = useEstilos(crearEstilos)
  const texto = valor ? formatFecha(valor, { anio: true }) : 'Elegir fecha'
  return (
    <View style={styles.flex}>
      <Txt variant="label" style={styles.labelFecha} accessible={false}>
        {etiqueta}
      </Txt>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${etiqueta}: ${valor ? texto : 'sin elegir'}`}
        accessibilityHint="Abre el calendario"
        style={({ pressed }) => [
          styles.campoFecha,
          error ? { borderColor: colors.danger, borderWidth: 2 } : null,
          pressed ? { backgroundColor: colors.surface2 } : null,
        ]}
      >
        <CalendarDays
          size={18}
          color={colors.fgSubtle}
          strokeWidth={1.75}
          accessible={false}
        />
        <Txt
          variant="body"
          color={valor ? 'fg' : 'fgSubtle'}
          numberOfLines={1}
          style={styles.flex}
        >
          {texto}
        </Txt>
      </Pressable>
    </View>
  )
}

function LoQueEntendimos({
  resultado,
  aplicado,
  onAplicar,
}: {
  resultado: InterpretResult
  aplicado: boolean
  onAplicar: () => void
}): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const c = resultado.campos
  const chips: string[] = []
  if (c.destinoSorpresa) chips.push('Destino sorpresa')
  else if (c.destino) chips.push(c.destino)
  if (c.origen) chips.push(`Desde ${c.origen}`)
  if (c.fechaInicio && c.fechaFin)
    chips.push(formatRangoFechas(c.fechaInicio, c.fechaFin))
  if (c.personas) chips.push(formatViajeros(c.personas))
  if (c.presupuesto)
    chips.push(formatCurrency(c.presupuesto, c.moneda ?? 'USD'))
  if (c.tipo) chips.push(ETIQUETA_TIPO[c.tipo])
  if (c.paquete) chips.push(ETIQUETA_PAQUETE[c.paquete])

  return (
    <Card style={styles.entendimos} accessibilityRole="summary">
      <CardKicker icon={Compass}>Lo que entendimos</CardKicker>
      {resultado.resumen ? (
        <Txt variant="bodyS" style={styles.entendimosTexto}>
          {resultado.resumen}
        </Txt>
      ) : null}
      {chips.length > 0 ? (
        <View style={styles.chipsEstaticos}>
          {chips.map((ch) => (
            <Badge key={ch} label={ch} variant="brand" />
          ))}
        </View>
      ) : null}
      {resultado.faltantes.length > 0 ? (
        <Txt variant="caption" color="warningFg" style={styles.entendimosTexto}>
          Falta: {resultado.faltantes.map((f) => NOMBRE_FALTANTE[f]).join(', ')}
          .
        </Txt>
      ) : null}
      {resultado.supuestos.slice(0, 3).map((s) => (
        <Txt key={s} variant="caption" color="fgMuted" style={styles.supuesto}>
          · {s}
        </Txt>
      ))}
      <Button
        title={aplicado ? 'Aplicado al formulario' : 'Aplicar al formulario'}
        variant="ghost"
        size="sm"
        {...(aplicado ? { icon: Check } : {})}
        disabled={aplicado}
        onPress={onAplicar}
        style={styles.aplicar}
      />
      <Txt variant="caption" color="fgSubtle">
        Solo rellena lo que aún no tocaste.
      </Txt>
    </Card>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    flex: { flex: 1 },
    scroll: { paddingHorizontal: 16, paddingTop: 16 },
    lead: { marginTop: 6 },
    resumenErrores: { marginTop: 16 },
    estacion: { flexDirection: 'row', gap: 12, marginTop: 24 },
    riel: { alignItems: 'center', width: 24 },
    circulo: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.bg,
    },
    numero: { fontSize: 12, lineHeight: 14 },
    linea: { flex: 1, width: 2, marginTop: 6, marginBottom: -22 },
    cuerpo: { flex: 1, paddingBottom: 4 },
    tituloFila: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      minHeight: 24,
    },
    contenido: { marginTop: 12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -4 },
    entender: { marginTop: 12 },
    iaError: { marginTop: 8 },
    entendimos: { marginTop: 16, padding: 16 },
    entendimosTexto: { marginTop: 8 },
    chipsEstaticos: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 10,
    },
    supuesto: { marginTop: 4 },
    aplicar: { marginTop: 12, marginLeft: -12 },
    segmento: { marginBottom: 16 },
    nota: { marginTop: 4, marginBottom: 12 },
    fechas: { flexDirection: 'row', gap: 12 },
    labelFecha: { marginBottom: 6 },
    campoFecha: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: t.colors.borderStrong,
      borderRadius: t.radius.control,
      backgroundColor: t.colors.surface,
    },
    resumenFechas: { marginTop: 8 },
    errorFecha: { marginTop: 6 },
    presupuesto: { marginTop: 16 },
    tnum: { fontVariant: ['tabular-nums'] },
    zona: { marginTop: 16 },
    barra: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      minHeight: t.control.bottomBar,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: t.colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
  })
