import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/supabase/client';
import { useAuthStore } from '../../../src/store/auth.store';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../../src/constants/theme';
import { Logo } from '../../../src/components/ui/Logo';
import type { Residence } from '../../../src/types';

interface SyndicItem {
  residence: Residence;
  admin_email: string | null;
  manager_email: string | null;
  apartment_count: number;
}

export default function SuperuserDashboard() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const [items, setItems] = useState<SyndicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const { data: residences, error } = await supabase
        .from('residences')
        .select('*')
        .order('name');

      if (error) throw error;

      const enriched: SyndicItem[] = await Promise.all(
        (residences ?? []).map(async (r) => {
          const { data: users } = await supabase
            .from('user_residences')
            .select('role, profiles(email)')
            .eq('residence_id', r.id);

          const adminUser = (users ?? []).find(u => u.role === 'admin');
          const managerUser = (users ?? []).find(u => u.role === 'manager');

          const { count } = await supabase
            .from('apartments')
            .select('*', { count: 'exact', head: true })
            .eq('residence_id', r.id)
            .eq('active', true);

          return {
            residence: r,
            admin_email: (adminUser?.profiles as any)?.email ?? null,
            manager_email: (managerUser?.profiles as any)?.email ?? null,
            apartment_count: count ?? 0,
          };
        })
      );

      setItems(enriched);
    } catch (e) {
      console.error('[Superuser] Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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
            <Text style={styles.headerTitle}>Entreprises</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/(superuser)/syndic/new')}
          >
            <Ionicons name="add" size={22} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Global stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{items.length}</Text>
          <Text style={styles.statLabel}>Syndics</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{items.reduce((s, i) => s + i.apartment_count, 0)}</Text>
          <Text style={styles.statLabel}>Appartements</Text>
        </View>
      </View>

      {/* Syndics list */}
      <FlatList
        data={items}
        keyExtractor={i => i.residence.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="business-outline" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>Aucun syndic</Text>
            <Text style={styles.emptyText}>Créez votre premier syndic avec le bouton +</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.syndicCard}
            onPress={() => router.push(`/(superuser)/syndics/${item.residence.id}`)}
          >
            {/* Card header */}
            <View style={styles.syndicHeader}>
              <View style={styles.syndicIconWrap}>
                <Ionicons name="business" size={22} color={Colors.primary} />
              </View>
              <View style={styles.syndicInfo}>
                <Text style={styles.syndicName}>{item.residence.name}</Text>
                {item.residence.address && (
                  <Text style={styles.syndicAddress}>{item.residence.address}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
            </View>

            {/* Stats row */}
            <View style={styles.syndicStats}>
              <View style={styles.syndicStat}>
                <Ionicons name="home-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.syndicStatText}>{item.apartment_count} app.</Text>
              </View>
              <View style={styles.syndicStat}>
                <Ionicons name="cash-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.syndicStatText}>{item.residence.monthly_fee} {item.residence.currency}/mois</Text>
              </View>
            </View>

            {/* Users */}
            <View style={styles.usersList}>
              <UserRow
                icon="shield-checkmark"
                label="Admin"
                email={item.admin_email}
                color={Colors.primary}
              />
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function UserRow({ icon, label, email, color }: {
  icon: string;
  label: string;
  email: string | null;
  color: string;
}) {
  return (
    <View style={userStyles.row}>
      <Ionicons name={icon as any} size={14} color={color} />
      <Text style={userStyles.label}>{label}</Text>
      <Text style={[userStyles.email, !email && { color: Colors.textMuted, fontStyle: 'italic' }]}>
        {email ?? 'Non assigné'}
      </Text>
    </View>
  );
}

const userStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  label: { fontSize: FontSize.xs, color: Colors.textSecondary, width: 52 },
  email: { fontSize: FontSize.xs, color: Colors.textPrimary, flex: 1 },
});

const styles = StyleSheet.create({
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
    width: 38, height: 38, borderRadius: Radius.full,
    backgroundColor: Colors.navyCard, alignItems: 'center', justifyContent: 'center',
  },
  addBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    ...Shadow.green,
  },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.navyCard,
    marginHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  statDivider: { width: 1, backgroundColor: Colors.navyBorder },

  list: { paddingHorizontal: Spacing.xl, gap: Spacing.md, paddingBottom: 32 },

  syndicCard: {
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  syndicHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  syndicIconWrap: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center',
  },
  syndicInfo: { flex: 1 },
  syndicName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  syndicAddress: { fontSize: FontSize.xs, color: Colors.textSecondary },

  syndicStats: { flexDirection: 'row', gap: Spacing.xl },
  syndicStat: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  syndicStatText: { fontSize: FontSize.xs, color: Colors.textSecondary },

  usersList: {
    gap: Spacing.xs,
    backgroundColor: Colors.navyBorder,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },

  emptyState: { alignItems: 'center', gap: Spacing.md, padding: Spacing.huge },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
