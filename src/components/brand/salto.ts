/**
 * Microinteracción de marca (docs/DISENO.md §7.4, «Guardar»): el punto del
 * logo del header hace un salto. Úsalo desde el cliente al confirmar un
 * guardado; respeta el movimiento reducido (lo anula brand.css).
 *
 * Es la ÚNICA API del salto: marca con [data-salto] el primer
 * [data-wy-logo] del documento (el del SiteHeader).
 */
export function saltarPuntoDelLogo(): void {
  if (typeof document === 'undefined') return
  const logo = document.querySelector<SVGElement>('[data-wy-logo]')
  if (!logo) return
  // Reinicia la animación aunque ya se estuviera reproduciendo.
  logo.removeAttribute('data-salto')
  void logo.getBoundingClientRect()
  logo.setAttribute('data-salto', '')
  window.setTimeout(() => logo.removeAttribute('data-salto'), 600)
}
