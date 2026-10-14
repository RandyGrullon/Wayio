/**
 * Piezas locales del modo en vivo: Hoja (bottom sheet modal), Sello, Aviso
 * (callout) y BotonInverso (ghost sobre superficie de tinta). Siguen los
 * tokens de theme.ts y la spec §5.
 *
 * ui/ ya tiene Sheet, Callout y SelloInfo, pero aún no cubren lo que pide el
 * modo en vivo: Hoja lleva kicker con icono, role="alert" con anuncio y
 * acciones apiladas a todo el ancho (los 3 pasos de «Me la perdí»); Sello
 * parte en dos líneas los textos largos («Disponible sin conexión · guardado
 * 8 oct, 2:32 p. m.») sin desbordar a 375; Aviso admite un Button con
 * `loading` como acción. Cuando ui/ tenga esas variantes, se sustituyen.
 */
import { useEffect, useState, type ReactNode } from 'react'
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { alpha, useEstilos, useTheme, type Tema } from '../../theme'
import { Txt } from '../ui/Txt'
import { IconButton } from '../ui/IconButton'
import { X, type LucideIcon } from '../ui/iconos'
import { useReduceMotion } from '../ui/useReduceMotion'

// ── Hoja ───────────────────────────────────────────────────────────────────

interface HojaProps {
  visible: boolean
  onClose: () => void
  /** Título accesible y visible de la hoja. */
  titulo?: string
  /** Overline sobre el título. */
  kicker?: string
  kickerIcon?: LucideIcon
  /** role="alert": se anuncia al abrirse (embarque, retrasos). */
  alerta?: boolean
  /** Si false, tocar fuera o «atrás» no cierra (se llama a onClose igual). */
  cerrable?: boolean
  children: ReactNode
  /** Acciones fijas al pie. */
  acciones?: ReactNode
}

/**
 * Bottom sheet modal (§5.6): papel elevado, radio 24, velo `overlay`, sin
 * gestos de arrastre (evita conflictos con el mapa). Con movimiento reducido
 * aparece con fundido en vez de deslizarse.
 */
export function Hoja({
  visible,
  onClose,
  titulo,
  kicker,
  kickerIcon: IconoKicker,
  alerta = false,
  cerrable = true,
  children,
  acciones,
}: HojaProps): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const { colors } = useTheme()
  const reducir = useReduceMotion()

  useEffect(() => {
    if (visible && alerta && titulo) {
      AccessibilityInfo.announceForAccessibility(titulo)
    }
  }, [visible, alerta, titulo])

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducir ? 'fade' : 'slide'}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.velo}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={cerrable ? onClose : undefined}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          accessible={cerrable}
          importantForAccessibility={cerrable ? 'auto' : 'no'}
        />
        <SafeAreaView
          edges={['bottom']}
          style={styles.hoja}
          accessibilityViewIsModal
          {...(alerta ? { accessibilityRole: 'alert' as const } : {})}
        >
          <View style={styles.asa} accessible={false} />
          {titulo || kicker ? (
            <View style={styles.cabecera}>
              <View style={styles.titulos}>
                {kicker ? (
                  <View style={styles.kicker}>
                    {IconoKicker ? (
                      <IconoKicker
                        size={14}
                        color={colors.fgMuted}
                        strokeWidth={1.75}
                        accessible={false}
                      />
                    ) : null}
                    <Txt variant="overline" color="fgMuted">
                      {kicker}
                    </Txt>
                  </View>
                ) : null}
                {titulo ? <Txt variant="h2">{titulo}</Txt> : null}
              </View>
              {cerrable ? (
                <IconButton
                  label="Cerrar"
                  icon={X}
                  onPress={onClose}
                  size="sm"
                />
              ) : null}
            </View>
          ) : null}
          <ScrollView
            style={styles.cuerpo}
            contentContainerStyle={styles.cuerpoContenido}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
          {acciones ? <View style={styles.acciones}>{acciones}</View> : null}
        </SafeAreaView>
      </View>
    </Modal>
  )
}

// ── Sello ──────────────────────────────────────────────────────────────────

type TonoSello = 'tinta' | 'mar' | 'laton' | 'aviso'

/** Sello informativo (§5.5): 12 px, mayúsculas, sin rotar. */
export function Sello({
  children,
  icon: Icono,
  tono = 'mar',
  style,
}: {
  children: ReactNode
  icon?: LucideIcon
  tono?: TonoSello
  style?: StyleProp<ViewStyle>
}): React.ReactElement {
  const { colors } = useTheme()
  const color =
    tono === 'tinta'
      ? colors.fg
      : tono === 'laton'
        ? colors.brassText
        : tono === 'aviso'
          ? colors.warningFg
          : colors.accent
  return (
    <View
      style={[estilosSello.base, { borderColor: alpha(color, 0.55) }, style]}
    >
      {Icono ? (
        <Icono size={13} color={color} strokeWidth={1.75} accessible={false} />
      ) : null}
      <Txt
        variant="overline"
        style={[estilosSello.texto, { color }]}
        numberOfLines={2}
      >
        {children}
      </Txt>
    </View>
  )
}

const estilosSello = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  texto: { letterSpacing: 1.2, flexShrink: 1 },
})

// ── Aviso (callout) ────────────────────────────────────────────────────────

export type TonoAviso = 'info' | 'warning' | 'success' | 'danger'

interface AvisoProps {
  tono?: TonoAviso
  icon: LucideIcon
  titulo?: string
  children?: ReactNode
  /** Acción opcional a la derecha o debajo (un Button sm o link). */
  accion?: ReactNode
  /** Se anuncia al aparecer (sin robar el foco). */
  vivo?: boolean
  style?: StyleProp<ViewStyle>
}

/** Callout (§5): icono + texto; el estado nunca se comunica solo con color. */
export function Aviso({
  tono = 'info',
  icon: Icono,
  titulo,
  children,
  accion,
  vivo = false,
  style,
}: AvisoProps): React.ReactElement {
  const { colors } = useTheme()
  const fondo =
    tono === 'warning'
      ? colors.warningBg
      : tono === 'success'
        ? colors.successBg
        : tono === 'danger'
          ? colors.dangerBg
          : colors.infoBg
  const tinta =
    tono === 'warning'
      ? 'warningFg'
      : tono === 'success'
        ? 'successFg'
        : tono === 'danger'
          ? 'dangerFg'
          : 'infoFg'
  return (
    <View
      style={[estilosAviso.base, { backgroundColor: fondo }, style]}
      accessible={!accion}
      {...(vivo ? { accessibilityLiveRegion: 'polite' as const } : {})}
    >
      <Icono
        size={18}
        color={colors[tinta]}
        strokeWidth={1.75}
        accessible={false}
        style={estilosAviso.icono}
      />
      <View style={estilosAviso.textos}>
        {titulo ? (
          <Txt variant="label" color={tinta}>
            {titulo}
          </Txt>
        ) : null}
        {children ? (
          <Txt variant="bodyS" color={tinta}>
            {children}
          </Txt>
        ) : null}
        {accion ? <View style={estilosAviso.accion}>{accion}</View> : null}
      </View>
    </View>
  )
}

const estilosAviso = StyleSheet.create({
  base: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  icono: { marginTop: 2 },
  textos: { flex: 1, gap: 2 },
  accion: { marginTop: 6, alignItems: 'flex-start' },
})

// ── BotonInverso ───────────────────────────────────────────────────────────

/** Botón ghost sobre superficie de tinta (la variante no existe en ui/Button). */
export function BotonInverso({
  title,
  onPress,
  icon: Icono,
  accessibilityHint,
}: {
  title: string
  onPress: () => void
  icon?: LucideIcon
  accessibilityHint?: string
}): React.ReactElement {
  const { colors, fonts } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      hitSlop={4}
      style={({ pressed }) => [
        estilosInverso.base,
        {
          borderColor: alpha(colors.fgInverse, 0.6),
          backgroundColor: pressed
            ? alpha(colors.fgInverse, 0.14)
            : 'transparent',
        },
      ]}
    >
      {Icono ? (
        <Icono
          size={18}
          color={colors.fgInverse}
          strokeWidth={1.75}
          accessible={false}
        />
      ) : null}
      <Txt
        variant="label"
        color="fgInverse"
        maxFontSizeMultiplier={1.4}
        numberOfLines={1}
        style={{ fontFamily: fonts.sansSemiBold }}
      >
        {title}
      </Txt>
    </Pressable>
  )
}

const estilosInverso = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
})

// ── Aparición ──────────────────────────────────────────────────────────────

/**
 * Entrada «aterriza» (§7): sube 8 px y aparece. Con movimiento reducido,
 * solo fundido. Una sola vez, sin bucles.
 */
export function Aparece({
  children,
  style,
  retraso = 0,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  retraso?: number
}): React.ReactElement {
  const reducir = useReduceMotion()
  const [valor] = useState(() => new Animated.Value(0))
  useEffect(() => {
    const anim = Animated.timing(valor, {
      toValue: 1,
      duration: 280,
      delay: retraso,
      useNativeDriver: true,
    })
    anim.start()
    return () => anim.stop()
  }, [valor, retraso])
  const translateY = valor.interpolate({
    inputRange: [0, 1],
    outputRange: [reducir ? 0 : 8, 0],
  })
  return (
    <Animated.View
      style={[style, { opacity: valor, transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    velo: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: t.colors.overlay,
    },
    hoja: {
      backgroundColor: t.colors.surfaceRaised,
      borderTopLeftRadius: t.radius.sheet,
      borderTopRightRadius: t.radius.sheet,
      paddingHorizontal: t.space.gutter + 4,
      paddingTop: t.space[2],
      maxHeight: '88%',
      borderWidth: t.isDark ? 1 : 0,
      borderColor: t.colors.border,
      ...(t.isDark ? {} : t.elevation.float),
    },
    asa: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.rule,
      marginBottom: t.space[3],
    },
    cabecera: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: t.space[3],
      marginBottom: t.space[3],
    },
    titulos: { flex: 1, gap: t.space[1] },
    kicker: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cuerpo: { flexGrow: 0 },
    cuerpoContenido: { gap: t.space[3], paddingBottom: t.space[4] },
    acciones: {
      gap: t.space[2],
      paddingTop: t.space[2],
      paddingBottom: t.space[4],
    },
  })
