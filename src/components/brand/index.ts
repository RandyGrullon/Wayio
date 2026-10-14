/**
 * Marca de Wayio (docs/DISENO.md §8–§9). Todo es Server Component salvo
 * IntroHandoff (dentro de <Intro />) y saltarPuntoDelLogo (función de cliente).
 * Se pueden importar desde aquí o desde cada archivo.
 */
export { Logo } from './Logo'
export type { LogoProps, LogoTone, LogoVariant } from './Logo'
export { Sello } from './Sello'
export type { SelloProps, SelloTono } from './Sello'
export { Postal, PostalArte, inferirEscena } from './Postal'
export type { Escena, PostalArteProps, PostalProps, Proporcion } from './Postal'
export { IlustracionRuta } from './IlustracionRuta'
export type { IlustracionRutaProps } from './IlustracionRuta'
export { Intro } from './intro/Intro'
export { saltarPuntoDelLogo } from './salto'
export {
  BRAND,
  COORDS_SDQ,
  ISOTIPO,
  SELLO_TEXTO,
  TAGLINE,
  WORDMARK,
} from './marks'
