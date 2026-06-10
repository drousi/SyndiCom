import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius } from '../../../src/constants/theme';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { SelectInput } from '../../../src/components/ui/SelectInput';
import { useAuthStore } from '../../../src/store/auth.store';
import { supabase } from '../../../src/supabase/client';
import { secondarySupabase } from '../../../src/supabase/secondary';
import { useLanguageStore } from '../../../src/store/language.store';

const newUserSchema = z.object({
  fullName: z.string().min(2, 'Le nom doit faire au moins 2 caractères'),
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit faire au moins 6 caractères'),
  role: z.enum(['resident', 'manager', 'admin']),
});

type NewUserForm = z.infer<typeof newUserSchema>;

export default function NewUserScreen() {
  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const router = useRouter();
  const { activeResidence, hasPermission } = useAuthStore();
  const { t } = useLanguageStore();
  const [loading, setLoading] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<NewUserForm>({
    resolver: zodResolver(newUserSchema),
    defaultValues: { fullName: '', email: '', password: '', role: 'resident' }
  });

  if (!hasPermission('manageUsers')) {
    return (
      <View style={styles.container}>
        <Text style={{ color: Colors.danger, padding: 20 }}>{t('new_user.access_denied')}</Text>
      </View>
    );
  }

  const onSubmit = async (data: NewUserForm) => {
    if (!activeResidence) return;

    setLoading(true);
    try {
      // 1. Créer le compte Auth via secondarySupabase
      const { data: signUpData, error: signUpError } = await secondarySupabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { full_name: data.fullName },
        }
      });

      let newUserId = null;

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          const { data: existingUser } = await secondarySupabase
            .from('profiles')
            .select('id')
            .eq('email', data.email)
            .single();

          if (!existingUser) throw new Error(t('new_user.error_not_found'));
          newUserId = existingUser.id;
        } else {
          throw signUpError;
        }
      } else if (signUpData?.user) {
        newUserId = signUpData.user.id;
        // 2. Le profil est automatiquement créé par un Trigger Supabase.
        // On force la mise à jour du nom au cas où le Trigger ne le ferait pas correctement.
        if (signUpData.session) {
          await secondarySupabase
            .from('profiles')
            .update({ full_name: data.fullName })
            .eq('id', newUserId);
        }
      }

      if (newUserId) {
        // 3. Ajouter à la résidence
        const { error: resError } = await supabase
          .from('user_residences')
          .upsert({
            user_id: newUserId,
            residence_id: activeResidence.id,
            role: data.role,
          }, { onConflict: 'user_id,residence_id' });
          
        if (resError) throw resError;

        Alert.alert(t('common.success'), t('new_user.success'));
        router.back();
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert(t('common.error'), e?.message || t('new_user.error_create'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('new_user.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Controller
          control={control}
          name="fullName"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label={t('new_user.fullname_label')}
              placeholder={t('new_user.fullname_placeholder')}
              onChangeText={onChange}
              onBlur={onBlur}
              value={value}
              error={errors.fullName?.message}
              leftIcon={<Ionicons name="person-outline" size={18} color={Colors.textMuted} />}
            />
          )}
        />

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label={t('new_user.email_label')}
              placeholder={t('new_user.email_placeholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              onChangeText={onChange}
              onBlur={onBlur}
              value={value}
              error={errors.email?.message}
              leftIcon={<Ionicons name="mail-outline" size={18} color={Colors.textMuted} />}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label={t('new_user.password_label')}
              placeholder={t('new_user.password_placeholder')}
              secureTextEntry
              onChangeText={onChange}
              onBlur={onBlur}
              value={value}
              error={errors.password?.message}
              leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />}
            />
          )}
        />

        <Controller
          control={control}
          name="role"
          render={({ field: { onChange, value } }) => (
            <SelectInput
              label={t('new_user.role_label')}
              options={[
                { label: t('new_user.role_resident'), value: 'resident' },
                { label: t('new_user.role_manager'), value: 'manager' },
                { label: t('new_user.role_admin'), value: 'admin' },
              ]}
              selectedValue={value}
              onSelect={(val) => onChange(val)}
            />
          )}
        />

        <Button
          label={t('new_user.create_btn')}
          onPress={handleSubmit(onSubmit)}
          isLoading={loading}
          style={{ marginTop: Spacing.xl }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navy },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: 56,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.navyCard,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  content: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: 100 },
});
