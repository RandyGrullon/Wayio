import { ImageResponse } from 'next/og'
import { BRAND } from '@/components/brand/marks'
import {
  ReticulaOg,
  WordmarkOg,
  fuentesOg,
  opcionesFuentes,
  selloOgDataUri,
} from '@/components/brand/og'
import { coordenadasDelViaje } from '@/components/trip/tripUtils'
import {
  formatCoordenadas,
  formatDias,
  formatRangoFechas,
  formatViajeros,
} from '@/lib/utils/formatters'
import { obtenerCompartido } from './_lib/compartido'

/**
 * Imagen OG de un viaje compartido (docs/DISENO.md §6.7): póster de papel con
 * el destino en Newsreader itálica, las fechas, el sello de latón con el
 * destino en el anillo y el wordmark. Pensada para WhatsApp. Si el viaje no
 * existe o no es público, sale un póster genérico (sin datos del viaje).
 */

export const alt = 'Plan de viaje compartido en Wayio'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const KICKER = 'PLAN DE VIAJE COMPARTIDO'
const PIE = 'TRAZADO CON WAYIO'

function cuerpoDestino(texto: string): number {
  const n = texto.length
  if (n <= 10) return 132
  if (n <= 16) return 108
  if (n <= 24) return 84
  return 64
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const r = await obtenerCompartido(id)
  const ok = r.estado === 'ok'
  const destino = ok ? r.destino.slice(0, 40) : 'Un viaje por descubrir'
  const linea = ok
    ? [
        formatRangoFechas(r.fechaInicio, r.fechaFin),
        formatDias(r.trip.dias.length),
        formatViajeros(r.trip.personas),
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Itinerarios día a día, trazados con IA'
  const coordsViaje = ok ? coordenadasDelViaje(r.trip) : null
  const coords = coordsViaje
    ? formatCoordenadas(coordsViaje.lat, coordsViaje.lng)
    : ''
  const textoSello = ok ? `${destino.toUpperCase()} · WAYIO` : undefined

  const { fonts, sans } = await fuentesOg({
    serifItalica: destino,
    sans: `${KICKER}${PIE}${linea}${textoSello ?? ''}`,
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
        <div
          style={{
            display: 'flex',
            fontFamily: 'Newsreader',
            fontStyle: 'italic',
            fontWeight: 500,
            fontSize: cuerpoDestino(destino),
            lineHeight: 1.02,
            letterSpacing: -1.5,
            color: BRAND.tinta,
          }}
        >
          {destino}
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 28,
            fontSize: 32,
            fontWeight: 600,
            color: BRAND.fgMuted,
          }}
        >
          {linea}
        </div>
      </div>

      <div
        style={{ position: 'absolute', right: 96, top: 92, display: 'flex' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- satori solo entiende <img> */}
        <img src={selloSrc} width={ladoSello} height={ladoSello} alt="" />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 88,
          right: 88,
          bottom: 70,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <WordmarkOg ancho={220} />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            fontSize: 17,
            color: BRAND.fgSubtle,
          }}
        >
          {coords ? (
            <span
              style={{
                fontFamily: 'Geist Mono',
                fontWeight: 500,
                letterSpacing: 1.2,
                marginBottom: 8,
              }}
            >
              {coords}
            </span>
          ) : null}
          <span style={{ fontWeight: 600, letterSpacing: 2.4 }}>{PIE}</span>
        </div>
      </div>
    </div>,
    // Sin red no hay fuentes: con `fonts: []` satori daría 500.
    { ...size, ...opcionesFuentes(fonts) }
  )
}
