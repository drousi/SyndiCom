import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../src/store/auth.store';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius } from '../../../src/constants/theme';
import { DatePickerInput } from '../../../src/components/ui/DatePickerInput';
import { EXPENSE_TYPES } from '../../../src/constants/app';
import { createExpenseTemplate, updateExpenseTemplate, getActiveExpenseTemplates } from '../../../src/db/repositories/expense_templates';
import { supabase } from '../../../src/supabase/client';

export default function TemplateScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { activeResidence, profile } = useAuthStore();
  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const [loading, setLoading] = useState(!!id && id !== 'new');
  const [submitting, setSubmitting] = useState(false);
  
  const [title, setTitle] = useState('');
  const [type, setType] = useState<string>(EXPENSE_TYPES[0].key);
  const [amountType, setAmountType] = useState<'fixed' | 'variable'>('fixed');
  const [defaultAmount, setDefaultAmount] = useState('');
  const [periodicity, setPeriodicity] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [firstBillingDate, setFirstBillingDate] = useState<Date>(new Date());

  useEffect(() => {
    if (id && id !== 'new') {
      loadTemplate(id as string);
    }
  }, [id]);

  const loadTemplate = async (templateId: string) => {
    try {
      const { data, error } = await supabase
        .from('expense_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      
      if (error) throw error;
      
      setTitle(data.title);
      setType(data.type || EXPENSE_TYPES[0].key);
      setAmountType(data.amount_type);
      setDefaultAmount(data.default_amount.toString());
      setPeriodicity(data.periodicity || 'monthly');
      
      const loadMonth = data.recurrence_month ? data.recurrence_month - 1 : new Date().getMonth();
      const loadDay = data.recurrence_day || 1;
      setFirstBillingDate(new Date(new Date().getFullYear(), loadMonth, loadDay));
    } catch (e: any) {
      Alert.alert('Erreur', 'Impossible de charger le modèle.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Erreur', 'Le nom du modèle est obligatoire.');
      return;
    }
    
    const day = firstBillingDate.getDate();
    const month = firstBillingDate.getMonth() + 1;

    let amount = 0;
    if (amountType === 'fixed') {
      amount = parseFloat(defaultAmount.replace(',', '.'));
      if (isNaN(amount) || amount <= 0) {
        Alert.alert('Erreur', 'Le montant fixe doit être supérieur à 0.');
        return;
      }
    }

    try {
      setSubmitting(true);
      const data = {
        title: title.trim(),
        type: type,
        amount_type: amountType,
        default_amount: amount,
        periodicity: periodicity,
        recurrence_day: day,
        recurrence_month: periodicity === 'monthly' ? 1 : month,
      };

      if (id && id !== 'new') {
        await updateExpenseTemplate(id as string, data, profile?.id);
      } else {
        await createExpenseTemplate({
          ...data,
          residence_id: activeResidence!.id,
          active: true,
          created_by: profile?.id || null,
        }, profile?.id);
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Erreur', 'Erreur lors de l\'enregistrement.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{id === 'new' ? 'Nouveau Modèle' : 'Modifier Modèle'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.formGroup}>
            <Text style={styles.label}>Nom de la dépense</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Salaire Concierge"
              placeholderTextColor={Colors.textMuted}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Catégorie</Text>
            <View style={styles.typeGrid}>
              {EXPENSE_TYPES.map(expenseType => (
                <TouchableOpacity
                  key={expenseType.key}
                  style={[styles.typeChip, type === expenseType.key && styles.typeChipSelected]}
                  onPress={() => setType(expenseType.key)}
                >
                  <Ionicons
                    name={expenseType.icon as any}
                    size={18}
                    color={type === expenseType.key ? Colors.white : Colors.textSecondary}
                  />
                  <Text style={[styles.typeChipText, type === expenseType.key && styles.typeChipTextSelected]}>
                    {expenseType.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Type de montant</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity 
                style={[styles.typeBtn, amountType === 'fixed' && styles.typeBtnActive]}
                onPress={() => setAmountType('fixed')}
              >
                <Ionicons name="pricetag-outline" size={18} color={amountType === 'fixed' ? Colors.white : Colors.textSecondary} />
                <Text style={[styles.typeBtnText, amountType === 'fixed' && { color: Colors.white }]}>Fixe</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.typeBtn, amountType === 'variable' && styles.typeBtnActive]}
                onPress={() => setAmountType('variable')}
              >
                <Ionicons name="flash-outline" size={18} color={amountType === 'variable' ? Colors.white : Colors.textSecondary} />
                <Text style={[styles.typeBtnText, amountType === 'variable' && { color: Colors.white }]}>Variable</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.helpText}>
              {amountType === 'fixed' 
                ? 'Le montant sera pré-rempli chaque mois.' 
                : 'Le montant vous sera demandé chaque mois (ex: Facture d\'électricité).'}
            </Text>
          </View>

          {amountType === 'fixed' && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Montant ({activeResidence?.currency || 'DH'})</Text>
              <TextInput
                style={styles.input}
                placeholder="2500"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={defaultAmount}
                onChangeText={setDefaultAmount}
              />
            </View>
          )}

          <View style={styles.formGroup}>
            <Text style={styles.label}>Périodicité</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity 
                style={[styles.typeBtn, periodicity === 'monthly' && styles.typeBtnActive]}
                onPress={() => setPeriodicity('monthly')}
              >
                <Text style={[styles.typeBtnText, periodicity === 'monthly' && { color: Colors.white }]}>Mensuel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.typeBtn, periodicity === 'quarterly' && styles.typeBtnActive]}
                onPress={() => setPeriodicity('quarterly')}
              >
                <Text style={[styles.typeBtnText, periodicity === 'quarterly' && { color: Colors.white }]}>Trimestriel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.typeBtn, periodicity === 'yearly' && styles.typeBtnActive]}
                onPress={() => setPeriodicity('yearly')}
              >
                <Text style={[styles.typeBtnText, periodicity === 'yearly' && { color: Colors.white }]}>Annuel</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formGroup}>
            <DatePickerInput
              label={periodicity === 'monthly' ? "Date de facturation *" : "Première date de facturation *"}
              value={firstBillingDate}
              onChange={setFirstBillingDate}
            />
            <Text style={styles.helpText}>
              {periodicity === 'monthly' 
                ? 'Seul le jour (ex: le 1er du mois) sera pris en compte pour la récurrence.' 
                : 'Le jour et le mois de cette date seront utilisés pour générer les prochaines factures automatiquement.'}
            </Text>
          </View>

          <TouchableOpacity 
            style={[styles.saveBtn, submitting && { opacity: 0.7 }]} 
            onPress={handleSave}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.saveBtnText}>Enregistrer le modèle</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
  },
  backBtn: { padding: Spacing.xs },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  content: { padding: Spacing.xl },
  formGroup: { marginBottom: Spacing.xl },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary, marginBottom: Spacing.sm },
  input: {
    backgroundColor: Colors.navyCard,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
  },
  typeSelector: { flexDirection: 'row', gap: Spacing.md },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
    backgroundColor: Colors.navyCard,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    borderRadius: Radius.md,
  },
  typeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeBtnText: { color: Colors.textSecondary, fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
  helpText: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.xs },
  saveBtn: {
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: 40,
  },
  saveBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.navyBorder,
    backgroundColor: Colors.navyCard,
  },
  typeChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  typeChipTextSelected: { color: Colors.white },
});
