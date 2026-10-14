import { useEffect, useState, type ReactNode } from 'react'
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useEstilos, useTheme, type Tema } from '../../theme'
import { IconButton } from './IconButton'
import { Txt } from './Txt'
import { useReduceMotion } from './useReduceMotion'
import { X } from './iconos'

interface Props {
  visible: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  /** Botonera fija al pie (Cancelar a la izquierda, principal a la derecha). */
  footer?: ReactNode
  /** Sin ScrollView interno (contenido con su propio scroll, p. ej. chat). */
  sinScroll?: boolean
}

/**
 * Hoja inferior (§5.6): velo `overlay`, panel `surfaceRaised` con radio 24,
 * asa, título en Newsreader y cierre de 44 con «Cerrar». Se cierra con el
 * velo, con el botón y con «atrás» en Android. Respeta el área segura.
 */
export function Sheet({
  visible,
  onClose,
  title,
  description,
  children,
  footer,
  sinScroll = false,
}: Props): React.ReactElement {
  const { motion } = useTheme()
  const styles = useEstilos(crearEstilos)
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const reducir = useReduceMotion()
  const [entrada] = useState(() => new Animated.Value(0))

  useEffect(() => {
    if (!visible) return
    if (reducir) {
      entrada.setValue(1)
      return
    }
    entrada.setValue(0)
    Animated.timing(entrada, {
      toValue: 1,
      duration: 380,
      easing: motion.easing.papel,
      useNativeDriver: true,
    }).start()
  }, [visible, reducir, entrada, motion.easing.papel])

  const contenido = (
    <>
      {children}
      {footer ? <View style={styles.pie}>{footer}</View> : null}
    </>
  )

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.flex}>
          <Pressable
            style={styles.velo}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          />
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.panel,
              {
                maxHeight: height * 0.9,
                paddingBottom: Math.max(16, insets.bottom + 8),
                transform: [
                  {
                    translateY: entrada.interpolate({
                      inputRange: [0, 1],
                      outputRange: [Math.min(320, height * 0.4), 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.asa} />
            {title ? (
              <View style={styles.cabecera}>
                <View style={styles.titulos}>
                  <Txt variant="h3">{title}</Txt>
                  {description ? (
                    <Txt variant="bodyS" color="fgMuted" style={styles.desc}>
                      {description}
                    </Txt>
                  ) : null}
                </View>
                <IconButton label="Cerrar" icon={X} onPress={onClose} />
              </View>
            ) : null}
            {sinScroll ? (
              <View style={[styles.cuerpo, styles.flexShrink]}>
                {contenido}
              </View>
            ) : (
              <ScrollView
                style={styles.flexShrink}
                contentContainerStyle={styles.cuerpo}
                keyboardShouldPersistTaps="handled"
              >
                {contenido}
              </ScrollView>
            )}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    flex: { flex: 1, justifyContent: 'flex-end' },
    flexShrink: { flexShrink: 1 },
    velo: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: t.colors.overlay,
    },
    panel: {
      backgroundColor: t.colors.surfaceRaised,
      borderTopLeftRadius: t.radius.sheet,
      borderTopRightRadius: t.radius.sheet,
      borderWidth: t.isDark ? 1 : 0,
      borderColor: t.colors.border,
      ...t.elevation.float,
    },
    asa: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 999,
      backgroundColor: t.colors.rule,
      marginTop: 8,
      marginBottom: 4,
    },
    cabecera: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingLeft: 20,
      paddingRight: 8,
      paddingTop: 8,
    },
    titulos: { flex: 1, paddingTop: 8 },
    desc: { marginTop: 4 },
    cuerpo: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    pie: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 16,
    },
  })
