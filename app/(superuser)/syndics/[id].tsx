import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/supabase/client';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../../src/constants/theme';
import { ROLE_LABELS } from '../../../src/constants/app';
import type { UserResidenceWithProfile, Residence } from '../../../src/types';
import { ActionSheet, ActionSheetOption } from '../../../src/components/ui/ActionSheet';

export default function SyndicDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [residence, setResidence] = useState<Residence | null>(null);
  const [users, setUsers] = useState<UserResidenceWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResidenceWithProfile | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const { data: resData, error: resError } = await supabase
        .from('residences')
        .select('*')
        .eq('id', id)
        .single();
      
      if (resError) throw resError;
      setResidence(resData);

      const { data: usersData, error: usersError } = await supabase
        .from('user_residences')
        .select('*, profiles(full_name, email, phone)')
        .eq('residence_id', id);

      if (usersError) throw usersError;

      const formatted = (usersData ?? []).map((ur: any) => ({
        user_id: ur.user_id,
        residence_id: ur.residence_id,
        role: ur.role,
        created_at: ur.created_at,
        updated_at: ur.updated_at,
        full_name: ur.profiles?.full_name,
        email: ur.profiles?.email,
        phone: ur.profiles?.phone,
      }));

      setUsers(formatted);
    } catch (e) {
      console.error('[SyndicDetails] Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleChangeRole = (user: UserResidenceWithProfile) => {
    setSelectedUser(user);
    setActionSheetVisible(true);
  };

  const executeRoleChange = async (newRole: string) => {
    if (!selectedUser) return;
    try {
      await supabase
        .from('user_residences')
        .update({ role: newRole })
        .eq('user_id', selectedUser.user_id)
        .eq('residence_id', id);
      loadData();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message);
    }
  };

  const handleRemoveUser = async () => {
    if (!selectedUser) return;
    try {
      await supabase
        .from('user_residences')
        .delete()
        .eq('user_id', selectedUser.user_id)
        .eq('residence_id', id);
      loadData();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message);
    }
  };

  const getActionSheetOptions = (): ActionSheetOption[] => {
    if (!selectedUser) return [];
    return [
      {
        label: 'Nommer Admin',
        icon: 'shield-checkmark-outline',
        onPress: () => executeRoleChange('admin'),
      },
      {
        label: 'Nommer Gérant (Manager)',
        icon: 'briefcase-outline',
        onPress: () => executeRoleChange('manager'),
      },
      {
        label: 'Nommer Résident',
        icon: 'person-outline',
        onPress: () => executeRoleChange('resident'),
      },
      {
        label: 'Retirer de la résidence',
        icon: 'trash-outline',
        destructive: true,
        onPress: () => {
          // Still use a basic alert for the destructive confirmation, 
          // or we could use another modal, but a basic alert is standard for "Are you sure?"
          setTimeout(() => {
            Alert.alert('Confirmation', 'Retirer cet utilisateur de la résidence ?', [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Retirer', style: 'destructive', onPress: handleRemoveUser }
            ]);
          }, 300); // Wait for modal to close
        },
      }
    ];
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1, paddingHorizontal: Spacing.md }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{residence?.name}</Text>
          <Text style={styles.headerSub}>{residence?.address ?? 'Aucune adresse'}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={users}
        keyExtractor={item => item.user_id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Aucun utilisateur dans ce syndic</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.userCard}>
            <View style={styles.userIconWrap}>
              <Text style={styles.userIconText}>
                {item.full_name?.charAt(0)?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{item.full_name || 'Utilisateur'}</Text>
              <Text style={styles.userEmail}>{item.email}</Text>
              {item.phone && <Text style={styles.userPhone}>{item.phone}</Text>}
            </View>
            
            <TouchableOpacity 
              style={[
                styles.roleBadge,
                item.role === 'admin' && { backgroundColor: Colors.dangerLight },
                item.role === 'manager' && { backgroundColor: Colors.warningLight },
              ]}
              onPress={() => handleChangeRole(item)}
            >
              <Text style={[
                styles.roleBadgeText,
                item.role === 'admin' && { color: Colors.danger },
                item.role === 'manager' && { color: Colors.warning },
              ]}>
                {ROLE_LABELS[item.role] || item.role}
              </Text>
              <Ionicons 
                name="chevron-down" 
                size={12} 
                color={item.role === 'admin' ? Colors.danger : item.role === 'manager' ? Colors.warning : Colors.primary} 
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>
          </View>
        )}
      />

      <ActionSheet
        visible={actionSheetVisible}
        title="Modifier le rôle"
        subtitle={`Choisissez un nouveau rôle pour ${selectedUser?.full_name || selectedUser?.email}`}
        options={getActionSheetOptions()}
        onClose={() => {
          setActionSheetVisible(false);
          setSelectedUser(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navy },
  loadingContainer: { flex: 1, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center' },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: 56,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.navyCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.white },
  headerSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  
  list: { padding: Spacing.xl, gap: Spacing.md, paddingBottom: 48 },
  
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  userIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center', justifyContent: 'center',
  },
  userIconText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  userInfo: { flex: 1 },
  userName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.white },
  userEmail: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  userPhone: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  roleBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.primary },

  emptyState: { alignItems: 'center', padding: Spacing.xl },
  emptyText: { color: Colors.textSecondary },
});
