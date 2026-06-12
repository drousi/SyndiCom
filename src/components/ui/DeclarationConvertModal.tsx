import React, { useState, useMemo, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  TouchableWithoutFeedback, ScrollView, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius, ThemeColors } from '../../constants/theme';
import { useLanguageStore } from '../../store/language.store';
import { useAuthStore } from '../../store/auth.store';
import { supabase } from '../../supabase/client';
import { createNotification } from '../../db/repositories/notifications';
import { updatePaymentDeclarationStatus, getUserPushToken } from '../../db/repositories/payment-declarations';
import { getPeriodLabels } from '../../constants/app';
import type { AppNotification } from '../../types';

interface Props {
  visible: boolean;
  notification: AppNotification | null;
  onClose: () => void;
  onSuccess: (notificationId: string) => void;
}

async function sendExpoPush(token: string, title: string, body: string): Promise<void> {
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify([{ to: token, title, body, data: { createInApp: false } }]),
    });
  } catch (_) {}
}

export function DeclarationConvertModal({ visible, notification, onClose, onSuccess }: Props) {
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguageStore();
  const { profile, activeResidence } = useAuthStore();

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedPeriod, setSelectedPeriod] = useState(1);
  const [loading, setLoading] = useState(false);
  const [paidPeriods, setPaidPeriods] = useState<Set<string>>(new Set());
  const [aptPhone, setAptPhone] = useState<string | null>(null);

  const frequency = activeResidence?.contribution_frequency ?? 'monthly';
  const currency = activeResidence?.currency ?? 'DH';
  const monthlyFee = activeResidence?.monthly_fee ?? 0;

  const meta = notification?.metadata ?? {};
  const amount = meta.amount ?? 0;
  const aptNumber = meta.apartment_number ?? '';
  const aptId = meta.apartment_id ?? '';
  const ownerName = meta.owner_name ?? '';
  const periodsCount = monthlyFee > 0 ? Math.max(1, Math.floor(amount / monthlyFee)) : 1;

  const periodLabels = getPeriodLabels(frequency);
  const maxPeriods = periodLabels.length;
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (!visible || !aptId) return;
    setPaidPeriods(new Set());
    setAptPhone(null);
    Promise.all([
      supabase.from('contributions').select('month, year').eq('apartment_id', aptId).eq('paid', true),
      supabase.from('apartments').select('phone').eq('id', aptId).maybeSingle(),
    ]).then(([contribsRes, aptRes]) => {
      const paid = new Set<string>((contribsRes.data ?? []).map((c: any) => `${c.year}-${c.month}`));
      setPaidPeriods(paid);
      setAptPhone((aptRes.data as any)?.phone ?? null);
    });
  }, [visible, aptId]);

  const handleConfirm = async () => {
    if (!notification || !profile || !activeResidence || !aptId) return;
    setLoading(true);
    try {
      // 1. Create contributions for each period covered, starting from selectedPeriod
      for (let i = 0; i < periodsCount; i++) {
        let period = selectedPeriod + i;
        let year = selectedYear;
        // Wrap around if period exceeds max (e.g. monthly: 13 → next year, period 1)
        while (period > maxPeriods) {
          period -= maxPeriods;
          year += 1;
        }

        // Upsert: update if exists, insert if not
        const { data: existing } = await supabase
          .from('contributions')
          .select('id')
          .eq('apartment_id', aptId)
          .eq('month', period)
          .eq('year', year)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('contributions')
            .update({ paid: true, paid_at: new Date().toISOString(), amount: monthlyFee })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('contributions')
            .insert({
              residence_id: activeResidence.id,
              apartment_id: aptId,
              month: period,
              year,
              amount: monthlyFee,
              paid: true,
              paid_at: new Date().toISOString(),
              comment: null,
              created_by: profile.id,
            });
        }
      }

      // 2. Mark declaration as validated
      if (notification.related_declaration_id) {
        await updatePaymentDeclarationStatus(
          notification.related_declaration_id,
          'validated',
          profile.id
        );

        // 3. Find declared_by from the declaration to notify the resident
        const { data: decl } = await supabase
          .from('payment_declarations')
          .select('declared_by')
          .eq('id', notification.related_declaration_id)
          .maybeSingle();

        if (decl?.declared_by) {
          const notifBody = t('notifications.resident_validated_body', {
            amount,
            currency,
            count: periodsCount,
          });
          // Create in-app notification for the resident
          await createNotification({
            residence_id: activeResidence.id,
            title: t('notifications.resident_validated_title'),
            body: notifBody,
            type: 'payment_declaration',
            target_user_id: decl.declared_by,
          }).catch(() => {});

          // Send push to resident
          const pushToken = await getUserPushToken(decl.declared_by);
          if (pushToken) {
            await sendExpoPush(pushToken, t('notifications.resident_validated_title'), notifBody);
          }
        }
      }

      onSuccess(notification.id);
      onClose();
    } catch (e: any) {
      Alert.alert(t('common.error'), t('notifications.convert_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleReject = () => {
    Alert.alert(
      t('notifications.convert_reject_confirm_title'),
      t('notifications.convert_reject_confirm_desc'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('notifications.convert_reject_btn'),
          style: 'destructive',
          onPress: async () => {
            if (!notification || !profile || !activeResidence) return;
            setLoading(true);
            try {
              if (notification.related_declaration_id) {
                await updatePaymentDeclarationStatus(notification.related_declaration_id, 'rejected', profile.id);
                const { data: decl } = await supabase
                  .from('payment_declarations')
                  .select('declared_by')
                  .eq('id', notification.related_declaration_id)
                  .maybeSingle();
                if (decl?.declared_by) {
                  const rejBody = t('notifications.resident_rejected_body', { amount, currency });
                  await createNotification({
                    residence_id: activeResidence.id,
                    title: t('notifications.resident_rejected_title'),
                    body: rejBody,
                    type: 'payment_declaration',
                    target_user_id: decl.declared_by,
                  }).catch(() => {});
                  const pushToken = await getUserPushToken(decl.declared_by);
                  if (pushToken) await sendExpoPush(pushToken, t('notifications.resident_rejected_title'), rejBody);
                }
              }
              onSuccess(notification.id);
              onClose();
            } catch {
              Alert.alert(t('common.error'), t('notifications.convert_error'));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (!notification) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={[styles.panel, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('notifications.convert_title')}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* Resident info card */}
          <View style={styles.infoCard}>
            {/* Header: apartment number + owner */}
            <View style={styles.infoCardHeader}>
              <Ionicons name="home" size={16} color={Colors.primary} />
              <Text style={styles.infoCardTitle}>{t('notifications.convert_apt', { number: aptNumber })}</Text>
              {ownerName ? <Text style={styles.infoCardSubtitle}> · {ownerName}</Text> : null}
            </View>
            {/* Body */}
            <View style={styles.infoCardBody}>
              {aptPhone ? (
                <View style={styles.phoneRow}>
                  <Text style={styles.infoMuted}>{aptPhone}</Text>
                  <View style={styles.phoneActions}>
                    <TouchableOpacity
                      style={[styles.phoneBtn, { backgroundColor: Colors.primarySurface }]}
                      onPress={() => Linking.openURL(`tel:${aptPhone}`)}
                    >
                      <Ionicons name="call" size={16} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.phoneBtn, { backgroundColor: 'rgba(37,211,102,0.12)' }]}
                      onPress={() => Linking.openURL(`https://wa.me/${aptPhone.replace(/\D/g, '')}`)}
                    >
                      <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
              <View style={styles.paidSummaryRow}>
                <Ionicons name="checkmark-circle-outline" size={14} color={Colors.success} />
                <Text style={styles.infoMuted}>
                  {t('notifications.convert_already_paid_summary', {
                    count: [...paidPeriods].filter(k => k.startsWith(`${selectedYear}-`)).length,
                    total: maxPeriods,
                    year: selectedYear,
                  })}
                </Text>
              </View>
            </View>
          </View>

          {/* Year selector */}
          <View style={styles.yearBlock}>
            <Text style={styles.sectionLabel}>{t('notifications.convert_year_label')}</Text>
            <View style={styles.yearRow}>
              <TouchableOpacity
                style={styles.yearBtn}
                onPress={() => isRTL ? setSelectedYear(y => Math.min(currentYear + 1, y + 1)) : setSelectedYear(y => y - 1)}
              >
                <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.yearText}>{selectedYear}</Text>
              <TouchableOpacity
                style={styles.yearBtn}
                onPress={() => isRTL ? setSelectedYear(y => y - 1) : setSelectedYear(y => Math.min(currentYear + 1, y + 1))}
              >
                <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {/* Declaration amount + periods covered */}
            <View style={styles.declSummary}>
              <View style={styles.declSummaryItem}>
                <Ionicons name="cash-outline" size={14} color={Colors.primary} />
                <Text style={styles.declSummaryText}>{t('notifications.convert_amount', { amount, currency })}</Text>
              </View>
              <View style={styles.declSummaryItem}>
                <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.declSummaryMuted}>
                  {t('notifications.convert_periods_covered', { count: periodsCount, fee: monthlyFee, currency })}
                </Text>
              </View>
            </View>
          </View>

          {/* Period selector */}
          <View style={styles.sectionBlock} >
            <Text style={styles.sectionLabel}>{t('notifications.convert_period_label')}</Text>
            <View style={styles.periodGrid}>
              {periodLabels.map((label, idx) => {
                const period = idx + 1;
                const isSelected = period === selectedPeriod;
                const isPaid = paidPeriods.has(`${selectedYear}-${period}`);
                return (
                  <TouchableOpacity
                    key={period}
                    style={[
                      styles.periodCell,
                      isSelected && styles.periodCellSelected,
                      isPaid && styles.periodCellPaid,
                    ]}
                    onPress={() => !isPaid && setSelectedPeriod(period)}
                    disabled={isPaid}
                    activeOpacity={isPaid ? 1 : 0.7}
                  >
                    <Text style={[
                      styles.periodCellText,
                      isSelected && styles.periodCellTextSelected,
                      isPaid && styles.periodCellTextPaid,
                    ]}>
                      {label}
                    </Text>
                    {isPaid && <Ionicons name="checkmark" size={10} color={Colors.success} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.rejectBtn, loading && { opacity: 0.5 }]}
              onPress={handleReject}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Ionicons name="close-circle-outline" size={20} color={Colors.danger} />
              <Text style={styles.rejectBtnText}>{t('notifications.convert_reject_btn')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, loading && { opacity: 0.7 }]}
              onPress={handleConfirm}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
                  <Text style={styles.confirmBtnText}>{t('notifications.convert_btn')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.navy,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderColor: Colors.navyBorder,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.navyBorder,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderColor: Colors.navyBorder,
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xl },

  infoCard: {
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    overflow: 'hidden',
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primarySurface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
  },
  infoCardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
  infoCardSubtitle: { fontSize: FontSize.sm, color: Colors.primary, opacity: 0.7, flex: 1 },
  infoCardBody: { padding: Spacing.md, gap: Spacing.sm },
  phoneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  phoneActions: { flexDirection: 'row', gap: Spacing.sm },
  phoneBtn: {
    width: 34, height: 34, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  paidSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  infoText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  infoMuted: { fontSize: FontSize.sm, color: Colors.textSecondary },

  sectionBlock: { gap: Spacing.xs },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },

  yearBlock: { alignItems: 'center', gap: Spacing.xs },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  yearBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.navyCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  yearText: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, minWidth: 60, textAlign: 'center' },

  periodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  periodCell: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.navyCard,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    minWidth: 52,
    alignItems: 'center',
  },
  periodCellSelected: {
    backgroundColor: Colors.primarySurface,
    borderColor: Colors.primary,
  },
  periodCellText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  periodCellTextSelected: { color: Colors.primary, fontWeight: FontWeight.bold },
  periodCellPaid: { borderColor: Colors.success, opacity: 0.6 },
  periodCellTextPaid: { color: Colors.success, fontSize: FontSize.xs },

  infoSeparator: { borderTopWidth: 1, borderTopColor: Colors.navyBorder, paddingTop: Spacing.sm, marginTop: Spacing.xs },
  declSummary: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    width: '100%',
  },
  declSummaryItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  declSummaryText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  declSummaryMuted: { fontSize: FontSize.sm, color: Colors.textSecondary },

  btnRow: { flexDirection: 'row', gap: Spacing.md },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderWidth: 1.5,
    borderColor: Colors.danger,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  rejectBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.danger },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  confirmBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.white },
});
