import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { ErrorTrabajo } from './errores.mjs'

/**
 * Plataformas aceptadas. DEBE coincidir con HOSTS_PERMITIDOS de
 * src/lib/ai/analyzeVideo.ts: la app valida antes de llamar y el worker vuelve
 * a validar porque es quien descarga.
 */
export const HOSTS_PERMITIDOS = Object.freeze([
  'youtube.com',
  'youtu.be',
  'tiktok.com',
  'instagram.com',
  'vimeo.com',
  'facebook.com',
  'fb.watch',
])

const MSG_PLATAFORMAS =
  'Por ahora solo podemos analizar videos de YouTube, TikTok, Instagram, Vimeo o Facebook.'

/**
 * Valida y normaliza la URL del video (misma lógica que normalizarUrlVideo de
 * la app). Lanza ErrorTrabajo si no vale.
 * @param {string} input
 * @returns {string}
 */
export function normalizarUrlVideo(input) {
  let s = String(input).trim()
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`
  let url
  try {
    url = new URL(s)
  } catch {
    throw new ErrorTrabajo(
      'url_no_valida',
      'url',
      400,
      'Ese enlace no parece válido. Copia el enlace completo del video.'
    )
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ErrorTrabajo(
      'url_no_permitida',
      'plataforma',
      400,
      MSG_PLATAFORMAS
    )
  }
  url.protocol = 'https:'
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  if (
    url.username ||
    url.password ||
    (url.port && url.port !== '443') ||
    isIP(host.replace(/^\[|\]$/g, '')) !== 0 ||
    !HOSTS_PERMITIDOS.some((d) => host === d || host.endsWith(`.${d}`))
  ) {
    throw new ErrorTrabajo(
      'url_no_permitida',
      'plataforma',
      400,
      MSG_PLATAFORMAS
    )
  }
  url.hash = ''
  return url.toString()
}

/**
 * IPs privadas, locales, reservadas o de metadatos (anti-SSRF).
 * @param {string} ip
 * @returns {boolean}
 */
export function esIpNoPublica(ip) {
  const v = isIP(ip)
  if (v === 4) {
    const [a = 0, b = 0] = ip.split('.').map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    )
  }
  if (v === 6) {
    const s = ip.toLowerCase()
    const mapeada = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s)?.[1]
    if (mapeada) return esIpNoPublica(mapeada)
    return (
      s === '::' ||
      s === '::1' ||
      /^f[cd]/.test(s) ||
      /^fe[89ab]/.test(s) ||
      s.startsWith('ff') ||
      s.startsWith('64:ff9b:')
    )
  }
  return true
}

/**
 * El host debe resolver solo a IPs públicas.
 * @param {string} host
 */
export async function comprobarDestinoPublico(host) {
  let direcciones
  try {
    direcciones = await lookup(host, { all: true, verbatim: true })
  } catch (err) {
    throw new ErrorTrabajo(
      'descarga',
      'dns',
      422,
      'No pudimos acceder a ese enlace. Comprueba que esté bien escrito.',
      { cause: err }
    )
  }
  if (
    direcciones.length === 0 ||
    direcciones.some((d) => esIpNoPublica(d.address))
  ) {
    throw new ErrorTrabajo(
      'url_no_permitida',
      'plataforma',
      400,
      MSG_PLATAFORMAS
    )
  }
}

/**
 * Normaliza y comprueba DNS. Es la validación completa que usa el servidor.
 * @param {string} input
 * @returns {Promise<string>}
 */
export async function validarUrlVideo(input) {
  const url = normalizarUrlVideo(input)
  await comprobarDestinoPublico(new URL(url).hostname)
  return url
}
