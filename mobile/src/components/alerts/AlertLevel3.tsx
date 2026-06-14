import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native'
import type { AlertMessage } from '../../types/alert'

interface Props {
  retrasoMinutos: number
  aiMessage: AlertMessage | null
  aiLoading: boolean
  onAceptar: () => void
  onRechazar: () => void
}

export function AlertLevel3({
  retrasoMinutos,
  aiMessage,
  aiLoading,
  onAceptar,
  onRechazar,
}: Props): React.ReactElement {
  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.badge}>Nivel 3</Text>
            <Text style={styles.title}>⏳ {retrasoMinutos} min de retraso</Text>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {aiLoading && (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={styles.loadingText}>
                  Analizando tu itinerario...
                </Text>
              </View>
            )}

            {aiMessage && !aiLoading && (
              <>
                <Text style={styles.aiMessage}>
                  {aiMessage.mensajeAmigable}
                </Text>

                {aiMessage.actividadRecomendarQuitar && (
                  <View style={styles.recommendation}>
                    <Text style={styles.recLabel}>Recomendación:</Text>
                    <Text style={styles.recText}>
                      Quitar esta actividad ahorra{' '}
                      <Text style={styles.recHighlight}>
                        {aiMessage.tiempoQueAhorra} min
                      </Text>
                    </Text>
                    <Text style={styles.recReason}>
                      {aiMessage.razonSimple}
                    </Text>
                  </View>
                )}

                {aiMessage.alternativa && (
                  <View style={styles.alternative}>
                    <Text style={styles.altText}>{aiMessage.alternativa}</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={onAceptar}
            >
              <Text style={styles.btnPrimaryText}>Aceptar recomendación</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={onRechazar}
            >
              <Text style={styles.btnSecondaryText}>Continuar igual</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  header: { marginBottom: 16 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  content: { marginBottom: 24 },
  loading: { alignItems: 'center', paddingVertical: 32, gap: 16 },
  loadingText: { fontSize: 14, color: '#6B7280' },
  aiMessage: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
    marginBottom: 20,
  },
  recommendation: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  recLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
    marginBottom: 4,
  },
  recText: { fontSize: 15, color: '#1E3A5F', marginBottom: 4 },
  recHighlight: { fontWeight: '700', color: '#1D4ED8' },
  recReason: { fontSize: 13, color: '#3B82F6' },
  alternative: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
  },
  altText: { fontSize: 14, color: '#15803D', lineHeight: 20 },
  buttons: { gap: 12 },
  btn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: '#2563EB' },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  btnSecondary: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  btnSecondaryText: { color: '#374151', fontSize: 15, fontWeight: '600' },
})
