'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { X } from 'lucide-react'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { indicePaso, type PasoRuta } from '@/components/layout/Stepper'
import { saltarPuntoDelLogo } from '@/components/brand/salto'
import { Button } from '@/components/ui/Button'
import { SkeletonPortada, SkeletonRegion } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { DUR, EASE } from '@/components/ui/motion'
import {
  MENSAJE_TOPE_DIARIO,
  codigoDe,
  esCupoAgotado,
  esTopeDiario,
  mensajeCupoAgotado,
  segundosDeEspera,
  textoCupoAgotado,
  textoEspera,
} from '@/components/trip/limitesIA'
import { enfocarCampo } from '@/components/trip/TripForm'
import { ResultView } from '@/components/trip/ResultView'
import { useBackgroundGeocode } from '@/hooks/useBackgroundGeocode'
import { useUser } from '@/hooks/useUser'
import type { GenerateResult, ProgressEvent } from '@/lib/ai/generateTrips'
import { StreamGenerateError, streamGenerate } from '@/lib/ai/streamClient'
import { track } from '@/lib/analytics/events'
import { esAuthRequired, iaExigeSesion, urlLogin } from '@/lib/auth/irALogin'
import { getDestino } from '@/lib/seo/destinos'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { InterpretResult } from '@/lib/validations/interpret'
import type { TripForm } from '@/lib/validations/tripForm'
import type { Trip } from '@/types/trip'
import {
  MAX_DESCRIPCION_VISUAL,
  borradorDesdeFormulario,
  borradorVacio,
  erroresDesdeServidor,
  type CampoForm,
  type ErroresForm,
  type Paquete,
  type TripFormDraft,
} from './borrador'
import {
  borrarGenerarPendiente,
  borrarPendiente,
  esTrip,
  firmaDe,
  guardarFlujo,
  guardarGenerarPendiente,
  guardarPendiente,
  hayFlujoGuardado,
  leerFlujo,
  leerGenerarPendiente,
  leerPendiente,
  type GuardadoFlujo,
} from './flujoStorage'
import { borrarSemilla, leerSemilla } from './semilla'
import { PasoDatos } from './PasoDatos'
import { PasoTrazado, type EstadoGeneracion } from './PasoTrazado'
import { PasoVersiones } from './PasoVersiones'
import { indiceDeFase } from './RutaDeFases'

/**
 * Flujo cliente de /planificar (docs/DISENO.md §6.2–§6.5 y §7.3).
 *
 * - El paso vive en la URL (?paso=datos|trazado|versiones|itinerario) y se
 *   cambia con history.pushState/replaceState (integrados en el router).
 * - El estado se guarda en sessionStorage 'wayio-flujo-v1': Atrás y recargar
 *   no lo pierden.
 * - ?d=<texto> precarga la descripción; ?destino=<slug> precarga el destino.
 * - La generación usa el SSE real (fases y labels del backend), se cancela con
 *   AbortController y NO se repite si el stream ya había arrancado.
 * - Al cambiar de paso: scroll a 0, foco al H1 y document.title.
 * - Guardar o compartir sin sesión deja el itinerario en
 *   'wayio-pendiente-v1' y lo guarda solo al volver del login (DA-14).
 * - Trazar exige cuenta (la IA cuesta): «Trazar» sin sesión deja el
 *   formulario en 'wayio-generar-pendiente-v1' (localStorage, 2 h) y lo
 *   traza solo al volver de ESE login (el redirect lleva ?reanudar=1, sin
 *   datos del formulario); cualquier otra visita no traza nada sola. Un 401
 *   a mitad (sesión caducada) hace lo mismo. En local sin Supabase se traza
 *   sin cuenta (modoLocalSinCuentas).
 * - Cupo del plan Gratis agotado (402 cupo_agotado, también con «Otra
 *   versión»): se muestra el mensaje del servidor con «Ver planes», sin
 *   «Reintentar» y sin caer al /api/generate de respaldo.
 */

const PASOS: readonly PasoRuta[] = [
  'datos',
  'trazado',
  'versiones',
  'itinerario',
]

function parsePaso(v: string | null): PasoRuta | null {
  return PASOS.find((p) => p === v) ?? null
}

const urlPaso = (paso: PasoRuta) => `/planificar?paso=${paso}`

/**
 * Bandera del redirect del login pedido por «Trazar»: solo con ella se retoma
 * el trazado pendiente. No lleva datos del formulario (esos van en
 * localStorage) y sobrevive a la confirmación por correo, que conserva el
 * destino completo.
 */
const PARAM_REANUDAR = 'reanudar'
const URL_REANUDAR_TRAZADO = `${urlPaso('datos')}&${PARAM_REANUDAR}=1`

/** Quita ?reanudar de la URL (se consume una sola vez). */
function quitarBanderaReanudar(): void {
  const url = new URL(window.location.href)
  if (!url.searchParams.has(PARAM_REANUDAR)) return
  url.searchParams.delete(PARAM_REANUDAR)
  window.history.replaceState(
    null,
    '',
    `${url.pathname}${url.search}${url.hash}`
  )
}

const sinSuscripcion = () => () => {}

const VARIANTES_PASO = {
  entrada: (dir: number) => ({ x: 32 * dir, opacity: 0 }),
  centro: {
    x: 0,
    opacity: 1,
    transition: { duration: DUR.slow, ease: EASE.papel },
  },
  salida: (dir: number) => ({
    x: -24 * dir,
    opacity: 0,
    transition: { duration: DUR.base, ease: EASE.salida },
  }),
}

/** Error con un mensaje apto para mostrar al usuario (y el code del servidor). */
class ErrorVisible extends Error {
  readonly code: string | null

  constructor(message: string, code: string | null = null) {
    super(message)
    this.code = code
  }
}

function mensajeDe(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null
  const e = (data as { error?: unknown }).error
  return typeof e === 'string' && e.trim() ? e : null
}

/**
 * Límite personal (429 rate_limit) con los segundos de Retry-After: con las
 * ventanas por hora y por día la espera puede ser de minutos, horas o hasta
 * mañana.
 */
function mensajeLimite(retryAfter: number | null): string {
  if (retryAfter === null || retryAfter <= 0) {
    return 'Has trazado varios viajes seguidos. Espera unos minutos y vuelve a intentarlo.'
  }
  const espera = textoEspera(retryAfter)
  return retryAfter < 3600
    ? `Has trazado varios viajes seguidos. Podrás volver a intentarlo ${espera}.`
    : `Llegaste al límite de viajes que puedes trazar por ahora. Podrás volver a intentarlo ${espera}.`
}

const ERROR_GENERICO = 'No pudimos trazar tu viaje. Inténtalo de nuevo.'

const MENSAJE_SESION =
  'Inicia sesión y seguimos trazando tu viaje con los mismos datos.'

/** code del servidor que acompaña al error (cuerpo del 4xx o evento SSE). */
function codigoDeError(err: unknown): string | null {
  if (err instanceof StreamGenerateError) return err.code
  if (err instanceof ErrorVisible) return err.code
  return null
}

/** ¿El error pide iniciar sesión? (401 o code auth_required). */
function esErrorDeSesion(err: unknown): boolean {
  if (err instanceof StreamGenerateError) {
    return esAuthRequired(err.status, err.code)
  }
  return codigoDeError(err) === 'auth_required'
}

/** ¿Se agotó el cupo del mes? (402 o code cupo_agotado). */
function esErrorDeCupo(err: unknown): boolean {
  if (err instanceof StreamGenerateError && err.status === 402) return true
  return esCupoAgotado(codigoDeError(err))
}

function mensajeDeError(err: unknown): string {
  if (err instanceof ErrorVisible) return err.message
  if (err instanceof StreamGenerateError) {
    // Cupo del mes agotado (402 antes de abrir el stream).
    if (esErrorDeCupo(err)) {
      return err.mensaje ?? mensajeCupoAgotado('generar', err.renueva)
    }
    // Tope diario de Wayio (429 antes del stream o evento SSE a mitad).
    if (esTopeDiario(err.code)) return err.mensaje ?? MENSAJE_TOPE_DIARIO
    if (err.status === 429) return mensajeLimite(err.retryAfter)
    if (err.status !== null && err.status >= 500) {
      return 'El servicio está ocupado ahora mismo. Inténtalo de nuevo en un momento.'
    }
    // Mensaje del servidor (cuerpo del 4xx o evento `error` del SSE): ya
    // viene en español.
    if (err.mensaje) return err.mensaje
    if (/conexi/i.test(err.message)) {
      return 'Se cortó la conexión mientras trazábamos tu viaje. Revisa tu internet y vuelve a intentarlo.'
    }
  }
  return ERROR_GENERICO
}

// ─── Componente público ────────────────────────────────────────────────────

/**
 * Montaje solo en el cliente: el estado sale de sessionStorage, así que en el
 * servidor (y durante la hidratación) se pinta el esqueleto.
 */
export function PlannerFlow() {
  const montado = useSyncExternalStore(
    sinSuscripcion,
    () => true,
    () => false
  )
  const params = useSearchParams()
  if (!montado) {
    return (
      <PlanificadorCargando paso={parsePaso(params.get('paso')) ?? 'datos'} />
    )
  }
  return <Flujo />
}

/** Esqueleto del planificador (Suspense de la página y primer render). */
export function PlanificadorCargando({ paso = 'datos' }: { paso?: PasoRuta }) {
  return (
    <>
      <SiteHeader variant="flujo" paso={paso} />
      <main id="contenido" className="flex-1">
        <SkeletonRegion
          label="Cargando el planificador…"
          className="mx-auto max-w-content px-4 pt-10 pb-24 md:px-6 lg:px-8 lg:pt-14"
        >
          <SkeletonPortada className="max-w-2xl" />
        </SkeletonRegion>
      </main>
    </>
  )
}

// ─── Flujo ─────────────────────────────────────────────────────────────────

function Flujo() {
  const router = useRouter()
  const params = useSearchParams()
  const { user, loading: cargandoUsuario } = useUser()
  const { success, error: toastError, toast } = useToast()

  // ¿Esta visita es la vuelta del login que pidió «Trazar»? (ver
  // PARAM_REANUDAR). Se lee al montar: la URL cambia en cuanto se traza.
  const [vieneDeTrazar] = useState(() => params.get(PARAM_REANUDAR) === '1')

  // Estado inicial: sessionStorage + semillas de la URL o de la landing.
  const [inicial] = useState(() => {
    const conFlujo = hayFlujoGuardado()
    const e = leerFlujo()
    const semilla = leerSemilla()
    const pendiente = leerPendiente()
    // Solo en la vuelta de ese login: en un equipo compartido, otra visita no
    // debe precargar el formulario que dejó otra persona.
    const generarPendiente = vieneDeTrazar ? leerGenerarPendiente() : null
    const d = params.get('d')
    const slug = params.get('destino')
    // Vuelta del login en otra pestaña (confirmación por correo): esta pestaña
    // no tiene el flujo, pero el trazado pendiente trae el formulario.
    let borrador: TripFormDraft =
      !conFlujo && generarPendiente
        ? borradorDesdeFormulario(generarPendiente.form)
        : e.borrador
    let interpretacion: InterpretResult | null = e.interpretacion
    const descripcion = d ?? semilla?.descripcion
    if (descripcion?.trim()) {
      borrador = {
        ...borrador,
        descripcion: descripcion.trim().slice(0, MAX_DESCRIPCION_VISUAL),
      }
      interpretacion = null
    }
    const destino = slug
      ? (getDestino(slug)?.nombre ?? slug.replace(/-/g, ' '))
      : semilla?.destino
    if (destino?.trim()) {
      borrador = {
        ...borrador,
        destino: destino.trim(),
        destinoSorpresa: false,
      }
    }
    if (semilla?.lugaresDeseados?.length) {
      borrador = {
        ...borrador,
        lugaresDeseados: Array.from(
          new Set([...borrador.lugaresDeseados, ...semilla.lugaresDeseados])
        ).slice(0, 30),
      }
    }
    return {
      ...e,
      borrador,
      interpretacion,
      // Si el itinerario se perdió pero quedó pendiente de guardar, se recupera.
      itinerario:
        e.itinerario ??
        (pendiente && esTrip(pendiente.trip) ? pendiente.trip : null),
    }
  })

  const [borrador, setBorrador] = useState<TripFormDraft>(inicial.borrador)
  const [formData, setFormData] = useState<TripForm | null>(inicial.formData)
  const [resultado, setResultado] = useState<GenerateResult | null>(
    inicial.resultado
  )
  const [paquete, setPaquete] = useState<Paquete>(inicial.paquete)
  const [itinerario, setItinerario] = useState<Trip | null>(inicial.itinerario)
  const [guardado, setGuardado] = useState<GuardadoFlujo | null>(
    inicial.guardado
  )
  const [interpretacion, setInterpretacion] = useState<InterpretResult | null>(
    inicial.interpretacion
  )
  const [gen, setGen] = useState<EstadoGeneracion | null>(null)
  const [erroresServidor, setErroresServidor] = useState<
    ErroresForm | undefined
  >(undefined)
  const [saving, setSaving] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  // Guardar/compartir pulsado mientras useUser aún comprueba la sesión: la
  // acción espera (con el botón en carga) y sigue en cuanto se sabe.
  const [enCola, setEnCola] = useState<{
    accion: 'guardar' | 'compartir'
    trip: Trip
  } | null>(null)
  // «Trazar» pulsado mientras useUser aún comprueba la sesión: igual que
  // guardar, espera y sigue (traza o va al login) en cuanto se sabe.
  const [trazarEnCola, setTrazarEnCola] = useState<{
    form: TripForm
    noCache: boolean
  } | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const focoCampoRef = useRef<CampoForm | null>(null)
  // Última petición de trazado (para «Iniciar sesión» tras un 401).
  const ultimaPeticionRef = useRef<{ form: TripForm; noCache: boolean } | null>(
    null
  )
  // El trazado en curso se relanzó al volver del login: si aun así da 401 no
  // se vuelve a mandar al login solo (evita un bucle) y se ofrece el botón.
  const trasLoginRef = useRef(false)

  // Trazar exige cuenta salvo en local sin Supabase (modoLocalSinCuentas).
  const exigeSesion = iaExigeSesion()
  const sinSesion = exigeSesion && !cargandoUsuario && !user

  // ── Paso efectivo (la URL manda, pero solo si hay datos para él) ────────
  // El paso de la URL se refleja en estado local: ir() lo cambia al instante
  // (sin esperar a que el router procese su cola) y Atrás/Adelante (popstate)
  // o un <Link> del Stepper (useSearchParams) lo sincronizan.
  const pasoParam = parsePaso(params.get('paso'))
  const [pasoUrl, setPasoUrl] = useState<PasoRuta | null>(pasoParam)
  const [paramPrevio, setParamPrevio] = useState(pasoParam)
  if (pasoParam !== paramPrevio) {
    setParamPrevio(pasoParam)
    setPasoUrl(pasoParam)
  }
  const paso: PasoRuta =
    pasoUrl === 'trazado'
      ? gen && formData
        ? 'trazado'
        : resultado && formData
          ? 'versiones'
          : 'datos'
      : pasoUrl === 'versiones'
        ? resultado && formData
          ? 'versiones'
          : 'datos'
        : pasoUrl === 'itinerario'
          ? itinerario
            ? 'itinerario'
            : resultado && formData
              ? 'versiones'
              : 'datos'
          : 'datos'

  // Dirección de la transición (+1 avanzar, −1 volver).
  const [pasoPrevio, setPasoPrevio] = useState(paso)
  const [dir, setDir] = useState(1)
  if (paso !== pasoPrevio) {
    setPasoPrevio(paso)
    setDir(indicePaso(paso) >= indicePaso(pasoPrevio) ? 1 : -1)
  }

  const ir = useCallback(
    (destino: PasoRuta, modo: 'push' | 'replace' = 'push') => {
      const url = urlPaso(destino)
      setPasoUrl(destino)
      if (modo === 'push') window.history.pushState(null, '', url)
      else window.history.replaceState(null, '', url)
    },
    []
  )

  useEffect(() => {
    const onPop = () =>
      setPasoUrl(
        parsePaso(new URLSearchParams(window.location.search).get('paso'))
      )
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // La URL refleja el paso efectivo (y se limpian ?d= y ?destino=).
  // (En un macrotask: al montar, el router de Next aún puede estar
  // inicializándose y no admite acciones.)
  useEffect(() => {
    if (pasoUrl === paso && !params.has('d') && !params.has('destino')) return
    const id = window.setTimeout(
      () => window.history.replaceState(null, '', urlPaso(paso)),
      0
    )
    return () => window.clearTimeout(id)
  }, [paso, pasoUrl, params])

  // La semilla de la landing se usa una sola vez.
  useEffect(() => {
    borrarSemilla()
  }, [])

  // Persistencia (con un pequeño retardo: el borrador cambia al teclear).
  useEffect(() => {
    const id = window.setTimeout(() => {
      guardarFlujo({
        v: 1,
        borrador,
        formData,
        resultado,
        paquete,
        itinerario,
        guardado,
        interpretacion,
      })
    }, 250)
    return () => window.clearTimeout(id)
  }, [
    borrador,
    formData,
    resultado,
    paquete,
    itinerario,
    guardado,
    interpretacion,
  ])

  // Salir del trazado (Atrás, o el Stepper) cancela la generación en curso.
  useEffect(() => {
    if (paso === 'trazado' || !abortRef.current) return
    abortRef.current.abort()
    abortRef.current = null
    window.setTimeout(() => setGen(null), 0)
  }, [paso])

  useEffect(() => () => abortRef.current?.abort(), [])

  // Al cambiar de paso: scroll a 0 sin animación y foco al H1 (o a un campo).
  const primerPaso = useRef(true)
  useEffect(() => {
    if (primerPaso.current) {
      primerPaso.current = false
      return
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    const campo = focoCampoRef.current
    focoCampoRef.current = null
    const id = window.setTimeout(() => {
      if (campo && paso === 'datos') {
        enfocarCampo(campo)
        return
      }
      const h1 = document.querySelector<HTMLElement>(`[data-paso="${paso}"] h1`)
      if (!h1) return
      if (!h1.hasAttribute('tabindex')) h1.setAttribute('tabindex', '-1')
      h1.focus({ preventScroll: true })
    }, 80)
    return () => window.clearTimeout(id)
  }, [paso])

  // document.title: «Versiones · Cartagena | Wayio».
  const destinoTitulo =
    paso === 'itinerario' && itinerario
      ? itinerario.destino
      : formData
        ? formData.destinoSorpresa
          ? resultado && !resultado.demo
            ? resultado.confort.destino
            : 'Destino sorpresa'
          : formData.destino
        : ''
  useEffect(() => {
    const titulos: Record<PasoRuta, string> = {
      datos: 'Diseña tu viaje',
      trazado: destinoTitulo
        ? `Trazando · ${destinoTitulo}`
        : 'Trazando tu viaje',
      versiones: destinoTitulo ? `Versiones · ${destinoTitulo}` : 'Versiones',
      itinerario: destinoTitulo
        ? `Itinerario · ${destinoTitulo}`
        : 'Itinerario',
    }
    const titulo = `${titulos[paso]} | Wayio`
    document.title = titulo
    // Los metadatos de la página pueden llegar después (streaming) y pisar
    // el título: se restaura mientras el paso esté montado.
    const obs = new MutationObserver(() => {
      if (document.title !== titulo) document.title = titulo
    })
    obs.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    })
    return () => obs.disconnect()
  }, [paso, destinoTitulo])

  // Completa en segundo plano las coordenadas del itinerario elegido; mientras
  // tanto el mapa no pide las rutas (se cobrarían dos veces con Geoapify).
  const geocodificando = useBackgroundGeocode(
    paso === 'itinerario' ? itinerario : null,
    setItinerario
  )

  // ── Generación ───────────────────────────────────────────────────────────

  /** 400: vuelve al formulario con los errores por campo del servidor. */
  const volverConErrores = useCallback(
    (campos: unknown, mensaje: string | null) => {
      const errores = erroresDesdeServidor(campos)
      setErroresServidor(
        Object.keys(errores).length > 0
          ? errores
          : { destino: mensaje ?? 'Revisa los datos del viaje' }
      )
      setGen(null)
      ir('datos', 'replace')
    },
    [ir]
  )

  // Ir al login dejando el trazado pendiente (se define más abajo: usa el
  // estado del flujo para guardarlo antes de salir).
  const irALoginTrazarRef = useRef<(form: TripForm, noCache: boolean) => void>(
    () => {}
  )

  const generar = useCallback(
    async (form: TripForm, noCache = false) => {
      // Cualquier trazado deja obsoleto el pendiente del login (si este da
      // 401, irALoginParaTrazar lo vuelve a guardar).
      borrarGenerarPendiente()
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      ultimaPeticionRef.current = { form, noCache }
      const trasLogin = trasLoginRef.current
      trasLoginRef.current = false
      const desdeTrazado =
        parsePaso(new URLSearchParams(window.location.search).get('paso')) ===
        'trazado'
      setFormData(form)
      setPaquete(form.paquete)
      setErroresServidor(undefined)
      const inicio = Date.now()
      setGen({
        estado: 'activo',
        actual: 0,
        fase: null,
        label: 'Preparando tu ruta…',
        inicio,
        rapido: false,
        demo: false,
      })
      ir('trazado', desdeTrazado ? 'replace' : 'push')

      let rapido = false
      let desdeCache = false
      const onProgress = (p: ProgressEvent) => {
        if (ctrl.signal.aborted) return
        const idx = indiceDeFase(p.fase)
        if (p.fase === 'cache') desdeCache = true
        if (p.fase === 'cache' || p.fase === 'demo') rapido = true
        setGen((g) =>
          g
            ? {
                ...g,
                fase: p.fase,
                label: p.label,
                actual: idx >= 0 ? Math.max(g.actual, idx) : g.actual,
                rapido: g.rapido || p.fase === 'cache' || p.fase === 'demo',
                demo: g.demo || p.fase === 'demo',
              }
            : g
        )
      }

      try {
        let result: GenerateResult
        try {
          result = await streamGenerate(form, noCache, {
            onProgress,
            signal: ctrl.signal,
          })
        } catch (err) {
          if (ctrl.signal.aborted) return
          // 400 = datos inválidos: no se generó nada. Los errores por campo
          // vienen en el cuerpo del 400 del propio stream.
          if (err instanceof StreamGenerateError && err.status === 400) {
            volverConErrores(err.campos, err.mensaje)
            return
          }
          // El stream arrancó (o respondió 4xx, p. ej. 402 cupo_agotado o
          // 429): la generación ya corrió, falló o no procede. NO se repite
          // (§6.3: no regenerar dos veces); mensajeDeError usa
          // retryAfter/mensaje del servidor.
          if (err instanceof StreamGenerateError && err.started) throw err
          // El stream no llegó a arrancar: se usa el endpoint clásico.
          const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...form, noCache }),
            signal: ctrl.signal,
          })
          const data: unknown = await res.json().catch(() => null)
          if (!res.ok) {
            if (res.status === 400) {
              volverConErrores(
                typeof data === 'object' && data !== null
                  ? (data as { campos?: unknown }).campos
                  : undefined,
                mensajeDe(data)
              )
              return
            }
            if (esAuthRequired(res.status, data)) {
              throw new ErrorVisible(MENSAJE_SESION, 'auth_required')
            }
            if (res.status === 402 || esCupoAgotado(data)) {
              throw new ErrorVisible(
                textoCupoAgotado(data, 'generar'),
                'cupo_agotado'
              )
            }
            if (esTopeDiario(data)) {
              throw new ErrorVisible(
                mensajeDe(data) ?? MENSAJE_TOPE_DIARIO,
                codigoDe(data)
              )
            }
            throw new ErrorVisible(
              res.status === 429
                ? mensajeLimite(segundosDeEspera(data, res))
                : (mensajeDe(data) ?? ERROR_GENERICO),
              codigoDe(data)
            )
          }
          result = data as GenerateResult
        }
        if (ctrl.signal.aborted) return

        rapido = rapido || Boolean(result.demo)
        setResultado(result)
        setItinerario(null)
        setGuardado(null)
        setShareUrl(null)
        setGen((g) =>
          g
            ? {
                ...g,
                estado: 'listo',
                actual: 3,
                label: result.demo
                  ? 'Te mostramos un itinerario de ejemplo'
                  : g.fase === 'listo' || g.fase === 'cache'
                    ? g.label
                    : '¡Tu viaje está listo!',
                rapido: g.rapido || rapido,
                demo: Boolean(result.demo),
              }
            : g
        )
        track('itinerario_generado', {
          destino: result.confort.destino,
          dias: result.confort.dias.length,
          personas: form.personas,
          tipo: form.tipo,
          paquete: form.paquete,
          moneda: result.moneda,
          desdeCache,
          demo: Boolean(result.demo),
          duracionMs: Date.now() - inicio,
        })
        // El sello «Listo» se mantiene 300 ms (la ruta rápida tarda 600).
        abortRef.current = null
        window.setTimeout(
          () => {
            if (ctrl.signal.aborted) return
            const actual = parsePaso(
              new URLSearchParams(window.location.search).get('paso')
            )
            if (actual === 'trazado') ir('versiones', 'replace')
            setGen(null)
          },
          rapido ? 900 : 300
        )
      } catch (err) {
        if (ctrl.signal.aborted) return
        abortRef.current = null
        // Sesión caducada (401 / auth_required): no es un error del trazado.
        // Se deja pendiente y se va al login, salvo si este trazado ya venía
        // del login (evita un bucle): entonces se ofrece el botón.
        if (esErrorDeSesion(err)) {
          setGen((g) =>
            g
              ? {
                  ...g,
                  estado: 'error',
                  error: MENSAJE_SESION,
                  motivo: 'sesion',
                }
              : g
          )
          if (!trasLogin) irALoginTrazarRef.current(form, noCache)
          return
        }
        const motivo = esErrorDeCupo(err)
          ? ('cupo_agotado' as const)
          : esTopeDiario(codigoDeError(err))
            ? ('tope_diario' as const)
            : null
        setGen((g) =>
          g
            ? {
                ...g,
                estado: 'error',
                error: mensajeDeError(err),
                ...(motivo ? { motivo } : {}),
              }
            : g
        )
      }
    },
    [ir, volverConErrores]
  )

  const cancelar = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setGen(null)
    ir('datos', 'replace')
  }

  const editarDesdeError = () => {
    setGen(null)
    ir('datos', 'replace')
  }

  // ── Versiones → itinerario ───────────────────────────────────────────────

  const handleSelectPackage = (p: Paquete) => {
    if (!resultado) return
    setPaquete(p)
    const base = resultado[p]
    // Si ya se estaba editando esta misma versión, se conservan los cambios.
    const conserva = itinerario !== null && itinerario.id === base.id
    if (!conserva) {
      setItinerario(base)
      setGuardado(null)
      setShareUrl(null)
    }
    ir('itinerario', 'push')
  }

  const editarCampo = (campo?: CampoForm) => {
    focoCampoRef.current = campo ?? null
    ir('datos', 'push')
  }

  const nuevoViaje = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setBorrador((b) => ({
      ...borradorVacio(),
      origen: b.origen,
      moneda: b.moneda,
      personas: b.personas,
    }))
    setFormData(null)
    setResultado(null)
    setItinerario(null)
    setGuardado(null)
    setInterpretacion(null)
    setShareUrl(null)
    setGen(null)
    ir('datos', 'push')
  }

  // ── Guardar y compartir ──────────────────────────────────────────────────

  /** Guarda (POST) o actualiza (PUT) el itinerario y devuelve su id. */
  const asegurarGuardado = async (trip: Trip): Promise<string> => {
    const firma = firmaDe(trip)
    if (guardado) {
      if (guardado.firma === firma) return guardado.id
      const put = await fetch(`/api/trips/${guardado.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: trip }),
      })
      if (put.ok) {
        setGuardado({ id: guardado.id, firma })
        return guardado.id
      }
      if (put.status !== 403 && put.status !== 404) {
        const data: unknown = await put.json().catch(() => null)
        throw new ErrorVisible(
          mensajeDe(data) ??
            'No pudimos actualizar tu viaje. Inténtalo de nuevo.'
        )
      }
    }
    const res = await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trip }),
    })
    const data: unknown = await res.json().catch(() => null)
    if (!res.ok) {
      throw new ErrorVisible(
        mensajeDe(data) ?? 'No pudimos guardar tu viaje. Inténtalo de nuevo.'
      )
    }
    const fila =
      typeof data === 'object' && data !== null
        ? (data as { trip?: { id?: unknown } }).trip
        : undefined
    const id = fila?.id
    if (typeof id !== 'string') {
      throw new ErrorVisible('No pudimos guardar tu viaje. Inténtalo de nuevo.')
    }
    setGuardado({ id, firma })
    return id
  }

  const irALogin = (trip: Trip, accion: 'guardar' | 'compartir') => {
    guardarPendiente(trip, accion)
    guardarFlujo({
      v: 1,
      borrador,
      formData,
      resultado,
      paquete,
      itinerario: trip,
      guardado,
      interpretacion,
    })
    router.push(urlLogin(urlPaso('itinerario')))
  }

  // ── Trazar (exige cuenta) ────────────────────────────────────────────────

  /**
   * Deja el trazado pendiente (localStorage, 2 h) y va al login, que vuelve a
   * /planificar?paso=datos&reanudar=1 y allí se traza solo. El flujo se
   * guarda síncrono: la escritura con retardo se perdería al navegar.
   */
  const irALoginParaTrazar = (form: TripForm, noCache: boolean) => {
    guardarGenerarPendiente(form, noCache)
    guardarFlujo({
      v: 1,
      borrador,
      formData,
      resultado,
      paquete,
      itinerario,
      guardado,
      interpretacion,
    })
    router.push(urlLogin(URL_REANUDAR_TRAZADO))
  }

  /** «Trazar», «Reintentar» y «Otra versión»: sin sesión, primero el login. */
  const trazar = (form: TripForm, noCache = false) => {
    if (exigeSesion && !user) {
      if (!isSupabaseConfigured()) {
        toastError('Trazar viajes no está disponible ahora mismo.')
        return
      }
      if (cargandoUsuario) {
        setTrazarEnCola({ form, noCache })
        return
      }
      irALoginParaTrazar(form, noCache)
      return
    }
    void generar(form, noCache)
  }

  /** «Iniciar sesión» del paso trazado (tras un 401). */
  const iniciarSesionDesdeTrazado = () => {
    const ultima = ultimaPeticionRef.current
    if (ultima) irALoginParaTrazar(ultima.form, ultima.noCache)
    else router.push(urlLogin(urlPaso('datos')))
  }

  const guardarViaje = async (trip: Trip) => {
    if (saving) return
    if (!isSupabaseConfigured()) {
      toastError('Guardar viajes no está disponible ahora mismo.')
      return
    }
    if (!user) {
      if (cargandoUsuario) setEnCola({ accion: 'guardar', trip })
      else irALogin(trip, 'guardar')
      return
    }
    setSaving(true)
    try {
      const id = await asegurarGuardado(trip)
      borrarPendiente()
      track('viaje_guardado', {
        tripId: id,
        destino: trip.destino,
        dias: trip.dias.length,
      })
      saltarPuntoDelLogo()
      success('Viaje guardado', {
        // La copia sin conexión se hace al abrirlo en /trip, no al guardar.
        description: 'Lo encuentras en «Mis viajes».',
        action: { label: 'Ver', onClick: () => router.push(`/trip/${id}`) },
      })
    } catch (err) {
      toastError(
        err instanceof ErrorVisible
          ? err.message
          : 'No pudimos guardar tu viaje. Revisa tu conexión.'
      )
    } finally {
      setSaving(false)
    }
  }

  const compartirViaje = async (trip: Trip) => {
    if (sharing) return
    if (!isSupabaseConfigured()) {
      toastError('Compartir viajes no está disponible ahora mismo.')
      return
    }
    if (!user) {
      if (cargandoUsuario) setEnCola({ accion: 'compartir', trip })
      else irALogin(trip, 'compartir')
      return
    }
    setSharing(true)
    try {
      const id = await asegurarGuardado(trip)
      borrarPendiente()
      const res = await fetch(`/api/trips/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: true }),
      })
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => null)
        throw new ErrorVisible(
          mensajeDe(data) ?? 'No pudimos crear el enlace para compartir.'
        )
      }
      const url = `${window.location.origin}/viaje-compartido/${id}`
      setShareUrl(url)
      let copiado = false
      try {
        await navigator.clipboard.writeText(url)
        copiado = true
      } catch {
        copiado = false
      }
      if (copiado) {
        success('Enlace copiado', {
          description: 'Quien lo abra verá el viaje en modo de solo lectura.',
        })
      } else {
        toast({ message: 'Enlace listo para compartir', description: url })
      }
      track('viaje_compartido', { tripId: id, metodo: 'enlace' })
    } catch (err) {
      toastError(
        err instanceof ErrorVisible
          ? err.message
          : 'No pudimos compartir tu viaje. Revisa tu conexión.'
      )
    } finally {
      setSharing(false)
    }
  }

  // Al volver del login: guarda (o comparte) lo que quedó pendiente.
  const accionesRef = useRef({ guardarViaje, compartirViaje, trazar })
  useEffect(() => {
    accionesRef.current = { guardarViaje, compartirViaje, trazar }
    irALoginTrazarRef.current = irALoginParaTrazar
  })
  const pendienteHecho = useRef(false)
  useEffect(() => {
    if (pendienteHecho.current || cargandoUsuario || !user) return
    if (paso !== 'itinerario') return
    const pendiente = leerPendiente()
    if (!pendiente) return
    pendienteHecho.current = true
    window.setTimeout(() => {
      const { guardarViaje: g, compartirViaje: c } = accionesRef.current
      void (pendiente.accion === 'compartir'
        ? c(pendiente.trip)
        : g(pendiente.trip))
    }, 0)
  }, [cargandoUsuario, user, paso])

  // La sesión ya se conoce: sigue la acción que quedó en cola (con usuario se
  // guarda o comparte; sin él, va al login como siempre).
  useEffect(() => {
    if (!enCola || cargandoUsuario) return
    const id = window.setTimeout(() => {
      setEnCola(null)
      const { guardarViaje: g, compartirViaje: c } = accionesRef.current
      void (enCola.accion === 'compartir' ? c(enCola.trip) : g(enCola.trip))
    }, 0)
    return () => window.clearTimeout(id)
  }, [enCola, cargandoUsuario])

  // Al volver del login que pidió «Trazar» (?reanudar=1): traza lo que quedó
  // pendiente, una sola vez. Sin la bandera no se traza nada solo (login
  // abandonado, otra cuenta en el mismo equipo, formulario editado después).
  // Si el servidor aún responde 401, trasLoginRef evita el bucle de login.
  const generarPendienteHecho = useRef(false)
  useEffect(() => {
    if (!vieneDeTrazar || generarPendienteHecho.current) return
    if (cargandoUsuario || !user) return
    generarPendienteHecho.current = true
    quitarBanderaReanudar()
    // «Trazar» pulsado mientras cargaba la sesión: gana lo que pidió ahora
    // (si no, saldrían dos trazados y el límite contaría ambos).
    if (trazarEnCola || paso !== 'datos') {
      borrarGenerarPendiente()
      return
    }
    const pendiente = leerGenerarPendiente()
    if (!pendiente) return
    borrarGenerarPendiente()
    window.setTimeout(() => {
      trasLoginRef.current = true
      void generar(pendiente.form, pendiente.noCache)
    }, 0)
  }, [vieneDeTrazar, cargandoUsuario, user, paso, trazarEnCola, generar])

  // La sesión ya se conoce: sigue el trazado que quedó en cola.
  useEffect(() => {
    if (!trazarEnCola || cargandoUsuario) return
    const id = window.setTimeout(() => {
      setTrazarEnCola(null)
      accionesRef.current.trazar(trazarEnCola.form, trazarEnCola.noCache)
    }, 0)
    return () => window.clearTimeout(id)
  }, [trazarEnCola, cargandoUsuario])

  // ── Render ───────────────────────────────────────────────────────────────

  const pasosHref: Partial<Record<PasoRuta, string>> = {
    datos: urlPaso('datos'),
    ...(resultado && formData ? { versiones: urlPaso('versiones') } : {}),
  }

  let contenido: ReactNode = null
  if (paso === 'trazado' && gen && formData) {
    contenido = (
      <PasoTrazado
        formData={formData}
        gen={gen}
        onReintentar={() => trazar(formData)}
        onEditar={editarDesdeError}
        onIniciarSesion={iniciarSesionDesdeTrazado}
      />
    )
  } else if (paso === 'versiones' && resultado && formData) {
    contenido = (
      <PasoVersiones
        resultado={resultado}
        formData={formData}
        paquete={paquete}
        onPaquete={setPaquete}
        onVerItinerario={() => handleSelectPackage(paquete)}
        onEditar={editarCampo}
        onReintentar={() => trazar(formData, true)}
      />
    )
  } else if (paso === 'itinerario' && itinerario) {
    contenido = (
      <ResultView
        trip={itinerario}
        setTrip={setItinerario}
        geocodificando={geocodificando}
        weather={resultado?.weather ?? null}
        form={formData}
        demo={
          resultado?.demo
            ? resultado.motivo
              ? { motivo: resultado.motivo }
              : {}
            : null
        }
        isAuthed={Boolean(user)}
        saving={saving || enCola?.accion === 'guardar'}
        sharing={sharing || enCola?.accion === 'compartir'}
        shareUrl={shareUrl}
        tripIdGuardado={guardado?.id ?? null}
        onSave={() => void guardarViaje(itinerario)}
        onShare={() => void compartirViaje(itinerario)}
        onRegenerate={() => {
          if (formData) trazar(formData, true)
        }}
        onChangePackage={() => ir('versiones', 'push')}
        onNewTrip={nuevoViaje}
      />
    )
  } else {
    contenido = (
      <PasoDatos
        borrador={borrador}
        setBorrador={setBorrador}
        interpretacion={interpretacion}
        onInterpretacion={setInterpretacion}
        errores={erroresServidor}
        onSubmit={(data) => trazar(data)}
        sinSesion={sinSesion}
        trazando={trazarEnCola !== null}
      />
    )
  }

  return (
    <>
      <SiteHeader
        variant="flujo"
        paso={paso}
        pasosHref={pasosHref}
        {...(paso === 'trazado' && gen?.estado === 'activo'
          ? {
              acciones: (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<X />}
                  onClick={cancelar}
                >
                  Cancelar
                </Button>
              ),
            }
          : {})}
      />
      <main id="contenido" className="relative flex-1 overflow-x-clip">
        <AnimatePresence mode="popLayout" custom={dir} initial={false}>
          <m.div
            key={paso}
            data-paso={paso}
            custom={dir}
            variants={VARIANTES_PASO}
            initial="entrada"
            animate="centro"
            exit="salida"
          >
            {contenido}
          </m.div>
        </AnimatePresence>
      </main>
    </>
  )
}
