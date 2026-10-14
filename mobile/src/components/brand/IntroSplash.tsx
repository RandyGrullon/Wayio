import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native'
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../theme'
import { COORDS_SDQ, TAGLINE, WORDMARK, LARGOS } from './marks'
import type { WordmarkPath } from './marks'
import {
  AROS,
  ESTELA,
  RADIO_ESTELA,
  T,
  TIEMPOS,
  aro,
  dashoffset,
  estela,
  fantasma,
  muestrear,
  pista,
  punto,
  reticula,
  subir,
  trazoVisible,
} from './introLinea'
import { medirDestinoIntro, setIntroActiva } from './introEstado'

const APath = Animated.createAnimatedComponent(Path)
const ACircle = Animated.createAnimatedComponent(Circle)
const AEllipse = Animated.createAnimatedComponent(Ellipse)

/** Diámetro del punto del splash nativo (app.json → imageWidth: 20). */
const DIAMETRO_SPLASH = 20

/** Margen del lienzo alrededor del wordmark (vuelo, ondas, ping). */
const LIENZO = { x: -12, y: -17, w: 180, h: 96 } as const

const ORDEN_TRAZOS: readonly WordmarkPath[] = [
  'w',
  'aBowl',
  'aStem',
  'yArm',
  'yTail',
  'iStem',
  'o',
]

// Retícula de carta náutica en vertical (5 meridianos, 4 paralelos).
const MERIDIANOS = [
  'M40 0 Q10 400 40 800',
  'M120 0 Q105 400 120 800',
  'M200 0 V800',
  'M280 0 Q295 400 280 800',
  'M360 0 Q390 400 360 800',
]
const PARALELOS = [
  'M0 170 Q200 150 400 170',
  'M0 330 Q200 318 400 330',
  'M0 490 Q200 484 400 490',
  'M0 650 Q200 648 400 650',
]

const EASE_PAPEL = Easing.bezier(0.22, 1, 0.36, 1)

interface Props {
  /** Primer fotograma pintado: ocultar el splash nativo (relevo invisible). */
  onListo: () => void
  /** La intro terminó (o se saltó): desmontar el overlay. */
  onTerminar: () => void
}

/**
 * Intro de marca «La ruta llega» (§9.9). El primer fotograma es idéntico al
 * splash nativo (el punto rosa centrado); el punto traza la w frenando en
 * cada vértice, despega en arco dejando estela, aterriza como el punto de la
 * i (squash + háptico + ondas GPS) y el logo vuela a la cabecera mientras el
 * papel se funde. Se salta con un toque. No se monta con movimiento reducido
 * ni con lector de pantalla (lo decide App.tsx).
 */
export function IntroSplash({
  onListo,
  onTerminar,
}: Props): React.ReactElement {
  const { colors, fonts } = useTheme()
  const ventana = useWindowDimensions()
  const insets = useSafeAreaInsets()
  // Tamaño real del overlay (pantalla completa, también bajo las barras del
  // sistema): así el punto queda en el mismo centro que el del splash nativo.
  const [caja, setCaja] = useState<{ w: number; h: number } | null>(null)
  const width = caja?.w ?? ventana.width
  const height = caja?.h ?? ventana.height

  const ancho = Math.round(Math.min(320, Math.max(240, width * 0.68)))
  const escala = ancho / WORDMARK.ancho
  const lienzoW = LIENZO.w * escala
  const lienzoH = LIENZO.h * escala
  const r0 = DIAMETRO_SPLASH / 2 / escala
  const altoMarca = WORDMARK.alto * escala

  const [reloj] = useState(() => new Animated.Value(0))
  // Valores del relevo (driver nativo, independientes del reloj).
  const [papel] = useState(() => new Animated.Value(1))
  const [todo] = useState(() => new Animated.Value(1))
  const [marcaOpacidad] = useState(() => new Animated.Value(1))
  const [tx] = useState(() => new Animated.Value(0))
  const [ty] = useState(() => new Animated.Value(0))
  const [sc] = useState(() => new Animated.Value(1))
  const saltarRef = useRef<() => void>(() => undefined)
  const listoRef = useRef(false)
  // Medidas vigentes para el relevo (sin reiniciar el reloj si cambian).
  const medidas = useRef({ w: width, h: height, ancho })
  useEffect(() => {
    medidas.current = { w: width, h: height, ancho }
  })

  const anim = useMemo(() => {
    const i = (fn: (t: number) => number) =>
      reloj.interpolate({
        inputRange: TIEMPOS,
        outputRange: muestrear(fn),
        extrapolate: 'clamp',
      })
    const trazos = Object.fromEntries(
      ORDEN_TRAZOS.map((p) => [
        p,
        {
          offset: i((t) => dashoffset(p, t)),
          opacity: i((t) => trazoVisible(p, t)),
        },
      ])
    ) as Record<
      WordmarkPath,
      {
        offset: Animated.AnimatedInterpolation<number>
        opacity: Animated.AnimatedInterpolation<number>
      }
    >
    const aroAnim = (a: (typeof AROS)[keyof typeof AROS]) => ({
      r: i((t) => aro(t, a.a, a.b, a.escala, a.opacidad).r),
      opacity: i((t) => aro(t, a.a, a.b, a.escala, a.opacidad).opacity),
    })
    return {
      trazos,
      punto: {
        cx: i((t) => punto(t, r0).cx),
        cy: i((t) => punto(t, r0).cy),
        rx: i((t) => punto(t, r0).rx),
        ry: i((t) => punto(t, r0).ry),
      },
      fantasma: i(fantasma),
      ping: aroAnim(AROS.ping),
      onda1: aroAnim(AROS.onda1),
      onda2: aroAnim(AROS.onda2),
      estela: ESTELA.map((e) => i((t) => estela(t, e.aparece))),
      tagline: {
        opacity: i((t) => subir(t, 1200, 1440).opacity),
        y: i((t) => subir(t, 1200, 1440).y),
      },
      coords: {
        opacity: i((t) => subir(t, 1260, 1500).opacity),
        y: i((t) => subir(t, 1260, 1500).y),
      },
      pista: i(pista),
      reticula: {
        opacity: i((t) => reticula(t).opacity),
        escala: i((t) => reticula(t).escala),
      },
    }
  }, [reloj, r0])

  useEffect(() => {
    let terminado = false
    const timers: ReturnType<typeof setTimeout>[] = []

    const terminar = (): void => {
      if (terminado) return
      terminado = true
      timers.forEach(clearTimeout)
      // El logo real de la cabecera aparece en el mismo commit en que se
      // desmonta el overlay.
      setIntroActiva(false)
      onTerminar()
    }

    const relevo = async (): Promise<void> => {
      const destino = await medirDestinoIntro()
      if (terminado) return
      const anims: Animated.CompositeAnimation[] = [
        Animated.timing(papel, {
          toValue: 0,
          duration: 300,
          delay: 40,
          easing: EASE_PAPEL,
          useNativeDriver: true,
        }),
      ]
      if (destino) {
        const m = medidas.current
        const cx = m.w / 2
        const cy = m.h / 2
        const config = {
          duration: T.relevoDuracion,
          easing: EASE_PAPEL,
          useNativeDriver: true,
        }
        anims.push(
          Animated.timing(tx, {
            ...config,
            toValue: destino.x + destino.w / 2 - cx,
          }),
          Animated.timing(ty, {
            ...config,
            toValue: destino.y + destino.h / 2 - cy,
          }),
          Animated.timing(sc, { ...config, toValue: destino.w / m.ancho })
        )
      } else {
        anims.push(
          Animated.timing(marcaOpacidad, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          })
        )
      }
      Animated.parallel(anims).start(() => terminar())
    }

    Animated.timing(reloj, {
      toValue: T.fin,
      duration: T.fin,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start()

    timers.push(
      setTimeout(() => {
        // El punto aterriza como el punto de la i.
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
          () => undefined
        )
      }, T.aterrizaje),
      setTimeout(() => {
        void relevo()
      }, T.relevo),
      // Tope duro: pase lo que pase, la app queda libre.
      setTimeout(terminar, T.tope)
    )

    saltarRef.current = () => {
      if (terminado) return
      reloj.stopAnimation()
      Animated.timing(todo, {
        toValue: 0,
        duration: 200,
        easing: Easing.bezier(0.4, 0, 1, 1),
        useNativeDriver: true,
      }).start(() => terminar())
    }

    return () => {
      terminado = true
      timers.forEach(clearTimeout)
      reloj.stopAnimation()
    }
  }, [reloj, papel, todo, marcaOpacidad, tx, ty, sc, onTerminar])

  const { paths } = WORDMARK
  const vb = `${LIENZO.x} ${LIENZO.y} ${LIENZO.w} ${LIENZO.h}`

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.capa, { opacity: todo }]}
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout
        setCaja((c) => (c && c.w === w && c.h === h ? c : { w, h }))
        if (listoRef.current) return
        listoRef.current = true
        onListo()
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => saltarRef.current()}
        accessible={false}
      >
        {/* Papel: se funde en el relevo (el hero ya está pintado debajo). */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.bg, opacity: papel },
          ]}
        />

        {/* Retícula de carta náutica */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: anim.reticula.opacity,
              transform: [{ scale: anim.reticula.escala }],
            },
          ]}
        >
          <Svg
            width="100%"
            height="100%"
            viewBox="0 0 400 800"
            preserveAspectRatio="xMidYMid slice"
          >
            <Defs>
              <RadialGradient
                id="wyIntroFade"
                cx="200"
                cy="400"
                r="380"
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0" stopColor={colors.rule} stopOpacity="1" />
                <Stop offset="0.6" stopColor={colors.rule} stopOpacity="0.6" />
                <Stop offset="1" stopColor={colors.rule} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <G fill="none" stroke="url(#wyIntroFade)" strokeWidth={1}>
              {MERIDIANOS.concat(PARALELOS).map((d) => (
                <Path key={d} d={d} />
              ))}
            </G>
          </Svg>
        </Animated.View>

        {/* La marca: vuela a la cabecera en el relevo */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.marca,
            {
              width: lienzoW,
              height: lienzoH,
              left: width / 2 - lienzoW / 2,
              top: height / 2 - lienzoH / 2,
              opacity: marcaOpacidad,
              transform: [
                { translateX: tx },
                { translateY: ty },
                { scale: sc },
              ],
            },
          ]}
        >
          <Svg width={lienzoW} height={lienzoH} viewBox={vb}>
            {/* W fantasma punteada: el plan antes del viaje */}
            <APath
              d={paths.w}
              fill="none"
              stroke={colors.rule}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeDasharray="0.1 4.2"
              opacity={anim.fantasma}
            />
            <G
              fill="none"
              stroke={colors.fg}
              strokeWidth={WORDMARK.stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {ORDEN_TRAZOS.map((p) => {
                const largo = LARGOS[p]
                return (
                  <APath
                    key={p}
                    d={paths[p]}
                    strokeDasharray={`${largo} ${largo * 2}`}
                    strokeDashoffset={anim.trazos[p].offset}
                    opacity={anim.trazos[p].opacity}
                  />
                )
              })}
            </G>
            {/* Ping de origen y ondas GPS del aterrizaje */}
            <ACircle
              cx={AROS.ping.centro[0]}
              cy={AROS.ping.centro[1]}
              r={anim.ping.r}
              fill="none"
              stroke={colors.primary}
              strokeWidth={AROS.ping.trazo}
              opacity={anim.ping.opacity}
            />
            <ACircle
              cx={AROS.onda1.centro[0]}
              cy={AROS.onda1.centro[1]}
              r={anim.onda1.r}
              fill="none"
              stroke={colors.primary}
              strokeWidth={AROS.onda1.trazo}
              opacity={anim.onda1.opacity}
            />
            <ACircle
              cx={AROS.onda2.centro[0]}
              cy={AROS.onda2.centro[1]}
              r={anim.onda2.r}
              fill="none"
              stroke={colors.primary}
              strokeWidth={AROS.onda2.trazo}
              opacity={anim.onda2.opacity}
            />
            {/* Estela del vuelo, como la de un avión en un mapa */}
            <G>
              {ESTELA.map((e, k) => (
                <ACircle
                  key={k}
                  cx={e.cx}
                  cy={e.cy}
                  r={RADIO_ESTELA}
                  fill={colors.primary}
                  opacity={anim.estela[k] ?? 0}
                />
              ))}
            </G>
            {/* El punto: se desliza, traza, vuela y aterriza */}
            <AEllipse
              cx={anim.punto.cx}
              cy={anim.punto.cy}
              rx={anim.punto.rx}
              ry={anim.punto.ry}
              fill={colors.primary}
            />
          </Svg>
        </Animated.View>

        {/* Tagline */}
        <Animated.Text
          style={[
            styles.tagline,
            {
              top: height / 2 + altoMarca / 2 + 26,
              color: colors.fgMuted,
              fontFamily: fonts.sansSemiBold,
              opacity: anim.tagline.opacity,
              transform: [{ translateY: anim.tagline.y }],
            },
          ]}
          maxFontSizeMultiplier={1.2}
        >
          {TAGLINE.toUpperCase()}
        </Animated.Text>

        {/* Coordenadas de Santo Domingo, con los dígitos asentándose */}
        <Animated.View
          style={[
            styles.pie,
            {
              bottom: insets.bottom + 48,
              opacity: anim.coords.opacity,
              transform: [{ translateY: anim.coords.y }],
            },
          ]}
        >
          <Coordenadas color={colors.fgSubtle} fuente={fonts.mono} />
        </Animated.View>

        <Animated.Text
          style={[
            styles.pista,
            {
              bottom: insets.bottom + 20,
              color: colors.fgSubtle,
              fontFamily: fonts.sansMedium,
              opacity: anim.pista,
            },
          ]}
          maxFontSizeMultiplier={1.2}
        >
          Toca para saltar
        </Animated.Text>
      </Pressable>
    </Animated.View>
  )
}

const DIGITOS = '0123456789'

/** Coordenadas con «scramble»: los dígitos se asientan de izquierda a derecha. */
function Coordenadas({
  color,
  fuente,
}: {
  color: string
  fuente: string
}): React.ReactElement {
  const [texto, setTexto] = useState(() => COORDS_SDQ.replace(/\d/g, '0'))

  useEffect(() => {
    const inicio = 1260
    const duracion = 300
    let intervalo: ReturnType<typeof setInterval> | null = null
    const arranque = setTimeout(() => {
      const t0 = Date.now()
      const posiciones = [...COORDS_SDQ]
        .map((c, i) => (/\d/.test(c) ? i : -1))
        .filter((i) => i >= 0)
      intervalo = setInterval(() => {
        const p = Math.min(1, (Date.now() - t0) / duracion)
        const fijos = Math.floor(p * posiciones.length)
        const chars = [...COORDS_SDQ]
        posiciones.forEach((pos, k) => {
          if (k >= fijos) {
            chars[pos] = DIGITOS[Math.floor(Math.random() * 10)] ?? '0'
          }
        })
        setTexto(chars.join(''))
        if (p >= 1 && intervalo) {
          clearInterval(intervalo)
          setTexto(COORDS_SDQ)
        }
      }, 33)
    }, inicio)
    return () => {
      clearTimeout(arranque)
      if (intervalo) clearInterval(intervalo)
    }
  }, [])

  return (
    <Animated.Text
      style={[styles.coords, { color, fontFamily: fuente }]}
      maxFontSizeMultiplier={1.2}
    >
      {texto}
    </Animated.Text>
  )
}

const styles = StyleSheet.create({
  capa: { zIndex: 1000, elevation: 1000 },
  marca: { position: 'absolute' },
  tagline: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 1.7,
  },
  pie: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  coords: { fontSize: 12, lineHeight: 16, letterSpacing: 1 },
  pista: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
  },
})
