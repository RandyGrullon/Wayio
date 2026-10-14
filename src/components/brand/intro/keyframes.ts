/**
 * Generador del CSS de la intro (docs/DISENO.md §9.6). Función pura: se
 * evalúa una vez por proceso en el Server Component y su salida va en un
 * <style> del SSR, así la intro arranca con el primer paint sin esperar a
 * la hidratación.
 */
import { AROS, CURVAS, DECOR, INTRO, TRAZOS } from './timeline'
import type { Punto } from './timeline'

/** Curva cúbica de Bézier (como la de CSS): devuelve y(x). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const X = (t: number) => ((ax * t + bx) * t + cx) * t
  const Y = (t: number) => ((ay * t + by) * t + cy) * t
  const dX = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (x: number) => {
    // Newton-Raphson y, si no converge, bisección.
    let t = x
    for (let i = 0; i < 8; i++) {
      const e = X(t) - x
      if (Math.abs(e) < 1e-6) return Y(t)
      const d = dX(t)
      if (Math.abs(d) < 1e-6) break
      t -= e / d
    }
    let lo = 0
    let hi = 1
    t = x
    for (let i = 0; i < 40 && Math.abs(X(t) - x) > 1e-6; i++) {
      if (X(t) < x) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return Y(t)
  }
}

/** Punto de una Bézier cuadrática a→(c)→b en u ∈ [0, 1]. */
export function quad(a: Punto, c: Punto, b: Punto, u: number): Punto {
  const k = 1 - u
  return [
    k * k * a[0] + 2 * u * k * c[0] + u * u * b[0],
    k * k * a[1] + 2 * u * k * c[1] + u * u * b[1],
  ]
}

const f = (n: number) => +n.toFixed(3)

export interface PuntoEstela {
  cx: number
  cy: number
  /** ms desde el primer paint en que el punto pasa por aquí. */
  delay: number
}

export interface IntroKeyframes {
  /** CSS completo: @keyframes generados + reglas por elemento. */
  css: string
  trailDots: PuntoEstela[]
}

export function buildIntroKeyframes(): IntroKeyframes {
  const { W, FLIGHT, t, segEase, flyEase, samples, trail } = INTRO
  const seg = `cubic-bezier(${segEase.join(',')})`

  // Longitudes de los cuatro tramos de la w.
  const lens: number[] = []
  for (let i = 1; i < W.length; i++) {
    const a = W[i - 1]
    const b = W[i]
    if (a && b) lens.push(Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const total = lens.reduce((s, l) => s + l, 0)

  // Trazo de la w: dashoffset en cada vértice con la misma curva que el
  // punto, para que la punta y el punto vayan en sincronía exacta.
  let acc = 0
  const w = [`0%{stroke-dashoffset:100;animation-timing-function:${seg}}`]
  for (const L of lens) {
    acc += L
    const p = (acc / total) * 100
    w.push(
      `${f(p)}%{stroke-dashoffset:${f(100 - p)};animation-timing-function:${seg}}`
    )
  }

  // Punto: recorre la w frenando en los vértices y luego vuela en arco.
  const span = t.flyEnd - t.wStart
  const pct = (ms: number) => `${f(((ms - t.wStart) / span) * 100)}%`
  const origen = W[0]
  const dot = [
    `0%{transform:translate(${origen[0]}px,${origen[1]}px);animation-timing-function:${seg}}`,
  ]
  acc = 0
  lens.forEach((L, i) => {
    acc += L
    const v = W[i + 1]
    if (!v) return
    const ms = t.wStart + (acc / total) * (t.wEnd - t.wStart)
    const curva = i < lens.length - 1 ? seg : 'linear'
    dot.push(
      `${pct(ms)}{transform:translate(${v[0]}px,${v[1]}px);animation-timing-function:${curva}}`
    )
  })
  const ease = cubicBezier(flyEase[0], flyEase[1], flyEase[2], flyEase[3])
  for (let i = 1; i <= samples; i++) {
    const tau = i / samples
    const u = ease(tau)
    const [x, y] = quad(FLIGHT.from, FLIGHT.ctrl, FLIGHT.to, u)
    // Se encoge un 10 % en el ápice: perspectiva de vuelo.
    const s = 1 - 0.1 * Math.sin(Math.PI * u)
    dot.push(
      `${pct(t.wEnd + tau * (t.flyEnd - t.wEnd))}{transform:translate(${f(x)}px,${f(y)}px) scale(${f(s)})}`
    )
  }

  // Estela: cada punto aparece cuando el punto pasa por u = k/(n+1).
  const inv = (y: number) => {
    let lo = 0
    let hi = 1
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2
      if (ease(m) < y) lo = m
      else hi = m
    }
    return (lo + hi) / 2
  }
  const trailDots = Array.from({ length: trail }, (_, k): PuntoEstela => {
    const u = (k + 1) / (trail + 1)
    const [cx, cy] = quad(FLIGHT.from, FLIGHT.ctrl, FLIGHT.to, u)
    return {
      cx: f(cx),
      cy: f(cy),
      delay: Math.round(t.wEnd + inv(u) * (t.flyEnd - t.wEnd)),
    }
  })

  // Reglas por elemento (los nombres de @keyframes estáticos viven en intro.css).
  const reglas: string[] = [
    `.wy-intro [data-t="w"]{animation:wy-w ${t.wEnd - t.wStart}ms linear ${t.wStart}ms both}`,
    `.wy-intro .dot-move{animation:wy-dot ${span}ms linear ${t.wStart}ms both}`,
    `.wy-intro .dot-squash{animation:wy-squash ${DECOR.squash.dur}ms linear ${DECOR.squash.delay}ms both}`,
    `.wy-intro .dot-pop{animation:wy-pop ${DECOR.pop.dur}ms ${CURVAS.sello} ${DECOR.pop.delay}ms both}`,
    `.wy-intro .ghost{animation:wy-ghost ${DECOR.fantasma.dur}ms linear ${DECOR.fantasma.delay}ms both}`,
    // Las animaciones CSS van en el hijo (.wy-intro__in / __grid-in): el
    // relevo desvanece el contenedor [data-wy-intro-decor] con framer-motion
    // y un fill-mode CSS en el mismo nodo pisaría su estilo final.
    `.wy-intro__grid-in{animation:wy-grid ${DECOR.reticula.dur}ms ${CURVAS.papel} ${DECOR.reticula.delay}ms both}`,
    `.wy-intro__tag>.wy-intro__in{animation:wy-rise8 ${DECOR.tagline.dur}ms ${CURVAS.papel} ${DECOR.tagline.delay}ms both}`,
    `.wy-intro__coords>.wy-intro__in{animation:wy-rise8 ${DECOR.coords.dur}ms ${CURVAS.papel} ${DECOR.coords.delay}ms both}`,
    `.wy-intro__hint>.wy-intro__in{animation:wy-fade ${DECOR.hint.dur}ms linear ${DECOR.hint.delay}ms both}`,
  ]
  for (const tr of TRAZOS) {
    reglas.push(
      `.wy-intro [data-t="${tr.path}"]{animation:wy-draw ${tr.dur}ms ${tr.ease} ${tr.delay}ms both}`
    )
  }
  for (const aro of AROS) {
    // fill-mode forwards + opacidad base 0: no se ven antes de empezar.
    reglas.push(
      `.wy-intro [data-t="${aro.id}"]{animation:${aro.anim} ${aro.dur}ms ${CURVAS.papel} ${aro.delay}ms forwards}`
    )
  }
  trailDots.forEach((d, k) => {
    reglas.push(
      `.wy-intro [data-trail="${k}"]{animation:wy-trail ${DECOR.estela.dur}ms linear ${d.delay}ms both}`
    )
  })

  return {
    css: `@keyframes wy-w{${w.join('')}}@keyframes wy-dot{${dot.join('')}}${reglas.join('')}`,
    trailDots,
  }
}
