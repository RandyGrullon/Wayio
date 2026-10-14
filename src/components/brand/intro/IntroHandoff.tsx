'use client'

import { useEffect } from 'react'
import { animate } from 'framer-motion'
import { INTRO } from './timeline'

/**
 * Relevo de la intro (docs/DISENO.md §9.8). Cuando termina el reloj CSS
 * (2100 ms) hace el FLIP medido del wordmark hacia el [data-wy-logo] del
 * header y abre el papel en portal circular desde el punto. Además hace el
 * scramble de las coordenadas si hidrató a tiempo.
 *
 * Si hidrata tarde (>2000 ms) no interrumpe nada: deja terminar el fallback
 * CSS y llama a window.__wyIntroDone. El tope duro de 3200 ms lo pone el
 * bootScript del <head>, así que nunca se queda pegada.
 */

declare global {
  interface Window {
    /** Lo define el bootScript del <head>: pone html[data-intro="done"]. */
    __wyIntroDone?: () => void
  }
}

const SALIDA = [0.4, 0, 1, 1] as const
const PORTAL = [0.76, 0, 0.24, 1] as const

/** Equipos modestos: el portal se sustituye por un fundido. */
const lowEnd = () => {
  const nav = navigator as Navigator & { deviceMemory?: number }
  return (nav.hardwareConcurrency ?? 4) <= 4 || (nav.deviceMemory ?? 8) <= 4
}

const terminar = () => window.__wyIntroDone?.()

function relojDe(root: HTMLElement) {
  return root
    .getAnimations()
    .find(
      (a): a is CSSAnimation =>
        'animationName' in a && (a as CSSAnimation).animationName === 'wy-clock'
    )
}

/** Los dígitos se asientan de izquierda a derecha durante `dur` ms. */
function scramble(el: HTMLElement, esperar: number, dur: number) {
  const nodo = el.firstChild
  if (!(nodo instanceof Text)) return () => {}
  const final = nodo.data
  const chars = Array.from(final)
  const digitos = chars.flatMap((c, i) => (/\d/.test(c) ? [i] : []))
  const html = document.documentElement
  let raf = 0
  let t0 = 0
  const paso = (ahora: number) => {
    // Si se saltó la intro (overlay oculto), no se sigue animando.
    if (html.dataset.intro !== 'play') {
      nodo.data = final
      return
    }
    if (!t0) t0 = ahora
    const p = Math.min(1, (ahora - t0) / dur)
    const asentados = Math.floor(p * digitos.length)
    const salida = chars.slice()
    digitos.forEach((pos, k) => {
      if (k >= asentados) salida[pos] = String(Math.floor(Math.random() * 10))
    })
    nodo.data = p < 1 ? salida.join('') : final
    if (p < 1) raf = requestAnimationFrame(paso)
  }
  const id = window.setTimeout(() => {
    raf = requestAnimationFrame(paso)
  }, esperar)
  return () => {
    window.clearTimeout(id)
    cancelAnimationFrame(raf)
    nodo.data = final
  }
}

export function IntroHandoff() {
  useEffect(() => {
    const html = document.documentElement
    if (html.dataset.intro !== 'play') return
    const root = document.querySelector<HTMLElement>('.wy-intro')
    const reloj = root ? relojDe(root) : undefined
    const ahora = Number(reloj?.currentTime ?? 0)

    // Hidrató tarde: deja que termine el fallback CSS (no lo interrumpas).
    // Se espera al final del revelado CSS del hero (≈3020 ms, antes del tope
    // de 3200): «done» quita esa animación y, si llega antes, los bloques
    // con --i alto saltarían ~12 px a su sitio. El overlay ya es invisible
    // (visibility: hidden) desde 2470 ms, así que esperar no se nota.
    if (!root || !reloj || ahora > INTRO.t.handoff - 100) {
      const id = window.setTimeout(
        terminar,
        Math.max(0, INTRO.t.fallbackFin - ahora)
      )
      return () => window.clearTimeout(id)
    }

    html.dataset.introJs = '1'
    let cancelado = false
    const limpiezas: Array<() => void> = []

    // Scramble de las coordenadas (solo si llegamos antes de que suban).
    const coords = root.querySelector<HTMLElement>('[data-wy-intro-coords]')
    if (coords && ahora < INTRO.t.coords) {
      limpiezas.push(scramble(coords, INTRO.t.coords - ahora, INTRO.t.scramble))
    }

    // El hero empieza a subir a los 2250 ms (solo transform).
    const idReveal = window.setTimeout(
      () => {
        if (html.dataset.intro === 'play') html.dataset.introReveal = '1'
      },
      Math.max(0, INTRO.t.reveal - ahora)
    )
    limpiezas.push(() => window.clearTimeout(idReveal))

    // Al cambiar el atributo la animación wy-clock sigue viva (mismo nombre),
    // pero se vuelve a pedir por si el navegador la recreó.
    const clock = relojDe(root) ?? reloj

    clock.finished
      .then(async () => {
        if (cancelado || html.dataset.intro !== 'play') return
        const mark = root.querySelector<HTMLElement>('[data-wy-intro-mark]')
        const paper = root.querySelector<HTMLElement>('[data-wy-intro-paper]')
        const dotEl = root.querySelector('[data-wy-intro-dot]')
        if (!mark || !paper || !dotEl) {
          terminar()
          return
        }

        const dot = dotEl.getBoundingClientRect()
        const a = mark.getBoundingClientRect()
        paper.style.setProperty('--wy-x', `${dot.left + dot.width / 2}px`)
        paper.style.setProperty('--wy-y', `${dot.top + dot.height / 2}px`)
        // El portal descubre la página: desde aquí los clics llegan a ella
        // (el listener del <head> sigue saltando la intro con el pointerdown).
        root.style.pointerEvents = 'none'

        const decor = Array.from(
          root.querySelectorAll<HTMLElement>('[data-wy-intro-decor]')
        )
        const trabajos: Promise<unknown>[] = [
          animate(decor, { opacity: 0 }, { duration: 0.16, ease: SALIDA })
            .finished,
        ]

        // FLIP medido hacia el logo real del header. Spring suave 260/30
        // (§7.1). La precisión de reposo va por valor: 0,001 en la escala
        // (§9.8) pero el umbral por defecto (0,5 px) en x/y; con 0,001 px el
        // muelle tardaba ~1 s en «terminar» y «done» llegaba a ~3,1 s en
        // lugar de ≈2,7 s, con el clon tapando el logo real.
        const target = document.querySelector<HTMLElement>('[data-wy-logo]')
        const b = target?.getBoundingClientRect()
        if (b && b.width > 0 && a.width > 0) {
          const muelle = {
            type: 'spring',
            stiffness: 260,
            damping: 30,
          } as const
          trabajos.push(
            animate(
              mark,
              {
                x: b.left + b.width / 2 - (a.left + a.width / 2),
                y: b.top + b.height / 2 - (a.top + a.height / 2),
                scale: b.width / a.width,
              },
              { ...muelle, scale: { ...muelle, restDelta: 0.001 } }
            ).finished
          )
        } else {
          trabajos.push(
            animate(mark, { opacity: 0 }, { duration: 0.2 }).finished
          )
        }

        // Portal circular desde el punto (o fundido en equipos modestos).
        if (lowEnd()) {
          trabajos.push(
            animate(paper, { opacity: 0 }, { duration: 0.32, ease: SALIDA })
              .finished
          )
        } else {
          paper.dataset.portal = ''
          const radio = Math.hypot(window.innerWidth, window.innerHeight)
          trabajos.push(
            animate(
              paper,
              { '--wy-r': ['0px', `${radio}px`] },
              { duration: 0.52, delay: 0.05, ease: PORTAL }
            ).finished
          )
        }

        await Promise.all(trabajos)
        terminar()
      })
      // Si el reloj se cancela por un salto (o la pestaña se oculta), el
      // script del <head> ya hace el fundido de 200 ms y pone «done»: no lo
      // cortamos. Solo cerramos si se canceló estando aún en «play».
      .catch(() => {
        if (html.dataset.intro === 'play') terminar()
      })

    return () => {
      cancelado = true
      limpiezas.forEach((fn) => fn())
    }
  }, [])

  return null
}
