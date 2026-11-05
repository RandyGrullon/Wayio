import { createHash, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { ErrorTrabajo } from './errores.mjs'

/**
 * Servidor HTTP del worker (sin dependencias):
 *
 *   GET  /salud       → 200 { ok: true, ytDlp, ffmpeg, enCurso, maxTrabajos }
 *                       (503 si faltan yt-dlp o ffmpeg)
 *   POST /fotogramas  → Authorization: Bearer <VIDEO_WORKER_SECRET>
 *                       { videoUrl, maxFotogramas?, maxDuracionSeg?, tiempoMaxMs? }
 *
 * Los errores de la petición (secreto, JSON, URL, ocupado) llevan su status
 * HTTP. Una vez empieza la descarga se responde 200 enseguida y se manda un
 * espacio cada 10 s (JSON admite espacios iniciales) para que ningún proxy
 * corte la conexión por inactividad; el resultado va en el cuerpo:
 *   { ok: true, titulo, duracion, fotogramas: [{ data, mediaType }], ms }
 *   { ok: false, code, motivo, error, detalle? }
 */

const MAX_CUERPO = 16 * 1024
const LATIDO_MS = 10_000

/** @typedef {import('./config.mjs').Config} Config */
/** @typedef {import('./extraer.mjs').OpcionesTrabajo} OpcionesTrabajo */
/** @typedef {import('./extraer.mjs').ResultadoTrabajo} ResultadoTrabajo */

/**
 * @typedef {object} Dependencias
 * @property {Readonly<Config>} cfg
 * @property {(url: string) => Promise<string>} validarUrl Normaliza y comprueba la URL (lanza ErrorTrabajo).
 * @property {(url: string, op: OpcionesTrabajo) => Promise<ResultadoTrabajo>} procesar
 * @property {() => { listo: boolean, ytDlp: string | null, ffmpeg: string | null }} estado
 * @property {(evento: Record<string, unknown>) => void} [log]
 */

/**
 * @param {string} code
 * @param {string} motivo
 * @param {string} error
 * @param {string} [detalle]
 */
const fallo = (code, motivo, error, detalle) => ({
  ok: false,
  code,
  motivo,
  error,
  ...(detalle ? { detalle } : {}),
})

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} cuerpo
 * @param {Record<string, string>} [cabeceras]
 */
function responder(res, status, cuerpo, cabeceras = {}) {
  if (res.headersSent || res.destroyed) return
  const json = JSON.stringify(cuerpo)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': String(Buffer.byteLength(json)),
    ...cabeceras,
  })
  res.end(json)
}

/** @param {import('node:http').IncomingMessage} req */
async function leerCuerpo(req) {
  /** @type {Buffer[]} */
  const partes = []
  let total = 0
  for await (const c of req) {
    total += c.length
    if (total > MAX_CUERPO) throw new Error('Cuerpo demasiado grande')
    partes.push(c)
  }
  return Buffer.concat(partes).toString('utf8')
}

/**
 * Entero dentro de [min, max]; `porDefecto` si no es un número.
 * @param {unknown} v
 * @param {number} min
 * @param {number} max
 * @param {number} porDefecto
 */
function acotar(v, min, max, porDefecto) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return porDefecto
  return Math.min(max, Math.max(min, Math.floor(v)))
}

/**
 * @param {Dependencias} deps
 * @returns {import('node:http').Server & { trabajosEnCurso: () => number }}
 */
export function crearServidor(deps) {
  const { cfg, validarUrl, procesar, estado } = deps
  const log = deps.log ?? (() => undefined)
  const huella = createHash('sha256').update(cfg.secreto).digest()
  let enCurso = 0

  /** @param {import('node:http').IncomingMessage} req */
  const autorizado = (req) => {
    const m = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.authorization ?? '')
    if (!m?.[1]) return false
    // Hash de los dos lados: misma longitud y comparación en tiempo constante.
    return timingSafeEqual(createHash('sha256').update(m[1]).digest(), huella)
  }

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  async function atender(req, res) {
    const ruta = (req.url ?? '/').split('?')[0]

    if (ruta === '/salud') {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        responder(res, 405, fallo('metodo', 'metodo', 'Usa GET.'), {
          allow: 'GET, HEAD',
        })
        return
      }
      const e = estado()
      responder(res, e.listo ? 200 : 503, {
        ok: e.listo,
        ytDlp: e.ytDlp,
        ffmpeg: e.ffmpeg,
        enCurso,
        maxTrabajos: cfg.maxTrabajos,
      })
      return
    }

    if (ruta !== '/fotogramas') {
      responder(
        res,
        404,
        fallo(
          'no_encontrado',
          'ruta',
          'Ruta no encontrada. Usa POST /fotogramas o GET /salud.'
        )
      )
      return
    }
    if (req.method !== 'POST') {
      responder(res, 405, fallo('metodo', 'metodo', 'Usa POST.'), {
        allow: 'POST',
      })
      return
    }
    if (!autorizado(req)) {
      responder(
        res,
        401,
        fallo(
          'no_autorizado',
          'secreto',
          'Falta el secreto o no coincide (Authorization: Bearer <VIDEO_WORKER_SECRET>).'
        )
      )
      return
    }
    if (Number(req.headers['content-length'] ?? 0) > MAX_CUERPO) {
      responder(
        res,
        413,
        fallo('bad_request', 'cuerpo', 'El cuerpo es demasiado grande.')
      )
      return
    }

    /** @type {Record<string, unknown>} */
    let cuerpo
    try {
      const v = JSON.parse(await leerCuerpo(req))
      cuerpo = v && typeof v === 'object' ? v : {}
    } catch {
      responder(
        res,
        400,
        fallo(
          'bad_request',
          'json',
          'El cuerpo debe ser JSON: { "videoUrl": "https://…" }.'
        )
      )
      return
    }
    const videoUrl = cuerpo.videoUrl
    if (
      typeof videoUrl !== 'string' ||
      videoUrl.trim().length < 4 ||
      videoUrl.length > 2048
    ) {
      responder(
        res,
        400,
        fallo('bad_request', 'videoUrl', 'Falta videoUrl (texto).')
      )
      return
    }

    if (enCurso >= cfg.maxTrabajos) {
      responder(
        res,
        503,
        fallo(
          'ocupado',
          'ocupado',
          'El worker está ocupado con otros videos. Reintenta en unos segundos.'
        ),
        { 'retry-after': '30' }
      )
      return
    }

    enCurso++
    const inicio = Date.now()
    const ctrl = new AbortController()
    // Si la app corta la conexión (timeout, usuario que se fue), se matan
    // yt-dlp y ffmpeg y se borran los temporales.
    res.on('close', () => {
      if (!res.writableFinished) ctrl.abort()
    })
    /** @type {NodeJS.Timeout | null} */
    let latido = null
    let host = ''
    try {
      const url = await validarUrl(videoUrl)
      host = new URL(url).hostname
      const presupuesto = acotar(
        cuerpo.tiempoMaxMs,
        10_000,
        cfg.tiempoMaxMs,
        cfg.tiempoMaxMs
      )
      /** @type {OpcionesTrabajo} */
      const op = {
        cfg,
        deadline: inicio + presupuesto,
        maxFotogramas: acotar(
          cuerpo.maxFotogramas,
          1,
          cfg.maxFotogramas,
          cfg.maxFotogramas
        ),
        maxDuracionSeg: acotar(
          cuerpo.maxDuracionSeg,
          10,
          cfg.maxDuracionSeg,
          cfg.maxDuracionSeg
        ),
        signal: ctrl.signal,
      }

      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-accel-buffering': 'no',
      })
      res.write(' ')
      latido = setInterval(() => res.write(' '), LATIDO_MS)

      const r = await procesar(url, op)
      clearInterval(latido)
      const ms = Date.now() - inicio
      res.end(
        JSON.stringify({
          ok: true,
          titulo: r.titulo,
          duracion: r.duracion,
          fotogramas: r.fotogramas,
          ms,
        })
      )
      log({
        nivel: 'info',
        evento: 'trabajo',
        ok: true,
        host,
        duracion: r.duracion,
        fotogramas: r.fotogramas.length,
        ms,
      })
    } catch (err) {
      if (latido) clearInterval(latido)
      const e =
        err instanceof ErrorTrabajo
          ? err
          : new ErrorTrabajo(
              'interno',
              'interno',
              500,
              'Error interno del worker.',
              { cause: err }
            )
      const cuerpoError = fallo(e.code, e.motivo, e.mensaje, e.detalle)
      if (res.headersSent) res.end(JSON.stringify(cuerpoError))
      else responder(res, e.status, cuerpoError)
      log({
        nivel: e.status >= 500 ? 'error' : 'aviso',
        evento: 'trabajo',
        ok: false,
        host,
        code: e.code,
        motivo: e.motivo,
        detalle:
          e.detalle ||
          (e.cause instanceof Error ? e.cause.message.slice(0, 300) : ''),
        ms: Date.now() - inicio,
      })
    } finally {
      enCurso--
    }
  }

  const servidor = createServer((req, res) => {
    atender(req, res).catch((err) => {
      log({
        nivel: 'error',
        evento: 'no_controlado',
        error: err instanceof Error ? err.message : String(err),
      })
      if (!res.headersSent) {
        responder(
          res,
          500,
          fallo('interno', 'interno', 'Error interno del worker.')
        )
      } else {
        res.end()
      }
    })
  })
  // Tiempo para recibir la petición completa (el cuerpo es diminuto).
  servidor.requestTimeout = 30_000
  return Object.assign(servidor, { trabajosEnCurso: () => enCurso })
}
