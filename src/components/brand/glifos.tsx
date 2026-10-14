import type { ReactNode, SVGProps } from 'react'
import { ISOTIPO, SELLO_TEXTO } from './marks'
import { azar, n2 } from './semilla'

/**
 * Piezas SVG compartidas por Logo, Sello, Postal e ilustraciones. Son
 * fragmentos puros (sin hooks): quien los usa pasa ids únicos (useId).
 */

/** Isotipo en coordenadas locales 0..64. El aro es hueco gracias a `mask`. */
export function IsotipoGlifo({
  maskId,
  punto = 'currentColor',
}: {
  maskId: string
  punto?: string
}) {
  const { ring, dot } = ISOTIPO
  return (
    <>
      <defs>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="64"
          height="64"
        >
          <rect width="64" height="64" fill="#fff" />
          <circle cx={ring.cx} cy={ring.cy} r={ring.hole} fill="#000" />
        </mask>
      </defs>
      <g
        mask={`url(#${maskId})`}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={ISOTIPO.route} strokeWidth={ISOTIPO.stroke} />
        <circle
          cx={ring.cx}
          cy={ring.cy}
          r={ring.r}
          strokeWidth={ring.stroke}
        />
      </g>
      <circle cx={dot.cx} cy={dot.cy} r={dot.r} fill={punto} />
    </>
  )
}

/** Circunferencia útil del arco del sello (r = 46): 2πr ≈ 289. */
const LARGO_ARCO = 286
/** Caracteres del texto de marca (referencia de cuerpo 8,6). */
const CARACTERES_BASE = SELLO_TEXTO.length

/**
 * Normaliza el texto del anillo: mayúsculas, termina en « ·» y se repite
 * para llenar la circunferencia sin estirar demasiado el espaciado.
 */
export function textoDeAnillo(texto: string) {
  const base = texto
    .trim()
    .toUpperCase()
    .replace(/\s*·\s*$/, '')
  const pieza = `${base} ·`
  const reps = Math.max(1, Math.round(CARACTERES_BASE / (pieza.length + 1)))
  const anillo = Array.from({ length: reps }, () => pieza).join(' ')
  const cuerpo = Math.min(
    9.2,
    Math.max(6.4, (8.6 * CARACTERES_BASE) / anillo.length)
  )
  return { anillo, cuerpo: n2(cuerpo) }
}

/** Motas de desgaste de tinta, deterministas por texto (solo ≥96 px). */
function Motas({ semilla }: { semilla: string }) {
  const a = azar(`sello|${semilla}`)
  const motas = Array.from({ length: 74 }, () => {
    const ang = a.entre(0, Math.PI * 2)
    const rho = a.r() < 0.7 ? a.entre(40, 59) : a.entre(6, 40)
    return {
      cx: n2(60 + rho * Math.cos(ang)),
      cy: n2(60 + rho * Math.sin(ang)),
      r: n2(a.entre(0.25, 0.95)),
      o: n2(a.entre(0.45, 1)),
    }
  })
  // Zonas de poca presión: manchas grandes y muy tenues.
  const manchas = Array.from({ length: 4 }, () => ({
    cx: n2(a.entre(20, 100)),
    cy: n2(a.entre(20, 100)),
    r: n2(a.entre(6, 14)),
    o: n2(a.entre(0.08, 0.16)),
  }))
  // Rayas finas, como un sello de goma con uso.
  const rayas = Array.from({ length: 3 }, () => {
    const x = a.entre(14, 96)
    const y = a.entre(14, 96)
    const ang = a.entre(-0.6, 0.6)
    const l = a.entre(10, 22)
    return {
      d: `M${n2(x)} ${n2(y)} l${n2(l * Math.cos(ang))} ${n2(l * Math.sin(ang))}`,
      o: n2(a.entre(0.35, 0.6)),
    }
  })
  return (
    <>
      {manchas.map((m, i) => (
        <circle
          key={`m${i}`}
          cx={m.cx}
          cy={m.cy}
          r={m.r}
          fill="#000"
          fillOpacity={m.o}
        />
      ))}
      {motas.map((m, i) => (
        <circle
          key={i}
          cx={m.cx}
          cy={m.cy}
          r={m.r}
          fill="#000"
          fillOpacity={m.o}
        />
      ))}
      {rayas.map((r, i) => (
        <path
          key={`r${i}`}
          d={r.d}
          stroke="#000"
          strokeOpacity={r.o}
          strokeWidth="0.6"
          strokeLinecap="round"
        />
      ))}
    </>
  )
}

export interface SelloSvgProps extends Omit<
  SVGProps<SVGSVGElement>,
  'children' | 'viewBox'
> {
  /** Prefijo único para ids internos (useId). */
  idBase: string
  /** Texto del anillo. Por defecto el de marca. */
  texto?: string
  /** Símbolo central. */
  centro?: 'isotipo' | 'pregunta'
  /** Desgaste de tinta (usar a partir de 96 px). */
  textura?: boolean
  /** Contenido extra dentro del SVG (raro). */
  extra?: ReactNode
}

/** Sello circular de un solo color (currentColor). §8.3 */
export function SelloSvg({
  idBase,
  texto = SELLO_TEXTO,
  centro = 'isotipo',
  textura = false,
  extra,
  ...svg
}: SelloSvgProps) {
  const arcoId = `${idBase}-arco`
  const texId = `${idBase}-tex`
  const isoId = `${idBase}-iso`
  const { anillo, cuerpo } = textoDeAnillo(texto)
  return (
    <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" {...svg}>
      <defs>
        <path id={arcoId} d="M60 14 a46 46 0 1 1 -0.01 0" />
        {textura ? (
          <mask
            id={texId}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="120"
            height="120"
          >
            <rect width="120" height="120" fill="#fff" />
            <Motas semilla={texto} />
          </mask>
        ) : null}
      </defs>
      <g mask={textura ? `url(#${texId})` : undefined}>
        <circle
          cx="60"
          cy="60"
          r="57"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <circle
          cx="60"
          cy="60"
          r="42"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
        <text
          fill="currentColor"
          style={{
            font: `600 ${cuerpo}px var(--font-sans, ui-sans-serif, system-ui, sans-serif)`,
            fontStretch: '85%',
          }}
        >
          <textPath
            href={`#${arcoId}`}
            textLength={LARGO_ARCO}
            lengthAdjust="spacing"
          >
            {anillo}
          </textPath>
        </text>
        {centro === 'isotipo' ? (
          <svg x="34.7" y="34.2" width="51.2" height="51.2" viewBox="0 0 64 64">
            <IsotipoGlifo maskId={isoId} />
          </svg>
        ) : (
          <text
            x="60"
            y="61"
            textAnchor="middle"
            dominantBaseline="central"
            fill="currentColor"
            style={{
              font: 'italic 500 50px var(--font-display, Georgia, serif)',
            }}
          >
            ?
          </text>
        )}
        {extra}
      </g>
    </svg>
  )
}
