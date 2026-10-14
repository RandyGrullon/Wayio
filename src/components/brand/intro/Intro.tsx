import { IntroHandoff } from './IntroHandoff'
import { IntroSplash } from './IntroSplash'

/**
 * Intro «La ruta llega» (docs/DISENO.md §9). Renderízala UNA vez, al
 * principio del contenido de la landing (`/`). El bootScript del <head>
 * decide si se reproduce; si no, no se ve ni cuesta nada más que el SSR.
 *
 * Requisitos en la página:
 * - el logo del header con `data-wy-logo` (destino del relevo);
 * - los bloques del hero con `className="wy-hero-item"` y `style={{ '--i': n }}`
 *   (n = 0..4) para el revelado escalonado.
 */
export function Intro() {
  return (
    <>
      <IntroSplash />
      <IntroHandoff />
    </>
  )
}
