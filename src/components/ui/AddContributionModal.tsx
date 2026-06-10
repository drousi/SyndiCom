import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth.store';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius, useFontFamily } from '../../constants/theme';
import { createContribution, updateContribution } from '../../db/repositories/contributions';
import { Apartment, Contribution } from '../../types';
import { SelectInput } from './SelectInput';
import { DateField } from './DateField';
import { Button } from './Button';
import { useLanguageStore } from '../../store/language.store';

interface AddContributionModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (addedAmount: number) => void;
  apartments: Apartment[];
  contributions: Contribution[];
  currentYear: number;
  monthlyFee: number;
  preselectedAptId?: string;
}

export function AddContributionModal({
  visible,
  onClose,
  onSuccess,
  apartments,
  contributions,
  currentYear,
  monthlyFee,
  preselectedAptId,
}: AddContributionModalProps) {
  const { profile, activeResidence } = useAuthStore();
  const [selectedAptId, setSelectedAptId] = useState<string>('');
  const [amount, setAmount] = useState<number>(monthlyFee);
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const Colors = useThemeColors();
  const styles = createStyles(Colors);
  const { t } = useLanguageStore();
  
  const fontRegular = useFontFamily('regular');
  const fontMedium = useFontFamily('medium');
  const fontBold = useFontFamily('bold');

  useEffect(() => {
    if (preselectedAptId) {
      setSelectedAptId(preselectedAptId);
    } else if (apartments.length > 0) {
      setSelectedAptId(apartments[0].id);
    }
  }, [preselectedAptId, apartments]);

  useEffect(() => {
    setAmount(monthlyFee);
  }, [monthlyFee]);

  const aptOptions = apartments.map((apt) => ({
    label: t('apartments.label', { number: apt.number }),
    value: apt.id,
  }));

  const allocatePayment = async () => {
    if (isSubmitting) return;
    if (!selectedAptId || amount <= 0 || !activeResidence || !profile) {
      if (amount <= 0) Alert.alert(t('common.error'), t('contributions.amount_invalid'));
      return;
    }
    setIsSubmitting(true);

    try {
      let remainingAmount = amount;
      const apt = apartments.find((a) => a.id === selectedAptId);
      if (!apt) return;

      const frequency = activeResidence.contribution_frequency ?? 'monthly';
      const periodsPerYear = frequency === 'quarterly' ? 4 : frequency === 'yearly' ? 1 : 12;
      const maxPeriods = periodsPerYear;

      const aptContributions = contributions.filter((c) => c.apartment_id === selectedAptId);
      
      let nextPeriod = 1;
      let nextYear = currentYear;

      if (aptContributions.length > 0) {
        const sorted = [...aptContributions].sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          return b.month - a.month;
        });
        const lastContrib = sorted[0];
        
        nextPeriod = lastContrib.month + 1;
        nextYear = lastContrib.year;
        if (nextPeriod > maxPeriods) {
          nextPeriod = 1;
          nextYear++;
        }
      }

      while (remainingAmount > 0) {
        const existing = aptContributions.find(
          (c) => c.year === nextYear && c.month === nextPeriod
        );

        if (existing) {
          const needed = monthlyFee - existing.amount;
          if (needed <= 0) {
            nextPeriod++;
            if (nextPeriod > maxPeriods) {
              nextPeriod = 1;
              nextYear++;
            }
            continue;
          }

          const toAllocate = Math.min(remainingAmount, needed);
          const isFullyPaid = existing.amount + toAllocate >= monthlyFee;
          await updateContribution(existing.id, {
            amount: existing.amount + toAllocate,
            paid: isFullyPaid,
            paid_at: isFullyPaid ? new Date(payDate).toISOString() : null,
          });
          remainingAmount -= toAllocate;

          nextPeriod++;
          if (nextPeriod > maxPeriods) {
            nextPeriod = 1;
            nextYear++;
          }
        } else {
          const toAllocate = Math.min(remainingAmount, monthlyFee);
          const isFullyPaid = toAllocate >= monthlyFee;
          await createContribution({
            residence_id: activeResidence.id,
            apartment_id: selectedAptId,
            year: nextYear,
            month: nextPeriod,
            amount: toAllocate,
            paid: isFullyPaid,
            paid_at: isFullyPaid ? new Date(payDate).toISOString() : null,
            comment: null,
            created_by: profile.id,
          });
          remainingAmount -= toAllocate;

          nextPeriod++;
          if (nextPeriod > maxPeriods) {
            nextPeriod = 1;
            nextYear++;
          }
        }
      }

      onSuccess(amount);
      onClose();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={[styles.modalTitle, { fontFamily: fontBold }]}>{t('contributions.add_payment')}</Text>

          <SelectInput
            label={t('contributions.apartment_label')}
            options={aptOptions}
            selectedValue={selectedAptId}
            onSelect={setSelectedAptId}
          />

          <View style={{ marginBottom: Spacing.xl, marginTop: Spacing.md }}>
            <DateField
              label={t('contributions.payment_date')}
              value={payDate ? new Date(payDate + 'T12:00:00') : new Date()}
              onChange={(date) => {
                setPayDate(date.toISOString().split('T')[0]);
              }}
              formatString="dd MMMM yyyy"
            />
          </View>

          <View style={{ marginBottom: Spacing.xl }}>
            <Text style={[styles.inputLabel, { fontFamily: fontMedium }]}>{t('contributions.amount_label')}</Text>
            <View style={styles.amountControl}>
              <TouchableOpacity
                style={styles.amountBtn}
                onPress={() => setAmount(Math.max(monthlyFee, amount - monthlyFee))}
              >
                <Ionicons name="remove" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>

              <TextInput
                style={[styles.amountInput, { fontFamily: fontRegular }]}
                value={amount.toString()}
                onChangeText={(val) => setAmount(parseInt(val) || 0)}
                keyboardType="numeric"
              />

              <TouchableOpacity style={styles.amountBtn} onPress={() => setAmount(amount + monthlyFee)}>
                <Ionicons name="add" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.modalActions}>
            <Button label={t('common.cancel')} variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button label={t('common.validate')} onPress={allocatePayment} isLoading={isSubmitting} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(Colors: any) {
  return StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: Spacing.xl,
    },
    modalContent: {
      backgroundColor: Colors.navyCard,
      borderRadius: Radius.xl,
      padding: Spacing.xl,
      borderWidth: 1,
      borderColor: Colors.navyBorder,
    },
    modalTitle: {
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
      color: Colors.textPrimary,
      marginBottom: Spacing.lg,
    },
    inputLabel: {
      fontSize: FontSize.sm,
      fontWeight: FontWeight.medium,
      color: Colors.textSecondary,
      marginBottom: 8,
    },
    amountControl: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    amountBtn: {
      width: 48,
      height: 48,
      borderRadius: Radius.md,
      backgroundColor: Colors.navy,
      borderWidth: 1,
      borderColor: Colors.navyBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    amountInput: {
      flex: 1,
      height: 48,
      backgroundColor: Colors.navy,
      borderWidth: 1,
      borderColor: Colors.navyBorder,
      borderRadius: Radius.md,
      color: Colors.textPrimary,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
      textAlign: 'center',
    },
    modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  });
}
