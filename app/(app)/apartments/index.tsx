import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../../src/supabase/client';
import { Logo } from '../../../src/components/ui/Logo';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../src/store/auth.store';
import { getApartmentsByResidence, deleteApartment } from '../../../src/db/repositories/apartments';
import { Badge } from '../../../src/components/ui/Badge';
import { DropdownMenu, DropdownOption } from '../../../src/components/ui/DropdownMenu';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../../src/constants/theme';
import type { Apartment } from '../../../src/types';

export default function ApartmentsScreen() {
  const router = useRouter();
  const { activeResidence, profile, hasPermission } = useAuthStore();
  const canWrite = hasPermission('write');
  const canDelete = hasPermission('delete');
  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!activeResidence) { 
      console.log('[Apartments] No active residence');
      setLoading(false); 
      return; 
    }
    console.log('[Apartments] Loading for residence:', activeResidence.id);
    try {
      const data = await getApartmentsByResidence(activeResidence.id);
      console.log('[Apartments] Loaded data count:', data.length);
      setApartments(data);
    } catch (e) {
      console.error('[Apartments] Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeResidence]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleDelete = (id: string, number: string) => {
    Alert.alert(
      `Désactiver App. ${number}`,
      'L\'appartement sera marqué comme inactif. Les données seront conservées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Désactiver',
          style: 'destructive',
          onPress: async () => {
            await deleteApartment(id, profile?.id);
            loadData();
          },
        },
      ]
    );
  };

  const activeCount = apartments.filter(a => a.active).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Logo width={110} height={31} />
            <Text style={styles.headerTitle}>Appartements</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={apartments}
        keyExtractor={a => a.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="business-outline" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>Aucun appartement</Text>
            <Text style={styles.emptyText}>Commencez par ajouter les appartements de votre résidence.</Text>
            {canWrite && (
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(app)/apartments/new')}>
                <Ionicons name="add" size={16} color={Colors.white} />
                <Text style={styles.emptyBtnText}>Ajouter un appartement</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item: apt }) => {
          const menuOptions: DropdownOption[] = [];

          if (canWrite) {
            menuOptions.push({
              label: 'Modifier',
              icon: 'pencil-outline',
              onPress: () => router.push(`/(app)/apartments/${apt.id}`),
            });
          }
          if (canDelete && apt.active) {
            menuOptions.push({
              label: 'Désactiver',
              icon: 'power-outline',
              destructive: true,
              onPress: () => handleDelete(apt.id, apt.number),
            });
          }

          return (
            <View style={[styles.aptCard, !apt.active && styles.aptCardInactive]}>
              <View style={[styles.aptBadge, { backgroundColor: apt.active ? Colors.primarySurface : Colors.navyBorder }]}>
                <Text style={[styles.aptNumber, { color: apt.active ? Colors.primary : Colors.textSecondary }]}>
                  {apt.number}
                </Text>
              </View>
              <View style={styles.aptInfo}>
                <Text style={styles.aptOwner}>{apt.owner_name ?? 'Propriétaire inconnu'}</Text>
                {apt.floor != null && <Text style={styles.aptDetail}>Étage {apt.floor}</Text>}
                {apt.phone && <Text style={styles.aptDetail}>{apt.phone}</Text>}
              </View>
              <View style={styles.aptRight}>
                <Badge label={apt.active ? 'Actif' : 'Inactif'} variant={apt.active ? 'success' : 'neutral'} />
                {(canWrite || canDelete) && menuOptions.length > 0 && (
                  <DropdownMenu options={menuOptions}>
                    <Ionicons name="ellipsis-vertical" size={18} color={Colors.textSecondary} />
                  </DropdownMenu>
                )}
              </View>
            </View>
          );
        }}
      />

      {canWrite && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/(app)/apartments/new')}
        >
          <Ionicons name="add" size={28} color={Colors.white} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navy },
  loadingContainer: { flex: 1, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: 56,
    paddingBottom: Spacing.lg,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  notifBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.navyCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.green,
  },

  list: { paddingHorizontal: Spacing.xl, gap: Spacing.sm, paddingBottom: 32 },
  aptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  aptCardInactive: { opacity: 0.6 },
  aptBadge: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aptNumber: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold },
  aptInfo: { flex: 1, gap: 2 },
  aptOwner: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  aptDetail: { fontSize: FontSize.xs, color: Colors.textSecondary },
  aptRight: { alignItems: 'flex-end', gap: Spacing.sm },

  emptyState: { alignItems: 'center', gap: Spacing.md, padding: Spacing.huge },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  emptyBtnText: { color: Colors.white, fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
});
