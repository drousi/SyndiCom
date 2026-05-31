import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/supabase/client';
import { useAuthStore } from '../../../src/store/auth.store';
import { Badge } from '../../../src/components/ui/Badge';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../../src/constants/theme';
import { MONTHS_FR } from '../../../src/constants/app';
import type { Apartment, Contribution, PaymentDeclaration } from '../../../src/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function MyApartmentScreen() {
  const router = useRouter();
  const { profile, activeResidence } = useAuthStore();
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [declarations, setDeclarations] = useState<PaymentDeclaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const loadData = useCallback(async () => {
    if (!profile || !activeResidence) { setLoading(false); return; }
    try {
      // 1. Load my apartment
      const { data: apt } = await supabase
        .from('apartments')
        .select('*')
        .eq('resident_user_id', profile.id)
        .eq('residence_id', activeResidence.id)
        .single();

      if (!apt) { setLoading(false); return; }
      setApartment(apt);

      // 2. Load contributions for current year
      const { data: contribs } = await supabase
        .from('contributions')
        .select('*')
        .eq('apartment_id', apt.id)
        .eq('year', currentYear)
        .order('month', { ascending: true });
      setContributions((contribs ?? []).map(c => ({ ...c, paid: c.paid })));

      // 3. Load pending declarations
      const { data: decls } = await supabase
        .from('payment_declarations')
        .select('*')
        .eq('apartment_id', apt.id)
        .order('created_at', { ascending: false })
        .limit(5);
      setDeclarations(decls ?? []);

    } catch (e) {
      console.error('[MyApartment] Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, activeResidence, currentYear]);

  useEffect(() => { loadData(); }, [loadData]);

  const paidMonths = contributions.filter(c => c.paid).length;
  const totalPaid = contributions.filter(c => c.paid).reduce((s, c) => s + c.amount, 0);
  const monthlyFee = activeResidence?.monthly_fee ?? 0;
  const balance = totalPaid - (paidMonths * monthlyFee);
  const pendingDecl = declarations.find(d => d.status === 'pending');

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!apartment) {
    return (
      <View style={styles.noAptContainer}>
        <Ionicons name="home-outline" size={56} color={Colors.textSecondary} />
        <Text style={styles.noAptTitle}>Aucun appartement lié</Text>
        <Text style={styles.noAptText}>
          Contactez votre gestionnaire pour lier votre compte à votre appartement.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Mon appart." />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Balance card */}
        <View style={[styles.balanceCard, { borderColor: balance >= 0 ? 'rgba(76,175,80,0.3)' : 'rgba(239,68,68,0.3)' }]}>
          <Text style={styles.balanceLabel}>Solde {currentYear}</Text>
          <Text style={[styles.balanceAmount, { color: balance >= 0 ? Colors.primary : Colors.danger }]}>
            {balance >= 0 ? '+' : ''}{balance.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} {activeResidence?.currency ?? 'DH'}
          </Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceStat}>
              <Text style={styles.balanceStatVal}>{paidMonths}/12</Text>
              <Text style={styles.balanceStatLab}>mois payés</Text>
            </View>
            <View style={styles.balanceStat}>
              <Text style={styles.balanceStatVal}>{monthlyFee} {activeResidence?.currency}</Text>
              <Text style={styles.balanceStatLab}>cotisation</Text>
            </View>
            <View style={styles.balanceStat}>
              <Text style={[styles.balanceStatVal, { color: Colors.danger }]}>
                {Math.max(0, 12 - paidMonths)}
              </Text>
              <Text style={styles.balanceStatLab}>mois dus</Text>
            </View>
          </View>
        </View>

        {/* Declare payment button */}
        {pendingDecl ? (
          <View style={styles.pendingBanner}>
            <Ionicons name="time-outline" size={18} color={Colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingTitle}>Déclaration en attente</Text>
              <Text style={styles.pendingText}>
                {pendingDecl.amount} {activeResidence?.currency} · En cours de validation par votre gestionnaire
              </Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.declareBtn}
            onPress={() => router.push('/(app)/my-apartment/declare')}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle" size={22} color={Colors.white} />
            <Text style={styles.declareBtnText}>Déclarer un paiement</Text>
          </TouchableOpacity>
        )}

        {/* Monthly grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suivi mensuel {currentYear}</Text>
          <View style={styles.monthGrid}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
              const contrib = contributions.find(c => c.month === month);
              const isPaid = contrib?.paid;
              const isPast = month <= currentMonth;
              const isCurrent = month === currentMonth;
              return (
                <View
                  key={month}
                  style={[
                    styles.monthCell,
                    isPaid && styles.monthCellPaid,
                    !isPaid && isPast && styles.monthCellUnpaid,
                    isCurrent && !isPaid && styles.monthCellCurrent,
                  ]}
                >
                  <Text style={[styles.monthCellText, isPaid && { color: Colors.white }]}>
                    {MONTHS_FR[month - 1].slice(0, 3)}
                  </Text>
                  {isPaid && <Ionicons name="checkmark" size={10} color={Colors.white} />}
                </View>
              );
            })}
          </View>
        </View>

        {/* Recent declarations */}
        {declarations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mes déclarations récentes</Text>
            {declarations.map(d => (
              <View key={d.id} style={styles.declRow}>
                <View style={[styles.declStatus, {
                  backgroundColor: d.status === 'validated' ? Colors.successLight :
                    d.status === 'rejected' ? Colors.dangerLight : Colors.navyBorder,
                }]}>
                  <Ionicons
                    name={d.status === 'validated' ? 'checkmark' : d.status === 'rejected' ? 'close' : 'time'}
                    size={14}
                    color={d.status === 'validated' ? Colors.success : d.status === 'rejected' ? Colors.danger : Colors.textSecondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.declAmount}>
                    {d.amount} {activeResidence?.currency ?? 'DH'}
                  </Text>
                  {d.note && <Text style={styles.declNote}>{d.note}</Text>}
                  <Text style={styles.declDate}>
                    {format(new Date(d.created_at), 'dd MMM yyyy', { locale: fr })}
                  </Text>
                </View>
                <Badge
                  label={d.status === 'validated' ? 'Validé' : d.status === 'rejected' ? 'Refusé' : 'En attente'}
                  variant={d.status === 'validated' ? 'success' : d.status === 'rejected' ? 'danger' : 'neutral'}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navy },
  loadingContainer: { flex: 1, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: 56,
    paddingBottom: Spacing.lg,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  notifBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.navyCard,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: { padding: Spacing.xl, gap: Spacing.xl, paddingBottom: 48 },

  balanceCard: {
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    borderWidth: 1.5,
  },
  balanceLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  balanceAmount: { fontSize: 32, fontWeight: FontWeight.extrabold, letterSpacing: -1 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: Spacing.sm },
  balanceStat: { alignItems: 'center', gap: 2 },
  balanceStatVal: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  balanceStatLab: { fontSize: FontSize.xs, color: Colors.textSecondary },

  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  pendingTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.warning },
  pendingText: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  declareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    ...Shadow.green,
  },
  declareBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.white },

  section: { gap: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  monthCell: {
    width: '14%',
    aspectRatio: 1.2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.navyCard,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  monthCellPaid: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  monthCellUnpaid: { borderColor: Colors.danger, backgroundColor: Colors.dangerLight },
  monthCellCurrent: { borderColor: Colors.warning, borderWidth: 2 },
  monthCellText: { fontSize: 9, fontWeight: FontWeight.semibold, color: Colors.textSecondary },

  declRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  declStatus: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  declAmount: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  declNote: { fontSize: FontSize.xs, color: Colors.textSecondary },
  declDate: { fontSize: FontSize.xs, color: Colors.textMuted },

  noAptContainer: {
    flex: 1, backgroundColor: Colors.navy,
    alignItems: 'center', justifyContent: 'center',
    padding: Spacing.huge, gap: Spacing.md,
  },
  noAptTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  noAptText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
