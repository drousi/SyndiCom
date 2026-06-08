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
import { useThemeColors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';
import { createContribution, updateContribution } from '../../db/repositories/contributions';
import { Apartment, Contribution } from '../../types';
import { SelectInput } from './SelectInput';
import { DateField } from './DateField';
import { Button } from './Button';

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
  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const [selectedAptId, setSelectedAptId] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedAptId(preselectedAptId || (apartments.length > 0 ? apartments[0].id : ''));
      setAmount(monthlyFee);
      setPayDate(new Date().toISOString().split('T')[0]);
    }
  }, [visible, preselectedAptId, apartments, monthlyFee]);

  const aptOptions = apartments.map((a) => ({
    label: `Appartement ${a.number} ${a.owner_name ? `(${a.owner_name})` : ''}`,
    value: a.id,
  }));

  const allocatePayment = async () => {
    if (!activeResidence || !profile) return;
    if (!selectedAptId || amount <= 0) {
      Alert.alert('Erreur', 'Sélectionnez un appartement et saisissez un montant valide.');
      return;
    }

    setIsSubmitting(true);
    try {
      let remainingAmount = amount;
      const aptContribs = contributions.filter((c) => c.apartment_id === selectedAptId);

      for (let month = 1; month <= 12; month++) {
        if (remainingAmount <= 0) break;

        const contrib = aptContribs.find((c) => c.month === month);
        const currentPaid = contrib ? contrib.amount : 0;

        // Si le mois est déjà marqué comme "payé", on ne réclame pas la différence
        const needed = contrib && contrib.paid ? 0 : monthlyFee - currentPaid;

        if (needed > 0) {
          const toAllocate = Math.min(needed, remainingAmount);
          const newTotal = currentPaid + toAllocate;
          const isFullyPaid = newTotal >= monthlyFee;

          if (contrib) {
            await updateContribution(
              contrib.id,
              {
                amount: newTotal,
                paid: isFullyPaid,
                paid_at: isFullyPaid ? new Date(payDate).toISOString() : null,
              },
              profile.id
            );
          } else {
            await createContribution({
              residence_id: activeResidence.id,
              apartment_id: selectedAptId,
              month,
              year: currentYear,
              amount: toAllocate,
              paid: isFullyPaid,
              paid_at: isFullyPaid ? new Date(payDate).toISOString() : null,
              comment: null,
              created_by: profile.id,
            });
          }

          remainingAmount -= toAllocate;
        }
      }

      // Handle surplus -> rollovers
      if (remainingAmount > 0) {
        let nextYear = currentYear + 1;
        let nextMonth = 1;

        // Safety limit to max 5 years ahead
        while (remainingAmount > 0 && nextYear < currentYear + 5) {
          const toAllocate = Math.min(monthlyFee, remainingAmount);
          const isFullyPaid = toAllocate >= monthlyFee;

          await createContribution({
            residence_id: activeResidence.id,
            apartment_id: selectedAptId,
            month: nextMonth,
            year: nextYear,
            amount: toAllocate,
            paid: isFullyPaid,
            paid_at: isFullyPaid ? new Date(payDate).toISOString() : null,
            comment: 'Excédent',
            created_by: profile.id,
          });
          remainingAmount -= toAllocate;

          nextMonth++;
          if (nextMonth > 12) {
            nextMonth = 1;
            nextYear++;
          }
        }
      }

      onSuccess(amount);
      onClose();
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Ajouter un paiement</Text>

          <SelectInput
            label="Appartement"
            options={aptOptions}
            selectedValue={selectedAptId}
            onSelect={setSelectedAptId}
          />

          <View style={{ marginBottom: Spacing.xl, marginTop: Spacing.md }}>
            <DateField
              label="Date du paiement"
              value={payDate ? new Date(payDate + 'T12:00:00') : new Date()}
              onChange={(date) => {
                setPayDate(date.toISOString().split('T')[0]);
              }}
              formatString="dd MMMM yyyy"
            />
          </View>

          <View style={{ marginBottom: Spacing.xl }}>
            <Text style={styles.inputLabel}>Montant (DH)</Text>
            <View style={styles.amountControl}>
              <TouchableOpacity
                style={styles.amountBtn}
                onPress={() => setAmount(Math.max(0, amount - monthlyFee))}
              >
                <Ionicons name="remove" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>

              <TextInput
                style={styles.amountInput}
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
            <Button label="Annuler" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button label="Valider" onPress={allocatePayment} isLoading={isSubmitting} style={{ flex: 1 }} />
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
