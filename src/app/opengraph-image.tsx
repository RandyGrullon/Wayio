import { ImageResponse } from 'next/og'
import { BRAND, COORDS_SDQ } from '@/components/brand/marks'
import {
  ReticulaOg,
  WordmarkOg,
  fuentesOg,
  opcionesFuentes,
  selloOgDataUri,
} from '@/components/brand/og'

/**
 * Imagen OG global (docs/DISENO.md §5.5, §8): póster de papel con el wordmark
 * dibujado con los paths de marks.ts, el tagline y el sello circular de
 * latón (el único punto magenta es el de la i).
 *
 * Las fuentes se piden a Google Fonts con tiempo límite; si fallan, la imagen
 * sale igual con la fuente por defecto de next/og (el wordmark y el sello
 * son trazos).
 */

export const alt = 'Wayio · Traza tu viaje · Vive el camino'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const KICKER = 'PLANIFICADOR DE VIAJES CON IA'
const PIE = 'HECHO EN REPÚBLICA DOMINICANA'
const TAG_A = 'Traza tu viaje'
const TAG_B = 'Vive el camino'

export default async function Image() {
  const { fonts, sans } = await fuentesOg({
    serif: `${TAG_A}·`,
    serifItalica: TAG_B,
    sans: `${KICKER}${PIE}`,
    mono: COORDS_SDQ,
  })
  const ladoSello = 260
  const selloSrc = await selloOgDataUri({ lado: ladoSello, sans })

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        background: BRAND.papel,
        color: BRAND.tinta,
        fontFamily: 'Instrument Sans',
      }}
    >
      <ReticulaOg />

      {/* Filete de póster */}
      <div
        style={{
          position: 'absolute',
          left: 32,
          top: 32,
          right: 32,
          bottom: 32,
          border: `1.5px solid ${BRAND.filete}`,
          borderRadius: 24,
          display: 'flex',
        }}
      />

      {/* Kicker con filete de latón */}
      <div
        style={{
          position: 'absolute',
          left: 88,
          top: 84,
          display: 'flex',
          alignItems: 'center',
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: 2.4,
          color: BRAND.fgMuted,
        }}
      >
        <div
          style={{
            width: 36,
            height: 2,
            background: BRAND.laton,
            marginRight: 16,
            display: 'flex',
          }}
        />
        {KICKER}
      </div>

      {/* Wordmark y tagline */}
      <div
        style={{
          position: 'absolute',
          left: 82,
          top: 168,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <WordmarkOg ancho={560} />
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            marginTop: 34,
            marginLeft: 8,
            fontFamily: 'Newsreader',
            fontWeight: 500,
            fontSize: 50,
            letterSpacing: -0.8,
            color: BRAND.tinta,
          }}
        >
          <span>{TAG_A}</span>
          <span style={{ margin: '0 18px', color: BRAND.laton }}>·</span>
          <span style={{ fontStyle: 'italic' }}>{TAG_B}</span>
        </div>
      </div>

      {/* Sello de latón */}
      <div
        style={{ position: 'absolute', right: 96, top: 96, display: 'flex' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- satori solo entiende <img> */}
        <img src={selloSrc} width={ladoSello} height={ladoSello} alt="" />
      </div>

      {/* Pie: coordenadas y origen */}
      <div
        style={{
          position: 'absolute',
          left: 88,
          right: 88,
          bottom: 70,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 17,
          color: BRAND.fgSubtle,
        }}
      >
        <span
          style={{
            fontFamily: 'Geist Mono',
            fontWeight: 500,
            letterSpacing: 1.2,
          }}
        >
          {COORDS_SDQ}
        </span>
        <span style={{ fontWeight: 600, letterSpacing: 2.4 }}>{PIE}</span>
      </div>
    </div>,
    { ...size, ...opcionesFuentes(fonts) }
  )
}
