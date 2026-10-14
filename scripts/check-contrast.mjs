#!/usr/bin/env node
/**
 * Lint de pares de contraste (docs/DISENO.md §4 y §4.4.7).
 *
 * Lee los tokens REALES de src/app/globals.css (@theme, :root y .dark),
 * resuelve cada par de la tabla de abajo y falla (exit 1) si alguno baja de su
 * mínimo WCAG 2.x: 4,5 para texto normal y 3 para texto grande y componentes
 * de UI (1.4.11). Así, si alguien cambia un token, CI lo detecta.
 *
 * Uso: node scripts/check-contrast.mjs [--verbose]
 *
 * Un color se escribe como:
 *   - nombre semántico de :root / .dark  ('fg', 'surface-2', 'ring'…)
 *   - nombre de la paleta de @theme sin '--color-' ('tinta-300', 'dia-base-4')
 *   - hex literal ('#F2F3F0')
 * Los colores con alfa (header al 88 %, velo) se verifican con axe/Lighthouse.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const css = readFileSync(resolve(raiz, 'src/app/globals.css'), 'utf8')
const verbose = process.argv.includes('--verbose')

// ─── Lectura de tokens ─────────────────────────────────────────────────────

/** Contenido del primer bloque de nivel superior que empieza con `cabecera {`. */
function bloque(cabecera) {
  const lineas = css.split(/\r?\n/)
  const inicio = lineas.findIndex((l) => l.trimEnd() === `${cabecera} {`)
  if (inicio < 0)
    throw new Error(`No encuentro el bloque «${cabecera}» en globals.css`)
  const fin = lineas.findIndex((l, i) => i > inicio && l === '}')
  return lineas.slice(inicio + 1, fin).join('\n')
}

function declaraciones(texto) {
  const mapa = new Map()
  for (const m of texto.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    mapa.set(m[1], m[2].trim())
  }
  return mapa
}

const paleta = new Map(
  [...declaraciones(bloque('@theme'))]
    .filter(([k]) => k.startsWith('color-'))
    .map(([k, v]) => [k.slice('color-'.length), v])
)
const temas = {
  claro: declaraciones(bloque(':root')),
  oscuro: declaraciones(bloque('.dark')),
}

function resolver(nombre, tema) {
  if (nombre.startsWith('#')) return nombre
  const valor = temas[tema].get(nombre) ?? paleta.get(nombre)
  if (!valor) throw new Error(`Token desconocido «${nombre}» (${tema})`)
  if (!/^#[0-9a-f]{3,8}$/i.test(valor)) {
    throw new Error(`«${nombre}» (${tema}) no es un hex opaco: ${valor}`)
  }
  return valor
}

// ─── WCAG 2.x ──────────────────────────────────────────────────────────────

function rgb(hex) {
  let h = hex.replace('#', '')
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
}
function luminancia(hex) {
  const [r, g, b] = rgb(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contraste(a, b) {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

// ─── Pares permitidos (tabla de §4) ────────────────────────────────────────

const TEXTO = 4.5
const UI = 3

/** [primer plano, [fondos], mínimo, nota] */
const CLARO = [
  ['fg', ['bg', 'surface', 'surface-2'], TEXTO, 'texto'],
  ['fg-muted', ['bg', 'surface', 'surface-2'], TEXTO, 'texto secundario'],
  [
    'fg-subtle',
    [
      'bg',
      'surface',
      'surface-2',
      'primary-soft',
      'accent-soft',
      'warning-bg',
      'danger-bg',
      'success-bg',
      '#F2F3F0',
    ],
    TEXTO,
    'texto terciario',
  ],
  [
    'primary-fg',
    ['primary', 'primary-hover', 'primary-pressed'],
    TEXTO,
    'botón primario',
  ],
  ['primary', ['bg', 'surface'], TEXTO, 'itálica del hero'],
  ['primary-text', ['bg', 'surface', 'surface-2'], TEXTO, 'texto rosa'],
  ['primary-soft-fg', ['primary-soft'], TEXTO, 'badge accent'],
  ['accent', ['bg', 'surface', 'surface-2'], TEXTO, 'enlaces'],
  ['accent-fg', ['accent'], TEXTO, 'blanco sobre mar'],
  ['accent-soft-fg', ['accent-soft'], TEXTO, 'badge brand'],
  ['brass-text', ['bg', 'surface'], TEXTO, 'texto latón'],
  ['brass-soft-fg', ['brass-soft'], TEXTO, 'nota de ruta'],
  ['success', ['bg', 'surface'], TEXTO, 'éxito'],
  ['success-fg', ['success-bg'], TEXTO, 'callout éxito'],
  ['#FFFFFF', ['success'], TEXTO, 'blanco sobre éxito'],
  ['warning', ['bg', 'surface'], TEXTO, 'aviso'],
  ['warning-fg', ['warning-bg'], TEXTO, 'callout aviso'],
  ['danger', ['bg', 'surface', 'surface-2'], TEXTO, 'peligro'],
  ['on-danger', ['danger'], TEXTO, 'botón danger'],
  ['danger-fg', ['danger-bg'], TEXTO, 'callout peligro'],
  ['info-fg', ['info-bg'], TEXTO, 'callout info'],
  ['fg-inverse', ['surface-inverse'], TEXTO, 'toast, chip seleccionado, pie'],
  ['tinta-200', ['surface-inverse'], TEXTO, 'enlaces del pie'],
  ['tinta-300', ['surface-inverse'], TEXTO, 'kicker y barra del pie'],
  ['toast-action', ['surface-inverse'], TEXTO, 'acción del toast'],
  ['toast-success', ['surface-inverse'], UI, 'icono éxito del toast'],
  ['toast-danger', ['surface-inverse'], UI, 'icono error del toast'],
  ['bg', ['primary'], TEXTO, 'banda CTA'],
  ['primary-text', ['bg'], TEXTO, 'botón invertido de la banda'],
  ['fg', ['selection'], TEXTO, 'selección'],
  ['border-strong', ['surface', 'bg', 'surface-2'], UI, 'borde de controles'],
  ['ring', ['bg', 'surface', 'surface-2', 'primary-soft'], UI, 'foco'],
  ['ring-inverse', ['surface-inverse'], UI, 'foco sobre inverse'],
  ['brass', ['bg', 'surface'], UI, 'latón gráfico'],
  ['tinta-500', ['bg'], UI, 'switch apagado'],
  ['#FFFFFF', ['tinta-500', 'accent'], UI, 'thumb del switch'],
  ['accent', ['bg', 'surface'], UI, 'switch encendido, voto Sí'],
  ['fg-subtle', ['surface'], UI, 'voto No'],
  ['gps', ['#F2F3F0', '#C2C8CA'], UI, 'GPS sobre positron'],
  ['dia-1', ['bg'], TEXTO, 'kicker DÍA 01 sobre papel'],
  ['dia-2', ['bg'], TEXTO, 'kicker DÍA 02 sobre papel'],
  ['dia-3', ['bg'], TEXTO, 'kicker DÍA 03 sobre papel'],
  ['dia-4', ['bg'], TEXTO, 'kicker DÍA 04 sobre papel'],
  ['dia-5', ['bg'], TEXTO, 'kicker DÍA 05 sobre papel'],
  ['dia-6', ['bg'], TEXTO, 'kicker DÍA 06 sobre papel'],
  ['dia-7', ['bg'], TEXTO, 'kicker DÍA 07 sobre papel'],
  ['dia-8', ['bg'], TEXTO, 'kicker DÍA 08 sobre papel'],
  ['dia-9', ['bg'], TEXTO, 'kicker DÍA 09 sobre papel'],
  ['dia-10', ['bg'], TEXTO, 'kicker DÍA 10 sobre papel'],
]

const OSCURO = [
  ['fg', ['bg', 'surface', 'surface-2', 'surface-raised'], TEXTO, 'texto'],
  [
    'fg-muted',
    ['bg', 'surface', 'surface-2', 'surface-raised'],
    TEXTO,
    'texto secundario',
  ],
  [
    'fg-subtle',
    ['bg', 'surface', 'surface-2', 'surface-raised'],
    TEXTO,
    'texto terciario',
  ],
  [
    'primary-fg',
    ['primary', 'primary-hover', 'primary-pressed'],
    TEXTO,
    'botón primario (tinta)',
  ],
  [
    'primary-text',
    ['bg', 'surface', 'surface-2', 'surface-raised'],
    TEXTO,
    'texto rosa',
  ],
  ['primary-soft-fg', ['primary-soft'], TEXTO, 'badge accent'],
  ['fg', ['primary-soft'], TEXTO, 'resaltado IA'],
  [
    'accent',
    ['bg', 'surface', 'surface-2', 'surface-raised', 'accent-soft'],
    TEXTO,
    'enlaces',
  ],
  ['accent-fg', ['accent'], TEXTO, 'tinta sobre mar'],
  ['accent-soft-fg', ['accent-soft'], TEXTO, 'badge brand'],
  ['brass-text', ['bg', 'surface', 'brass-soft'], TEXTO, 'texto latón'],
  ['brass-soft-fg', ['brass-soft'], TEXTO, 'nota de ruta'],
  ['success', ['bg', 'surface'], TEXTO, 'éxito'],
  ['success-fg', ['success-bg'], TEXTO, 'callout éxito'],
  ['#0B1622', ['success'], TEXTO, 'tinta sobre éxito'],
  ['warning', ['bg', 'surface'], TEXTO, 'aviso'],
  ['warning-fg', ['warning-bg'], TEXTO, 'callout aviso'],
  [
    'danger',
    ['bg', 'surface', 'surface-2', 'surface-raised'],
    TEXTO,
    'peligro',
  ],
  ['on-danger', ['danger'], TEXTO, 'botón danger (tinta)'],
  ['danger-fg', ['danger-bg'], TEXTO, 'callout peligro'],
  ['info-fg', ['info-bg'], TEXTO, 'callout info'],
  ['fg-inverse', ['surface-inverse'], TEXTO, 'toast, chip seleccionado'],
  ['fg', ['tinta-800'], TEXTO, 'burbuja propia del chat'],
  ['toast-action', ['surface-inverse'], TEXTO, 'acción del toast'],
  ['toast-success', ['surface-inverse'], UI, 'icono éxito del toast'],
  ['toast-danger', ['surface-inverse'], UI, 'icono error del toast'],
  ['fg', ['selection'], TEXTO, 'selección'],
  ['tinta-200', ['noche-900'], TEXTO, 'enlaces del pie'],
  ['tinta-300', ['noche-900'], TEXTO, 'kicker y barra del pie'],
  [
    'border-strong',
    ['bg', 'surface', 'surface-2', 'surface-raised'],
    UI,
    'borde de controles',
  ],
  ['primary', ['bg', 'surface', 'surface-raised'], UI, 'primario gráfico'],
  ['ring', ['bg', 'surface', 'surface-2'], UI, 'foco'],
  ['ring-inverse', ['surface-inverse'], UI, 'foco sobre inverse'],
  ['tinta-400', ['surface'], UI, 'switch apagado'],
  ['papel-150', ['tinta-400'], UI, 'thumb del switch apagado'],
  ['#0B1622', ['accent'], UI, 'thumb del switch encendido'],
  ['gps', ['#0C0C0C', '#0E1925'], UI, 'GPS sobre dark y fork noche'],
  ['dia-1', ['bg'], TEXTO, 'kicker DÍA 01'],
  ['dia-2', ['bg'], TEXTO, 'kicker DÍA 02'],
  ['dia-3', ['bg'], TEXTO, 'kicker DÍA 03'],
  ['dia-4', ['bg'], TEXTO, 'kicker DÍA 04'],
  ['dia-5', ['bg'], TEXTO, 'kicker DÍA 05'],
  ['dia-6', ['bg'], TEXTO, 'kicker DÍA 06'],
  ['dia-7', ['bg'], TEXTO, 'kicker DÍA 07'],
  ['dia-8', ['bg'], TEXTO, 'kicker DÍA 08'],
  ['dia-9', ['bg'], TEXTO, 'kicker DÍA 09'],
  ['dia-10', ['bg'], TEXTO, 'kicker DÍA 10'],
]

/** Marcadores del mapa: número sobre el color y color sobre la tierra (§10.2). */
const MAPA = []
for (let n = 1; n <= 10; n++) {
  MAPA.push([
    `#FFFFFF`,
    [`dia-base-${n}`],
    TEXTO,
    `número blanco / día ${n} base`,
  ])
  MAPA.push([
    `dia-base-${n}`,
    ['#F2F3F0', '#C2C8CA', '#DCE0DC'],
    UI,
    `día ${n} base / positron`,
  ])
  MAPA.push([`#0B1622`, [`dia-luz-${n}`], TEXTO, `número tinta / día ${n} luz`])
  MAPA.push([
    `dia-luz-${n}`,
    ['#0C0C0C', '#1B1B1D', '#202020', '#0E1925'],
    UI,
    `día ${n} luz / dark`,
  ])
}

// ─── Ejecución ─────────────────────────────────────────────────────────────

const fallos = []
let total = 0

function revisar(pares, tema) {
  for (const [fg, fondos, minimo, nota] of pares) {
    for (const fondo of fondos) {
      total += 1
      let ratio
      try {
        ratio = contraste(resolver(fg, tema), resolver(fondo, tema))
      } catch (e) {
        fallos.push({ tema, fg, fondo, ratio: NaN, minimo, nota: e.message })
        continue
      }
      const ok = ratio >= minimo
      if (!ok) fallos.push({ tema, fg, fondo, ratio, minimo, nota })
      if (verbose) {
        console.log(
          `${ok ? 'ok  ' : 'FALLA'} ${tema.padEnd(6)} ${fg.padEnd(16)} / ${fondo.padEnd(16)} ${ratio.toFixed(2).padStart(5)} (mín ${minimo}) · ${nota}`
        )
      }
    }
  }
}

revisar(CLARO, 'claro')
revisar(OSCURO, 'oscuro')
revisar(MAPA, 'claro')

if (fallos.length > 0) {
  console.error(
    `\n✗ ${fallos.length} de ${total} pares de contraste por debajo de su mínimo:\n`
  )
  for (const f of fallos) {
    const r = Number.isNaN(f.ratio) ? '  —  ' : f.ratio.toFixed(2)
    console.error(
      `  [${f.tema}] ${f.fg} / ${f.fondo}: ${r} < ${f.minimo} · ${f.nota}`
    )
  }
  console.error(
    '\nRevisa los tokens de src/app/globals.css (docs/DISENO.md §4).'
  )
  process.exit(1)
}

console.log(
  `✓ ${total} pares de contraste dentro de su mínimo (claro, oscuro y mapa).`
)
