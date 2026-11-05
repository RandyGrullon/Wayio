import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { crearServidor } from '../src/app.mjs'
import { leerConfig } from '../src/config.mjs'
import { ErrorTrabajo } from '../src/errores.mjs'
import { normalizarUrlVideo } from '../src/url.mjs'

const SECRETO = 'secreto-de-prueba-0123456789'
const cfg = leerConfig({ VIDEO_WORKER_SECRET: SECRETO, MAX_TRABAJOS: '1' })

/** JPEG mínimo (solo la firma) en base64. */
const JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70,
]).toString('base64')

/** @type {Array<() => void>} */
const pendientes = []

const servidor = crearServidor({
  cfg,
  // Sin DNS en las pruebas: solo la validación de dominios.
  validarUrl: async (u) => normalizarUrlVideo(u),
  procesar: async (url, op) => {
    if (url.includes('privado')) {
      throw new ErrorTrabajo('descarga', 'privado', 422, 'Privado.')
    }
    if (url.includes('lento')) {
      await new Promise((resolve) => pendientes.push(() => resolve(undefined)))
    }
    return {
      titulo: 'Paseo por Kioto',
      duracion: 42,
      fotogramas: Array.from({ length: op.maxFotogramas }, () => ({
        data: JPEG,
        mediaType: /** @type {const} */ ('image/jpeg'),
      })),
    }
  },
  estado: () => ({ listo: true, ytDlp: '2026.10.26', ffmpeg: 'ffmpeg 5.1' }),
})

let base = ''
before(async () => {
  await new Promise((resolve) =>
    servidor.listen(0, '127.0.0.1', () => resolve(undefined))
  )
  const dir = servidor.address()
  assert.ok(dir && typeof dir === 'object')
  base = `http://127.0.0.1:${dir.port}`
})
after(() => {
  servidor.closeAllConnections()
  servidor.close()
})

/**
 * @param {unknown} cuerpo
 * @param {string} [secreto]
 */
const pedir = (cuerpo, secreto = SECRETO) =>
  fetch(`${base}/fotogramas`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(secreto ? { authorization: `Bearer ${secreto}` } : {}),
    },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  })

test('GET /salud responde sin secreto', async () => {
  const r = await fetch(`${base}/salud`)
  assert.equal(r.status, 200)
  const j = await r.json()
  assert.equal(j.ok, true)
  assert.equal(j.maxTrabajos, 1)
})

test('sin secreto o con uno incorrecto: 401', async () => {
  for (const s of ['', 'otro-secreto-cualquiera-123']) {
    const r = await pedir({ videoUrl: 'https://youtu.be/abc' }, s)
    assert.equal(r.status, 401)
    assert.equal((await r.json()).code, 'no_autorizado')
  }
})

test('JSON roto o sin videoUrl: 400 bad_request', async () => {
  for (const c of ['{no es json', { otra: 1 }]) {
    const r = await pedir(c)
    assert.equal(r.status, 400)
    assert.equal((await r.json()).code, 'bad_request')
  }
})

test('dominio no permitido: 400 url_no_permitida', async () => {
  const r = await pedir({ videoUrl: 'https://example.com/v.mp4' })
  assert.equal(r.status, 400)
  const j = await r.json()
  assert.equal(j.ok, false)
  assert.equal(j.code, 'url_no_permitida')
})

test('éxito: 200 con fotogramas y metadatos (respeta maxFotogramas)', async () => {
  const r = await pedir({
    videoUrl: 'https://www.youtube.com/watch?v=abc',
    maxFotogramas: 3,
  })
  assert.equal(r.status, 200)
  const j = JSON.parse(await r.text())
  assert.equal(j.ok, true)
  assert.equal(j.titulo, 'Paseo por Kioto')
  assert.equal(j.duracion, 42)
  assert.equal(j.fotogramas.length, 3)
  assert.equal(j.fotogramas[0].mediaType, 'image/jpeg')
})

test('maxFotogramas no pasa del máximo del worker', async () => {
  const r = await pedir({
    videoUrl: 'https://youtu.be/abc',
    maxFotogramas: 500,
  })
  const j = JSON.parse(await r.text())
  assert.equal(j.fotogramas.length, cfg.maxFotogramas)
})

test('fallo durante el trabajo: 200 con ok:false, code y motivo', async () => {
  const r = await pedir({ videoUrl: 'https://youtu.be/privado' })
  assert.equal(r.status, 200)
  const j = JSON.parse(await r.text())
  assert.deepEqual(
    { ok: j.ok, code: j.code, motivo: j.motivo },
    { ok: false, code: 'descarga', motivo: 'privado' }
  )
})

test('ocupado: 503 con Retry-After cuando se llega a MAX_TRABAJOS', async () => {
  const lento = pedir({ videoUrl: 'https://youtu.be/lento' })
  // Espera a que el primer trabajo ocupe el hueco.
  while (servidor.trabajosEnCurso() === 0) {
    await new Promise((r) => setTimeout(r, 10))
  }
  const r = await pedir({ videoUrl: 'https://youtu.be/abc' })
  assert.equal(r.status, 503)
  assert.equal(r.headers.get('retry-after'), '30')
  assert.equal((await r.json()).code, 'ocupado')
  for (const fin of pendientes.splice(0)) fin()
  const r1 = await lento
  assert.equal(JSON.parse(await r1.text()).ok, true)
})

test('rutas y métodos desconocidos', async () => {
  assert.equal((await fetch(`${base}/otra`)).status, 404)
  assert.equal((await fetch(`${base}/fotogramas`)).status, 405)
})

test('sin secreto (o muy corto) la configuración falla', () => {
  assert.throws(() => leerConfig({}), /VIDEO_WORKER_SECRET/)
  assert.throws(
    () => leerConfig({ VIDEO_WORKER_SECRET: 'corto' }),
    /VIDEO_WORKER_SECRET/
  )
})
