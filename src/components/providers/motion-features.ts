import { domMax } from 'framer-motion'

// Bundle de funciones de framer-motion que carga LazyMotion en un chunk
// asíncrono. domMax es obligatorio: incluye layout/layoutId y drag, que
// domAnimation no trae (docs/DISENO.md §7.2).
export default domMax
