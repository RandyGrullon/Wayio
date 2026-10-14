import { useState } from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { useEstilos, type Tema } from '../../theme'
import { Button } from './Button'
import { Txt } from './Txt'

interface Props {
  visible: boolean
  onClose: () => void
  /** Si devuelve una promesa, muestra el spinner y cierra al resolver. */
  onConfirm: () => void | Promise<void>
  /** En forma de pregunta: «¿Eliminar este viaje?». */
  title: string
  description?: string
  /** Verbo exacto: «Eliminar viaje». */
  confirmLabel: string
  loadingLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'neutral'
}

/**
 * Diálogo de confirmación (§5.6). Sustituye a las confirmaciones nativas
 * para acciones destructivas: es el único sitio donde va el botón `danger`.
 */
export function ConfirmDialog({
  visible,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  loadingLabel,
  cancelLabel = 'Cancelar',
  tone = 'danger',
}: Props): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const [cargando, setCargando] = useState(false)

  const confirmar = async (): Promise<void> => {
    try {
      setCargando(true)
      await onConfirm()
      onClose()
    } catch {
      // El error lo muestra quien llama; el diálogo queda abierto.
    } finally {
      setCargando(false)
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.centro}>
        <Pressable
          style={styles.velo}
          onPress={cargando ? undefined : onClose}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
        />
        <View
          style={styles.panel}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          <Txt variant="h3">{title}</Txt>
          {description ? (
            <Txt variant="bodyS" color="fgMuted" style={styles.desc}>
              {description}
            </Txt>
          ) : null}
          <View style={styles.botones}>
            <Button
              title={cancelLabel}
              variant="outline"
              onPress={onClose}
              disabled={cargando}
            />
            <Button
              title={confirmLabel}
              variant={tone === 'danger' ? 'danger' : 'tinta'}
              loading={cargando}
              {...(loadingLabel ? { loadingText: loadingLabel } : {})}
              onPress={() => void confirmar()}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    centro: { flex: 1, justifyContent: 'center', padding: 16 },
    velo: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: t.colors.overlay,
    },
    panel: {
      backgroundColor: t.colors.surfaceRaised,
      borderRadius: t.radius.sheet,
      borderWidth: t.isDark ? 1 : 0,
      borderColor: t.colors.border,
      padding: 24,
      ...t.elevation.float,
    },
    desc: { marginTop: 8 },
    botones: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 24,
    },
  })
