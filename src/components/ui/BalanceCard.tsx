import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, FontSize, FontWeight, Spacing } from '../../constants/theme';
import { useLanguageStore } from '../../store/language.store';

interface BalanceCardProps {
  currentYear: number;
  setCurrentYear: (year: number | ((prev: number) => number)) => void;
  totalContributions: number;
  totalExpenses: number;
  balance: number;
  currency?: string;
  style?: object;
}

export function BalanceCard({
  currentYear,
  setCurrentYear,
  totalContributions,
  totalExpenses,
  balance,
  currency = 'DH',
  style,
}: BalanceCardProps) {
  const Colors = useThemeColors();
  const { t, isRTL } = useLanguageStore();

  return (
    <View style={[styles.container, { backgroundColor: Colors.navyCard, borderColor: Colors.primary }, style]}>
      {/* Year Selector */}
      <View style={[styles.yearSelector, { borderColor: Colors.navyBorder }]}>
        <TouchableOpacity style={styles.arrowBtn} onPress={() => setCurrentYear(y => y - 1)}>
          <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={16} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.yearText, { color: Colors.textPrimary }]}>{currentYear}</Text>
        <TouchableOpacity style={styles.arrowBtn} onPress={() => setCurrentYear(y => y + 1)}>
          <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={16} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
      
      {/* Balances */}
      <View style={styles.balancesContainer}>
        <View style={[styles.balanceItem, { borderColor: Colors.navyBorder }]}>
          <Text style={[styles.balanceLabel, { color: Colors.textSecondary }]}>{t('dashboard.balance_contributions')}</Text>
          <Text style={[styles.balanceValue, { color: Colors.primary }]} numberOfLines={1}>
            {totalContributions?.toLocaleString('fr-MA', { minimumFractionDigits: 0 })} {currency}
          </Text>
        </View>
        <View style={[styles.balanceItem, { borderColor: Colors.navyBorder, paddingHorizontal: Spacing.sm }]}>
          <Text style={[styles.balanceLabel, { color: Colors.textSecondary }]}>{t('dashboard.balance_expenses')}</Text>
          <Text style={[styles.balanceValue, { color: Colors.danger }]} numberOfLines={1}>
            {totalExpenses?.toLocaleString('fr-MA', { minimumFractionDigits: 0 })} {currency}
          </Text>
        </View>
        <View style={[styles.balanceItemRight, { paddingLeft: Spacing.sm }]}>
          <Text style={[styles.balanceLabel, { color: Colors.textSecondary }]}>{t('dashboard.balance_balance')}</Text>
          <Text style={[styles.balanceValue, { color: balance >= 0 ? Colors.primary : Colors.danger }]} numberOfLines={1}>
            {balance?.toLocaleString('fr-MA', { minimumFractionDigits: 0 })} {currency}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRightWidth: 1,
    paddingRight: Spacing.sm,
    marginRight: Spacing.sm,
  },
  arrowBtn: {
    padding: 4,
  },
  yearText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    marginHorizontal: 2,
  },
  balancesContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceItem: {
    flex: 1,
    borderRightWidth: 1,
    paddingRight: Spacing.sm,
  },
  balanceItemRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  balanceLabel: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
  },
  balanceValue: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
});
