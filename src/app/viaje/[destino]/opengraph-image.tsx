import { ImageResponse } from 'next/og'
import { BRAND } from '@/components/brand/marks'
import {
  ReticulaOg,
  WordmarkOg,
  fuentesOg,
  opcionesFuentes,
  selloOgDataUri,
} from '@/components/brand/og'
import { getDestino } from '@/lib/seo/destinos'
import { getFicha } from '@/lib/seo/fichas'
import { formatCoordenadas, formatDias } from '@/lib/utils/formatters'

/**
 * Imagen social de cada destino (docs/DISENO.md §6.10): póster de papel con
 * el destino en Newsreader itálica, el país y sus coordenadas, los días
 * recomendados, el sello de latón con el nombre en el anillo y el wordmark.
 * Sustituye a las fotos /destinos/*.jpg que no existían.
 */

export const alt = 'Wayio · Itinerario de viaje con IA'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const PIE = 'PLANIFICA GRATIS CON IA'

export default async function Image({
  params,
}: {
  params: Promise<{ destino: string }>
}) {
  const { destino: slug } = await params
  const destino = getDestino(slug)
  const ficha = getFicha(slug)

  const nombre = destino?.nombre ?? 'tu próximo destino'
  const pais = (destino?.pais ?? 'Wayio').toUpperCase()
  const coords = ficha ? formatCoordenadas(ficha.lat, ficha.lng) : ''
  const dias = destino
    ? `${formatDias(destino.diasRecomendados)} recomendados`
    : 'Tu viaje, trazado día a día'
  const textoSello = destino
    ? destino.pais === destino.nombre
      ? destino.nombre
      : `${destino.nombre} · ${destino.pais}`
    : undefined

  // Cuerpo del nombre según su largo (cabe a la izquierda del sello).
  const cuerpo = Math.round(Math.min(112, 700 / (nombre.length * 0.47)))

  const { fonts, sans } = await fuentesOg({
    serif: 'Viaje a',
    serifItalica: nombre,
    sans: `${pais}${dias}${PIE}${(textoSello ?? '').toUpperCase()}·`,
    ...(coords ? { mono: coords } : {}),
  })
  const ladoSello = 240
  const selloSrc = await selloOgDataUri({
    lado: ladoSello,
    sans,
    ...(textoSello ? { texto: textoSello } : {}),
  })

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

      {/* Kicker: país y coordenadas */}
      <div
        style={{
          position: 'absolute',
          left: 88,
          top: 88,
          display: 'flex',
          alignItems: 'center',
          fontSize: 18,
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
        <span>{pais}</span>
        {coords ? (
          <span
            style={{
              marginLeft: 16,
              fontFamily: 'Geist Mono',
              fontWeight: 500,
              letterSpacing: 0.8,
              color: BRAND.fgSubtle,
            }}
          >
            {coords}
          </span>
        ) : null}
      </div>

      {/* Titular */}
      <div
        style={{
          position: 'absolute',
          left: 84,
          top: 150,
          width: 760,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <span
          style={{
            fontFamily: 'Newsreader',
            fontWeight: 500,
            fontSize: 52,
            letterSpacing: -0.8,
          }}
        >
          Viaje a
        </span>
        <span
          style={{
            fontFamily: 'Newsreader',
            fontStyle: 'italic',
            fontWeight: 500,
            fontSize: cuerpo,
            lineHeight: 1.02,
            letterSpacing: -1.5,
            marginTop: 4,
          }}
        >
          {nombre}
        </span>
        <span
          style={{
            marginTop: 26,
            fontSize: 24,
            fontWeight: 600,
            color: BRAND.fgMuted,
          }}
        >
          {dias}
        </span>
      </div>

      {/* Sello de latón con el destino */}
      <div
        style={{ position: 'absolute', right: 96, top: 92, display: 'flex' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- satori solo entiende <img> */}
        <img src={selloSrc} width={ladoSello} height={ladoSello} alt="" />
      </div>

      {/* Pie: wordmark y llamada */}
      <div
        style={{
          position: 'absolute',
          left: 84,
          right: 88,
          bottom: 66,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <WordmarkOg ancho={170} />
        <span
          style={{
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: 2.4,
            color: BRAND.fgSubtle,
          }}
        >
          {PIE}
        </span>
      </div>
    </div>,
    // Sin red no hay fuentes: con `fonts: []` satori daría 500.
    { ...size, ...opcionesFuentes(fonts) }
  )
}
