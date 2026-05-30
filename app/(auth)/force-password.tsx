import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/supabase/client';
import { useAuthStore } from '../../src/store/auth.store';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';

export default function ForcePasswordScreen() {
  const router = useRouter();
  const { loadSession, signOut } = useAuthStore();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!password) {
      Alert.alert('Erreur', 'Veuillez saisir un mot de passe.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      // 1. Update password
      const { error: passError } = await supabase.auth.updateUser({ password });
      if (passError) throw passError;

      // 2. Clear force_password_change flag in profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non trouvé');

      const { error: profError } = await supabase
        .from('profiles')
        .update({ force_password_change: false })
        .eq('id', user.id);
      
      if (profError) throw profError;

      // 3. Reload session to update local cache and trigger redirect
      await loadSession();

    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="lock-closed" size={32} color={Colors.primary} />
        </View>
        <Text style={styles.title}>Sécurisez votre compte</Text>
        <Text style={styles.subtitle}>
          C'est votre première connexion. Veuillez choisir un nouveau mot de passe personnel pour continuer.
        </Text>

        <View style={styles.form}>
          <Input
            label="Nouveau mot de passe"
            placeholder="••••••••"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />}
          />
          <Input
            label="Confirmez le mot de passe"
            placeholder="••••••••"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />}
          />

          <Button
            label="Valider et continuer"
            onPress={handleSubmit}
            isLoading={loading}
            style={{ marginTop: Spacing.sm }}
          />
        </View>

        <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Se déconnecter</Text>
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
