import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActionSheet, ActionSheetOption } from '../../../src/components/ui/ActionSheet';
import { supabase } from '../../../src/supabase/client';
import { useAuthStore } from '../../../src/store/auth.store';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius } from '../../../src/constants/theme';
import { ROLE_LABELS } from '../../../src/constants/app';
import type { UserResidenceWithProfile, ResidenceRole } from '../../../src/types';

export default function UsersSettingsScreen() {
  const router = useRouter();
  const { activeResidence, hasPermission } = useAuthStore();
  const [users, setUsers] = useState<UserResidenceWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResidenceWithProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [actionUser, setActionUser] = useState<UserResidenceWithProfile | null>(null);

  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const canManageUsers = hasPermission('manageUsers');

  const loadUsers = useCallback(async () => {
    if (!activeResidence) return;
    try {
      const { data, error } = await supabase
        .from('user_residences')
        .select('*, profiles(full_name, email, phone)')
        .eq('residence_id', activeResidence.id);

      if (error) throw error;

      const formatted = (data ?? []).map((ur: any) => ({
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
      console.error('[Users] Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeResidence]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleChangeRole = (user: UserResidenceWithProfile) => {
    if (!canManageUsers) return;
    setActionUser(user);
    setActionSheetVisible(true);
  };

  const getActionSheetOptions = (): ActionSheetOption[] => {
    if (!actionUser) return [];
    return [
      {
        label: 'Forcer un nouveau mot de passe',
        icon: 'key-outline',
        onPress: () => {
          setSelectedUser(actionUser);
          setNewPassword('');
          setActionSheetVisible(false);
          setTimeout(() => setPasswordModalVisible(true), 400);
        }
      },
      {
        label: 'Détacher de son appartement',
        icon: 'unlink-outline',
        onPress: () => {
          setActionSheetVisible(false);
          setTimeout(() => {
            Alert.alert(
              'Détacher l\'utilisateur',
              'Êtes-vous sûr de vouloir libérer l\'appartement de ce résident ?',
              [
                { text: 'Annuler', style: 'cancel' },
                {
                  text: 'Détacher',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await supabase
                        .from('apartments')
                        .update({ resident_user_id: null })
                        .eq('resident_user_id', actionUser.user_id)
                        .eq('residence_id', activeResidence?.id);
                      Alert.alert('Succès', 'Le résident a été détaché.');
                      loadUsers();
                    } catch (e: any) {
                      Alert.alert('Erreur', e?.message);
                    }
                  }
                }
              ]
            );
          }, 400);
        }
      },
      {
        label: actionUser.role === 'manager' ? 'Nommer Résident (enlever Gérant)' : 'Nommer Gérant (Manager)',
        icon: 'briefcase-outline',
        onPress: async () => {
          setActionSheetVisible(false);
          try {
            if (actionUser.role !== 'manager') {
              const currentManager = users.find(u => u.role === 'manager');
              if (currentManager) {
                await supabase.from('user_residences').update({ role: 'resident' }).eq('user_id', currentManager.user_id).eq('residence_id', activeResidence?.id);
              }
              await supabase.from('user_residences').update({ role: 'manager' }).eq('user_id', actionUser.user_id).eq('residence_id', activeResidence?.id);
            } else {
              await supabase.from('user_residences').update({ role: 'resident' }).eq('user_id', actionUser.user_id).eq('residence_id', activeResidence?.id);
            }
            loadUsers();
          } catch (e: any) { Alert.alert('Erreur', e?.message); }
        }
      },
      {
        label: actionUser.role === 'admin' ? 'Nommer Résident (enlever Admin)' : 'Nommer Administrateur',
        icon: 'shield-checkmark-outline',
        onPress: async () => {
          setActionSheetVisible(false);
          try {
            await supabase.from('user_residences').update({ role: actionUser.role === 'admin' ? 'resident' : 'admin' }).eq('user_id', actionUser.user_id).eq('residence_id', activeResidence?.id);
            loadUsers();
          } catch (e: any) { Alert.alert('Erreur', e?.message); }
        }
      },
      {
        label: 'Détacher de ses appartements',
        icon: 'unlink-outline',
        onPress: () => {
          setActionSheetVisible(false);
          setTimeout(() => {
            Alert.alert(
              'Confirmation',
              `Voulez-vous vraiment détacher ${actionUser.full_name || 'cet utilisateur'} de tous ses appartements ? (Il restera membre de la résidence)`,
              [
                { text: 'Annuler', style: 'cancel' },
                {
                  text: 'Détacher',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await supabase.from('apartments')
                        .update({ resident_user_id: null })
                        .eq('resident_user_id', actionUser.user_id)
                        .eq('residence_id', activeResidence?.id);
                      Alert.alert('Succès', 'L\'utilisateur a été détaché de ses appartements.');
                    } catch (e: any) { Alert.alert('Erreur', e?.message); }
                  }
                }
              ]
            );
          }, 400);
        }
      },
      {
        label: 'Supprimer de la résidence',
        icon: 'trash-outline',
        destructive: true,
        onPress: () => {
          setActionSheetVisible(false);
          setTimeout(() => {
            Alert.alert(
              'Confirmation',
              `Voulez-vous vraiment retirer ${actionUser.full_name || 'cet utilisateur'} de la résidence ?`,
              [
                { text: 'Annuler', style: 'cancel' },
                {
                  text: 'Retirer',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await supabase.from('user_residences').delete().eq('user_id', actionUser.user_id).eq('residence_id', activeResidence?.id);
                      await supabase.from('apartments').update({ resident_user_id: null }).eq('resident_user_id', actionUser.user_id).eq('residence_id', activeResidence?.id);
                      loadUsers();
                      Alert.alert('Succès', "L'utilisateur a été retiré et détaché de ses appartements.");
                    } catch (e: any) { Alert.alert('Erreur', e?.message); }
                  }
                }
              ]
            );
          }, 400);
        }
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

  const handleResetPassword = async () => {
    if (!selectedUser || newPassword.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit faire au moins 6 caractères.');
      return;
    }

    setIsResetting(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      const response = await fetch('https://mrbalhwgrlvjhvjpujfb.supabase.co/functions/v1/super-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetUserId: selectedUser.user_id, newPassword })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur serveur (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      if (data?.error) throw new Error(data.error);

      Alert.alert('Succès', 'Le mot de passe a été mis à jour avec succès.');
      setPasswordModalVisible(false);
      setNewPassword('');
    } catch (e: any) {
      console.error('Fetch error:', e);
      Alert.alert('Erreur', e?.message || 'Impossible de réinitialiser le mot de passe.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Utilisateurs</Text>
        <TouchableOpacity onPress={() => router.push('/(app)/settings/new-user')}>
          <Ionicons name="person-add" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={users}
        keyExtractor={item => item.user_id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadUsers(); }} tintColor={Colors.primary} />
        }
        renderItem={({ item }) => (
          <View style={styles.userCard}>
            <View style={styles.userIconWrap}>
              <Text style={styles.userIconText}>
                {item.full_name?.charAt(0)?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>{item.full_name || 'Utilisateur'}</Text>
              <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
              {item.phone && <Text style={styles.userPhone} numberOfLines={1}>{item.phone}</Text>}
            </View>
            
            <TouchableOpacity 
              style={[
                styles.roleBadge,
                item.role === 'admin' && { backgroundColor: Colors.dangerLight },
                item.role === 'manager' && { backgroundColor: Colors.warningLight },
              ]}
              onPress={() => handleChangeRole(item)}
              disabled={!canManageUsers}
            >
              <Text style={[
                styles.roleBadgeText,
                item.role === 'admin' && { color: Colors.danger },
                item.role === 'manager' && { color: Colors.warning },
              ]}>
                {ROLE_LABELS[item.role] || item.role}
              </Text>
              {canManageUsers && (
                <Ionicons 
                  name="chevron-down" 
                  size={12} 
                  color={item.role === 'admin' ? Colors.danger : item.role === 'manager' ? Colors.warning : Colors.primary} 
                  style={{ marginLeft: 4 }}
                />
              )}
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Modal Changement de mot de passe */}
      <Modal visible={passwordModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nouveau mot de passe</Text>
            <Text style={styles.modalDesc}>
              Saisissez un nouveau mot de passe pour {selectedUser?.full_name || selectedUser?.email}.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Min. 6 caractères"
              placeholderTextColor={Colors.textMuted}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setPasswordModalVisible(false)}
                disabled={isResetting}
              >
                <Text style={[styles.modalBtnText, { color: Colors.textSecondary }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSubmit]}
                onPress={handleResetPassword}
                disabled={isResetting}
              >
                {isResetting ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: Colors.white }]}>Confirmer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ActionSheet
        visible={actionSheetVisible}
        title={`Gestion de ${actionUser?.full_name || 'l\'utilisateur'}`}
        subtitle="Choisissez une action"
        options={getActionSheetOptions()}
        onClose={() => setActionSheetVisible(false)}
      />
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navy },
  loadingContainer: { flex: 1, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center' },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: 56,
    paddingBottom: Spacing.lg,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  
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
  userName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
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
  
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: Spacing.xl,
  },
  modalContent: {
    width: '100%', backgroundColor: Colors.navyCard,
    borderRadius: Radius.xl, padding: Spacing.xl,
    borderWidth: 1, borderColor: Colors.navyBorder,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  modalDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xl },
  modalInput: {
    backgroundColor: Colors.navy,
    borderWidth: 1, borderColor: Colors.navyBorder,
    borderRadius: Radius.md, padding: Spacing.md,
    color: Colors.textPrimary, fontSize: FontSize.md,
    marginBottom: Spacing.xl,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.md },
  modalBtn: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  modalBtnCancel: { backgroundColor: Colors.navy, borderWidth: 1, borderColor: Colors.navyBorder },
  modalBtnSubmit: { backgroundColor: Colors.primary },
  modalBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});
