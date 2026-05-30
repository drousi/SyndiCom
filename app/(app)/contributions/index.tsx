import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TouchableWithoutFeedback,
  ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Svg, Line } from 'react-native-svg';
import * as Print from 'expo-print';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useAuthStore } from '../../../src/store/auth.store';
import { supabase } from '../../../src/supabase/client';
import { Logo } from '../../../src/components/ui/Logo';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../../src/constants/theme';
import { MONTHS_FR, MONTHS_SHORT_FR } from '../../../src/constants/app';
import { getApartmentsByResidence } from '../../../src/db/repositories/apartments';
import { getContributionsByResidence, createContribution, updateContribution, getTotalContributions } from '../../../src/db/repositories/contributions';
import { getTotalExpenses } from '../../../src/db/repositories/expenses';
import { Button } from '../../../src/components/ui/Button';
import { SelectInput } from '../../../src/components/ui/SelectInput';
import { DatePickerModal } from '../../../src/components/ui/DatePickerModal';
import type { Apartment, Contribution } from '../../../src/types';

export default function ContributionsScreen() {
  const { profile, activeResidence, hasPermission } = useAuthStore();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [totalExpenses, setTotalExpenses] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAptId, setSelectedAptId] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  // FAB Menu Animation
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuAnim = useSharedValue(0);
  const viewShotRef = useRef<ViewShot>(null);

  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const canManage = hasPermission('write');
  const monthlyFee = activeResidence?.monthly_fee || 0;

  const loadData = useCallback(async () => {
    if (!activeResidence) return;
    try {
      const [apts, contribs, totalContribs, totalExp] = await Promise.all([
        getApartmentsByResidence(activeResidence.id),
        getContributionsByResidence(activeResidence.id, currentYear),
        getTotalContributions(activeResidence.id),
        getTotalExpenses(activeResidence.id)
      ]);
      setApartments(apts.filter(a => a.active));
      setContributions(contribs);
      setBalance(totalContribs - totalExp);
      setTotalExpenses(totalExp);
    } catch (e) {
      console.error('[Contributions] Load error:', e);
    } finally {
      setLoading(false);
    }
  }, [activeResidence, currentYear]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const toggleMenu = () => setIsMenuOpen(prev => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  useEffect(() => {
    // Tighter spring to remove exaggerated bouncing
    menuAnim.value = withSpring(isMenuOpen ? 1 : 0, { damping: 20, stiffness: 180, mass: 0.8 });
  }, [isMenuOpen, menuAnim]);

  const fabStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${menuAnim.value * 45}deg` }]
    };
  });

  const action1Style = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: menuAnim.value * -60 }],
      opacity: menuAnim.value,
    };
  });

  const action2Style = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: menuAnim.value * -115 }],
      opacity: menuAnim.value,
    };
  });

  const action3Style = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: menuAnim.value * -170 }],
      opacity: menuAnim.value,
    };
  });

  const exportPDF = async () => {
    try {
      setIsSubmitting(true);
      
      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
              h1 { text-align: center; color: #1e3a8a; }
              h3 { text-align: center; color: #6b7280; margin-bottom: 30px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
              th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: center; }
              th { background-color: #f3f4f6; font-weight: bold; color: #1f2937; }
              .corner { background-color: #f3f4f6; }
              .paid { color: #10b981; font-weight: bold; }
              .partial { color: #f59e0b; font-weight: bold; }
              .total { background-color: #f3f4f6; font-weight: bold; }
            </style>
          </head>
          <body>
            <h1>${activeResidence?.name || 'SyndiCom'}</h1>
            <h3>Situation des cotisations - ${new Date().toLocaleDateString('fr-FR')}</h3>
            
            <table>
              <thead>
                <tr>
                  <th class="corner">Mois \\ Appart.</th>
                  ${apartments.map(apt => `<th>App. ${apt.number}<br/><small>${apt.owner_name || 'N/A'}</small></th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${Array.from({ length: 12 }, (_, i) => i + 1).map(month => `
                  <tr>
                    <th>${MONTHS_SHORT_FR[month-1]}</th>
                    ${apartments.map(apt => {
                      const contrib = contributions.find(c => c.apartment_id === apt.id && c.month === month);
                      if (contrib && contrib.paid) {
                        return `<td class="paid">${contrib.amount} DH</td>`;
                      } else if (contrib && !contrib.paid && contrib.amount > 0) {
                        return `<td class="partial">${contrib.amount} DH</td>`;
                      } else {
                        return `<td>-</td>`;
                      }
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <th class="total">Total</th>
                  ${apartments.map(apt => {
                    const aptTotal = contributions
                      .filter(c => c.apartment_id === apt.id)
                      .reduce((sum, c) => sum + c.amount, 0);
                    return `<td class="total">${aptTotal} DH</td>`;
                  }).join('')}
                </tr>
              </tfoot>
            </table>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Partager la matrice des cotisations',
        UTI: 'com.adobe.pdf'
      });
      
    } catch (error: any) {
      Alert.alert('Erreur', 'Impossible de générer le PDF');
    } finally {
      setIsSubmitting(false);
    }
  };

  const shareMatrix = async () => {
    setIsCapturing(true);
    setTimeout(async () => {
      if (!viewShotRef.current?.capture) {
        setIsCapturing(false);
        return;
      }
      try {
        setIsSubmitting(true);
        const uri = await viewShotRef.current.capture();
        setIsCapturing(false);
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Partager la matrice des contributions',
          UTI: 'public.png'
        });
      } catch (e: any) {
        setIsCapturing(false);
        Alert.alert('Erreur de partage', e.message);
      } finally {
        setIsSubmitting(false);
      }
    }, 150);
  };

  // Double Tap handling
  const lastTapRef = useRef<{ time: number, key: string }>({ time: 0, key: '' });
  
  const handleDoubleTap = (key: string, callback: () => void) => {
    if (!canManage) return;
    const now = Date.now();
    if (lastTapRef.current.key === key && now - lastTapRef.current.time < 300) {
      callback();
      lastTapRef.current = { time: 0, key: '' };
    } else {
      lastTapRef.current = { time: now, key };
    }
  };

  const handleCellDoubleTap = async (apt: Apartment, month: number, contrib?: Contribution) => {
    if (!activeResidence || !profile) return;
    
    if (contrib) {
      // Optimistic delete
      setContributions(prev => prev.filter(c => c.id !== contrib.id));
      
      // Background delete
      try {
        const { data, error } = await supabase.from('contributions').delete().eq('id', contrib.id).select();
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error("Impossible de supprimer. Vérifiez vos permissions (Policy RLS).");
        }
      } catch (e: any) { 
        Alert.alert('Erreur', e.message); 
        loadData(); // Revert on failure
      }
    } else {
      // Optimistic create
      const tempId = `temp_${Date.now()}`;
      const newContrib: Contribution = {
        id: tempId,
        residence_id: activeResidence.id,
        apartment_id: apt.id,
        month,
        year: currentYear,
        amount: monthlyFee,
        paid: true,
        paid_at: new Date().toISOString(),
        comment: null,
        created_by: profile.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      setContributions(prev => [...prev, newContrib]);

      // Background create
      try {
        await createContribution({
          residence_id: activeResidence.id,
          apartment_id: apt.id,
          month,
          year: currentYear,
          amount: monthlyFee,
          paid: true,
          paid_at: new Date().toISOString(),
          comment: null,
          created_by: profile.id
        });
        loadData(); // Sync real DB ID in background
      } catch (e: any) {
        Alert.alert('Erreur', 'Impossible de créer la contribution: ' + e.message);
        loadData(); // Revert on failure
      }
    }
  };

  const openPaymentDialog = (aptId?: string) => {
    if (!canManage) return;
    setSelectedAptId(aptId || (apartments.length > 0 ? apartments[0].id : ''));
    setAmount(monthlyFee);
    setPayDate(new Date().toISOString().split('T')[0]);
    setModalVisible(true);
  };

  const allocatePayment = async () => {
    if (!activeResidence || !profile) return;
    if (!selectedAptId || amount <= 0) {
      Alert.alert('Erreur', 'Sélectionnez un appartement et saisissez un montant valide.');
      return;
    }

    setIsSubmitting(true);
    try {
      let remainingAmount = amount;
      const aptContribs = contributions.filter(c => c.apartment_id === selectedAptId);
      
      for (let month = 1; month <= 12; month++) {
        if (remainingAmount <= 0) break;
        
        const contrib = aptContribs.find(c => c.month === month);
        const currentPaid = contrib ? contrib.amount : 0;
        const needed = monthlyFee - currentPaid;
        
        if (needed > 0) {
          const toAllocate = Math.min(needed, remainingAmount);
          const newTotal = currentPaid + toAllocate;
          const isFullyPaid = newTotal >= monthlyFee;
          
          if (contrib) {
            await updateContribution(contrib.id, {
              amount: newTotal,
              paid: isFullyPaid,
              paid_at: isFullyPaid ? new Date(payDate).toISOString() : null
            }, profile.id);
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
              created_by: profile.id
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
            created_by: profile.id
          });
          remainingAmount -= toAllocate;
          
          nextMonth++;
          if (nextMonth > 12) {
            nextMonth = 1;
            nextYear++;
          }
        }
      }
      
      setModalVisible(false);
      loadData();
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const aptOptions = apartments.map(a => ({
    label: `App. ${a.number} - ${a.owner_name || 'Sans résident'}`,
    value: a.id
  }));

  const renderMatrixData = () => (
    <View>
      {/* Header Row (Apartments) */}
      <View style={styles.row}>
        {apartments.map(apt => (
          <TouchableOpacity 
            key={apt.id} 
            style={[styles.cell, styles.headerCell]}
            activeOpacity={0.7}
            onPress={() => handleDoubleTap(`apt_${apt.id}`, () => openPaymentDialog(apt.id))}
          >
            <Text style={styles.headerCellApt}>App. {apt.number}</Text>
            <Text style={styles.headerCellName} numberOfLines={1}>{apt.owner_name || 'N/A'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Data Rows (Months) */}
      {Array.from({ length: 12 }, (_, i) => i + 1).map((month, index) => (
        <View key={`data_row_${month}`} style={styles.row}>
          {apartments.map(apt => {
            const contrib = contributions.find(c => c.apartment_id === apt.id && c.month === month);
            const isPaid = contrib && contrib.paid;
            const isPartial = contrib && !contrib.paid && contrib.amount > 0;
            
            return (
              <TouchableOpacity
                key={`${apt.id}_${month}`}
                style={[styles.cell, styles.dataCell, index % 2 !== 0 && { backgroundColor: Colors.navyCard }]}
                activeOpacity={0.7}
                onPress={() => handleDoubleTap(`${apt.id}_${month}`, () => handleCellDoubleTap(apt, month, contrib))}
              >
                {isPaid ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', height: 24, maxWidth: 84 }}>
                    <View style={{ backgroundColor: Colors.primary, paddingHorizontal: 6, height: '100%', justifyContent: 'center', borderTopLeftRadius: 12, borderBottomLeftRadius: 12 }}>
                      <Ionicons name="checkmark" size={12} color={Colors.white} />
                    </View>
                    <View style={{ borderWidth: 1, borderColor: Colors.primary, borderLeftWidth: 0, paddingHorizontal: 6, height: '100%', justifyContent: 'center', borderTopRightRadius: 12, borderBottomRightRadius: 12 }}>
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: Colors.primary }} numberOfLines={1} adjustsFontSizeToFit>
                        {contrib.amount} <Text style={{ fontSize: 8 }}>{activeResidence?.currency || 'DH'}</Text>
                      </Text>
                    </View>
                  </View>
                ) : isPartial ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', height: 24, maxWidth: 84 }}>
                    <View style={{ backgroundColor: Colors.warning, paddingHorizontal: 6, height: '100%', justifyContent: 'center', borderTopLeftRadius: 12, borderBottomLeftRadius: 12 }}>
                      <Ionicons name="pie-chart" size={12} color={Colors.white} />
                    </View>
                    <View style={{ borderWidth: 1, borderColor: Colors.warning, borderLeftWidth: 0, paddingHorizontal: 6, height: '100%', justifyContent: 'center', borderTopRightRadius: 12, borderBottomRightRadius: 12 }}>
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: Colors.warning }} numberOfLines={1} adjustsFontSizeToFit>
                        {contrib.amount} <Text style={{ fontSize: 8 }}>{activeResidence?.currency || 'DH'}</Text>
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.emptyCellText}>-</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Total Row (Apartments) */}
      <View style={styles.row}>
        {apartments.map(apt => {
          const aptTotal = contributions
            .filter(c => c.apartment_id === apt.id)
            .reduce((sum, c) => sum + c.amount, 0);
          
          return (
            <View key={`total_${apt.id}`} style={[styles.cell, styles.totalDataCell]}>
              <Text style={styles.totalDataText} numberOfLines={1} adjustsFontSizeToFit>
                {aptTotal} <Text style={{ fontSize: 9 }}>{activeResidence?.currency || 'DH'}</Text>
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, isCapturing && { flex: undefined, height: 'auto' }]}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Logo width={110} height={31} />
          <Text style={styles.headerTitle}>Contributions</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <TouchableOpacity style={styles.yearBtn} onPress={() => setCurrentYear(y => y - 1)}>
            <Ionicons name="chevron-back" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.yearText}>{currentYear}</Text>
          <TouchableOpacity style={styles.yearBtn} onPress={() => setCurrentYear(y => y + 1)}>
            <Ionicons name="chevron-forward" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Balance Card */}
      {balance !== null && totalExpenses !== null && (
        <View style={{ flexDirection: 'row', marginHorizontal: Spacing.xl, marginBottom: Spacing.md, padding: Spacing.md, backgroundColor: Colors.navyCard, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, borderRightWidth: 1, borderColor: Colors.navyBorder, paddingRight: Spacing.md }}>
            <Text style={{ color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>Total Dépenses</Text>
            <Text style={{ color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold }}>
              {totalExpenses.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} {activeResidence?.currency ?? 'DH'}
            </Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={{ color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>Solde en caisse</Text>
            <Text style={{ color: balance >= 0 ? Colors.primary : Colors.danger, fontSize: FontSize.md, fontWeight: FontWeight.bold }}>
              {balance.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} {activeResidence?.currency ?? 'DH'}
            </Text>
          </View>
        </View>
      )}

      <View style={{ flex: 1, paddingBottom: 120 }}>
        <View style={[styles.tableContainer, { flexDirection: 'row', borderLeftWidth: 0, marginLeft: Spacing.md }]}>
          
          {/* STICKY COLUMN (LEFT) */}
          <View style={{ borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.navyBorder, zIndex: 10, backgroundColor: Colors.navy }}>
            {/* Corner Cell */}
            <View style={[styles.cell, styles.cornerCell, { borderLeftWidth: 0 }]}>
              <Svg height="100%" width="100%" style={{ position: 'absolute' }}>
                <Line x1="0" y1="0" x2="100%" y2="100%" stroke={Colors.navyBorder} strokeWidth="1" />
              </Svg>
              <Text style={{ position: 'absolute', top: 4, right: 6, fontSize: 10, color: Colors.textSecondary, fontWeight: 'bold' }}>Appart.</Text>
              <Text style={{ position: 'absolute', bottom: 4, left: 6, fontSize: 10, color: Colors.textSecondary, fontWeight: 'bold' }}>Mois</Text>
            </View>
            
            {/* Month Cells */}
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month, index) => (
              <View key={`sticky_month_${month}`} style={[styles.cell, styles.monthCell, { borderLeftWidth: 0 }, index % 2 === 0 && { backgroundColor: Colors.navy }]}>
                <Text style={styles.monthCellText}>{MONTHS_SHORT_FR[month-1]}</Text>
              </View>
            ))}
            
            {/* Total Label */}
            <View style={[styles.cell, styles.totalCell, { borderLeftWidth: 0 }]}>
              <Text style={styles.totalCellText}>Total</Text>
            </View>
          </View>

          {/* SCROLLABLE APARTMENTS (RIGHT) */}
          <ScrollView 
            horizontal 
            bounces={false} 
            style={styles.tableScrollX} 
            contentContainerStyle={[styles.tableContentX, { paddingLeft: 0 }]}
            showsHorizontalScrollIndicator={false}
          >
            {renderMatrixData()}
          </ScrollView>
        </View>
      </View>

      {/* OFF-SCREEN CAPTURE VIEW FOR FULL MATRIX GENERATION */}
      {isCapturing && (
        <View style={{ position: 'absolute', top: -10000, left: 10000 }}>
          <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
            <View style={{ backgroundColor: Colors.navy, padding: Spacing.xl }}>
              <View style={{ alignItems: 'center', marginBottom: Spacing.xl }}>
                <Text style={{ fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.textPrimary }}>
                  {activeResidence?.name}
                </Text>
                <Text style={{ fontSize: FontSize.md, color: Colors.textSecondary, marginTop: 4 }}>
                  Situation des cotisations - {new Date().toLocaleDateString('fr-FR')}
                </Text>
              </View>

              {balance !== null && totalExpenses !== null && (
                <View style={{ flexDirection: 'row', marginBottom: Spacing.xl, padding: Spacing.md, backgroundColor: Colors.navyCard, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, borderRightWidth: 1, borderColor: Colors.navyBorder, paddingRight: Spacing.md }}>
                    <Text style={{ color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>Total Dépenses</Text>
                    <Text style={{ color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold }}>
                      {totalExpenses.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} {activeResidence?.currency ?? 'DH'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={{ color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>Solde en caisse</Text>
                    <Text style={{ color: balance >= 0 ? Colors.primary : Colors.danger, fontSize: FontSize.md, fontWeight: FontWeight.bold }}>
                      {balance.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} {activeResidence?.currency ?? 'DH'}
                    </Text>
                  </View>
                </View>
              )}

              <View style={[styles.tableContainer, { flexDirection: 'row', borderLeftWidth: 0 }]}>
                {/* STICKY COLUMN */}
                <View style={{ borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.navyBorder, backgroundColor: Colors.navy }}>
                  <View style={[styles.cell, styles.cornerCell, { borderLeftWidth: 0 }]}>
                    <Svg height="100%" width="100%" style={{ position: 'absolute' }}>
                      <Line x1="0" y1="0" x2="100%" y2="100%" stroke={Colors.navyBorder} strokeWidth="1" />
                    </Svg>
                    <Text style={{ position: 'absolute', top: 4, right: 6, fontSize: 10, color: Colors.textSecondary, fontWeight: 'bold' }}>Appart.</Text>
                    <Text style={{ position: 'absolute', bottom: 4, left: 6, fontSize: 10, color: Colors.textSecondary, fontWeight: 'bold' }}>Mois</Text>
                  </View>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month, index) => (
                    <View key={`capture_month_${month}`} style={[styles.cell, styles.monthCell, { borderLeftWidth: 0 }, index % 2 === 0 && { backgroundColor: Colors.navy }]}>
                      <Text style={styles.monthCellText}>{MONTHS_SHORT_FR[month-1]}</Text>
                    </View>
                  ))}
                  <View style={[styles.cell, styles.totalCell, { borderLeftWidth: 0 }]}>
                    <Text style={styles.totalCellText}>Total</Text>
                  </View>
                </View>

                {/* FULL UNWRAPPED DATA */}
                <View style={[styles.tableContentX, { paddingLeft: 0 }]}>
                  {renderMatrixData()}
                </View>
              </View>
            </View>
          </ViewShot>
        </View>
      )}

      {/* FAB */}
      {canManage && (
        <>
          {isMenuOpen && (
            <TouchableOpacity 
              style={[StyleSheet.absoluteFill, { zIndex: 90, elevation: 5 }]} 
              activeOpacity={1}
              onPress={closeMenu} 
            />
          )}

          <Animated.View style={[styles.fabAction, action3Style, { bottom: Spacing.md }]} pointerEvents={isMenuOpen ? "auto" : "none"}>
            <TouchableOpacity style={[styles.fabSubButton, { elevation: 8 }]} onPress={() => { closeMenu(); exportPDF(); }}>
              <Ionicons name="document-text-outline" size={24} color={Colors.white} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={[styles.fabAction, action2Style, { bottom: Spacing.md }]} pointerEvents={isMenuOpen ? "auto" : "none"}>
            <TouchableOpacity style={[styles.fabSubButton, { elevation: 8 }]} onPress={() => { closeMenu(); shareMatrix(); }}>
              <Ionicons name="logo-whatsapp" size={24} color={Colors.white} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={[styles.fabAction, action1Style, { bottom: Spacing.md }]} pointerEvents={isMenuOpen ? "auto" : "none"}>
            <TouchableOpacity style={[styles.fabSubButton, { elevation: 8 }]} onPress={() => { closeMenu(); openPaymentDialog(); }}>
              <Ionicons name="wallet-outline" size={24} color={Colors.white} />
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity style={[styles.fab, { zIndex: 100, elevation: 12 }]} onPress={toggleMenu} activeOpacity={0.8}>
            <Animated.View style={fabStyle}>
              <Ionicons name="add" size={28} color={Colors.white} />
            </Animated.View>
          </TouchableOpacity>
        </>
      )}

      {/* Payment Dialog */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
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
              <Text style={styles.inputLabel}>Date du paiement</Text>
              <TouchableOpacity
                style={[styles.textInput, { justifyContent: 'center' }]}
                onPress={() => setDatePickerVisible(true)}
              >
                <Text style={{ color: Colors.textPrimary, fontSize: FontSize.md }}>
                  {payDate}
                </Text>
              </TouchableOpacity>
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
                
                <TouchableOpacity 
                  style={styles.amountBtn}
                  onPress={() => setAmount(amount + monthlyFee)}
                >
                  <Ionicons name="add" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalActions}>
              <Button label="Annuler" variant="outline" onPress={() => setModalVisible(false)} style={{ flex: 1 }} />
              <Button label="Valider" onPress={allocatePayment} isLoading={isSubmitting} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Date Picker */}
      <DatePickerModal
        visible={datePickerVisible}
        date={payDate}
        onConfirm={(date) => {
          setPayDate(date);
          setDatePickerVisible(false);
        }}
        onCancel={() => setDatePickerVisible(false)}
      />
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navy },
  loadingContainer: { flex: 1, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center' },
  
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingTop: 56, paddingBottom: Spacing.lg,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  
  yearBtn: { padding: Spacing.xs },
  yearText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  tableScrollX: { flex: 1 },
  tableContentX: { paddingHorizontal: Spacing.md },
  tableContainer: {
    borderTopWidth: 1, borderLeftWidth: 1, borderColor: Colors.navyBorder,
    backgroundColor: Colors.navy,
  },

  row: { flexDirection: 'row' },
  cell: {
    width: 90, height: 45,
    borderBottomWidth: 1, borderRightWidth: 1, borderColor: Colors.navyBorder,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.navy,
  },
  cornerCell: { backgroundColor: Colors.navy },
  headerCell: { backgroundColor: Colors.navyCard, padding: 4 },
  headerCellApt: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  headerCellName: { fontSize: 10, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
  
  monthCell: { backgroundColor: Colors.navyCard },
  monthCellText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  
  dataCell: { backgroundColor: Colors.navy },
  cellPaid: { backgroundColor: Colors.primary },
  cellPartial: { backgroundColor: Colors.warningLight },
  partialText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.warning },
  emptyCellText: { color: Colors.textMuted },

  totalCell: { backgroundColor: Colors.navyBorder },
  totalCellText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  totalDataCell: { backgroundColor: Colors.navyCard },
  totalDataText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },

  fabAction: {
    position: 'absolute', right: Spacing.xl + 4,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 95,
  },
  fabSubButton: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.green,
  },
  fab: {
    position: 'absolute', bottom: Spacing.md, right: Spacing.xl,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 100,
    ...Shadow.green,
  },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', padding: Spacing.xl,
  },
  modalContent: {
    backgroundColor: Colors.navyCard, borderRadius: Radius.xl,
    padding: Spacing.xl, borderWidth: 1, borderColor: Colors.navyBorder,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.lg },
  
  inputLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary, marginBottom: 8 },
  textInput: {
    backgroundColor: Colors.navy, borderWidth: 1, borderColor: Colors.navyBorder,
    borderRadius: Radius.md, padding: Spacing.md, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  
  amountControl: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  amountBtn: {
    width: 48, height: 48, borderRadius: Radius.md,
    backgroundColor: Colors.navy, borderWidth: 1, borderColor: Colors.navyBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  amountInput: {
    flex: 1, height: 48, backgroundColor: Colors.navy,
    borderWidth: 1, borderColor: Colors.navyBorder, borderRadius: Radius.md,
    color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
});
