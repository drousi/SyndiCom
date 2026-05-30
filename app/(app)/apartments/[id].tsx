import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { apartmentSchema, ApartmentFormData } from '../../../src/schemas';
import { createApartment, updateApartment, getApartmentById } from '../../../src/db/repositories/apartments';
import { secondarySupabase } from '../../../src/supabase/secondary';
import { useAuthStore } from '../../../src/store/auth.store';
import { supabase } from '../../../src/supabase/client';
import { DropdownMenu } from '../../../src/components/ui/DropdownMenu';
import { Button } from '../../../src/components/ui/Button';
import { Input } from '../../../src/components/ui/Input';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius } from '../../../src/constants/theme';
import { SelectInput } from '../../../src/components/ui/SelectInput';

export default function ApartmentFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const router = useRouter();
  const { activeResidence, profile } = useAuthStore();
  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const [loading, setLoading] = useState(false);
  const [aptResidentId, setAptResidentId] = useState<string | null>(null);
  const [residentPassword, setResidentPassword] = useState('');
  const [residentPasswordError, setResidentPasswordError] = useState('');
  
  // New states for flexible user linking
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUserIdToLink, setSelectedUserIdToLink] = useState<string>('');
  const [linkingMode, setLinkingMode] = useState<'create' | 'link'>('create');
  const [residentName, setResidentName] = useState<string | null>(null);

  const { control, handleSubmit, setValue, getValues, watch, setError, formState: { errors } } = useForm<ApartmentFormData>({
    resolver: zodResolver(apartmentSchema),
    defaultValues: { number: '', floor: null, owner_name: '', phone: '', email: '', whatsapp: '', active: true },
  });

  const isActive = watch('active');

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      const apt = await getApartmentById(id);
      if (apt) {
        setValue('number', apt.number);
        setValue('floor', apt.floor);
        setValue('owner_name', apt.owner_name ?? '');
        setValue('phone', apt.phone ?? '');
        setValue('email', apt.email ?? '');
        setValue('whatsapp', apt.whatsapp ?? '');
        setValue('active', apt.active);
        setAptResidentId(apt.resident_user_id ?? null);
        
        if (apt.resident_user_id) {
          supabase.from('profiles').select('full_name').eq('id', apt.resident_user_id).single().then(({ data: profileData }) => {
            if (profileData) setResidentName(profileData.full_name);
          });
        }
      }
    };
    if (!isNew && id) {
      loadData();
      loadAvailableUsers();
    }
  }, [id, isNew, activeResidence]);

  useEffect(() => {
    if (aptResidentId) {
      supabase.from('profiles').select('full_name').eq('id', aptResidentId).single().then(({ data }) => {
        if (data) setResidentName(data.full_name);
      });
    } else {
      setResidentName(null);
    }
  }, [aptResidentId]);

  const loadAvailableUsers = async () => {
    if (!activeResidence) return;
    try {
      // Fetch all user_residences with profiles
      const { data: usersData, error: usersError } = await supabase
        .from('user_residences')
        .select('user_id, profiles(full_name, email)')
        .eq('residence_id', activeResidence.id);
        
      if (usersError) throw usersError;

      // Fetch all apartments with resident_user_id
      const { data: aptsData, error: aptsError } = await supabase
        .from('apartments')
        .select('resident_user_id')
        .eq('residence_id', activeResidence.id)
        .not('resident_user_id', 'is', null);

      if (aptsError) throw aptsError;

      // Filter out users who already have an apartment
      const linkedUserIds = new Set(aptsData.map(a => a.resident_user_id));
      const freeUsers = (usersData ?? [])
        .filter(u => !linkedUserIds.has(u.user_id))
        .map(u => ({
          label: `${(u.profiles as any)?.full_name || 'Utilisateur'} (${(u.profiles as any)?.email})`,
          value: u.user_id
        }));

      setAvailableUsers(freeUsers);
      if (freeUsers.length > 0) setSelectedUserIdToLink(freeUsers[0].value);
    } catch (e) {
      console.error('[Apartments] Error loading available users:', e);
    }
  };

  const onSubmit = async (data: ApartmentFormData) => {
    if (!activeResidence) return;
    setLoading(true);
    try {
      if (isNew) {
        await createApartment({
          residence_id: activeResidence.id,
          number: data.number,
          floor: data.floor ?? null,
          owner_name: data.owner_name ?? null,
          phone: data.phone ?? null,
          email: data.email || null,
          whatsapp: data.whatsapp || null,
          active: data.active,
          resident_user_id: null,
        }, profile?.id);
      } else if (id) {
        await updateApartment(id, data, profile?.id);
      }
      router.back();
    } catch (e: any) {
      console.error('[Apartments] Save error:', e);
      Alert.alert('Erreur', e?.message || 'Impossible de sauvegarder l\'appartement');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteResident = async () => {
    const email = getValues('email');
    const ownerName = getValues('owner_name');

    setResidentPasswordError('');

    if (!email) {
      setError('email', { type: 'manual', message: "Veuillez saisir l'email du résident pour créer son compte." });
      return;
    }

    if (!residentPassword || residentPassword.length < 6) {
      setResidentPasswordError('Le mot de passe doit faire au moins 6 caractères.');
      return;
    }

    setLoading(true);
    try {
      const { data: signUpData, error: signUpError } = await secondarySupabase.auth.signUp({
        email,
        password: residentPassword,
        options: {
          data: { full_name: ownerName || 'Résident' },
        }
      });

      let newResidentId = null;

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          const { data: existingUser } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single();

          if (!existingUser) throw new Error("Profil introuvable pour cet email.");
          newResidentId = existingUser.id;
        } else {
          throw signUpError;
        }
      } else if (signUpData?.user) {
        newResidentId = signUpData.user.id;
        
        // Le profil est automatiquement créé par un Trigger Supabase.
        // Si le Trigger ne copie pas le nom, on force la mise à jour avec la session courante du nouvel utilisateur.
        if (signUpData.session) {
          await secondarySupabase
            .from('profiles')
            .update({ full_name: ownerName || 'Résident' })
            .eq('id', newResidentId);
        }
      }

      if (newResidentId && activeResidence && id) {
        // Lier à l'appartement (SQLite et Supabase)
        await updateApartment(id, { resident_user_id: newResidentId });
        // Ajouter le rôle dans la résidence (upsert pour éviter les erreurs de doublon)
        await supabase.from('user_residences').upsert({
          user_id: newResidentId,
          residence_id: activeResidence.id,
          role: 'resident',
        });

        setAptResidentId(newResidentId);
        Alert.alert('Succès', 'Le compte du résident a été créé avec succès.');
      }
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible d\'inviter le résident');
    } finally {
      setLoading(false);
    }
  };

  const handleDetachResident = async () => {
    if (!id || !activeResidence) return;
    
    Alert.alert(
      'Détacher le résident',
      'Êtes-vous sûr de vouloir détacher le compte de ce résident ? Il n\'aura plus accès à cet appartement.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Détacher',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await updateApartment(id, { resident_user_id: null });
              setAptResidentId(null);
              Alert.alert('Succès', 'Le compte a été détaché de cet appartement.');
              loadAvailableUsers(); // Reload the free users list
            } catch (e: any) {
              Alert.alert('Erreur', e?.message || 'Impossible de détacher le compte.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleLinkExistingUser = async () => {
    if (!id || !selectedUserIdToLink) return;
    setLoading(true);
    try {
      await updateApartment(id, { resident_user_id: selectedUserIdToLink });
      setAptResidentId(selectedUserIdToLink);
      Alert.alert('Succès', 'L\'utilisateur a été lié à cet appartement.');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de lier l\'utilisateur.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isNew ? 'Nouvel appartement' : 'Modifier l\'appartement'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Controller
          control={control}
          name="number"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Numéro d'appartement *"
              placeholder="Ex: 01, A1, RDC..."
              onChangeText={onChange}
              onBlur={onBlur}
              value={value}
              error={errors.number?.message}
              leftIcon={<Ionicons name="home-outline" size={18} color={Colors.textMuted} />}
            />
          )}
        />

        <Controller
          control={control}
          name="floor"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Étage (optionnel)"
              placeholder="Ex: 1, 2, RDC..."
              keyboardType="number-pad"
              onChangeText={v => onChange(parseInt(v) || null)}
              onBlur={onBlur}
              value={value?.toString() ?? ''}
              leftIcon={<Ionicons name="layers-outline" size={18} color={Colors.textMuted} />}
            />
          )}
        />

        <Controller
          control={control}
          name="owner_name"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Nom du propriétaire"
              placeholder="Nom complet"
              onChangeText={onChange}
              onBlur={onBlur}
              value={value ?? ''}
              leftIcon={<Ionicons name="person-outline" size={18} color={Colors.textMuted} />}
            />
          )}
        />

        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Téléphone (optionnel)"
              placeholder="06 00 00 00 00"
              keyboardType="phone-pad"
              onChangeText={onChange}
              onBlur={onBlur}
              value={value ?? ''}
              leftIcon={<Ionicons name="call-outline" size={18} color={Colors.textMuted} />}
            />
          )}
        />

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Email du résident (optionnel)"
              placeholder="resident@exemple.com"
              keyboardType="email-address"
              autoCapitalize="none"
              onChangeText={onChange}
              onBlur={onBlur}
              value={value ?? ''}
              error={errors.email?.message}
              leftIcon={<Ionicons name="mail-outline" size={18} color={Colors.textMuted} />}
            />
          )}
        />

        <Controller
          control={control}
          name="whatsapp"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="WhatsApp (optionnel)"
              placeholder="+212 600 000 000"
              keyboardType="phone-pad"
              onChangeText={onChange}
              onBlur={onBlur}
              value={value ?? ''}
              leftIcon={<Ionicons name="logo-whatsapp" size={18} color={Colors.textMuted} />}
            />
          )}
        />

        {/* Invite section */}
        {!isNew && (
          <View style={styles.inviteCard}>
            <View style={styles.inviteInfo}>
              <Ionicons name="person-add-outline" size={24} color={Colors.primary} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.inviteTitle}>Accès résident</Text>
                <Text style={styles.inviteText}>
                  {aptResidentId 
                    ? `Le compte de ${residentName || 'cet utilisateur'} est lié à cet appartement.`
                    : 'Créez un compte pour le résident afin qu\'il puisse suivre ses paiements.'}
                </Text>
              </View>
            </View>
            {!aptResidentId ? (
              <View style={{ gap: Spacing.md }}>
                <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                  <Button
                    label="Nouveau"
                    variant={linkingMode === 'create' ? 'primary' : 'outline'}
                    size="sm"
                    style={{ flex: 1 }}
                    onPress={() => setLinkingMode('create')}
                  />
                  <Button
                    label="Existant"
                    variant={linkingMode === 'link' ? 'primary' : 'outline'}
                    size="sm"
                    style={{ flex: 1 }}
                    onPress={() => setLinkingMode('link')}
                  />
                </View>

                {linkingMode === 'create' ? (
                  <>
                    <Input
                      label="Mot de passe initial *"
                      placeholder="Ex: Resident123!"
                      secureTextEntry
                      value={residentPassword}
                      onChangeText={(val) => {
                        setResidentPassword(val);
                        setResidentPasswordError('');
                      }}
                      leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />}
                      error={residentPasswordError}
                    />
                    <Button
                      label="Créer le compte résident"
                      onPress={handleInviteResident}
                      variant="outline"
                      size="sm"
                      isLoading={loading}
                    />
                  </>
                ) : (
                  <>
                    {availableUsers.length > 0 ? (
                      <>
                        <SelectInput
                          label="Choisir un utilisateur libre"
                          options={availableUsers}
                          selectedValue={selectedUserIdToLink}
                          onSelect={setSelectedUserIdToLink}
                        />
                        <Button
                          label="Lier cet utilisateur"
                          onPress={handleLinkExistingUser}
                          variant="outline"
                          size="sm"
                          isLoading={loading}
                          style={{ marginTop: Spacing.sm }}
                        />
                      </>
                    ) : (
                      <Text style={{ color: Colors.textMuted, fontSize: FontSize.sm, fontStyle: 'italic', marginTop: Spacing.sm }}>
                        Aucun utilisateur libre dans cette résidence. Veuillez en créer un depuis les paramètres.
                      </Text>
                    )}
                  </>
                )}
              </View>
            ) : (
              <Button
                label="Détacher le compte actuel"
                onPress={handleDetachResident}
                variant="outline"
                size="sm"
                isLoading={loading}
                style={{ marginTop: Spacing.sm, borderColor: Colors.danger }}
                textStyle={{ color: Colors.danger }}
                leftIcon={<Ionicons name="unlink-outline" size={18} color={Colors.danger} style={{ marginRight: 8 }} />}
              />
            )}
          </View>
        )}

        {/* Active toggle */}
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.toggleLabel}>Appartement actif</Text>
            <Text style={styles.toggleSub}>Les appartements inactifs sont exclus du suivi</Text>
          </View>
          <Controller
            control={control}
            name="active"
            render={({ field: { onChange, value } }) => (
              <Switch
                value={value}
                onValueChange={onChange}
                trackColor={{ false: Colors.navyBorder, true: Colors.primaryLight }}
                thumbColor={value ? Colors.primary : Colors.textSecondary}
              />
            )}
          />
        </View>

        <Button
          label={isNew ? 'Ajouter l\'appartement' : 'Enregistrer les modifications'}
          onPress={handleSubmit(onSubmit)}
          isLoading={loading}
          fullWidth
          size="lg"
          style={styles.submitBtn}
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
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  content: { padding: Spacing.xl, gap: Spacing.xl, paddingBottom: 48 },

  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  toggleLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  toggleSub: { fontSize: FontSize.xs, color: Colors.textSecondary, maxWidth: 220, marginTop: 2 },

  submitBtn: { marginTop: Spacing.md },

  inviteCard: {
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(76,175,80,0.3)',
  },
  inviteInfo: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  inviteTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  inviteText: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
});
