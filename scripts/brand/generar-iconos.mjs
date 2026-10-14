#!/usr/bin/env node
/**
 * Genera los iconos PNG/ICO de Wayio a partir de la geometría única de
 * src/components/brand/marks.ts (docs/DISENO.md §8.3 y §9.9).
 *
 * Uso: node scripts/brand/generar-iconos.mjs
 *
 * Motor: sharp (librsvg), que ya viene en node_modules como dependencia
 * opcional de Next. No instala nada. Si sharp no está disponible, el script
 * termina con un mensaje claro.
 *
 * Salidas:
 *   src/app/favicon.ico              16 + 32 (PNG embebidos)
 *   src/app/apple-icon.png           180 (app icon, el sistema redondea)
 *   public/icons/icon-192.png        icono «any» redondeado
 *   public/icons/icon-512.png        icono «any» redondeado
 *   public/icons/maskable-512.png    sangrado completo, isotipo en el 80 %
 *   mobile/assets/icon.png           1024 sin redondeo
 *   mobile/assets/android-icon-foreground.png   1080, zona segura 660
 *   mobile/assets/android-icon-background.png   1080, tinta sólida
 *   mobile/assets/android-icon-monochrome.png   1080, isotipo de un color
 *   mobile/assets/splash-icon.png    solo el punto (#C21A66)
 *   mobile/assets/splash-punto.png   solo el punto (#C21A66)
 *   mobile/assets/splash-punto-dark.png  solo el punto (#F55A9A)
 *   mobile/assets/favicon.png        48 (web de Expo)
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// ── Geometría: se lee de marks.ts para no duplicarla ────────────────────────
async function leerMarcas() {
  const fuente = await readFile(
    join(RAIZ, 'src/components/brand/marks.ts'),
    'utf8'
  )
  const leer = (nombre) => {
    const re = new RegExp(
      `export const ${nombre} = (\\{[\\s\\S]*?\\n\\}) as const`,
      'm'
    )
    const m = fuente.match(re)
    if (!m) throw new Error(`No encuentro ${nombre} en marks.ts`)
    return vm.runInNewContext(`(${m[1]})`)
  }
  return {
    ISOTIPO: leer('ISOTIPO'),
    FAVICON: leer('FAVICON'),
    BRAND: leer('BRAND'),
  }
}

const { ISOTIPO, FAVICON, BRAND } = await leerMarcas()

// Centro óptico del isotipo (= centro de su caja visual, §8.2).
const ISO_CX = 31.625
const ISO_CY = 32.25

/** Isotipo en coordenadas locales 0..64 (aro hueco con máscara). */
function isotipo({ trazo, punto, id = 'h' }) {
  const { ring, dot } = ISOTIPO
  return `
  <defs>
    <mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
      <rect width="64" height="64" fill="#fff"/>
      <circle cx="${ring.cx}" cy="${ring.cy}" r="${ring.hole}" fill="#000"/>
    </mask>
  </defs>
  <g mask="url(#${id})" fill="none" stroke="${trazo}" stroke-linecap="round" stroke-linejoin="round">
    <path d="${ISOTIPO.route}" stroke-width="${ISOTIPO.stroke}"/>
    <circle cx="${ring.cx}" cy="${ring.cy}" r="${ring.r}" stroke-width="${ring.stroke}"/>
  </g>
  <circle cx="${dot.cx}" cy="${dot.cy}" r="${dot.r}" fill="${punto}"/>`
}

/**
 * Coloca el isotipo en un lienzo cuadrado de `lado` px a escala `escala`
 * (px por unidad), centrado ópticamente y elevado `elevar` px.
 */
function isotipoEn(lado, escala, elevar, colores) {
  const ancho = 64 * escala
  const x = lado / 2 - ISO_CX * escala
  const y = lado / 2 - ISO_CY * escala - elevar
  return `<svg x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${ancho}" height="${ancho}" viewBox="0 0 64 64">${isotipo(colores)}</svg>`
}

const svg = (lado, cuerpo) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">${cuerpo}</svg>`

const COLOR = { trazo: BRAND.papel, punto: BRAND.rosaOscuro }

/** App icon §8.3: 1024, tinta, isotipo ×11, elevación óptica de 8 px. */
function appIcon({ fondo = BRAND.tintaIcono, radio = 0 } = {}) {
  return svg(
    1024,
    `<rect width="1024" height="1024" rx="${radio}" fill="${fondo}"/>` +
      isotipoEn(1024, 11, 8, COLOR)
  )
}

/** Maskable (PWA): sangrado completo; la zona segura es un círculo del 80 %. */
function maskable() {
  // ×5,5 (= app icon a 512): diagonal de la caja 372 px < 409,6 de la zona segura.
  return svg(
    512,
    `<rect width="512" height="512" fill="${BRAND.tintaIcono}"/>` +
      isotipoEn(512, 5.5, 4, COLOR)
  )
}

/** Android adaptive §8.3: foreground 1080 con el isotipo ×9,5 (zona segura 660). */
function adaptiveForeground() {
  return svg(1080, isotipoEn(1080, 9.5, 0, COLOR))
}
function adaptiveBackground() {
  return svg(
    1080,
    `<rect width="1080" height="1080" fill="${BRAND.tintaIcono}"/>`
  )
}
function adaptiveMonochrome() {
  // Android usa solo el alfa: todo en un color, punto incluido.
  return svg(
    1080,
    isotipoEn(1080, 9.5, 0, { trazo: '#FFFFFF', punto: '#FFFFFF' })
  )
}

/** Favicon §8.3 (rejilla de 32). `chico` = dibujo reforzado para 16 px. */
function favicon(chico = false) {
  const trazo = chico ? FAVICON.chico.stroke : FAVICON.stroke
  const r = chico ? FAVICON.chico.r : FAVICON.dot.r
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="${FAVICON.viewBox}">
  <rect width="32" height="32" rx="${FAVICON.rx}" fill="${BRAND.tintaIcono}"/>
  <path d="${FAVICON.route}" fill="none" stroke="${BRAND.papel}" stroke-width="${trazo}" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${FAVICON.dot.cx}" cy="${FAVICON.dot.cy}" r="${r}" fill="${BRAND.rosaOscuro}"/>
</svg>`
}

/** Splash nativo §9.9: solo el punto. */
function punto(color) {
  return svg(256, `<circle cx="128" cy="128" r="128" fill="${color}"/>`)
}

// ── Render ──────────────────────────────────────────────────────────────────
let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error(
    'No encuentro «sharp» en node_modules. Viene como dependencia opcional de Next;\n' +
      'reinstala dependencias (npm install) en una plataforma soportada y vuelve a ejecutar.'
  )
  process.exit(1)
}

async function png(svgTexto, lado, { opaco = false } = {}) {
  let tubo = sharp(Buffer.from(svgTexto), { density: 72 }).resize(lado, lado, {
    fit: 'fill',
    kernel: 'lanczos3',
  })
  // Los iconos de iOS no admiten alfa: se aplana sobre la tinta.
  if (opaco) tubo = tubo.flatten({ background: BRAND.tintaIcono })
  return tubo.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer()
}

/** Renderiza un SVG a su tamaño nativo multiplicado (mejor antialias) y reduce. */
async function pngNitido(svgTexto, lado, nativo) {
  const densidad = Math.max(72, Math.round((72 * lado * 2) / nativo))
  return sharp(Buffer.from(svgTexto), { density: densidad })
    .resize(lado, lado, { fit: 'fill', kernel: 'lanczos3' })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()
}

/** ICO con PNG embebidos (soportado por todos los navegadores actuales). */
function ico(imagenes) {
  const cabecera = Buffer.alloc(6)
  cabecera.writeUInt16LE(0, 0)
  cabecera.writeUInt16LE(1, 2)
  cabecera.writeUInt16LE(imagenes.length, 4)
  const entradas = []
  let offset = 6 + 16 * imagenes.length
  for (const { lado, datos } of imagenes) {
    const e = Buffer.alloc(16)
    e.writeUInt8(lado >= 256 ? 0 : lado, 0)
    e.writeUInt8(lado >= 256 ? 0 : lado, 1)
    e.writeUInt8(0, 2)
    e.writeUInt8(0, 3)
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(datos.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += datos.length
    entradas.push(e)
  }
  return Buffer.concat([cabecera, ...entradas, ...imagenes.map((i) => i.datos)])
}

async function guardar(ruta, datos) {
  const destino = join(RAIZ, ruta)
  await mkdir(dirname(destino), { recursive: true })
  await writeFile(destino, datos)
  console.log(
    `  ✓ ${relative(RAIZ, destino).replaceAll('\\', '/')} (${datos.length} B)`
  )
}

console.log('Generando iconos de Wayio…')

// Web
const fav16 = await pngNitido(favicon(true), 16, 32)
const fav32 = await pngNitido(favicon(false), 32, 32)
// 32 primero: Next anuncia el tamaño de la primera imagen del .ico.
await guardar(
  'src/app/favicon.ico',
  ico([
    { lado: 32, datos: fav32 },
    { lado: 16, datos: fav16 },
  ])
)
await guardar(
  'src/app/apple-icon.png',
  await png(appIcon(), 180, { opaco: true })
)
// «any»: mismo dibujo con el radio del favicon (7/32 ≈ 22 %).
const redondeado = appIcon({ radio: Math.round((1024 * FAVICON.rx) / 32) })
await guardar('public/icons/icon-192.png', await png(redondeado, 192))
await guardar('public/icons/icon-512.png', await png(redondeado, 512))
await guardar('public/icons/maskable-512.png', await png(maskable(), 512))

// Móvil (Expo)
await guardar(
  'mobile/assets/icon.png',
  await png(appIcon(), 1024, { opaco: true })
)
await guardar(
  'mobile/assets/android-icon-foreground.png',
  await png(adaptiveForeground(), 1080)
)
await guardar(
  'mobile/assets/android-icon-background.png',
  await png(adaptiveBackground(), 1080)
)
await guardar(
  'mobile/assets/android-icon-monochrome.png',
  await png(adaptiveMonochrome(), 1080)
)
await guardar(
  'mobile/assets/splash-icon.png',
  await png(punto(BRAND.rosa), 256)
)
await guardar(
  'mobile/assets/splash-punto.png',
  await png(punto(BRAND.rosa), 256)
)
await guardar(
  'mobile/assets/splash-punto-dark.png',
  await png(punto(BRAND.rosaOscuro), 256)
)
await guardar(
  'mobile/assets/favicon.png',
  await pngNitido(favicon(false), 48, 32)
)

console.log('Listo.')
