import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { ErrorTrabajo } from '../src/errores.mjs'
import {
  esIpNoPublica,
  HOSTS_PERMITIDOS,
  normalizarUrlVideo,
} from '../src/url.mjs'

/** @param {() => unknown} fn */
const codigoDe = (fn) => {
  try {
    fn()
  } catch (err) {
    assert.ok(err instanceof ErrorTrabajo)
    return err.code
  }
  return 'sin_error'
}

test('acepta las plataformas permitidas y normaliza a https sin hash', () => {
  assert.equal(
    normalizarUrlVideo('www.youtube.com/watch?v=abc#t=3'),
    'https://www.youtube.com/watch?v=abc'
  )
  assert.equal(
    normalizarUrlVideo('http://vm.tiktok.com/ZM123/'),
    'https://vm.tiktok.com/ZM123/'
  )
  assert.equal(
    normalizarUrlVideo('https://youtu.be/abc'),
    'https://youtu.be/abc'
  )
})

test('rechaza hosts no permitidos, IPs, puertos y credenciales', () => {
  for (const u of [
    'https://example.com/video.mp4',
    'https://youtube.com.evil.com/x',
    'https://notyoutube.com/x',
    'https://127.0.0.1/x',
    'https://[::1]/x',
    'https://youtube.com:8080/x',
    'https://user:pass@youtube.com/x',
    'ftp://youtube.com/x',
    'file:///etc/passwd',
  ]) {
    assert.equal(
      codigoDe(() => normalizarUrlVideo(u)),
      'url_no_permitida',
      u
    )
  }
  assert.equal(
    codigoDe(() => normalizarUrlVideo('https://')),
    'url_no_valida'
  )
})

test('detecta IPs no públicas', () => {
  for (const ip of [
    '10.0.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '100.64.0.1',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:10.0.0.1',
  ]) {
    assert.equal(esIpNoPublica(ip), true, ip)
  }
  for (const ip of ['142.250.80.46', '2607:f8b0:4004:c1b::64']) {
    assert.equal(esIpNoPublica(ip), false, ip)
  }
})

test('la lista de dominios coincide con la de la app web', async () => {
  // Si el worker se despliega solo (sin el repo completo) no hay nada que comparar.
  let fuente
  try {
    fuente = await readFile(
      new URL('../../src/lib/ai/analyzeVideo.ts', import.meta.url),
      'utf8'
    )
  } catch {
    return
  }
  const bloque = /const HOSTS_PERMITIDOS = \[([\s\S]*?)\]/.exec(fuente)?.[1]
  assert.ok(bloque, 'No se encontró HOSTS_PERMITIDOS en analyzeVideo.ts')
  const deLaApp = [...bloque.matchAll(/'([^']+)'/g)].map((m) => m[1])
  assert.deepEqual([...HOSTS_PERMITIDOS], deLaApp)
})
