import { readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { crearServidor } from './app.mjs'
import { leerConfig } from './config.mjs'
import {
  actualizarYtDlp,
  procesarVideo,
  versionesHerramientas,
} from './extraer.mjs'
import { validarUrlVideo } from './url.mjs'

/**
 * Punto de entrada del worker: `node src/servidor.mjs`.
 * Registro en JSON por línea (stdout): el host del video y, si falla, el
 * final del error de yt-dlp. Nunca el secreto ni el proxy.
 */

/** @param {Record<string, unknown>} evento */
const log = (evento) => {
  process.stdout.write(
    `${JSON.stringify({ t: new Date().toISOString(), ...evento })}\n`
  )
}

const cfg = (() => {
  try {
    return leerConfig()
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : err}\n`)
    return process.exit(1)
  }
})()

/** @type {{ listo: boolean, ytDlp: string | null, ffmpeg: string | null }} */
const estado = { listo: false, ytDlp: null, ffmpeg: null }

async function revisarHerramientas() {
  const v = await versionesHerramientas(cfg)
  estado.ytDlp = v.ytDlp
  estado.ffmpeg = v.ffmpeg
  estado.listo = Boolean(v.ytDlp && v.ffmpeg)
  log({ nivel: estado.listo ? 'info' : 'error', evento: 'herramientas', ...v })
}

const servidor = crearServidor({
  cfg,
  validarUrl: validarUrlVideo,
  procesar: procesarVideo,
  estado: () => estado,
  log,
})

servidor.listen(cfg.puerto, () => {
  log({
    nivel: 'info',
    evento: 'escuchando',
    puerto: cfg.puerto,
    maxTrabajos: cfg.maxTrabajos,
    autoActualizar: cfg.autoActualizar,
  })
})

// Restos de un arranque anterior que terminó a la fuerza.
try {
  const viejos = (await readdir(tmpdir())).filter((f) =>
    f.startsWith('wayio-video-')
  )
  await Promise.all(
    viejos.map((f) =>
      rm(join(tmpdir(), f), { recursive: true, force: true }).catch(
        () => undefined
      )
    )
  )
} catch {
  // Sin acceso a tmp: no es grave.
}

await revisarHerramientas()

// yt-dlp se queda viejo enseguida (las plataformas cambian): se actualiza al
// arrancar y, si el contenedor sigue vivo, una vez al día cuando está libre.
const DIA_MS = 24 * 60 * 60 * 1000
let ultimaActualizacion = 0
async function actualizar() {
  ultimaActualizacion = Date.now()
  const ok = await actualizarYtDlp(cfg)
  log({ nivel: ok ? 'info' : 'aviso', evento: 'actualizar_yt_dlp', ok })
  await revisarHerramientas()
}
if (cfg.autoActualizar) {
  void actualizar()
  setInterval(
    () => {
      if (
        Date.now() - ultimaActualizacion > DIA_MS &&
        servidor.trabajosEnCurso() === 0
      ) {
        void actualizar()
      }
    },
    60 * 60 * 1000
  ).unref()
}

/** @param {string} senal */
function apagar(senal) {
  log({ nivel: 'info', evento: 'apagando', senal })
  servidor.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 25_000).unref()
}
process.on('SIGTERM', () => apagar('SIGTERM'))
process.on('SIGINT', () => apagar('SIGINT'))
