import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Switch, LayoutAnimation, DevSettings
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../src/store/auth.store';
import { supabase } from '../../../src/supabase/client';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius, ThemeColors } from '../../../src/constants/theme';
import { useThemeStore } from '../../../src/store/theme.store';
import { ROLE_LABELS } from '../../../src/constants/app';
import { useReminderStore } from '../../../src/store/reminder.store';
import { scheduleTestReminder } from '../../../src/services/notification.service';
import { useLanguageStore } from '../../../src/store/language.store';
import Constants from 'expo-constants';

export default function SettingsScreen() {
  const router = useRouter();
  const { profile, residenceRole, signOut, hasPermission, loadSession, residences, activeResidence, setActiveResidence } = useAuthStore();
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  
  const themeMode = useThemeStore((state) => state.mode);
  const setThemeMode = useThemeStore((state) => state.setMode);
  const reminderStore = useReminderStore();
  const languageStore = useLanguageStore();
  const { t } = languageStore;

  // Local state for smooth switch animation without lag
  const [localIsDark, setLocalIsDark] = useState(themeMode === 'dark');

  useEffect(() => {
    setLocalIsDark(themeMode === 'dark');
  }, [themeMode]);

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
        Alert.alert(t('settings.email_updated_title'), t('settings.email_updated_desc'));
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName, phone })
        .eq('id', profile?.id);

      if (profileError) throw profileError;

      await loadSession(true);
      setIsEditingProfile(false);
      Alert.alert(t('common.success'), t('settings.profile_updated'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || t('settings.profile_update_error'));
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword) {
      Alert.alert(t('common.error'), t('settings.password_current_required'));
      return;
    }
    if (!password) return;
    if (password.length < 6) {
      Alert.alert(t('common.error'), t('settings.password_min_length'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), t('settings.passwords_mismatch'));
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
        Alert.alert(t('common.error'), t('settings.password_current_wrong'));
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Alert.alert(t('common.success'), t('settings.password_updated'));
      setCurrentPassword('');
      setPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || t('settings.password_update_error'));
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(t('settings.sign_out'), t('settings.sign_out_confirm') || 'Êtes-vous sûr de vouloir vous déconnecter ?', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.sign_out'), style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const handleUpdateReminderSettings = (
    settings: Parameters<typeof reminderStore.updateSettings>[0]
  ) => {
    if (activeResidence) {
      reminderStore.updateSettings(settings, activeResidence.id, () => {
        Alert.alert(t('common.error'), t('settings.reminders_save_error'));
      });
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title={t('settings.title')} showSettings={false} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        {/* Profile Card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.my_profile')}</Text>
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
                      <Text style={styles.roleBadgeText}>{t(`roles.${residenceRole ?? 'resident'}` as any)}</Text>
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
                  label={t('settings.info_edit')} 
                  variant="outline" 
                  onPress={() => setIsEditingProfile(true)} 
                  style={{ marginTop: Spacing.md }}
                />
              </>
            ) : (
              <View style={{ gap: Spacing.md }}>
                <Input
                  label={t('settings.fullname')}
                  value={fullName}
                  onChangeText={setFullName}
                  leftIcon={<Ionicons name="person-outline" size={18} color={Colors.textMuted} />}
                />
                <Input
                  label={t('settings.email')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  leftIcon={<Ionicons name="mail-outline" size={18} color={Colors.textMuted} />}
                />
                <Input
                  label={t('settings.phone')}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  leftIcon={<Ionicons name="call-outline" size={18} color={Colors.textMuted} />}
                />
                <View style={styles.actionRow}>
                  <Button 
                    label={t('common.cancel')} 
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
                    label={t('common.save')} 
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
          <Text style={styles.sectionTitle}>{t('settings.security')}</Text>
          <View style={styles.card}>
            <Input
              label={t('settings.current_password')}
              placeholder="••••••••"
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
              leftIcon={<Ionicons name="key-outline" size={18} color={Colors.textMuted} />}
            />
            <Input
              label={t('settings.new_password')}
              placeholder="••••••••"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />}
            />
            <Input
              label={t('settings.confirm_password')}
              placeholder="••••••••"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />}
            />
            <Button
              label={t('settings.update_password')}
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
            <Text style={styles.sectionTitle}>{t('settings.active_residence')}</Text>
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
            <Text style={styles.sectionTitle}>{t('settings.administration')}</Text>
            {canManageResidence && (
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(app)/settings/residence')}>
                <Ionicons name="business-outline" size={20} color={Colors.textSecondary} />
                <Text style={styles.menuText}>{t('settings.residence_settings')}</Text>
                <Ionicons name={languageStore.isRTL ? "chevron-back" : "chevron-forward"} size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
            {canManageUsers && (
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(app)/settings/users')}>
                <Ionicons name="people-outline" size={20} color={Colors.textSecondary} />
                <Text style={styles.menuText}>{t('settings.users_management')}</Text>
                <Ionicons name={languageStore.isRTL ? "chevron-back" : "chevron-forward"} size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Rappels de relance (Admin/Gérant) */}
        {hasPermission('write') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.reminders_section')}</Text>
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                  <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary }}>
                    {t('settings.reminders_toggle')}
                  </Text>
                  <Text style={{ fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 }}>
                    {t('settings.reminders_desc')}
                  </Text>
                </View>
                <Switch
                  value={reminderStore.enabled}
                  onValueChange={(val) => handleUpdateReminderSettings({ enabled: val })}
                  trackColor={{ false: Colors.navyBorder, true: Colors.primarySurface }}
                  thumbColor={reminderStore.enabled ? Colors.primary : Colors.textMuted}
                />
              </View>

              {reminderStore.enabled && (
                <View style={{ gap: Spacing.md, marginTop: Spacing.sm, borderTopWidth: 1, borderColor: Colors.navyBorder, paddingTop: Spacing.md }}>
                  {/* Day Picker */}
                  <View>
                    <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary, marginBottom: Spacing.xs }}>
                      {t('settings.reminders_day')}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {[
                        t('days.dim'),
                        t('days.lun'),
                        t('days.mar'),
                        t('days.mer'),
                        t('days.jeu'),
                        t('days.ven'),
                        t('days.sam')
                      ].map((dayName, idx) => {
                        const dayValue = idx + 1; // 1 = Sun, 2 = Mon, ...
                        const isSelected = reminderStore.dayOfWeek === dayValue;
                        return (
                          <TouchableOpacity
                            key={idx}
                            style={{
                              paddingVertical: 6,
                              paddingHorizontal: 12,
                              borderRadius: Radius.sm,
                              backgroundColor: isSelected ? Colors.primary : Colors.navyBorder,
                              borderWidth: 1,
                              borderColor: isSelected ? Colors.primary : Colors.navyBorder,
                            }}
                            onPress={() => handleUpdateReminderSettings({ dayOfWeek: dayValue })}
                          >
                            <Text style={{ fontSize: 11, fontWeight: FontWeight.bold, color: isSelected ? Colors.white : Colors.textPrimary }}>
                              {dayName}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Time Picker Controls */}
                  <View style={{ flexDirection: 'row', gap: Spacing.xl }}>
                    {/* Hour */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary, marginBottom: Spacing.xs }}>
                        {t('settings.reminders_hour')}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.navyBorder, borderRadius: Radius.sm, padding: Spacing.xs, justifyContent: 'space-between' }}>
                        <TouchableOpacity
                          style={{ padding: 4 }}
                          onPress={() => {
                            let newHour = reminderStore.hour - 1;
                            if (newHour < 0) newHour = 23;
                            handleUpdateReminderSettings({ hour: newHour });
                          }}
                        >
                          <Ionicons name="remove-circle-outline" size={22} color={Colors.primary} />
                        </TouchableOpacity>
                        <Text style={{ color: Colors.textPrimary, fontWeight: FontWeight.bold, fontSize: FontSize.md }}>
                          {String(reminderStore.hour).padStart(2, '0')} h
                        </Text>
                        <TouchableOpacity
                          style={{ padding: 4 }}
                          onPress={() => {
                            let newHour = reminderStore.hour + 1;
                            if (newHour > 23) newHour = 0;
                            handleUpdateReminderSettings({ hour: newHour });
                          }}
                        >
                          <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Minutes */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary, marginBottom: Spacing.xs }}>
                        {t('settings.reminders_minute')}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.navyBorder, borderRadius: Radius.sm, padding: Spacing.xs, justifyContent: 'space-between' }}>
                        <TouchableOpacity
                          style={{ padding: 4 }}
                          onPress={() => {
                            let newMin = reminderStore.minute - 10;
                            if (newMin < 0) newMin = 50;
                            handleUpdateReminderSettings({ minute: newMin });
                          }}
                        >
                          <Ionicons name="remove-circle-outline" size={22} color={Colors.primary} />
                        </TouchableOpacity>
                        <Text style={{ color: Colors.textPrimary, fontWeight: FontWeight.bold, fontSize: FontSize.md }}>
                          {String(reminderStore.minute).padStart(2, '0')} min
                        </Text>
                        <TouchableOpacity
                          style={{ padding: 4 }}
                          onPress={() => {
                            let newMin = reminderStore.minute + 10;
                            if (newMin > 50) newMin = 0;
                            handleUpdateReminderSettings({ minute: newMin });
                          }}
                        >
                          <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              <Button
                label={t('settings.reminders_test')}
                variant="outline"
                onPress={async () => {
                  await scheduleTestReminder();
                  Alert.alert(t('settings.reminders_test_scheduled'), t('settings.reminders_test_desc'));
                }}
                leftIcon={<Ionicons name="notifications-outline" size={18} color={Colors.primary} />}
                style={{ marginTop: Spacing.xs }}
              />
            </View>
          </View>
        )}

        {/* Sync section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.system')}</Text>
          <View style={[styles.menuItem, { opacity: 0.7 }]}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.menuText}>{t('settings.app_version')}</Text>
            <Text style={{ fontSize: FontSize.sm, color: Colors.textSecondary }}>
              {Constants.expoConfig?.version ?? '1.0.7'}
            </Text>
          </View>

          {/* Custom Language Switcher */}
          <View style={[styles.menuItem, { flexDirection: 'column', alignItems: 'stretch', gap: Spacing.sm }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
              <Ionicons name="language" size={24} color={Colors.primary} />
              <Text style={styles.menuText}>{t('settings.language')}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
              {[
                { code: 'fr', label: 'Français' },
                { code: 'en', label: 'English' },
                { code: 'ar', label: 'العربية' },
              ].map((lang) => {
                const isSelected = languageStore.locale === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      alignItems: 'center',
                      borderRadius: Radius.sm,
                      backgroundColor: isSelected ? Colors.primary : Colors.navyBorder,
                    }}
                    onPress={() => {
                      const needsRestart = languageStore.setLocale(lang.code as any);
                      if (needsRestart) {
                        Alert.alert(
                          t('settings.restart_required_title'),
                          t('settings.restart_required_desc'),
                          [
                            {
                              text: 'OK',
                              onPress: () => {
                                if (__DEV__ && DevSettings && typeof DevSettings.reload === 'function') {
                                  DevSettings.reload();
                                }
                              }
                            }
                          ]
                        );
                      }
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: FontWeight.bold, color: isSelected ? Colors.white : Colors.textPrimary }}>
                      {lang.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Custom Theme Switcher */}
          <View style={styles.menuItem}>
            <Ionicons name={localIsDark ? 'moon' : 'sunny'} size={24} color={Colors.primary} />
            <Text style={styles.menuText}>{localIsDark ? t('settings.dark_mode_on') : t('settings.dark_mode_off')}</Text>
            <Switch
              value={localIsDark}
              onValueChange={(val) => {
                setLocalIsDark(val);
                setThemeMode(val ? 'dark' : 'light');
              }}
              trackColor={{ false: Colors.navyBorder, true: Colors.primarySurface }}
              thumbColor={localIsDark ? Colors.primary : Colors.textMuted}
            />
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
          <Text style={styles.signOutText}>{t('settings.sign_out')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
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

  content: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.xl, paddingBottom: 48 },

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
