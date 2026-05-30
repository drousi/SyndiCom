import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';
import { useSyncStore } from '../../store/sync.store';

export function SyncIndicator() {
  const { status, pendingCount, lastSyncedAt } = useSyncStore();

  if (status === 'idle' && pendingCount === 0) return null;

  const getIconName = () => {
    switch (status) {
      case 'syncing': return 'sync-outline';
      case 'success': return 'checkmark-circle-outline';
      case 'error': return 'warning-outline';
      case 'offline': return 'cloud-offline-outline';
      default: return 'time-outline';
    }
  };

  const getColor = () => {
    switch (status) {
      case 'syncing': return Colors.info;
      case 'success': return Colors.success;
      case 'error': return Colors.danger;
      case 'offline': return Colors.warning;
      default: return Colors.textSecondary;
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'syncing': return 'Synchronisation...';
      case 'success': return 'Synchronisé';
      case 'error': return `${pendingCount} en attente`;
      case 'offline': return 'Hors ligne';
      default: return `${pendingCount} non synchronisé${pendingCount > 1 ? 's' : ''}`;
    }
  };

  return (
    <View style={[styles.container, { borderColor: getColor() }]}>
      <Ionicons name={getIconName() as any} size={12} color={getColor()} />
      <Text style={[styles.label, { color: getColor() }]}>{getLabel()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    backgroundColor: Colors.navyCard,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
});
