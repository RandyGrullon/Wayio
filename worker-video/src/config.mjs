/**
 * Configuración del worker por variables de entorno. Solo el secreto es
 * obligatorio; el resto tiene valores por defecto pensados para un contenedor
 * pequeño (1 vCPU compartida, 1 GB de RAM).
 */

/**
 * @param {string | undefined} valor
 * @param {number} porDefecto
 * @param {number} min
 * @param {number} max
 */
function entero(valor, porDefecto, min, max) {
  const n = Number.parseInt(String(valor ?? '').trim(), 10)
  if (!Number.isFinite(n)) return porDefecto
  return Math.min(max, Math.max(min, n))
}

/** @param {string | undefined} valor */
const texto = (valor) => (valor ?? '').trim()

/** @param {string | undefined} valor */
const activado = (valor) => /^(true|1|si|sí|yes)$/i.test(texto(valor))

/**
 * @typedef {object} Config
 * @property {number} puerto
 * @property {string} secreto
 * @property {string} ffmpeg Ruta o nombre del binario de ffmpeg.
 * @property {string} ytDlp Ruta o nombre del binario de yt-dlp.
 * @property {string} jsRuntimes Valor de --js-runtimes de yt-dlp ('' = no se pasa).
 * @property {string} proxy Proxy para yt-dlp ('' = sin proxy).
 * @property {boolean} autoActualizar yt-dlp -U al arrancar y cada 24 h.
 * @property {number} maxDuracionSeg
 * @property {number} maxFotogramas
 * @property {number} maxVideoMb
 * @property {number} tiempoMaxMs
 * @property {number} maxTrabajos
 */

/**
 * Lee y valida la configuración. Lanza si falta el secreto.
 * @param {Record<string, string | undefined>} [env]
 * @returns {Readonly<Config>}
 */
export function leerConfig(env = process.env) {
  const secreto = texto(env.VIDEO_WORKER_SECRET)
  if (secreto.length < 16) {
    throw new Error(
      'Falta VIDEO_WORKER_SECRET o es muy corto (mínimo 16 caracteres). Genera uno con: openssl rand -hex 32'
    )
  }
  return Object.freeze({
    puerto: entero(env.PORT, 8080, 1, 65_535),
    secreto,
    ffmpeg: texto(env.FFMPEG_PATH) || 'ffmpeg',
    ytDlp: texto(env.YTDLP_PATH) || 'yt-dlp',
    jsRuntimes: texto(env.YTDLP_JS_RUNTIMES),
    proxy: texto(env.YTDLP_PROXY),
    autoActualizar: activado(env.YTDLP_AUTOACTUALIZAR),
    maxDuracionSeg: entero(env.MAX_DURACION_SEG, 600, 10, 3600),
    maxFotogramas: entero(env.MAX_FOTOGRAMAS, 20, 1, 60),
    maxVideoMb: entero(env.MAX_VIDEO_MB, 250, 1, 2048),
    tiempoMaxMs: entero(env.TIEMPO_MAX_MS, 240_000, 30_000, 900_000),
    maxTrabajos: entero(env.MAX_TRABAJOS, 2, 1, 16),
  })
}
