import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/supabase/client';
import { useAuthStore } from '../../src/store/auth.store';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';
import { useLanguageStore } from '../../src/store/language.store';

export default function ForcePasswordScreen() {
  const router = useRouter();
  const { loadSession, signOut } = useAuthStore();
  const { t } = useLanguageStore();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!password) {
      Alert.alert(t('common.error'), t('common.mandatory_field'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), t('settings.confirm_password') + ' mismatch'); // Or generic mismatch
      return;
    }

    setLoading(true);
    try {
      // 1. Update password
      const { error: passError } = await supabase.auth.updateUser({ password });
      if (passError) throw passError;

      // 2. Clear force_password_change flag in profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('common.error'));

      const { error: profError } = await supabase
        .from('profiles')
        .update({ force_password_change: false })
        .eq('id', user.id);
      
      if (profError) throw profError;

      // 3. Reload session to update local cache and trigger redirect
      await loadSession();

    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(t('settings.sign_out'), t('settings.sign_out_confirm') || 'Êtes-vous sûr de vouloir vous déconnecter ?', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.sign_out'), style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="lock-closed" size={32} color={Colors.primary} />
        </View>
        <Text style={styles.title}>{t('auth.secure_account_title')}</Text>
        <Text style={styles.subtitle}>
          {t('auth.secure_account_subtitle')}
        </Text>

        <View style={styles.form}>
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
            label={t('common.validate')}
            onPress={handleSubmit}
            isLoading={loading}
            style={{ marginTop: Spacing.sm }}
          />
        </View>

        <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>{t('settings.sign_out')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.navy,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.navyCard,
    padding: Spacing.xxl,
    borderRadius: Radius.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.white,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
  form: {
    width: '100%',
    gap: Spacing.md,
  },
  signOutBtn: {
    marginTop: Spacing.xl,
    padding: Spacing.sm,
  },
  signOutText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
});
