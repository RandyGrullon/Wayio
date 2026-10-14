import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useEstilos, useTheme, type Tema } from '../../theme'
import { Txt } from './Txt'
import { AlertCircle, CheckCircle2, Info } from './iconos'

type Tono = 'exito' | 'error' | 'info'

interface Accion {
  label: string
  onPress: () => void
}

interface ToastItem {
  id: number
  mensaje: string
  tono: Tono
  accion?: Accion
}

interface Opciones {
  accion?: Accion
}

interface ContextoToast {
  toast: (mensaje: string, tono?: Tono, opciones?: Opciones) => void
  success: (mensaje: string, opciones?: Opciones) => void
  error: (mensaje: string, opciones?: Opciones) => void
  /** Desplazamiento extra sobre el borde inferior (barra inferior fija). */
  setOffset: (px: number) => void
}

const ToastContext = createContext<ContextoToast | null>(null)

const MAX = 3

/**
 * Avisos efímeros (§5.8): abajo al centro, tinta invertida, 5 s (8 s con
 * acción). Se anuncian al lector de pantalla. Máximo 3 apilados.
 */
export function ToastProvider({
  children,
}: {
  children: ReactNode
}): React.ReactElement {
  const [items, setItems] = useState<ToastItem[]>([])
  const [offset, setOffset] = useState(0)
  const siguiente = useRef(1)
  const insets = useSafeAreaInsets()

  const quitar = useCallback((id: number) => {
    setItems((xs) => xs.filter((x) => x.id !== id))
  }, [])

  const toast = useCallback(
    (mensaje: string, tono: Tono = 'info', opciones: Opciones = {}) => {
      const id = siguiente.current++
      setItems((xs) =>
        [
          ...xs,
          {
            id,
            mensaje,
            tono,
            ...(opciones.accion ? { accion: opciones.accion } : {}),
          },
        ].slice(-MAX)
      )
      AccessibilityInfo.announceForAccessibility(mensaje)
    },
    []
  )

  const value = useMemo<ContextoToast>(
    () => ({
      toast,
      success: (m, o) => toast(m, 'exito', o),
      error: (m, o) => toast(m, 'error', o),
      setOffset,
    }),
    [toast]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View
        pointerEvents="box-none"
        style={[styles.pila, { bottom: insets.bottom + 16 + offset }]}
      >
        {items.map((t) => (
          <ToastVista key={t.id} item={t} onFin={quitar} />
        ))}
      </View>
    </ToastContext.Provider>
  )
}

function ToastVista({
  item,
  onFin,
}: {
  item: ToastItem
  onFin: (id: number) => void
}): React.ReactElement {
  const { colors, motion } = useTheme()
  const estilos = useEstilos(crearEstilos)
  const [entrada] = useState(() => new Animated.Value(0))
  const Icono =
    item.tono === 'exito'
      ? CheckCircle2
      : item.tono === 'error'
        ? AlertCircle
        : Info
  const colorIcono =
    item.tono === 'exito'
      ? colors.toastSuccess
      : item.tono === 'error'
        ? colors.toastDanger
        : colors.fgInverse

  useEffect(() => {
    Animated.timing(entrada, {
      toValue: 1,
      duration: 220,
      easing: motion.easing.papel,
      useNativeDriver: true,
    }).start()
    const t = setTimeout(
      () => {
        Animated.timing(entrada, {
          toValue: 0,
          duration: 160,
          easing: motion.easing.salida,
          useNativeDriver: true,
        }).start(() => onFin(item.id))
      },
      item.accion ? 8000 : 5000
    )
    return () => clearTimeout(t)
  }, [entrada, item.id, item.accion, onFin, motion.easing])

  return (
    <Animated.View
      accessibilityLiveRegion={item.tono === 'error' ? 'assertive' : 'polite'}
      style={[
        estilos.toast,
        {
          opacity: entrada,
          transform: [
            {
              translateY: entrada.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Icono
        size={18}
        color={colorIcono}
        strokeWidth={1.75}
        accessible={false}
      />
      <Txt variant="bodyS" color="fgInverse" style={estilos.texto}>
        {item.mensaje}
      </Txt>
      {item.accion ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.accion.label}
          hitSlop={10}
          onPress={() => {
            item.accion?.onPress()
            onFin(item.id)
          }}
        >
          <Txt variant="label" style={{ color: colors.toastAction }}>
            {item.accion.label}
          </Txt>
        </Pressable>
      ) : null}
    </Animated.View>
  )
}

/** Fuera del provider no hace nada (no lanza). */
export function useToast(): ContextoToast {
  return (
    useContext(ToastContext) ?? {
      toast: () => undefined,
      success: () => undefined,
      error: () => undefined,
      setOffset: () => undefined,
    }
  )
}

const styles = StyleSheet.create({
  pila: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    gap: 8,
    zIndex: 900,
    elevation: 900,
  },
})

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      maxWidth: 400,
      width: '100%',
      borderRadius: t.radius.control,
      backgroundColor: t.colors.surfaceInverse,
      paddingHorizontal: 16,
      paddingVertical: 12,
      ...t.elevation.float,
    },
    texto: { flex: 1, fontFamily: t.fonts.sansMedium, fontSize: 14 },
  })
