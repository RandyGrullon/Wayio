import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Columns3,
  MapPin,
  MessagesSquare,
  Navigation,
  PenLine,
  Vote,
  Wallet,
} from 'lucide-react'
import { Postal } from '@/components/brand/Postal'
import type { Escena } from '@/components/brand/Postal'
import { AvatarStack } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink, buttonClasses } from '@/components/ui/Button'
import { DESTINOS, getDestino } from '@/lib/seo/destinos'
import {
  formatCurrency,
  formatDuracion,
  formatFecha,
  formatHora12,
  formatHora12Partes,
} from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import { CajaDeseo } from './CajaDeseo'
import { TrazoEnVista } from './TrazoEnVista'

/**
 * Secciones de la landing (docs/DISENO.md §6.1). Server Components: solo la
 * caja de deseo y el trazo de «Cómo funciona» son islas cliente. Sin MapLibre:
 * el mapa de ejemplo es un SVG estático.
 */

const CONTENEDOR = 'mx-auto max-w-content px-4 md:px-6 lg:px-8'
const SECCION = 'py-[72px] md:py-24 lg:py-32'
const item = (i: number) => ({ '--i': i }) as CSSProperties

// ─── 3 · Portada ───────────────────────────────────────────────────────────

const HERO_FILAS: readonly [string, string][] = [
  ['09:00', 'Catedral Primada'],
  ['11:30', 'Calle El Conde'],
  ['13:00', 'Almuerzo criollo'],
]

export function Portada() {
  return (
    <section
      data-wy-hero
      aria-labelledby="portada-titulo"
      className="reticula pt-14 pb-[72px] lg:pt-24 lg:pb-28"
    >
      <div className={cn(CONTENEDOR, 'grid gap-12 lg:grid-cols-12')}>
        <div className="lg:col-span-7">
          <p className="wy-hero-item kicker kicker-filete" style={item(0)}>
            Planificador de viajes con IA · Hecho en RD
          </p>
          <h1
            id="portada-titulo"
            className="wy-hero-item mt-6 font-display text-display-xl text-fg"
            style={item(1)}
          >
            Tu próximo viaje, <em className="text-primary italic">trazado</em>{' '}
            día a día.
          </h1>
          <p
            className="wy-hero-item mt-6 max-w-[36ch] text-lead text-fg-muted"
            style={item(2)}
          >
            Cuéntanos qué imaginas. Wayio arma tres versiones de tu itinerario,
            con horarios, mapa y presupuesto en USD, EUR o DOP. Tú eliges.
          </p>
          <div className="wy-hero-item mt-10" style={item(3)}>
            <CajaDeseo />
            <p className="mt-6 text-caption text-fg-subtle">
              Gratis para empezar · Sin tarjeta · {DESTINOS.length} guías de
              destino
            </p>
          </div>
        </div>

        <div className="wy-hero-item lg:col-span-5 lg:pt-2" style={item(4)}>
          <Postal
            semilla="santo-domingo"
            escena="ciudad"
            proporcion="4:5"
            redondeo="sheet"
            sello
            kicker="Día 02 · Santo Domingo"
            kickerClassName="text-dia-2"
            titulo="Zona Colonial al amanecer"
            // Ilustración de ejemplo: sin encabezado (no salta de h1 a h3).
            tituloComo="p"
            arteClassName="max-lg:aspect-[4/3] max-lg:max-h-[360px]"
            como="figure"
          >
            <ul className="flex flex-col gap-1.5">
              {HERO_FILAS.map(([hora, lugar]) => (
                <li key={hora} className="flex gap-3">
                  <span className="w-[5.5rem] shrink-0 font-semibold text-fg tnum">
                    {formatHora12(hora)}
                  </span>
                  <span>{lugar}</span>
                </li>
              ))}
            </ul>
          </Postal>
        </div>
      </div>
    </section>
  )
}

// ─── 4 · Cómo funciona ─────────────────────────────────────────────────────

const PASOS: readonly {
  n: string
  titulo: string
  texto: string
  icono: ReactNode
}[] = [
  {
    n: '01',
    titulo: 'Cuéntanos',
    texto:
      'Escríbelo como se lo contarías a un amigo, o ve campo por campo: destino, fechas, viajeros y presupuesto.',
    icono: <PenLine />,
  },
  {
    n: '02',
    titulo: 'Compara 3 versiones',
    texto:
      'Básico, Confort y Premium, con sus hoteles, su ritmo y cuánto encajan con tu presupuesto, lado a lado.',
    icono: <Columns3 />,
  },
  {
    n: '03',
    titulo: 'Viaja con el mapa en vivo',
    texto:
      'Tu itinerario día a día con horarios, mapa y «Cómo llegar», también sin conexión.',
    icono: <Navigation />,
  },
]

export function ComoFunciona() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="como-funciona-titulo"
      className={cn(SECCION, 'scroll-mt-16')}
    >
      <div className={CONTENEDOR}>
        <p className="kicker kicker-filete">Cómo funciona</p>
        <h2
          id="como-funciona-titulo"
          className="mt-4 font-display text-h2 text-fg"
        >
          Tres pasos, una sola ruta
        </h2>

        <ol className="relative mt-14 grid gap-12 md:grid-cols-3 md:gap-8">
          {/* La ruta: punteada de fondo y trazada una vez al entrar */}
          <span
            aria-hidden="true"
            className="absolute top-[7px] right-[calc(33.333%-29px)] left-[7px] hidden border-t-2 border-dotted border-rule md:block"
          />
          <TrazoEnVista
            orientacion="horizontal"
            className="top-[7px] right-[calc(33.333%-29px)] left-[7px] hidden md:block"
          />
          <span
            aria-hidden="true"
            className="absolute top-[7px] bottom-8 left-[7px] border-l-2 border-dotted border-rule md:hidden"
          />
          <TrazoEnVista
            orientacion="vertical"
            className="top-[7px] bottom-8 left-[7px] md:hidden"
          />

          {PASOS.map((p) => (
            <li key={p.n} className="relative pl-10 md:pl-0">
              <span
                aria-hidden="true"
                className="absolute top-0 left-0 size-4 rounded-full border-2 border-fg bg-bg md:relative md:block"
              />
              <p
                aria-hidden="true"
                className="font-display text-[56px] leading-none text-primary-text tnum md:mt-6"
              >
                {p.n}
              </p>
              <h3 className="mt-4 flex items-center gap-2 text-title text-fg [&_svg]:size-5 [&_svg]:stroke-[1.75] [&_svg]:text-fg-subtle">
                <span aria-hidden="true" className="inline-flex">
                  {p.icono}
                </span>
                <span>
                  <span className="sr-only">Paso {Number(p.n)}: </span>
                  {p.titulo}
                </span>
              </h3>
              <p className="mt-2 max-w-[34ch] text-body-s text-fg-muted">
                {p.texto}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// ─── 5 · Así se ve tu itinerario ───────────────────────────────────────────

interface ActividadEjemplo {
  inicio: string
  fin: string
  nombre: string
  tipo: string
  descripcion: string
  minutos: number
  precio: number
  lugar: string
  siguiente?: number
}

const DIA_EJEMPLO: readonly ActividadEjemplo[] = [
  {
    inicio: '08:30',
    fin: '11:00',
    nombre: 'Salto El Limón',
    tipo: 'Actividad',
    descripcion:
      'Caminata entre cacaotales hasta una cascada de 40 m. Lleva zapatos que se puedan mojar.',
    minutos: 150,
    precio: 70,
    lugar: 'El Limón, Samaná',
    siguiente: 25,
  },
  {
    inicio: '11:45',
    fin: '13:00',
    nombre: 'Almuerzo frente al mar',
    tipo: 'Restaurante',
    descripcion: 'Pescado con coco y tostones en el Pueblo de los Pescadores.',
    minutos: 75,
    precio: 56,
    lugar: 'Las Terrenas',
    siguiente: 10,
  },
  {
    inicio: '13:30',
    fin: '16:30',
    nombre: 'Playa Bonita',
    tipo: 'Playa',
    descripcion: 'Arena dorada, poca gente y sombra de palmeras para la tarde.',
    minutos: 180,
    precio: 0,
    lugar: 'Playa Bonita, Las Terrenas',
    siguiente: 15,
  },
  {
    inicio: '18:00',
    fin: '19:00',
    nombre: 'Atardecer en Punta Popy',
    tipo: 'Playa',
    descripcion: 'El mejor sitio para ver caer el sol con un jugo de chinola.',
    minutos: 60,
    precio: 10,
    lugar: 'Punta Popy, Las Terrenas',
  },
]

function DiaEjemplo() {
  const total = DIA_EJEMPLO.reduce((s, a) => s + a.precio, 0)
  return (
    <article
      aria-labelledby="dia-ejemplo-titulo"
      className="rounded-card border border-border bg-surface p-5 shadow-card md:p-7"
    >
      <p className="kicker text-dia-2">Día 02 · {formatFecha('2026-12-12')}</p>
      <h3 id="dia-ejemplo-titulo" className="mt-2 font-display text-h2 text-fg">
        Cascada, playa y atardecer
      </h3>
      <p className="mt-2 text-body-s text-fg-muted tnum">
        Las Terrenas · {formatCurrency(total, 'USD')} estimado
      </p>

      <ol className="mt-6">
        {DIA_EJEMPLO.map((a, i) => {
          const inicio = formatHora12Partes(a.inicio)
          const ultima = i === DIA_EJEMPLO.length - 1
          return (
            <li key={a.nombre} className="relative flex gap-4">
              {/* Hora (64 px) */}
              <div className="w-16 shrink-0 pt-4 text-right">
                <p className="text-[15px] leading-tight font-semibold text-fg tnum">
                  {inicio?.hora}
                </p>
                <p className="text-caption text-fg-muted">{inicio?.periodo}</p>
                <p className="mt-1 text-caption text-fg-subtle tnum">
                  {formatHora12(a.fin)}
                </p>
              </div>
              {/* Riel punteado con el punto del día */}
              <div aria-hidden="true" className="relative w-3 shrink-0">
                <span
                  className={cn(
                    'absolute left-[5px] w-0 border-l-2 border-dotted border-rule',
                    i === 0 ? 'top-6' : 'top-0',
                    ultima ? 'h-6' : 'bottom-0'
                  )}
                />
                <span className="absolute top-[22px] left-0 size-3 rounded-full bg-dia-2 ring-2 ring-surface" />
              </div>
              {/* Contenido */}
              <div
                className={cn(
                  'min-w-0 flex-1 py-4',
                  !ultima && 'border-b border-border'
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-title text-fg">{a.nombre}</h4>
                  <Badge>{a.tipo}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-body-s text-fg-muted">
                  {a.descripcion}
                </p>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-caption text-fg-muted [&_svg]:size-3.5 [&_svg]:stroke-[1.75]">
                  <span className="inline-flex items-center gap-1 tnum">
                    <Clock aria-hidden="true" />
                    {formatDuracion(a.minutos)}
                  </span>
                  <span className="inline-flex items-center gap-1 tnum">
                    <Wallet aria-hidden="true" />
                    {a.precio > 0 ? formatCurrency(a.precio, 'USD') : 'Gratis'}
                  </span>
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPin aria-hidden="true" />
                    <span className="truncate">{a.lugar}</span>
                  </span>
                </p>
                {a.siguiente ? (
                  <p className="mt-3 text-caption text-fg-subtle">
                    {a.siguiente} min hasta la siguiente
                  </p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </article>
  )
}

/** Fragmento de mapa en SVG estático (sin MapLibre): 4 paradas y la ruta. */
function MapaEjemplo() {
  /** [x, y, nombre, x del rótulo, y del rótulo, anclaje]. */
  const paradas: readonly [
    number,
    number,
    string,
    number,
    number,
    'start' | 'middle' | 'end',
  ][] = [
    [148, 150, 'El Limón', 132, 154.5, 'end'],
    [204, 74, 'Las Terrenas', 188, 78.5, 'end'],
    // Encima del marcador: a la derecha se salía del recorte del SVG.
    [270, 58, 'Playa Bonita', 270, 40, 'middle'],
    [238, 96, 'Punta Popy', 254, 100.5, 'start'],
  ]
  return (
    <svg
      viewBox="0 0 360 300"
      role="img"
      aria-labelledby="mapa-ejemplo-titulo"
      className="block h-auto w-full"
    >
      <title id="mapa-ejemplo-titulo">
        Mapa del día 2: El Limón, Las Terrenas, Playa Bonita y Punta Popy,
        unidos por la ruta del día
      </title>
      <rect
        width="360"
        height="300"
        className="fill-mar-100 dark:fill-mar-950"
      />
      {/* Retícula de carta */}
      <g className="stroke-rule" strokeWidth="1" opacity="0.45" fill="none">
        <path d="M90 0V300M180 0V300M270 0V300M0 100H360M0 200H360" />
      </g>
      {/* Península y costa sur de la bahía */}
      <path
        d="M0 46C60 26 120 40 180 30C240 20 300 38 360 32V168C320 178 280 168 240 180C200 192 150 186 110 194C70 202 30 194 0 200Z"
        className="fill-papel-50 stroke-papel-400 dark:fill-noche-800 dark:stroke-noche-600"
        strokeWidth="1.5"
      />
      <path
        d="M0 262C80 250 160 264 240 252C290 244 330 258 360 252V300H0Z"
        className="fill-papel-50 stroke-papel-400 dark:fill-noche-800 dark:stroke-noche-600"
        strokeWidth="1.5"
      />
      {/* Carreteras */}
      <path
        d="M18 150C80 132 120 164 168 140S260 104 352 120M150 150C160 120 182 96 204 74"
        fill="none"
        strokeWidth="2"
        strokeDasharray="5 5"
        className="stroke-papel-300 dark:stroke-noche-700"
      />
      {/* Ruta del día (con «casing» del color del mapa) */}
      <path
        d="M148 150Q170 104 204 74Q236 48 270 58Q258 84 238 96"
        fill="none"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="[stroke:var(--map-casing)]"
      />
      <path
        d="M148 150Q170 104 204 74Q236 48 270 58Q258 84 238 96"
        fill="none"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-dia-2"
      />
      {/* Rótulos de agua en serif itálica, como en una carta (Newsreader
          nunca por debajo de 20 px, §13.8) */}
      <text
        x="16"
        y="24"
        className="fill-mar-700 font-display text-[20px] italic dark:fill-mar-300"
      >
        Océano Atlántico
      </text>
      <text
        x="180"
        y="230"
        textAnchor="middle"
        className="fill-mar-700 font-display text-[20px] italic dark:fill-mar-300"
      >
        Bahía de Samaná
      </text>
      {/* Paradas numeradas (número de 13 px, §10.3) */}
      {paradas.map(([x, y, nombre, lx, ly, ancla], i) => (
        <g key={nombre}>
          <circle
            cx={x}
            cy={y}
            r="11"
            strokeWidth="2.5"
            className="fill-dia-2 [stroke:var(--map-casing)]"
          />
          <text
            x={x}
            y={y + 4.5}
            textAnchor="middle"
            className="fill-dia-num text-[13px] font-bold tnum"
          >
            {i + 1}
          </text>
          <text
            x={lx}
            y={ly}
            textAnchor={ancla}
            className="fill-fg-muted text-[13px] font-medium"
          >
            {nombre}
          </text>
        </g>
      ))}
      {/* Norte */}
      <g className="fill-fg-muted" transform="translate(338 196)">
        <path d="M0 -14L6 4L0 0L-6 4Z" />
        <text y="18" textAnchor="middle" className="text-[13px] font-semibold">
          N
        </text>
      </g>
    </svg>
  )
}

export function AsiSeVe() {
  const total = 1840
  const presupuesto = 2000
  const pct = Math.round((total / presupuesto) * 100)
  return (
    <section
      aria-labelledby="asi-se-ve-titulo"
      className={cn(SECCION, 'bg-surface-2')}
    >
      <div className={CONTENEDOR}>
        <p className="kicker kicker-filete">Así se ve tu itinerario</p>
        <h2 id="asi-se-ve-titulo" className="mt-4 font-display text-h2 text-fg">
          Cada día, un capítulo
        </h2>
        <p className="mt-4 max-w-[60ch] text-lead text-fg-muted">
          Horarios reales, el tiempo entre paradas y lo que cuesta cada cosa, en
          la moneda de tu viaje.
        </p>

        <figure className="mt-12">
          <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-7">
              <DiaEjemplo />
            </div>
            <div className="relative lg:col-span-5">
              <div className="overflow-hidden rounded-card border border-border shadow-card">
                <MapaEjemplo />
              </div>
              <div className="relative -mt-10 ml-4 mr-4 rounded-control border border-border bg-surface p-4 shadow-elev sm:ml-auto sm:w-72 sm:mr-4">
                <p className="kicker">Total estimado</p>
                <p className="mt-1 text-num-l text-fg tnum">
                  {formatCurrency(total, 'USD')}
                </p>
                <p className="text-caption text-fg-muted tnum">
                  2 viajeros · {formatCurrency(total / 2, 'USD')} por persona ·
                  sin vuelo
                </p>
                <p className="mt-3 flex items-center gap-1.5 text-body-s font-medium text-success-fg">
                  <CheckCircle2
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="size-4 shrink-0"
                  />
                  Dentro de tu presupuesto ({pct} %)
                </p>
                <div
                  aria-hidden="true"
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
                >
                  <div
                    className="h-full rounded-full bg-success"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
          <figcaption className="mt-6 text-caption text-fg-muted">
            Ejemplo de un plan Confort de 5 días en Samaná
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

// ─── 6 · Destinos para empezar ─────────────────────────────────────────────

/** [slug, escena, región para el kicker cuando el destino es un país]. */
const DESTACADOS: readonly [string, Escena, string][] = [
  ['republica-dominicana', 'playa', 'Caribe'],
  ['colombia', 'ciudad', 'Caribe y Andes'],
  ['peru', 'montana', 'Andes'],
  ['mexico', 'selva', 'Norteamérica'],
]

const MESES_CORTOS: Record<string, string> = {
  enero: 'ene',
  febrero: 'feb',
  marzo: 'mar',
  abril: 'abr',
  mayo: 'may',
  junio: 'jun',
  julio: 'jul',
  agosto: 'ago',
  septiembre: 'sept',
  octubre: 'oct',
  noviembre: 'nov',
  diciembre: 'dic',
}

/** «Diciembre–Abril (temporada seca)» → «dic–abr». */
function epocaCorta(epoca: string): string {
  return epoca
    .replace(/\s*\([^)]*\)/g, '')
    .replace(
      /[A-Za-zÁÉÍÓÚÑáéíóúñ]+/g,
      (w) => MESES_CORTOS[w.toLowerCase()] ?? w
    )
    .trim()
}

export function Destinos() {
  const destacados = DESTACADOS.flatMap(([slug, escena, region]) => {
    const d = getDestino(slug)
    // El kicker es el país; si el destino ya es el país, su región.
    return d
      ? [{ d, escena, kicker: d.pais === d.nombre ? region : d.pais }]
      : []
  })
  const todos = [...DESTINOS].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es')
  )
  return (
    <section
      id="destinos"
      aria-labelledby="destinos-titulo"
      className={cn(SECCION, 'scroll-mt-16')}
    >
      <div className={CONTENEDOR}>
        <p className="kicker kicker-filete">Destinos</p>
        <h2 id="destinos-titulo" className="mt-4 font-display text-h2 text-fg">
          Destinos para empezar
        </h2>

        <ul className="-mx-4 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pt-5 pb-3 md:mx-0 md:grid md:grid-cols-2 md:gap-6 md:overflow-visible md:px-0 lg:grid-cols-4">
          {destacados.map(({ d, escena, kicker }) => (
            <li key={d.slug} className="w-[78%] shrink-0 snap-start md:w-auto">
              <Link
                href={`/viaje/${d.slug}`}
                className="group block h-full rounded-card"
              >
                <Postal
                  semilla={d.slug}
                  escena={escena}
                  proporcion="4:3"
                  kicker={kicker}
                  titulo={d.nombre}
                  tituloClassName="text-[22px] group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4"
                  como="div"
                  className="h-full transition-transform duration-(--dur-base) ease-papel group-hover:-translate-y-0.5"
                >
                  <span className="tnum">
                    {d.diasRecomendados} días · Mejor época:{' '}
                    {epocaCorta(d.mejorEpoca)}
                  </span>
                </Postal>
              </Link>
            </li>
          ))}
        </ul>

        <details className="group mt-8">
          <summary
            className={cn(
              buttonClasses({ variant: 'link' }),
              'cursor-pointer list-none text-[15px] [&::-webkit-details-marker]:hidden'
            )}
          >
            <span className="group-open:hidden">
              Ver los {DESTINOS.length} destinos
            </span>
            <span className="hidden group-open:inline">Ocultar destinos</span>
          </summary>
          <ul className="mt-6 columns-2 gap-x-6 text-body-s sm:columns-3 lg:columns-4">
            {todos.map((d) => (
              <li key={d.slug} className="break-inside-avoid">
                <Link
                  href={`/viaje/${d.slug}`}
                  className="flex min-h-10 items-center rounded-sm text-fg-muted hover:text-fg hover:underline hover:underline-offset-[3px]"
                >
                  {d.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </section>
  )
}

// ─── 7 · Viaja en grupo ────────────────────────────────────────────────────

const PUNTOS_GRUPO: readonly {
  titulo: string
  texto: string
  icono: ReactNode
}[] = [
  {
    titulo: 'Un chat por viaje',
    texto: 'Todos ven el mismo itinerario y comentan cada plan en su sitio.',
    icono: <MessagesSquare />,
  },
  {
    titulo: 'Votaciones',
    texto: '¿Los Haitises o Cayo Levantado? Se vota y gana la mayoría.',
    icono: <Vote />,
  },
  {
    titulo: 'Gastos compartidos',
    texto: 'Anoten quién pagó qué y Wayio hace las cuentas por ustedes.',
    icono: <Wallet />,
  },
]

const MIEMBROS = [
  { name: 'Ana Pérez', index: 0 },
  { name: 'Luis Gómez', index: 3 },
  { name: 'Carla Rosario', index: 6 },
  { name: 'José Martínez', index: 8 },
] as const

export function ViajaEnGrupo() {
  return (
    <section
      id="grupo"
      aria-labelledby="grupo-titulo"
      className={cn(SECCION, 'scroll-mt-16 border-t border-border')}
    >
      <div
        className={cn(CONTENEDOR, 'grid items-center gap-12 lg:grid-cols-12')}
      >
        <div className="lg:col-span-6">
          <p className="kicker kicker-filete">Viaja en grupo</p>
          <h2 id="grupo-titulo" className="mt-4 font-display text-h2 text-fg">
            Un mismo viaje, todos en la misma página
          </h2>
          <p className="mt-4 max-w-[52ch] text-lead text-fg-muted">
            Comparte el enlace del grupo y decidan juntos sin perder el hilo en
            el chat de siempre.
          </p>
          <ul className="mt-8 flex flex-col gap-6">
            {PUNTOS_GRUPO.map((p) => (
              <li key={p.titulo} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-fg [&_svg]:size-5 [&_svg]:stroke-[1.75]"
                >
                  {p.icono}
                </span>
                <div>
                  <h3 className="text-title text-fg">{p.titulo}</h3>
                  <p className="mt-1 text-body-s text-fg-muted">{p.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Maqueta estática de la sala del grupo */}
        <figure className="lg:col-span-6">
          <div className="rounded-sheet border border-border bg-surface p-5 shadow-elev md:p-6">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <p className="text-title text-fg">Samaná con los panas</p>
                <p className="text-caption text-fg-muted">
                  4 viajeros · 12–16 dic
                </p>
              </div>
              <AvatarStack people={MIEMBROS} size="sm" />
            </div>

            <div className="mt-4 flex flex-col gap-2.5 text-body-s">
              <div className="max-w-[80%] self-start rounded-card rounded-bl-stamp bg-surface-2 px-3.5 py-2.5 text-fg">
                <p className="text-caption font-semibold text-fg-muted">Ana</p>
                ¿Mañana vamos a Los Haitises o a Cayo Levantado?
              </div>
              <div className="max-w-[80%] self-end rounded-card rounded-br-stamp bg-surface-inverse px-3.5 py-2.5 text-fg-inverse">
                Yo voto por Los Haitises en lancha.
              </div>
            </div>

            <div className="mt-5 rounded-control border border-border p-4">
              <p className="text-label text-fg">Los Haitises en lancha</p>
              <div className="mt-3 flex flex-col gap-2 text-caption">
                <div className="flex items-center gap-3">
                  <span className="w-6 shrink-0 font-semibold text-fg">Sí</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <span className="block h-full w-3/4 rounded-full bg-mar-700 dark:bg-mar-300" />
                  </span>
                  <span className="w-10 shrink-0 text-right text-fg tnum">
                    75 %
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 shrink-0 font-semibold text-fg">No</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <span className="block h-full w-1/4 rounded-full bg-fg-subtle" />
                  </span>
                  <span className="w-10 shrink-0 text-right text-fg tnum">
                    25 %
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <p className="kicker">Gastos del grupo</p>
              <ul className="mt-2 text-body-s">
                <li className="flex justify-between gap-3 border-b border-border py-2">
                  <span className="text-fg">Lancha · pagó Ana</span>
                  <span className="text-fg tnum">
                    {formatCurrency(120, 'USD')}
                  </span>
                </li>
                <li className="flex justify-between gap-3 border-b border-border py-2">
                  <span className="text-fg">Cena · pagó Luis</span>
                  <span className="text-fg tnum">
                    {formatCurrency(86, 'USD')}
                  </span>
                </li>
              </ul>
              <p className="mt-3 text-body-s font-medium text-success-fg tnum">
                A ti te deben {formatCurrency(52, 'USD')}
              </p>
            </div>
          </div>
          <figcaption className="mt-4 text-caption text-fg-muted">
            Así se ve la sala de un grupo (ejemplo)
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

// ─── 8 · Banda final ───────────────────────────────────────────────────────

export function BandaFinal() {
  return (
    <section
      aria-labelledby="banda-titulo"
      className="px-4 pb-[72px] md:pb-24 lg:px-8 lg:pb-32"
    >
      <div className="mx-auto max-w-content rounded-sheet bg-primary px-6 py-16 text-center text-primary-fg [&_:focus-visible]:outline-primary-fg">
        <h2 id="banda-titulo" className="font-display text-display-l">
          ¿A dónde vamos?
        </h2>
        <p className="mx-auto mt-4 max-w-[44ch] text-lead">
          Cuéntanos tu idea y te trazamos tres versiones para elegir.
        </p>
        <ButtonLink
          href="/planificar"
          variant="ghost"
          size="xl"
          iconEnd={<ArrowRight />}
          className="mt-8 bg-bg text-primary-text hover:bg-papel-50 focus-visible:outline-primary-fg dark:bg-noche-950 dark:hover:bg-noche-900"
        >
          Trazar mi viaje
        </ButtonLink>
      </div>
    </section>
  )
}
