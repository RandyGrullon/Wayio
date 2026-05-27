import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import type { UseOfflineSyncReturn } from '../hooks/useOfflineSync'

type Props = Pick<UseOfflineSyncReturn, 'isOnline' | 'pendingCount' | 'syncNow'>

export function OfflineIndicator({
  isOnline,
  pendingCount,
  syncNow,
}: Props): React.ReactElement | null {
  if (isOnline && pendingCount === 0) return null

  return (
    <View
      style={[
        styles.container,
        isOnline ? styles.onlinePending : styles.offline,
      ]}
    >
      <Text style={styles.text}>
        {isOnline
          ? `${pendingCount} cambios sin sincronizar`
          : 'Sin conexión — modo offline'}
      </Text>
      {isOnline && pendingCount > 0 && (
        <TouchableOpacity onPress={() => void syncNow()} style={styles.button}>
          <Text style={styles.buttonText}>Sincronizar</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  offline: {
    backgroundColor: '#EF4444',
  },
  onlinePending: {
    backgroundColor: '#F59E0B',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
})
