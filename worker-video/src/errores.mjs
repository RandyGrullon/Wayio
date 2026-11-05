/**
 * Error de un trabajo con el contrato que entiende la app web
 * (src/lib/ai/analyzeVideo.ts): `code` es uno de los códigos de la app
 * (descarga, muy_largo, sin_fotogramas, herramientas…) y `motivo` afina el
 * mensaje que elige la app. El texto para el usuario lo pone la app; `mensaje`
 * es para quien prueba el worker a mano.
 */
export class ErrorTrabajo extends Error {
  /**
   * @param {string} code
   * @param {string} motivo
   * @param {number} status
   * @param {string} mensaje
   * @param {{ cause?: unknown, detalle?: string }} [extra]
   */
  constructor(code, motivo, status, mensaje, extra = {}) {
    super(
      mensaje,
      extra.cause !== undefined ? { cause: extra.cause } : undefined
    )
    this.name = 'ErrorTrabajo'
    this.code = code
    this.motivo = motivo
    this.status = status
    this.mensaje = mensaje
    this.detalle = extra.detalle ?? ''
  }
}
