import { ImageResponse } from 'next/og'
import { textoDeAnillo } from './glifos'
import { BRAND, ISOTIPO, SELLO_TEXTO, WORDMARK, WORDMARK_PATHS } from './marks'

/**
 * Piezas de marca para imágenes generadas con `next/og` (satori): OG global,
 * OG por destino (/viaje/[destino]) y de viaje compartido. Solo servidor.
 *
 * - fuentesOg(): Newsreader, Instrument Sans y Geist Mono desde Google Fonts,
 *   subconjunto con `text=` y tiempo límite. Si falla una, se omite y satori
 *   usa la fuente por defecto de next/og: la imagen se genera igual.
 * - WordmarkOg, ReticulaOg: trazos con los paths exactos de marks.ts.
 * - selloOgDataUri(): el sello circular rasterizado aparte (ver nota).
 *
 * Nota: satori desplaza los glifos girados cuando el elemento queda lejos
 * del (0,0) del lienzo, así que el anillo de texto del sello se dibuja en su
 * propio ImageResponse (en el origen y a 2×) y se inserta como <img>.
 */

export type PesoOg = 400 | 500 | 600
export interface FuenteOg {
  name: string
  data: ArrayBuffer
  weight: PesoOg
  style: 'normal' | 'italic'
}

/** Descarga una fuente estática de Google Fonts (TTF) para satori. */
export async function fuenteGoogle(
  familia: string,
  eje: string,
  texto: string,
  nombre: string,
  weight: PesoOg,
  style: 'normal' | 'italic' = 'normal'
): Promise<FuenteOg | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${familia}:${eje}&text=${encodeURIComponent(texto)}`
    const css = await fetch(url, { signal: AbortSignal.timeout(4000) }).then(
      (r) => (r.ok ? r.text() : '')
    )
    const src = css.match(
      /src: url\((.+?)\) format\('(opentype|truetype)'\)/
    )?.[1]
    if (!src) return null
    const res = await fetch(src, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return null
    return { name: nombre, data: await res.arrayBuffer(), weight, style }
  } catch {
    return null
  }
}

/**
 * Las tres familias del sistema, cada una subconjuntada con el texto que va
 * a dibujar. Nombres de familia para `fontFamily`: 'Newsreader',
 * 'Instrument Sans' y 'Geist Mono'.
 */
export async function fuentesOg(textos: {
  serif?: string
  serifItalica?: string
  sans?: string
  mono?: string
}) {
  const [serif, serifItalica, sans, mono] = await Promise.all([
    textos.serif
      ? fuenteGoogle('Newsreader', 'wght@500', textos.serif, 'Newsreader', 500)
      : null,
    textos.serifItalica
      ? fuenteGoogle(
          'Newsreader',
          'ital,wght@1,500',
          textos.serifItalica,
          'Newsreader',
          500,
          'italic'
        )
      : null,
    // El texto del sello siempre va incluido en la sans; el anillo se dibuja
    // en mayúsculas, así que también se piden las mayúsculas de `sans`.
    fuenteGoogle(
      'Instrument+Sans',
      'wght@600',
      `${textos.sans ?? ''}${(textos.sans ?? '').toUpperCase()}${SELLO_TEXTO}`,
      'Instrument Sans',
      600
    ),
    textos.mono
      ? fuenteGoogle('Geist+Mono', 'wght@500', textos.mono, 'Geist Mono', 500)
      : null,
  ])
  const fonts = [serif, serifItalica, sans, mono].filter(
    (f): f is FuenteOg => f !== null
  )
  return { fonts, sans }
}

/**
 * Opciones de fuentes para `new ImageResponse(…, { ...opcionesFuentes(fonts) })`.
 * OJO: next/og solo usa su fuente por defecto si `fonts` NO se pasa; con
 * `fonts: []` satori lanza «No fonts are loaded» y la imagen da 500 (p. ej.
 * en un build sin red). Por eso, sin fuentes cargadas, se omite la opción.
 */
export function opcionesFuentes(fonts: readonly FuenteOg[]): {
  fonts?: FuenteOg[]
} {
  return fonts.length > 0 ? { fonts: [...fonts] } : {}
}

/** Wordmark con los paths exactos (color: tinta + punto rosa). */
export function WordmarkOg({
  ancho,
  tinta = BRAND.tinta,
  punto = BRAND.rosa,
}: {
  ancho: number
  tinta?: string
  punto?: string
}) {
  return (
    <svg width={ancho} height={(ancho * 62) / 156} viewBox={WORDMARK.viewBox}>
      <g
        fill="none"
        stroke={tinta}
        strokeWidth={WORDMARK.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {WORDMARK_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <circle
        cx={WORDMARK.dot.cx}
        cy={WORDMARK.dot.cy}
        r={WORDMARK.dot.r}
        fill={punto}
      />
    </svg>
  )
}

/** Retícula de carta náutica a lienzo completo (posición absoluta). */
export function ReticulaOg({
  ancho = 1200,
  alto = 630,
  color = BRAND.regla,
}: {
  ancho?: number
  alto?: number
  color?: string
}) {
  const x = (f: number) => ancho * f
  const y = (f: number) => alto * f
  return (
    <svg
      width={ancho}
      height={alto}
      viewBox={`0 0 ${ancho} ${alto}`}
      style={{ position: 'absolute', left: 0, top: 0 }}
    >
      <defs>
        <radialGradient id="wy-og-fade" cx="0.42" cy="0.45" r="0.75">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="wy-og-mask">
          <rect width={ancho} height={alto} fill="url(#wy-og-fade)" />
        </mask>
      </defs>
      <g
        mask="url(#wy-og-mask)"
        fill="none"
        stroke={color}
        strokeWidth="1.25"
        opacity="0.7"
      >
        <path d={`M${x(1 / 6)} 0 Q${x(0.117)} ${y(0.5)} ${x(1 / 6)} ${alto}`} />
        <path d={`M${x(1 / 3)} 0 Q${x(0.308)} ${y(0.5)} ${x(1 / 3)} ${alto}`} />
        <path d={`M${x(0.5)} 0 V${alto}`} />
        <path d={`M${x(2 / 3)} 0 Q${x(0.692)} ${y(0.5)} ${x(2 / 3)} ${alto}`} />
        <path d={`M${x(5 / 6)} 0 Q${x(0.883)} ${y(0.5)} ${x(5 / 6)} ${alto}`} />
        <path d={`M0 ${y(0.25)} Q${x(0.5)} ${y(0.203)} ${ancho} ${y(0.25)}`} />
        <path d={`M0 ${y(0.5)} Q${x(0.5)} ${y(0.468)} ${ancho} ${y(0.5)}`} />
        <path d={`M0 ${y(0.75)} Q${x(0.5)} ${y(0.733)} ${ancho} ${y(0.75)}`} />
      </g>
    </svg>
  )
}

// Avances aproximados (em) de Instrument Sans 600 en mayúsculas.
const AVANCE: Record<string, number> = {
  W: 0.9,
  M: 0.8,
  A: 0.64,
  V: 0.62,
  Y: 0.6,
  O: 0.72,
  C: 0.64,
  N: 0.7,
  E: 0.54,
  L: 0.5,
  T: 0.56,
  Z: 0.58,
  R: 0.6,
  U: 0.68,
  J: 0.46,
  I: 0.28,
  ' ': 0.26,
  '·': 0.3,
}

/**
 * Ángulo (grados desde las 12, en sentido horario) del centro de cada
 * carácter, como lo haría <textPath textLength=286 lengthAdjust="spacing">
 * sobre el arco de r = 46 del sello web.
 */
function angulosDelAnillo(chars: string[], cuerpo: number) {
  const av = chars.map((c) => (AVANCE[c] ?? 0.6) * cuerpo)
  const extra = (286 - av.reduce((s, a) => s + a, 0)) / chars.length
  const circ = 2 * Math.PI * 46
  let s = 0
  return av.map((a) => {
    const centro = s + a / 2
    s += a + extra
    return (centro / circ) * 360
  })
}

/** Sello circular para satori (texto del anillo carácter a carácter). */
export function SelloOg({
  lado,
  color,
  texto = SELLO_TEXTO,
  giro = -8,
}: {
  lado: number
  color: string
  texto?: string
  giro?: number
}) {
  const k = lado / 120
  const { anillo, cuerpo: cuerpoBase } = textoDeAnillo(texto)
  const chars = Array.from(anillo)
  const angulos = angulosDelAnillo(chars, cuerpoBase)
  const cuerpo = cuerpoBase * k
  const radioTexto = 49 * k
  const caja = cuerpo * 1.3
  const { ring, dot } = ISOTIPO
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        width: lado,
        height: lado,
      }}
    >
      <svg
        width={lado}
        height={lado}
        viewBox="0 0 120 120"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `rotate(${giro}deg)`,
        }}
      >
        <circle
          cx="60"
          cy="60"
          r="57"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
        />
        <circle
          cx="60"
          cy="60"
          r="42"
          fill="none"
          stroke={color}
          strokeWidth="1"
        />
        {/* Isotipo (51,2 / 64 = 0,8); sin <svg> anidado, que satori duplica */}
        <defs>
          <mask
            id="wy-og-hueco"
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
        <g transform="translate(34.7 34.2) scale(0.8)">
          <g
            mask="url(#wy-og-hueco)"
            fill="none"
            stroke={color}
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
          <circle cx={dot.cx} cy={dot.cy} r={dot.r} fill={color} />
        </g>
      </svg>
      {chars.map((c, i) =>
        c === ' ' ? null : (
          // Caja del tamaño del sello girada sobre su centro: el carácter va
          // arriba, centrado, a la altura del arco del texto.
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: lado,
              height: lado,
              display: 'flex',
              justifyContent: 'center',
              transform: `rotate(${(giro + (angulos[i] ?? 0)).toFixed(2)}deg)`,
            }}
          >
            <div
              style={{
                display: 'flex',
                marginTop: lado / 2 - radioTexto - caja / 2,
                fontFamily: 'Instrument Sans',
                fontWeight: 600,
                fontSize: cuerpo,
                color,
              }}
            >
              {c}
            </div>
          </div>
        )
      )}
    </div>
  )
}

/**
 * Rasteriza el sello en su propio lienzo (2×, transparente) y devuelve un
 * data URI para usarlo con <img width={lado} height={lado} />.
 */
export async function selloOgDataUri({
  lado,
  color = BRAND.latonTexto,
  texto,
  sans,
}: {
  lado: number
  color?: string
  texto?: string
  /** La Instrument Sans de fuentesOg() (si se pudo cargar). */
  sans?: FuenteOg | null
}) {
  const png = await new ImageResponse(
    <SelloOg
      lado={lado * 2}
      color={color}
      {...(texto !== undefined && { texto })}
    />,
    {
      width: lado * 2,
      height: lado * 2,
      ...opcionesFuentes(sans ? [sans] : []),
    }
  ).arrayBuffer()
  return `data:image/png;base64,${Buffer.from(png).toString('base64')}`
}
