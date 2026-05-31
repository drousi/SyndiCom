import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Switch
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../src/store/auth.store';
import { supabase } from '../../../src/supabase/client';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { Logo } from '../../../src/components/ui/Logo';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius } from '../../../src/constants/theme';
import { useThemeStore } from '../../../src/store/theme.store';
import { ROLE_LABELS } from '../../../src/constants/app';

export default function SettingsScreen() {
  const router = useRouter();
  const { profile, residenceRole, signOut, hasPermission, loadSession, residences, activeResidence, setActiveResidence } = useAuthStore();
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  
  const themeMode = useThemeStore((state) => state.mode);
  const setThemeMode = useThemeStore((state) => state.setMode);

  const canManageUsers = hasPermission('manageUsers');
  const canManageResidence = hasPermission('manageResidence');

  // Form states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  const handleUpdateProfile = async () => {
    setLoadingProfile(true);
    try {
      if (email !== profile?.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email });
        if (emailError) throw emailError;
        Alert.alert('Email mis à jour', 'Si la confirmation est activée, veuillez vérifier votre ancienne et nouvelle boîte mail.');
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName, phone })
        .eq('id', profile?.id);

      if (profileError) throw profileError;
      
      await loadSession(true);
      setIsEditingProfile(false);
      Alert.alert('Succès', 'Profil mis à jour.');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de mettre à jour le profil');
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword) {
      Alert.alert('Erreur', 'Veuillez saisir votre mot de passe actuel.');
      return;
    }
    if (!password) return;
    if (password.length < 6) {
      Alert.alert('Erreur', 'Le nouveau mot de passe doit faire au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.');
      return;
    }
    setLoadingPassword(true);
    try {
      // Verify current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile?.email ?? '',
        password: currentPassword,
      });
      if (signInError) {
        Alert.alert('Erreur', 'Le mot de passe actuel est incorrect.');
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Alert.alert('Succès', 'Mot de passe mis à jour.');
      setCurrentPassword('');
      setPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de mettre à jour le mot de passe');
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Déconnexion', 'Êtes-vous sûr de vouloir vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Logo width={110} height={31} />
          <Text style={styles.headerTitle}>Paramètres</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn}>
          <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        {/* Profile Card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mon Profil</Text>
          <View style={styles.card}>
            {!isEditingProfile ? (
              <>
                <View style={styles.profileHeader}>
                  <View style={styles.avatarWrap}>
                    <Text style={styles.avatarText}>
                      {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                  <View style={styles.profileInfo}>
                    <Text style={styles.profileName}>{profile?.full_name ?? 'Utilisateur'}</Text>
                    <Text style={styles.profileEmail}>{profile?.email}</Text>
                    <View style={styles.roleBadge}>
                      <Text style={styles.roleBadgeText}>{ROLE_LABELS[residenceRole ?? 'resident']}</Text>
                    </View>
                  </View>
                </View>
                {profile?.phone && (
                  <View style={styles.infoRow}>
                    <Ionicons name="call-outline" size={16} color={Colors.textSecondary} />
                    <Text style={styles.infoText}>{profile.phone}</Text>
                  </View>
                )}
                <Button 
                  label="Modifier mes informations" 
                  variant="outline" 
                  onPress={() => setIsEditingProfile(true)} 
                  style={{ marginTop: Spacing.md }}
                />
              </>
            ) : (
              <View style={{ gap: Spacing.md }}>
                <Input
                  label="Nom complet"
                  value={fullName}
                  onChangeText={setFullName}
                  leftIcon={<Ionicons name="person-outline" size={18} color={Colors.textMuted} />}
                />
                <Input
                  label="Email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  leftIcon={<Ionicons name="mail-outline" size={18} color={Colors.textMuted} />}
                />
                <Input
                  label="Téléphone"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  leftIcon={<Ionicons name="call-outline" size={18} color={Colors.textMuted} />}
                />
                <View style={styles.actionRow}>
                  <Button 
                    label="Annuler" 
                    variant="outline" 
                    onPress={() => {
                      setIsEditingProfile(false);
                      setFullName(profile?.full_name || '');
                      setEmail(profile?.email || '');
                      setPhone(profile?.phone || '');
                    }} 
                    style={{ flex: 1 }}
                  />
                  <Button 
                    label="Sauvegarder" 
                    onPress={handleUpdateProfile} 
                    isLoading={loadingProfile}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Security / Password */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sécurité</Text>
          <View style={styles.card}>
            <Input
              label="Mot de passe actuel"
              placeholder="••••••••"
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
              leftIcon={<Ionicons name="key-outline" size={18} color={Colors.textMuted} />}
            />
            <Input
              label="Nouveau mot de passe"
              placeholder="••••••••"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />}
            />
            <Input
              label="Confirmer le mot de passe"
              placeholder="••••••••"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />}
            />
            <Button
              label="Mettre à jour le mot de passe"
              onPress={handleUpdatePassword}
              isLoading={loadingPassword}
              variant={currentPassword && password ? 'primary' : 'outline'}
              disabled={!currentPassword || !password}
            />
          </View>
        </View>

        {/* Residence selector */}
        {residences.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Résidence active</Text>
            {residences.map(r => (
              <TouchableOpacity
                key={r.id}
                style={[styles.menuItem, activeResidence?.id === r.id && styles.menuItemActive]}
                onPress={() => setActiveResidence(r)}
              >
                <Ionicons name="business-outline" size={20} color={activeResidence?.id === r.id ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.menuText, activeResidence?.id === r.id && { color: Colors.primary }]}>{r.name}</Text>
                {activeResidence?.id === r.id && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Administration */}
        {(canManageUsers || canManageResidence) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Administration</Text>
            {canManageResidence && (
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(app)/settings/residence')}>
                <Ionicons name="business-outline" size={20} color={Colors.textSecondary} />
                <Text style={styles.menuText}>Paramètres de la résidence</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
            {canManageUsers && (
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(app)/settings/users')}>
                <Ionicons name="people-outline" size={20} color={Colors.textSecondary} />
                <Text style={styles.menuText}>Gestion des utilisateurs</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Sync section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Système</Text>
          <View style={[styles.menuItem, { opacity: 0.7 }]}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.menuText}>Version de l'application</Text>
            <Text style={{ fontSize: FontSize.sm, color: Colors.textSecondary }}>1.0.0</Text>
          </View>

          {/* Custom Theme Switcher */}
          <View style={styles.menuItem}>
            <Ionicons name={themeMode === 'light' ? 'sunny' : 'moon'} size={24} color={Colors.primary} />
            <Text style={styles.menuText}>Mode Sombre</Text>
            <Switch
              value={themeMode === 'dark'}
              onValueChange={(val) => setThemeMode(val ? 'dark' : 'light')}
              trackColor={{ false: Colors.navyBorder, true: Colors.primarySurface }}
              thumbColor={themeMode === 'dark' ? Colors.primary : Colors.textMuted}
            />
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
          <Text style={styles.signOutText}>Se déconnecter</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navy },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: 56,
    paddingBottom: Spacing.lg,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  notifBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.navyCard,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: { padding: Spacing.xl, gap: Spacing.xl, paddingBottom: 48 },

  section: { gap: Spacing.sm },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingLeft: Spacing.sm,
  },
  
  card: {
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },

  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  avatarWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.primary,
  },
  avatarText: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.primary },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  profileEmail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  roleBadge: {
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  roleBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.primary },
  
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  infoText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  
  actionRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  menuItemActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  menuText: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.medium },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.danger,
    marginTop: Spacing.md,
  },
  signOutText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.danger },
});
