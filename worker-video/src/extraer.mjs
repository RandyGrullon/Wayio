import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ErrorTrabajo } from './errores.mjs'

/**
 * Descarga el video con yt-dlp (una sola llamada: metadatos + descarga) y saca
 * hasta N fotogramas con ffmpeg. Misma receta que el modo local de la app
 * (src/lib/ai/analyzeVideo.ts): ≤720p, sin audio, fotogramas JPG de ≤1024 px
 * repartidos por el video. Los temporales se borran siempre.
 */

const ES_WINDOWS = process.platform === 'win32'

/** @typedef {import('./config.mjs').Config} Config */

/**
 * @typedef {object} OpcionesEjecutar
 * @property {number} timeoutMs
 * @property {AbortSignal} [signal]
 * @property {number} [maxSalida] Bytes máximos de stdout.
 * @property {() => Promise<boolean>} [excedido] Se consulta cada segundo; true corta el proceso.
 */

/**
 * Lanza un binario sin shell. Rechaza con `{ corte }` si se cortó (tiempo,
 * abortado, pesado, salida), con `{ exitCode, stderr }` si terminó mal o con
 * el error de spawn (ENOENT si el binario no existe).
 * @param {string} bin
 * @param {string[]} args
 * @param {OpcionesEjecutar} opciones
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
export function ejecutar(bin, args, opciones) {
  const { timeoutMs, signal, maxSalida = 2_000_000, excedido } = opciones
  return new Promise((resolve, reject) => {
    /** @type {import('node:child_process').ChildProcess} */
    let hijo
    try {
      hijo = spawn(bin, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        // Grupo de procesos propio: yt-dlp (PyInstaller) lanza un proceso
        // hijo y hay que cortar los dos.
        detached: !ES_WINDOWS,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      })
    } catch (err) {
      reject(err)
      return
    }

    /** @type {Buffer[]} */
    const salida = []
    let bytesSalida = 0
    let stderr = ''
    /** @type {string | null} */
    let corte = null
    let terminado = false
    /** @type {NodeJS.Timeout | null} */
    let rematar = null

    /** @param {NodeJS.Signals} senal */
    const senalar = (senal) => {
      try {
        if (hijo.pid) process.kill(-hijo.pid, senal)
        else hijo.kill(senal)
      } catch {
        // Ya terminó.
      }
    }
    /** @param {string} motivo */
    const cortar = (motivo) => {
      if (corte || terminado) return
      corte = motivo
      if (ES_WINDOWS) {
        // Sin grupos de procesos (solo pruebas locales): taskkill /T mata el
        // árbol; matar solo al padre dejaría al hijo descargando.
        if (!hijo.pid) return
        spawn('taskkill', ['/pid', String(hijo.pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        }).on('error', () => hijo.kill())
        return
      }
      // SIGTERM deja a yt-dlp limpiar sus temporales; si no sale, SIGKILL.
      senalar('SIGTERM')
      rematar = setTimeout(() => senalar('SIGKILL'), 3000)
    }

    const reloj = setTimeout(() => cortar('tiempo'), timeoutMs)
    const alAbortar = () => cortar('abortado')
    signal?.addEventListener('abort', alAbortar, { once: true })
    if (signal?.aborted) cortar('abortado')

    let vigilando = false
    const vigia = excedido
      ? setInterval(() => {
          if (vigilando) return
          vigilando = true
          excedido()
            .then((si) => {
              if (si) cortar('pesado')
            })
            .catch(() => undefined)
            .finally(() => {
              vigilando = false
            })
        }, 1000)
      : null

    const limpiar = () => {
      terminado = true
      clearTimeout(reloj)
      if (rematar) clearTimeout(rematar)
      if (vigia) clearInterval(vigia)
      signal?.removeEventListener('abort', alAbortar)
    }

    hijo.stdout?.on('data', (/** @type {Buffer} */ c) => {
      bytesSalida += c.length
      if (bytesSalida > maxSalida) cortar('salida')
      else salida.push(c)
    })
    hijo.stderr?.on('data', (/** @type {Buffer} */ c) => {
      stderr = (stderr + c.toString('utf8')).slice(-8000)
    })
    hijo.on('error', (err) => {
      if (terminado) return
      limpiar()
      reject(err)
    })
    hijo.on('close', (codigo) => {
      if (terminado) return
      limpiar()
      if (corte) {
        reject(
          Object.assign(new Error(`Proceso cortado (${corte})`), {
            corte,
            stderr,
          })
        )
        return
      }
      if (codigo !== 0) {
        reject(
          Object.assign(new Error(`El proceso terminó con código ${codigo}`), {
            exitCode: codigo,
            stderr,
          })
        )
        return
      }
      resolve({ stdout: Buffer.concat(salida).toString('utf8'), stderr })
    })
  })
}

/**
 * Tiempo máximo (ms) para un paso, dejando `reservaMs` para lo que viene
 * después y sin pasar del `deadline`.
 * @param {number} deadline
 * @param {number} reservaMs
 * @param {number} maxMs
 */
function tiempoPara(deadline, reservaMs, maxMs) {
  const disponible = Math.min(maxMs, deadline - Date.now() - reservaMs)
  if (disponible < 5000) {
    throw new ErrorTrabajo(
      'descarga',
      'tiempo',
      504,
      'El video tardó demasiado en procesarse. Prueba con uno más corto.'
    )
  }
  return disponible
}

/**
 * Quita credenciales de URLs (p. ej. las del proxy) de un texto de error.
 * @param {string} s
 * @param {Config} cfg
 */
function redactar(s, cfg) {
  let r = s.replace(/\/\/[^/\s:@]+:[^/\s@]+@/g, '//***@')
  if (cfg.proxy) r = r.split(cfg.proxy).join('***')
  return r.trim().slice(-500)
}

/**
 * Traduce un fallo de yt-dlp a ErrorTrabajo (mismas reglas que
 * errorDeDescarga de la app, más el bloqueo de IPs de servidor).
 * @param {unknown} err
 * @param {Config} cfg
 * @returns {ErrorTrabajo}
 */
export function errorDeYtDlp(err, cfg) {
  const e = /** @type {Record<string, unknown>} */ (
    err && typeof err === 'object' ? err : {}
  )
  const stderr = typeof e.stderr === 'string' ? e.stderr : ''
  const mensaje = typeof e.message === 'string' ? e.message : ''
  const d = `${stderr} ${mensaje}`
  const extra = { cause: err, detalle: redactar(stderr || mensaje, cfg) }
  if (e.code === 'ENOENT' || e.code === 'EACCES') {
    return new ErrorTrabajo(
      'herramientas',
      'yt-dlp',
      503,
      'yt-dlp no está instalado o no se puede ejecutar.',
      extra
    )
  }
  if (e.corte === 'tiempo') {
    return new ErrorTrabajo(
      'descarga',
      'tiempo',
      504,
      'La descarga del video tardó demasiado.',
      extra
    )
  }
  if (e.corte === 'abortado') {
    return new ErrorTrabajo(
      'descarga',
      'cancelado',
      499,
      'La app canceló la petición.',
      extra
    )
  }
  if (e.corte === 'pesado' || /max-filesize|larger than/i.test(d)) {
    return new ErrorTrabajo(
      'muy_largo',
      'pesado',
      422,
      'El video es demasiado pesado.',
      extra
    )
  }
  if (/unsupported url|no suitable extractor/i.test(d)) {
    return new ErrorTrabajo(
      'url_no_permitida',
      'no_reconocido',
      400,
      'yt-dlp no reconoce ese enlace como un video.',
      extra
    )
  }
  // Va antes de «sign in»: YouTube pide «Sign in to confirm you're not a bot»
  // a las IPs de servidores; no es que el video sea privado.
  if (/not a bot|rate.?limit|too many requests|http error 429/i.test(d)) {
    return new ErrorTrabajo(
      'descarga',
      'bloqueado',
      502,
      'La plataforma bloqueó la descarga desde este servidor (prueba con YTDLP_PROXY).',
      extra
    )
  }
  if (
    /private|login|log in|sign in|cookies|age-restricted|confirm your age/i.test(
      d
    )
  ) {
    return new ErrorTrabajo(
      'descarga',
      'privado',
      422,
      'El video es privado o pide iniciar sesión.',
      extra
    )
  }
  if (/not available|unavailable|removed|404/i.test(d)) {
    return new ErrorTrabajo(
      'descarga',
      'no_disponible',
      422,
      'El video ya no está disponible.',
      extra
    )
  }
  return new ErrorTrabajo(
    'descarga',
    'generico',
    502,
    'No se pudo descargar el video.',
    extra
  )
}

/**
 * Argumentos de yt-dlp: sin config del sistema, sin extractor genérico
 * (anti-SSRF), sin listas, ≤720p sin audio, con límites de duración y peso.
 * Imprime una línea `M{...}` con los metadatos antes de descargar.
 * @param {Config} cfg
 * @param {string} url
 * @param {string} dir
 * @param {number} maxDuracionSeg
 */
function argsYtDlp(cfg, url, dir, maxDuracionSeg) {
  const args = [
    '--ignore-config',
    '--use-extractors',
    'default,-generic',
    '--no-playlist',
    '--no-warnings',
    '--socket-timeout',
    '20',
    '--print',
    'pre_process:M%(.{id,title,duration,is_live})j',
    '--no-simulate',
    '--match-filters',
    `!is_live & duration <=? ${maxDuracionSeg}`,
    '-o',
    join(dir, 'video.%(ext)s'),
    '-f',
    'bestvideo[height<=720]/best[height<=720]/best',
    '--max-filesize',
    `${cfg.maxVideoMb}M`,
    '--ffmpeg-location',
    cfg.ffmpeg,
    '--no-part',
    '--no-progress',
    '--retries',
    '2',
  ]
  if (cfg.jsRuntimes) args.push('--js-runtimes', cfg.jsRuntimes)
  if (cfg.proxy) args.push('--proxy', cfg.proxy)
  args.push('--', url)
  return args
}

/**
 * @param {string} stdout
 * @returns {{ titulo: string, duracion: number, enDirecto: boolean }}
 */
function leerMetadatos(stdout) {
  /** @type {Record<string, unknown>} */
  let meta = {}
  for (const linea of stdout.split(/\r?\n/)) {
    if (!linea.startsWith('M{')) continue
    try {
      const v = JSON.parse(linea.slice(1))
      if (v && typeof v === 'object') meta = v
    } catch {
      // Línea rota: seguimos sin metadatos.
    }
  }
  const duracion =
    typeof meta.duration === 'number' && Number.isFinite(meta.duration)
      ? meta.duration
      : 0
  return {
    titulo: typeof meta.title === 'string' ? meta.title.slice(0, 300) : '',
    duracion,
    enDirecto: meta.is_live === true,
  }
}

/** @param {string} dir */
async function bytesEn(dir) {
  let total = 0
  for (const f of await readdir(dir)) {
    total += (await stat(join(dir, f)).catch(() => ({ size: 0 }))).size
  }
  return total
}

/**
 * @typedef {object} OpcionesTrabajo
 * @property {Config} cfg
 * @property {number} deadline Momento (Date.now()) límite del trabajo.
 * @property {number} maxFotogramas
 * @property {number} maxDuracionSeg
 * @property {AbortSignal} [signal]
 */

/**
 * @typedef {object} ResultadoTrabajo
 * @property {string} titulo
 * @property {number} duracion Segundos (0 si la plataforma no la da).
 * @property {{ data: string, mediaType: 'image/jpeg' }[]} fotogramas
 */

/**
 * Descarga el video y devuelve sus fotogramas en base64.
 * @param {string} url URL ya validada (validarUrlVideo).
 * @param {OpcionesTrabajo} op
 * @returns {Promise<ResultadoTrabajo>}
 */
export async function procesarVideo(url, op) {
  const { cfg, deadline, maxFotogramas, maxDuracionSeg, signal } = op
  const dir = await mkdtemp(join(tmpdir(), 'wayio-video-'))
  try {
    // 1) Metadatos + descarga en una sola llamada (deja ≥20 s para ffmpeg).
    const maxBytes = cfg.maxVideoMb * 1024 * 1024
    /** @type {{ stdout: string }} */
    let yt
    try {
      yt = await ejecutar(cfg.ytDlp, argsYtDlp(cfg, url, dir, maxDuracionSeg), {
        timeoutMs: tiempoPara(deadline, 20_000, 200_000),
        ...(signal ? { signal } : {}),
        excedido: async () => (await bytesEn(dir)) > maxBytes * 1.05,
      })
    } catch (err) {
      throw err instanceof ErrorTrabajo ? err : errorDeYtDlp(err, cfg)
    }
    const meta = leerMetadatos(yt.stdout)

    const archivo = (await readdir(dir)).find(
      (f) =>
        f.startsWith('video.') && !f.endsWith('.part') && !f.endsWith('.ytdl')
    )
    if (!archivo) {
      // yt-dlp sale bien sin descargar cuando --match-filters lo descarta.
      if (meta.enDirecto) {
        throw new ErrorTrabajo(
          'descarga',
          'directo',
          422,
          'Es una transmisión en directo.'
        )
      }
      if (meta.duracion > maxDuracionSeg) {
        throw new ErrorTrabajo(
          'muy_largo',
          'duracion',
          422,
          `El video dura más de ${maxDuracionSeg} s.`
        )
      }
      throw new ErrorTrabajo(
        'descarga',
        'sin_archivo',
        422,
        'yt-dlp no dejó ningún archivo (¿privado o demasiado pesado?).'
      )
    }
    const video = join(dir, archivo)

    // 2) Fotogramas repartidos por el video, JPG de ≤1024 px.
    const framesDir = join(dir, 'frames')
    await mkdir(framesDir)
    const intervalo =
      meta.duracion > 0 ? Math.max(3, meta.duracion / maxFotogramas) : 10
    const filtro = `fps=${(1 / intervalo).toFixed(4)},scale='min(1024,iw)':-2`
    try {
      await ejecutar(
        cfg.ffmpeg,
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-nostdin',
          '-t',
          String(maxDuracionSeg),
          '-i',
          video,
          '-vf',
          filtro,
          '-frames:v',
          String(maxFotogramas),
          '-q:v',
          '4',
          '-an',
          '-y',
          join(framesDir, 'frame-%03d.jpg'),
        ],
        {
          timeoutMs: tiempoPara(deadline, 1000, 90_000),
          ...(signal ? { signal } : {}),
        }
      )
    } catch (err) {
      if (err instanceof ErrorTrabajo) throw err
      const e = /** @type {Record<string, unknown>} */ (
        err && typeof err === 'object' ? err : {}
      )
      if (e.code === 'ENOENT' || e.code === 'EACCES') {
        throw new ErrorTrabajo(
          'herramientas',
          'ffmpeg',
          503,
          'ffmpeg no está instalado o no se puede ejecutar.',
          { cause: err }
        )
      }
      if (e.corte === 'abortado') {
        throw new ErrorTrabajo(
          'descarga',
          'cancelado',
          499,
          'La app canceló la petición.',
          { cause: err }
        )
      }
      throw new ErrorTrabajo(
        'sin_fotogramas',
        e.corte === 'tiempo' ? 'tiempo' : 'ffmpeg',
        422,
        'ffmpeg no pudo leer las imágenes del video.',
        {
          cause: err,
          detalle: redactar(typeof e.stderr === 'string' ? e.stderr : '', cfg),
        }
      )
    }
    // El video ya no hace falta: liberamos disco cuanto antes.
    await rm(video, { force: true }).catch(() => undefined)

    const nombres = (await readdir(framesDir))
      .filter((f) => /^frame-\d+\.jpg$/.test(f))
      .sort()
      .slice(0, maxFotogramas)
    if (nombres.length === 0) {
      throw new ErrorTrabajo(
        'sin_fotogramas',
        'vacio',
        422,
        'ffmpeg no sacó ningún fotograma.'
      )
    }
    const fotogramas = await Promise.all(
      nombres.map(async (f) => ({
        data: (await readFile(join(framesDir, f))).toString('base64'),
        mediaType: /** @type {const} */ ('image/jpeg'),
      }))
    )
    return { titulo: meta.titulo, duracion: meta.duracion, fotogramas }
  } finally {
    // Reintentos: el proceso recién cortado puede tener aún el archivo abierto.
    await rm(dir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    }).catch(() => undefined)
  }
}

/**
 * Versión de yt-dlp y primera línea de ffmpeg -version (null si no están).
 * @param {Config} cfg
 */
export async function versionesHerramientas(cfg) {
  const version = async (
    /** @type {string} */ bin,
    /** @type {string} */ arg
  ) => {
    try {
      const r = await ejecutar(bin, [arg], { timeoutMs: 30_000 })
      return r.stdout.split(/\r?\n/)[0]?.trim().slice(0, 120) || null
    } catch {
      return null
    }
  }
  const [ytDlp, ffmpeg] = await Promise.all([
    version(cfg.ytDlp, '--version'),
    version(cfg.ffmpeg, '-version'),
  ])
  return { ytDlp, ffmpeg }
}

/**
 * yt-dlp -U: las plataformas cambian a menudo y un yt-dlp viejo deja de
 * funcionar. Devuelve true si terminó bien.
 * @param {Config} cfg
 */
export async function actualizarYtDlp(cfg) {
  try {
    await ejecutar(cfg.ytDlp, ['-U'], { timeoutMs: 120_000 })
    return true
  } catch {
    return false
  }
}
