import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { expenseSchema, ExpenseFormData } from '../../../src/schemas';
import { createExpense, updateExpense, getExpenseById } from '../../../src/db/repositories/expenses';
import { useAuthStore } from '../../../src/store/auth.store';
import { Button } from '../../../src/components/ui/Button';
import { Input } from '../../../src/components/ui/Input';
import { DateField } from '../../../src/components/ui/DateField';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius } from '../../../src/constants/theme';
import { EXPENSE_TYPES } from '../../../src/constants/app';
import { useLanguageStore } from '../../../src/store/language.store';

export default function ExpenseFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const router = useRouter();
  const { activeResidence, profile } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { t } = useLanguageStore();

  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      type: '',
      description: '',
      amount: 0,
    },
  });

  const selectedType = watch('type');

  useEffect(() => {
    if (!isNew && id) {
      getExpenseById(id).then(expense => {
        if (expense) {
          setValue('date', expense.date);
          setValue('type', expense.type);
          setValue('description', expense.description ?? '');
          setValue('amount', expense.amount);
        }
      });
    }
  }, [id, isNew]);

  const onSubmit = async (data: ExpenseFormData) => {
    if (!activeResidence) return;
    setLoading(true);
    try {
      if (isNew) {
        await createExpense({
          residence_id: activeResidence.id,
          date: data.date,
          type: data.type,
          description: data.description ?? null,
          amount: data.amount,
          status: 'paid',
          template_id: null,
          receipt_url: null,
          deleted: false,
          created_by: profile?.id ?? null,
        }, profile?.id);
      } else if (id) {
        await updateExpense(id, { ...data, status: 'paid' }, profile?.id);
      }
      router.back();
    } catch (e) {
      Alert.alert(t('common.error'), t('expenses.save_error'));
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
        <Text style={styles.headerTitle}>{isNew ? t('expenses.form_title_new') : t('expenses.form_title_edit')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Type selector */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t('expenses.type_label')}</Text>
          <View style={styles.typeGrid}>
            {EXPENSE_TYPES.map(type => (
              <TouchableOpacity
                key={type.key}
                style={[styles.typeChip, selectedType === type.key && styles.typeChipSelected]}
                onPress={() => setValue('type', type.key)}
              >
                <Ionicons
                  name={type.icon as any}
                  size={18}
                  color={selectedType === type.key ? Colors.white : Colors.textSecondary}
                />
                <Text style={[styles.typeChipText, selectedType === type.key && styles.typeChipTextSelected]}>
                  {t(`expense_types.${type.key}` as any) || type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.type && <Text style={styles.errorText}>{errors.type.message}</Text>}
        </View>

        {/* Amount */}
        <Controller
          control={control}
          name="amount"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label={t('expenses.amount_field', { currency: activeResidence?.currency ?? 'DH' })}
              placeholder="0.00"
              keyboardType="decimal-pad"
              onChangeText={v => onChange(parseFloat(v) || 0)}
              onBlur={onBlur}
              value={value ? value.toString() : ''}
              error={errors.amount?.message}
              leftIcon={<Ionicons name="cash-outline" size={18} color={Colors.textMuted} />}
            />
          )}
        />

        {/* Date */}
        <Controller
          control={control}
          name="date"
          render={({ field: { onChange, value } }) => (
            <DateField
              label={t('expenses.date_field')}
              value={new Date(value + 'T12:00:00')}
              onChange={(date) => onChange(date.toISOString().split('T')[0])}
              error={errors.date?.message}
            />
          )}
        />

        {/* Description */}
        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label={t('expenses.description_field')}
              placeholder={t('expenses.description_placeholder')}
              onChangeText={onChange}
              onBlur={onBlur}
              value={value ?? ''}
              leftIcon={<Ionicons name="document-text-outline" size={18} color={Colors.textMuted} />}
              multiline
            />
          )}
        />

        <Button
          label={isNew ? t('expenses.save_expense') : t('expenses.update_expense')}
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

  fieldGroup: { gap: Spacing.sm },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
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
  errorText: { fontSize: FontSize.xs, color: Colors.danger, fontWeight: FontWeight.medium },

  submitBtn: { marginTop: Spacing.md },
});
