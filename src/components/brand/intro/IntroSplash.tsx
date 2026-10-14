import { COORDS_SDQ, TAGLINE, WORDMARK } from '../marks'
import { buildIntroKeyframes } from './keyframes'
import { AROS, INTRO, TRAZOS } from './timeline'
import './intro.css'

/**
 * Overlay de la intro «La ruta llega» (docs/DISENO.md §9.3 y §9.7).
 *
 * Server Component: el overlay y su <style> con los keyframes generados van
 * en el SSR y arrancan con el primer paint, sin esperar a la hidratación.
 * Solo se ve si el bootScript del <head> puso html[data-intro="play"]; en
 * cualquier otro caso es `display: none`.
 *
 * Accesibilidad: aria-hidden y sin ningún elemento enfocable. El H1 real de
 * la landing, pintado debajo, es el contenido semántico.
 */

// Una sola vez por proceso: la línea de tiempo no cambia entre peticiones.
const { css, trailDots } = buildIntroKeyframes()

const MERIDIANOS = [
  'M180 0 Q120 300 180 600',
  'M340 0 Q310 300 340 600',
  'M500 0 V600',
  'M660 0 Q690 300 660 600',
  'M820 0 Q880 300 820 600',
]
const PARALELOS = [
  'M0 150 Q500 120 1000 150',
  'M0 300 Q500 280 1000 300',
  'M0 450 Q500 440 1000 450',
]

export function IntroSplash() {
  const { paths, dot } = WORDMARK
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="wy-intro" aria-hidden="true">
        <div className="wy-intro__paper" data-wy-intro-paper="" />

        {/* Retícula: 5 meridianos curvos y 3 paralelos con máscara radial */}
        <svg
          className="wy-intro__grid"
          data-wy-intro-decor=""
          viewBox="0 0 1000 600"
          preserveAspectRatio="xMidYMid slice"
          focusable="false"
        >
          <defs>
            <radialGradient id="wy-intro-fade">
              <stop offset="0" stopColor="#fff" />
              <stop offset="0.55" stopColor="#fff" stopOpacity="0.6" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <mask id="wy-intro-mask">
              <rect width="1000" height="600" fill="url(#wy-intro-fade)" />
            </mask>
          </defs>
          <g className="wy-intro__grid-in">
            <g
              mask="url(#wy-intro-mask)"
              fill="none"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            >
              {MERIDIANOS.concat(PARALELOS).map((d) => (
                <path key={d} d={d} vectorEffect="non-scaling-stroke" />
              ))}
            </g>
          </g>
        </svg>

        <div className="wy-intro__stage">
          <div data-wy-intro-mark="">
            <svg
              viewBox={WORDMARK.viewBox}
              overflow="visible"
              focusable="false"
            >
              {/* W fantasma: el plan antes del viaje */}
              <path className="ghost" d={paths.w} />
              {/* La w se traza con el punto pegado a la punta */}
              <path className="s" pathLength={100} d={paths.w} data-t="w" />
              {TRAZOS.map((t) => (
                <path
                  key={t.path}
                  className="s"
                  pathLength={100}
                  d={paths[t.path]}
                  data-t={t.path}
                />
              ))}
              {AROS.map((a) => (
                <circle
                  key={a.id}
                  className="wy-ring"
                  data-t={a.id}
                  cx={a.centro[0]}
                  cy={a.centro[1]}
                  r={dot.r}
                  strokeWidth={a.trazo}
                />
              ))}
              {/* Estela del vuelo */}
              <g>
                {trailDots.map((p, k) => (
                  <circle
                    key={k}
                    className="wy-trail"
                    data-trail={k}
                    cx={p.cx}
                    cy={p.cy}
                    r={INTRO.trailR}
                  />
                ))}
              </g>
              {/* El punto: se mueve (dot-move), aterriza (dot-squash) y aparece (dot-pop) */}
              <g className="dot-move">
                <g className="dot-squash">
                  <circle
                    className="dot-pop"
                    cx="0"
                    cy="0"
                    r={dot.r}
                    data-wy-intro-dot=""
                  />
                </g>
              </g>
            </svg>
          </div>
          <p className="wy-intro__tag" data-wy-intro-decor="">
            <span className="wy-intro__in">{TAGLINE}</span>
          </p>
        </div>

        <p className="wy-intro__coords" data-wy-intro-decor="">
          <span className="wy-intro__in" data-wy-intro-coords="">
            {COORDS_SDQ}
          </span>
        </p>
        <p className="wy-intro__hint" data-wy-intro-decor="">
          <span className="wy-intro__in">
            Toca o pulsa una tecla para saltar
          </span>
        </p>
      </div>
    </>
  )
}
