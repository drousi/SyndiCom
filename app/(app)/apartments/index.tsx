import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { openWhatsApp } from '../../../src/utils/whatsapp';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../../src/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import { Logo } from '../../../src/components/ui/Logo';
import { useAuthStore } from '../../../src/store/auth.store';
import { getApartmentsByResidence, deleteApartment } from '../../../src/db/repositories/apartments';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { FAB } from '../../../src/components/ui/FAB';
import { Badge } from '../../../src/components/ui/Badge';
import { DropdownMenu, DropdownOption } from '../../../src/components/ui/DropdownMenu';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../../src/constants/theme';
import { useLanguageStore } from '../../../src/store/language.store';
import type { Apartment } from '../../../src/types';

export default function ApartmentsScreen() {
  const router = useRouter();
  const { activeResidence, profile, hasPermission } = useAuthStore();
  const canWrite = hasPermission('write');
  const canDelete = hasPermission('delete');
  const Colors = useThemeColors();
  const { t } = useLanguageStore();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!activeResidence) { 
      setLoading(false); 
      return; 
    }
    try {
      const data = await getApartmentsByResidence(activeResidence.id);
      setApartments(data);
    } catch (e) {
      console.error('[Apartments] Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeResidence]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const sendGenericWhatsAppReminder = (apt: Apartment) => {
    const phone = apt.phone || apt.whatsapp;
    if (!phone) {
      Alert.alert(
        'Coordonnées manquantes',
        `Aucun numéro de téléphone ou WhatsApp n'est configuré pour l'appartement ${apt.number}.`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: t('common.edit'), onPress: () => router.push(`/(app)/apartments/${apt.id}`) }
        ]
      );
      return;
    }
    
    const message = `Bonjour ${apt.owner_name || ''},\n\nC'est le syndic de la résidence *${activeResidence?.name || ''}*.\nNous vous contactons pour le suivi des cotisations de l'appartement *${apt.number}*.\n\nMerci de bien vouloir régulariser vos cotisations en retard dès que possible ou de nous envoyer le justificatif si c'est déjà fait.\n\nCordialement.`;

    openWhatsApp(phone, message);
  };

  const handleDelete = (id: string, number: string) => {
    Alert.alert(
      t('apartments.deactivate_confirm_title', { number }),
      t('apartments.deactivate_confirm_desc'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.deactivate'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteApartment(id, profile?.id);
              loadData();
            } catch (e) {
              Alert.alert(t('common.error'), t('apartments.deactivate_error'));
            }
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
      <ScreenHeader title={t('apartments.title')} />

      <FlatList
        data={apartments}
        keyExtractor={a => a.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="business-outline"
            title={t('apartments.empty_title')}
            description={t('apartments.empty_desc')}
          >
            {canWrite && (
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(app)/apartments/new')}>
                <Ionicons name="add" size={16} color={Colors.white} />
                <Text style={styles.emptyBtnText}>{t('apartments.add_apartment')}</Text>
              </TouchableOpacity>
            )}
          </EmptyState>
        }
        renderItem={({ item: apt }) => {
          const menuOptions: DropdownOption[] = [];

          if (canWrite) {
            menuOptions.push({
              label: t('common.edit'),
              icon: 'pencil-outline',
              onPress: () => router.push(`/(app)/apartments/${apt.id}`),
            });
            if (apt.active) {
              menuOptions.push({
                label: t('apartments.whatsapp_remind'),
                icon: 'logo-whatsapp',
                onPress: () => sendGenericWhatsAppReminder(apt),
              });
            }
          }
          if (canDelete && apt.active) {
            menuOptions.push({
              label: t('common.deactivate'),
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
                <Text style={styles.aptOwner}>{apt.owner_name ?? t('apartments.owner_unknown')}</Text>
                {apt.floor != null && <Text style={styles.aptDetail}>{t('apartments.floor', { floor: apt.floor })}</Text>}
                {apt.phone && <Text style={styles.aptDetail}>{apt.phone}</Text>}
              </View>
              <View style={styles.aptRight}>
                <Badge label={apt.active ? t('common.active') : t('common.inactive')} variant={apt.active ? 'success' : 'neutral'} />
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
        <FAB onPress={() => router.push('/(app)/apartments/new')} />
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
