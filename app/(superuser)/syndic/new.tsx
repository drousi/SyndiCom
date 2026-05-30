import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/supabase/client';
import { secondarySupabase } from '../../../src/supabase/secondary';
import { Button } from '../../../src/components/ui/Button';
import { Input } from '../../../src/components/ui/Input';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../../src/constants/theme';

const schema = z.object({
  residence_name: z.string().min(2, 'Nom requis'),
  address: z.string().optional(),
  currency: z.string().min(1, 'Devise requise'),
  monthly_fee: z.coerce.number().min(0, 'Montant invalide'),
  admin_email: z.string().email('Email invalide'),
  admin_name: z.string().min(2, 'Nom requis'),
  admin_password: z.string().min(6, 'Le mot de passe doit faire au moins 6 caractères'),
});

type FormData = z.infer<typeof schema>;

export default function NewSyndicScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [createdEmail, setCreatedEmail] = useState('');

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      currency: 'DH',
      monthly_fee: 0,
    },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      // 1. Create residence
      const { data: residence, error: resError } = await supabase
        .from('residences')
        .insert({
          name: data.residence_name,
          address: data.address ?? null,
          currency: data.currency,
          monthly_fee: data.monthly_fee,
        })
        .select()
        .single();

      if (resError) throw resError;

      // 2. Sign up admin user via secondary Supabase client
      const { data: signUpData, error: signUpError } = await secondarySupabase.auth.signUp({
        email: data.admin_email,
        password: data.admin_password,
        options: {
          data: { full_name: data.admin_name },
        }
      });

      if (signUpError) {
        // If user already exists, Supabase auth might throw an error or return null user
        if (signUpError.message.includes('already registered')) {
          const { data: existingUser } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', data.admin_email)
            .single();

          if (!existingUser) throw new Error("Erreur: L'utilisateur existe mais son profil est introuvable.");

          // Link existing user as admin
          await supabase.from('user_residences').insert({
            user_id: existingUser.id,
            residence_id: residence.id,
            role: 'admin',
          });
        } else {
          throw signUpError;
        }
      } else if (signUpData?.user) {
        // Force le changement de mot de passe à la première connexion
        const { error: profileUpdateError } = await secondarySupabase
          .from('profiles')
          .update({ force_password_change: true })
          .eq('id', signUpData.user.id);
          
        if (profileUpdateError) {
          console.error('[NewSyndic] Failed to set force_password_change:', profileUpdateError);
        }

        // Link new user as admin
        await supabase.from('user_residences').insert({
          user_id: signUpData.user.id,
          residence_id: residence.id,
          role: 'admin',
        });
      }

      setCreatedEmail(data.admin_email);
      setStep('success');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de créer le syndic');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
        </View>
        <Text style={styles.successTitle}>Syndic créé !</Text>
        <Text style={styles.successText}>
          L'administrateur peut maintenant se connecter avec l'email :{'\n'}
          <Text style={styles.successEmail}>{createdEmail}</Text>
        </Text>
        <Text style={styles.successSub}>
          Il devra modifier son mot de passe lors de sa première connexion.
        </Text>
        <Button
          label="Retour au tableau de bord"
          onPress={() => router.back()}
          fullWidth
          size="lg"
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouveau syndic</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Residence section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏢 Résidence</Text>

          <Controller
            control={control}
            name="residence_name"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Nom de la résidence *"
                placeholder="Ex: Résidence Al Akahway 2"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.residence_name?.message}
                leftIcon={<Ionicons name="business-outline" size={18} color={Colors.textMuted} />}
              />
            )}
          />

          <Controller
            control={control}
            name="address"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Adresse (optionnel)"
                placeholder="Ex: Hay Hassani, Casablanca"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value ?? ''}
                leftIcon={<Ionicons name="location-outline" size={18} color={Colors.textMuted} />}
              />
            )}
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="monthly_fee"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Cotisation mensuelle *"
                    placeholder="200"
                    keyboardType="decimal-pad"
                    onChangeText={v => onChange(parseFloat(v) || 0)}
                    onBlur={onBlur}
                    value={value ? value.toString() : ''}
                    error={errors.monthly_fee?.message}
                    leftIcon={<Ionicons name="cash-outline" size={18} color={Colors.textMuted} />}
                  />
                )}
              />
            </View>
            <View style={{ width: 100 }}>
              <Controller
                control={control}
                name="currency"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Devise"
                    placeholder="DH"
                    onChangeText={onChange}
                    onBlur={onBlur}
                    value={value}
                    error={errors.currency?.message}
                  />
                )}
              />
            </View>
          </View>
        </View>

        {/* Admin section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👔 Administrateur</Text>
          <Text style={styles.sectionSub}>
            Cette personne recevra un email pour activer son compte et gérer la résidence.
          </Text>

          <Controller
            control={control}
            name="admin_name"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Nom complet *"
                placeholder="Mohamed Al Akahway"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.admin_name?.message}
                leftIcon={<Ionicons name="person-outline" size={18} color={Colors.textMuted} />}
              />
            )}
          />

          <Controller
            control={control}
            name="admin_email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Email *"
                placeholder="admin@exemple.com"
                keyboardType="email-address"
                autoCapitalize="none"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.admin_email?.message}
                leftIcon={<Ionicons name="mail-outline" size={18} color={Colors.textMuted} />}
              />
            )}
          />

          <Controller
            control={control}
            name="admin_password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Mot de passe initial *"
                placeholder="Ex: Admin123!"
                secureTextEntry
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.admin_password?.message}
                leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />}
              />
            )}
          />
        </View>

        <Button
          label="Créer le syndic"
          onPress={handleSubmit(onSubmit)}
          isLoading={loading}
          fullWidth
          size="lg"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navy },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: 56,
    paddingBottom: Spacing.lg,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.white },
  content: { padding: Spacing.xl, gap: Spacing.xl, paddingBottom: 48 },

  section: {
    gap: Spacing.md,
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.white },
  sectionSub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  row: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },

  successContainer: {
    flex: 1,
    backgroundColor: Colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.huge,
    gap: Spacing.xl,
  },
  successIcon: {},
  successTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.white },
  successText: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24 },
  successEmail: { fontWeight: FontWeight.bold, color: Colors.primary },
  successSub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
