'use client'

import { useId, useRef, useState } from 'react'
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  Check,
  Clapperboard,
  Compass,
  Dices,
  MapPin,
  PlaneTakeoff,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { Chip, ChipGroup } from '@/components/ui/Chip'
import { DateRangeField } from '@/components/ui/DateField'
import { Input } from '@/components/ui/Input'
import { Segmented } from '@/components/ui/Segmented'
import { StepCounter } from '@/components/ui/StepCounter'
import { Textarea } from '@/components/ui/Textarea'
import { DUR, EASE } from '@/components/ui/motion'
import { PackageSelector } from '@/components/trip/PackageSelector'
import {
  ETIQUETA_CAMPO,
  ID_CAMPO,
  MAX_DESCRIPCION_VISUAL,
  aFormulario,
  borradorVacio,
  erroresOrdenados,
  estacionesValidas,
  type CampoForm,
  type ErroresForm,
  type Estacion,
  type TripFormDraft,
} from '@/components/planner/borrador'
import {
  FRASES_DESCRIPCION,
  TIPOS,
  anadirFrase,
  quitarFrase,
} from '@/components/planner/catalogo'
import { DESTINOS } from '@/lib/seo/destinos'
import { MONEDAS, type Moneda, type TripForm } from '@/lib/validations/tripForm'
import { cn } from '@/lib/utils/cn'

/**
 * Formulario del planificador por estaciones (docs/DISENO.md §6.2).
 *
 * Seis estaciones numeradas unidas por una línea punteada; cada una cambia de
 * forma al completarse (número hueco → círculo de tinta con Check), así que el
 * estado no depende solo del color. Valida con el mismo zod del servidor y
 * asigna cada error a su campo, con un resumen arriba que enlaza a cada uno.
 *
 * Controlado (value/onChange, el planificador guarda el borrador en
 * sessionStorage) o no controlado con `initialValues`.
 */

const NOMBRES_DESTINOS = Array.from(
  new Set(DESTINOS.map((d) => d.nombre))
).sort((a, b) => a.localeCompare(b, 'es'))

const OPCIONES_MONEDA: readonly {
  value: Moneda
  label: string
  ariaLabel: string
}[] = MONEDAS.map((m) => ({
  value: m,
  label: m,
  ariaLabel:
    m === 'USD'
      ? 'Dólares (USD)'
      : m === 'EUR'
        ? 'Euros (EUR)'
        : 'Pesos dominicanos (DOP)',
}))

const OPCIONES_DESTINO = [
  { value: 'elijo', label: 'Lo elijo yo' },
  { value: 'sorpresa', label: 'Sorpréndeme', icon: <Dices /> },
] as const

/** Enfoca el control de un campo (anclas del resumen de errores y chips). */
export function enfocarCampo(campo: CampoForm): void {
  const el = document.getElementById(ID_CAMPO[campo])
  if (!el) return
  const control = el.matches('input, textarea, select, button')
    ? el
    : (el.querySelector<HTMLElement>('[aria-checked="true"]') ??
      el.querySelector<HTMLElement>('input, textarea, button:not(:disabled)'))
  control?.focus({ preventScroll: true })
  el.scrollIntoView({ block: 'center' })
}

export interface TripFormProps {
  /** Borrador controlado (el planificador lo persiste). */
  value?: TripFormDraft | undefined
  onChange?: Dispatch<SetStateAction<TripFormDraft>> | undefined
  /** Valores iniciales si el formulario no es controlado. */
  initialValues?: Partial<TripFormDraft> | undefined
  onSubmit: (data: TripForm) => void | Promise<void>
  loading?: boolean | undefined
  /** Errores por campo (p. ej. los 400 de zod del servidor). */
  errores?: ErroresForm | undefined
  /** Estaciones que la descripción no permitió deducir («Lo que entendimos»). */
  faltantes?: readonly Estacion[] | undefined
  /** id del <form> (para enviar desde la barra inferior móvil). */
  id?: string | undefined
  /** Contenido bajo la descripción (p. ej. «Lo que entendimos» en móvil). */
  extraDescripcion?: ReactNode
  /** «Entender mi viaje»: interpreta la descripción con la IA. */
  onEntender?: (() => void) | undefined
  entendiendo?: boolean | undefined
  onDescripcionBlur?: (() => void) | undefined
  /** Abre «Desde un video o una foto». */
  onDesdeVideo?: (() => void) | undefined
  /** Oculta el botón de envío por debajo de lg (la página pone su barra). */
  envioSoloEscritorio?: boolean | undefined
  /** layoutId del CTA (se encoge hasta el aro de origen de RutaDeFases). */
  ctaLayoutId?: string | undefined
}

export function TripForm({
  value,
  onChange,
  initialValues,
  onSubmit,
  loading = false,
  errores: erroresProp,
  faltantes = [],
  id,
  extraDescripcion,
  onEntender,
  entendiendo = false,
  onDescripcionBlur,
  onDesdeVideo,
  envioSoloEscritorio = false,
  ctaLayoutId,
}: TripFormProps) {
  const [interno, setInterno] = useState<TripFormDraft>(() => ({
    ...borradorVacio(),
    ...initialValues,
  }))
  const draft = value ?? interno
  const setDraft = onChange ?? setInterno

  const [errores, setErrores] = useState<ErroresForm>(erroresProp ?? {})
  const [intentado, setIntentado] = useState(
    Boolean(erroresProp && Object.keys(erroresProp).length > 0)
  )
  // Si llegan errores nuevos del servidor, sustituyen a los locales.
  const [erroresPrevios, setErroresPrevios] = useState(erroresProp)
  if (erroresProp !== erroresPrevios) {
    setErroresPrevios(erroresProp)
    setErrores(erroresProp ?? {})
    if (erroresProp && Object.keys(erroresProp).length > 0) setIntentado(true)
  }

  const resumenRef = useRef<HTMLDivElement | null>(null)
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const legend = (n: number) => `${uid}-estacion-${n}`
  const listaDestinos = `${uid}-destinos`
  // Mensajes en línea de los controles compuestos (stepper y chips): sus
  // controles los referencian con aria-describedby.
  const errorPersonas = `${uid}-error-personas`
  const errorTipo = `${uid}-error-tipo`
  const validas = estacionesValidas(draft)
  const falta = (e: Estacion) => faltantes.includes(e) && !validas[e]

  const limpiar = (...campos: CampoForm[]) =>
    setErrores((prev) => {
      if (!campos.some((c) => prev[c])) return prev
      const n = { ...prev }
      for (const c of campos) delete n[c]
      return n
    })

  const set = <K extends keyof TripFormDraft>(
    clave: K,
    valor: TripFormDraft[K],
    ...campos: CampoForm[]
  ) => {
    setDraft((d) => ({ ...d, [clave]: valor }))
    if (campos.length > 0) limpiar(...campos)
  }

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (loading) return
    const r = aFormulario(draft)
    if (!r.ok) {
      setErrores(r.errores)
      setIntentado(true)
      window.requestAnimationFrame(() =>
        resumenRef.current?.focus({ preventScroll: false })
      )
      return
    }
    setErrores({})
    setIntentado(false)
    await onSubmit(r.data)
  }

  const lista = erroresOrdenados(errores)
  const textoDescripcion = draft.descripcion

  const boton = (
    <Button
      type="submit"
      size="xl"
      fullWidth
      iconEnd={<ArrowRight />}
      loading={loading}
      loadingText="Trazando tu viaje…"
    >
      Trazar mi viaje
    </Button>
  )

  return (
    <form
      id={id}
      noValidate
      onSubmit={(e) => void enviar(e)}
      aria-label="Datos del viaje"
    >
      {intentado && lista.length > 0 ? (
        <div
          ref={resumenRef}
          tabIndex={-1}
          className="mb-10 rounded-card focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <Callout
            tone="danger"
            title={
              lista.length === 1
                ? 'Revisa 1 dato antes de trazar'
                : `Revisa ${lista.length} datos antes de trazar`
            }
          >
            <ul className="mt-1 flex flex-col gap-1">
              {lista.map(([campo, msg]) => (
                <li key={campo}>
                  <a
                    href={`#${ID_CAMPO[campo]}`}
                    onClick={(ev) => {
                      ev.preventDefault()
                      enfocarCampo(campo)
                    }}
                    className="rounded-sm underline decoration-1 underline-offset-[3px]"
                  >
                    {ETIQUETA_CAMPO[campo]}: {msg}
                  </a>
                </li>
              ))}
            </ul>
          </Callout>
        </div>
      ) : null}

      <ol className="flex flex-col">
        {/* 00 · Descripción libre */}
        <Estacion
          numero="00"
          titulo="Cuéntanos tu viaje ideal"
          opcional
          valida={validas.descripcion}
          legendId={legend(0)}
        >
          <Textarea
            id={ID_CAMPO.descripcion}
            aria-labelledby={legend(0)}
            value={textoDescripcion}
            onChange={(e) => set('descripcion', e.target.value, 'descripcion')}
            onBlur={onDescripcionBlur}
            maxLength={MAX_DESCRIPCION_VISUAL}
            rows={4}
            placeholder="Ej.: Vamos mi pareja y yo, nos encanta caminar y comer donde comen los locales. Nada de madrugar."
            hint="Escríbelo como se lo contarías a un amigo. La IA lo usa para afinar ritmo, intereses y restricciones."
            error={errores.descripcion}
            footer={
              <div
                role="group"
                aria-label="Añadir a la descripción"
                className="flex flex-wrap gap-2"
              >
                {FRASES_DESCRIPCION.map((f) => {
                  const incluida = textoDescripcion.includes(f.frase)
                  return (
                    <Chip
                      key={f.label}
                      size="sm"
                      selected={incluida}
                      aria-pressed={incluida}
                      onClick={() =>
                        set(
                          'descripcion',
                          incluida
                            ? quitarFrase(textoDescripcion, f.frase)
                            : anadirFrase(textoDescripcion, f.frase).slice(
                                0,
                                MAX_DESCRIPCION_VISUAL
                              ),
                          'descripcion'
                        )
                      }
                    >
                      {f.label}
                    </Chip>
                  )
                })}
              </div>
            }
          />

          <ListaQuitable
            titulo="Lugares que quieres ver"
            icono={<MapPin />}
            items={draft.lugaresDeseados}
            onQuitar={(l) =>
              set(
                'lugaresDeseados',
                draft.lugaresDeseados.filter((x) => x !== l)
              )
            }
          />
          <ListaQuitable
            titulo="Preferencias"
            items={draft.preferencias}
            onQuitar={(p) =>
              set(
                'preferencias',
                draft.preferencias.filter((x) => x !== p)
              )
            }
          />

          {onEntender || onDesdeVideo ? (
            <div className="flex flex-wrap items-center gap-3">
              {onEntender ? (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Compass />}
                  loading={entendiendo}
                  loadingText="Leyendo tu descripción…"
                  disabled={textoDescripcion.trim().length < 3}
                  onClick={onEntender}
                >
                  Entender mi viaje
                </Button>
              ) : null}
              {onDesdeVideo ? (
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Clapperboard />}
                  onClick={onDesdeVideo}
                >
                  Desde un video o una foto
                </Button>
              ) : null}
            </div>
          ) : null}
          {extraDescripcion}
        </Estacion>

        {/* 01 · Destino */}
        <Estacion
          numero="01"
          titulo="Destino"
          valida={validas.destino}
          falta={falta('destino')}
          legendId={legend(1)}
        >
          <Segmented
            options={OPCIONES_DESTINO}
            value={draft.destinoSorpresa ? 'sorpresa' : 'elijo'}
            onValueChange={(v) =>
              set('destinoSorpresa', v === 'sorpresa', 'destino')
            }
            label="Cómo elegir el destino"
            className="self-start"
          />
          <AnimatePresence initial={false} mode="popLayout">
            {draft.destinoSorpresa ? (
              <m.p
                key="sorpresa"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DUR.fast }}
                className="flex items-start gap-2.5 rounded-control bg-surface-2 px-4 py-3 text-body-s text-fg-muted"
              >
                <Dices
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="mt-0.5 size-[18px] shrink-0 text-fg-subtle"
                />
                Elegiremos un destino que encaje con tu estilo, tus fechas y tu
                presupuesto.
              </m.p>
            ) : (
              <m.div
                key="destino"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DUR.fast }}
              >
                <Input
                  id={ID_CAMPO.destino}
                  label="Destino"
                  icon={<MapPin />}
                  list={listaDestinos}
                  autoComplete="off"
                  placeholder="Cartagena, Punta Cana, Madrid…"
                  value={draft.destino}
                  onChange={(e) => set('destino', e.target.value, 'destino')}
                  error={errores.destino}
                />
              </m.div>
            )}
          </AnimatePresence>
          <datalist id={listaDestinos}>
            {NOMBRES_DESTINOS.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <Input
            id={ID_CAMPO.origen}
            label="Ciudad de origen"
            icon={<PlaneTakeoff />}
            autoComplete="address-level2"
            placeholder="Santo Domingo"
            value={draft.origen}
            onChange={(e) => set('origen', e.target.value, 'origen')}
            error={errores.origen}
          />
        </Estacion>

        {/* 02 · Fechas */}
        <Estacion
          numero="02"
          titulo="Fechas"
          valida={validas.fechas}
          falta={falta('fechas')}
          legendId={legend(2)}
        >
          <DateRangeField
            idInicio={ID_CAMPO.fechaInicio}
            idFin={ID_CAMPO.fechaFin}
            value={{ inicio: draft.fechaInicio, fin: draft.fechaFin }}
            onChange={({ inicio, fin }) => {
              setDraft((d) => ({ ...d, fechaInicio: inicio, fechaFin: fin }))
              limpiar('fechaInicio', 'fechaFin')
            }}
            errorInicio={errores.fechaInicio}
            errorFin={errores.fechaFin}
          />
        </Estacion>

        {/* 03 · Viajeros y presupuesto */}
        <Estacion
          numero="03"
          titulo="Viajeros y presupuesto"
          valida={validas.viajeros}
          falta={falta('viajeros')}
          legendId={legend(3)}
        >
          <div id={ID_CAMPO.personas}>
            <StepCounter
              label="Viajeros"
              unidad="viajeros"
              value={draft.personas}
              onChange={(n) => set('personas', n, 'personas')}
              aria-describedby={errores.personas ? errorPersonas : undefined}
              aria-invalid={errores.personas ? true : undefined}
            />
            {errores.personas ? (
              <MensajeError id={errorPersonas}>{errores.personas}</MensajeError>
            ) : null}
          </div>
          <Input
            id={ID_CAMPO.presupuesto}
            label="Presupuesto total"
            inputMode="numeric"
            autoComplete="off"
            placeholder="1800"
            value={draft.presupuesto}
            onChange={(e) =>
              set(
                'presupuesto',
                e.target.value.replace(/[^\d]/g, '').slice(0, 8),
                'presupuesto',
                'moneda'
              )
            }
            className="pr-[172px] tnum"
            hint="Para hospedaje, actividades y comidas. El vuelo se estima aparte."
            error={errores.presupuesto ?? errores.moneda}
            suffix={
              <Segmented
                size="sm"
                options={OPCIONES_MONEDA}
                value={draft.moneda}
                onValueChange={(v) => set('moneda', v, 'moneda')}
                label="Moneda"
              />
            }
          />
        </Estacion>

        {/* 04 · Estilo */}
        <Estacion
          numero="04"
          titulo="Estilo"
          valida={validas.estilo}
          legendId={legend(4)}
        >
          <div id={ID_CAMPO.tipo}>
            <ChipGroup
              options={TIPOS}
              value={draft.tipo || null}
              onValueChange={(v) => {
                const t = TIPOS.find((x) => x.value === v)
                if (t) set('tipo', t.value, 'tipo', 'zona')
              }}
              labelledBy={legend(4)}
              aria-describedby={errores.tipo ? errorTipo : undefined}
              aria-invalid={errores.tipo ? true : undefined}
            />
            {errores.tipo ? (
              <MensajeError id={errorTipo}>{errores.tipo}</MensajeError>
            ) : null}
          </div>
          <AnimatePresence initial={false}>
            {draft.tipo === 'crucero' ? (
              <m.div
                key="zona"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: DUR.medium, ease: EASE.papel }}
                className="-mx-1 overflow-hidden px-1"
              >
                <div className="pt-1 pb-1">
                  <Input
                    id={ID_CAMPO.zona}
                    label="Zona del crucero"
                    placeholder="Caribe, Mediterráneo, Alaska…"
                    value={draft.zona}
                    onChange={(e) => set('zona', e.target.value, 'zona')}
                    error={errores.zona}
                    required
                    aria-required="true"
                  />
                </div>
              </m.div>
            ) : null}
          </AnimatePresence>
        </Estacion>

        {/* 05 · Nivel */}
        <Estacion
          numero="05"
          titulo="Nivel preferido"
          valida={validas.nivel}
          legendId={legend(5)}
          ultima
        >
          <div id={ID_CAMPO.paquete} className="flex flex-col gap-2">
            <PackageSelector
              value={draft.paquete}
              onChange={(p) => set('paquete', p, 'paquete')}
              labelledBy={legend(5)}
              className="self-start"
            />
            <p className="text-caption text-fg-muted">
              Igual verás las tres versiones para comparar
            </p>
          </div>
        </Estacion>
      </ol>

      <div className={cn('mt-12', envioSoloEscritorio && 'hidden lg:block')}>
        {ctaLayoutId ? (
          <m.div layoutId={ctaLayoutId} className="rounded-full">
            {boton}
          </m.div>
        ) : (
          boton
        )}
      </div>
    </form>
  )
}

// ─── Piezas ────────────────────────────────────────────────────────────────

function Estacion({
  numero,
  titulo,
  opcional = false,
  valida,
  falta = false,
  legendId,
  ultima = false,
  children,
}: {
  numero: string
  titulo: string
  opcional?: boolean
  valida: boolean
  falta?: boolean
  legendId: string
  ultima?: boolean
  children: ReactNode
}) {
  return (
    <li className={cn('relative pl-10 sm:pl-12', !ultima && 'pb-12')}>
      {!ultima ? (
        <span
          aria-hidden="true"
          className="absolute top-8 bottom-1 left-[11px] border-l-2 border-dotted border-rule"
        />
      ) : null}
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-0.5 left-0 grid size-6 place-items-center overflow-hidden rounded-full text-[12px] font-semibold tnum',
          'transition-[background-color,border-color,color] duration-(--dur-base) ease-papel',
          valida
            ? 'bg-fg text-fg-inverse'
            : falta
              ? 'border-2 border-warning bg-bg text-warning-fg'
              : 'border-2 border-border-strong bg-bg text-fg-muted'
        )}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <m.span
            key={valida ? 'ok' : 'num'}
            className="inline-flex"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.base, ease: EASE.sello }}
          >
            {valida ? <Check strokeWidth={2.5} className="size-3.5" /> : numero}
          </m.span>
        </AnimatePresence>
      </span>
      <fieldset className="min-w-0">
        <legend
          id={legendId}
          className="flex flex-wrap items-center gap-x-2 font-display text-h3 text-fg"
        >
          <span>
            {titulo}
            {opcional ? (
              <span className="font-sans text-body-s font-normal text-fg-subtle">
                {' '}
                (opcional)
              </span>
            ) : null}
          </span>
          <span className="sr-only">{valida ? ' (completo)' : ''}</span>
          {falta ? (
            <Badge variant="warning" className="font-sans">
              Falta este dato
            </Badge>
          ) : null}
        </legend>
        <div className="mt-4 flex flex-col gap-5">{children}</div>
      </fieldset>
    </li>
  )
}

function ListaQuitable({
  titulo,
  icono,
  items,
  onQuitar,
}: {
  titulo: string
  icono?: ReactNode
  items: readonly string[]
  onQuitar: (item: string) => void
}) {
  const id = useId()
  if (items.length === 0) return null
  return (
    <div>
      <p id={id} className="text-label text-fg">
        {titulo}
      </p>
      <ul aria-labelledby={id} className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item}>
            <Chip
              size="sm"
              icon={icono}
              aria-label={`Quitar ${item}`}
              onClick={() => onQuitar(item)}
            >
              {item}
              <X aria-hidden="true" className="ml-0.5 text-fg-subtle" />
            </Chip>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MensajeError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p
      id={id}
      className="mt-1.5 flex animate-[wy-aparece_160ms_var(--ease-papel)_both] gap-1.5 text-[14px] text-danger"
    >
      <AlertCircle
        aria-hidden="true"
        strokeWidth={1.75}
        className="mt-[3px] size-4 shrink-0"
      />
      <span>{children}</span>
    </p>
  )
}
