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
import * as FileSystem from 'expo-file-system/legacy';
import { useAuthStore } from '../../../src/store/auth.store';
import { supabase } from '../../../src/supabase/client';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../../src/constants/theme';
import { MONTHS_FR, MONTHS_SHORT_FR } from '../../../src/constants/app';
import { getApartmentsByResidence } from '../../../src/db/repositories/apartments';
import { getContributionsByResidence, createContribution, updateContribution, getTotalContributions } from '../../../src/db/repositories/contributions';
import { getTotalExpenses, getExpensesByResidence } from '../../../src/db/repositories/expenses';
import { Button } from '../../../src/components/ui/Button';
import { SelectInput } from '../../../src/components/ui/SelectInput';
import { DatePickerModal } from '../../../src/components/ui/DatePickerModal';
import type { Apartment, Contribution, Expense } from '../../../src/types';

export default function ContributionsScreen() {
  const { profile, activeResidence, hasPermission } = useAuthStore();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
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
  const processingCellsRef = useRef<Set<string>>(new Set());

  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const canManage = hasPermission('write');
  const monthlyFee = activeResidence?.monthly_fee || 0;

  const loadData = useCallback(async () => {
    if (!activeResidence) {
      setLoading(false);
      return;
    }
    try {
      const [apts, contribs, totalContribs, totalExp, expList] = await Promise.all([
        getApartmentsByResidence(activeResidence.id),
        getContributionsByResidence(activeResidence.id, currentYear),
        getTotalContributions(activeResidence.id),
        getTotalExpenses(activeResidence.id),
        getExpensesByResidence(activeResidence.id, currentYear)
      ]);
      setApartments(apts.filter(a => a.active));
      setContributions(contribs);
      setExpenses(expList);
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
      
      // Construire le ledger (journal des opérations)
      const ops: any[] = [];
      contributions.filter(c => c.paid).forEach(c => {
        ops.push({
          date: c.paid_at || c.created_at,
          created_at: c.created_at,
          desc: `Cotisation App. ${apartments.find(a => a.id === c.apartment_id)?.number || ''} (${MONTHS_SHORT_FR[c.month-1]} ${c.year})`,
          sign: '+',
          amount: c.amount
        });
      });
      expenses.forEach(e => {
        ops.push({
          date: e.date,
          created_at: e.created_at,
          desc: e.description || e.type,
          sign: '-',
          amount: e.amount
        });
      });
      
      // Trier par ordre d'ajout dans la base de données
      ops.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      // Calculer le solde courant
      let currentBalance = 0;
      ops.forEach(op => {
        currentBalance += op.sign === '+' ? op.amount : -op.amount;
        op.balance = currentBalance;
      });

      const renderLedgerRows = (list: any[]) => {
        if (list.length === 0) return '<tr><td colspan="5">-</td></tr>';
        return list.map(op => {
          const color = op.sign === '+' ? '#388E3C' : '#D32F2F'; // Darker shades for text readability
          return `
          <tr style="color: ${color};">
            <td style="border-color: #E2E8F0;">${new Date(op.date).toLocaleDateString('fr-FR')}</td>
            <td style="text-align: left; border-color: #E2E8F0; font-weight: 500;">${op.desc}</td>
            <td style="font-weight: bold; border-color: #E2E8F0;">${op.sign}</td>
            <td style="font-weight: bold; border-color: #E2E8F0;">${op.amount}</td>
            <td style="border-color: #E2E8F0;">${op.balance}</td>
          </tr>
          `;
        }).join('');
      };

      const totalExp = totalExpenses ?? 0;
      const currentBal = balance ?? 0;
      const totalContribs = currentBal + totalExp;

      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
              h1 { text-align: center; color: #0D1B2A; font-size: 18px; text-transform: uppercase; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; margin-bottom: 20px; }
              
              .summary-cards { display: flex; gap: 15px; margin-bottom: 25px; }
              .card { flex: 1; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #E2E8F0; }
              .card-green { background-color: rgba(76, 175, 80, 0.1); border-color: #4CAF50; color: #388E3C; }
              .card-danger { background-color: rgba(239, 68, 68, 0.1); border-color: #EF4444; color: #B91C1C; }
              .card-navy { background-color: rgba(13, 27, 42, 0.1); border-color: #0D1B2A; color: #0D1B2A; }
              .card-title { font-size: 10px; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; }
              .card-value { font-size: 16px; font-weight: bold; }

              table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
              thead { display: table-header-group; }
              tfoot { display: table-footer-group; }
              th, td { border: 1px solid #E2E8F0; padding: 6px; text-align: center; }
              thead th { background-color: #1B263B; color: #FFF; border-color: #1B263B; }
              
              /* Zebra lines for all tables */
              tbody tr:nth-child(even) { background-color: #F8FAFC; }
              tbody tr:nth-child(even) th { background-color: #F8FAFC; }
              
              tfoot th { background-color: #F1F5F9; color: #0D1B2A; font-weight: bold; }
              
              .ledger-container { margin-top: 30px; }
              .ledger-title { text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 15px; color: #0D1B2A; text-transform: uppercase; border-bottom: 1px solid #E2E8F0; padding-bottom: 5px; }
              .legend { font-size: 10px; margin-top: 15px; color: #64748B; font-style: italic; text-align: center; }
            </style>
          </head>
          <body>
            <h1>SUIVI DES CONTRIBUTIONS ET DÉPENSES - ${(activeResidence?.name || "SYNDIC DE L'IMMEUBLE").toUpperCase()}</h1>
            
            <div class="summary-cards">
              <div class="card card-green">
                <div class="card-title">Total Contributions</div>
                <div class="card-value">${totalContribs.toLocaleString('fr-MA')} DH</div>
              </div>
              <div class="card card-danger">
                <div class="card-title">Total Dépenses</div>
                <div class="card-value">${totalExp.toLocaleString('fr-MA')} DH</div>
              </div>
              <div class="card card-navy">
                <div class="card-title">Reste à la Caisse</div>
                <div class="card-value">${currentBal.toLocaleString('fr-MA')} DH</div>
              </div>
            </div>

            <table class="grid-table">
              <thead>
                <tr>
                  <th>APPARTEMENT</th>
                  ${Array.from({ length: 12 }, (_, i) => `<th>${MONTHS_SHORT_FR[i].toUpperCase()}</th>`).join('')}
                  <th>TOTAL ANNUEL</th>
                </tr>
              </thead>
              <tbody>
                ${apartments.map(apt => {
                  const aptTotal = contributions.filter(c => c.apartment_id === apt.id).reduce((sum, c) => sum + c.amount, 0);
                  const residentName = apt.owner_name ? ` (${apt.owner_name})` : '';
                  return `
                  <tr>
                    <th>${apt.number}${residentName}</th>
                    ${Array.from({ length: 12 }, (_, i) => {
                      const contrib = contributions.find(c => c.apartment_id === apt.id && c.month === i + 1);
                      if (contrib && contrib.amount > 0) return `<td style="padding: 2px;"><span style="background-color: #E8F5E9; color: #2E7D32; border-radius: 4px; padding: 3px 5px; font-weight: bold; display: inline-block;">${contrib.amount}</span></td>`;
                      return `<td></td>`;
                    }).join('')}
                    <th style="background-color: transparent;">${aptTotal > 0 ? aptTotal : ''}</th>
                  </tr>
                  `;
                }).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <th style="text-align: left;">TOTAL PAR MOIS</th>
                  ${Array.from({ length: 12 }, (_, i) => {
                    const monthTotal = contributions.filter(c => c.month === i + 1).reduce((sum, c) => sum + c.amount, 0);
                    return `<th>${monthTotal > 0 ? monthTotal : ''}</th>`;
                  }).join('')}
                  <th>${contributions.reduce((sum, c) => sum + c.amount, 0)}</th>
                </tr>
              </tfoot>
            </table>

            <div class="ledger-container">
              <div class="ledger-title">Journal Chronologique des Opérations</div>
              <table>
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>DESCRIPTION</th>
                    <th>MOUVEMENT</th>
                    <th>MONTANT</th>
                    <th>SOLDE</th>
                  </tr>
                </thead>
                <tbody>${renderLedgerRows(ops)}</tbody>
              </table>
            </div>

            <div class="legend">
              + = CRÉDIT (AUGMENTE LE SOLDE) | - = DÉBIT (DIMINUE LE SOLDE)
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      
      const dateStr = new Date().toISOString().split('T')[0];
      const safeResidenceName = (activeResidence?.name || 'SYNDICOM').replace(/[^a-z0-9]/gi, '_').toUpperCase();
      const newUri = `${FileSystem.cacheDirectory}${safeResidenceName}_${dateStr}.pdf`;
      await FileSystem.moveAsync({ from: uri, to: newUri });
      
      await Sharing.shareAsync(newUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Partager le rapport complet',
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
    
    const cellKey = `${apt.id}_${month}`;
    if (processingCellsRef.current.has(cellKey)) return;
    processingCellsRef.current.add(cellKey);

    if (contrib) {
      // Optimistic delete
      setContributions(prev => prev.filter(c => c.id !== contrib.id));
      setBalance(prev => (prev ?? 0) - monthlyFee);
      
      // Background delete
      try {
        const { data, error } = await supabase.from('contributions').delete().eq('id', contrib.id).select();
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error("Impossible de supprimer. Vérifiez vos permissions (Policy RLS).");
        }
        processingCellsRef.current.delete(cellKey);
      } catch (e: any) { 
        Alert.alert('Erreur', e.message); 
        loadData().finally(() => processingCellsRef.current.delete(cellKey));
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
      setBalance(prev => (prev ?? 0) + monthlyFee);

      // Background create
      try {
        const newRecord = await createContribution({
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
        setContributions(prev => prev.map(c => c.id === tempId ? newRecord : c));
        processingCellsRef.current.delete(cellKey);
      } catch (e: any) {
        Alert.alert('Erreur', 'Impossible de créer la contribution: ' + e.message);
        loadData().finally(() => processingCellsRef.current.delete(cellKey));
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
        
        // Si le mois est déjà marqué comme "payé" (même à un ancien tarif), on ne réclame pas la différence
        let needed = (contrib && contrib.paid) ? 0 : (monthlyFee - currentPaid);
        
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
      
      // Optimistic update for the card
      setBalance(prev => (prev ?? 0) + Number(amount));
      setModalVisible(false);
      setTimeout(() => loadData(), 500);
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
      <ScreenHeader title="Contributions" />

      {/* Balance Card */}
      {balance !== null && totalExpenses !== null && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.xl, marginBottom: Spacing.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.navyCard, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary }}>
          {/* Year Selector */}
          <View style={{ flexDirection: 'row', alignItems: 'center', borderRightWidth: 1, borderColor: Colors.navyBorder, paddingRight: Spacing.sm, marginRight: Spacing.sm }}>
            <TouchableOpacity style={{ padding: 4 }} onPress={() => setCurrentYear(y => y - 1)}>
              <Ionicons name="chevron-back" size={16} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginHorizontal: 2 }}>{currentYear}</Text>
            <TouchableOpacity style={{ padding: 4 }} onPress={() => setCurrentYear(y => y + 1)}>
              <Ionicons name="chevron-forward" size={16} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          
          {/* Balances */}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, borderRightWidth: 1, borderColor: Colors.navyBorder, paddingRight: Spacing.sm }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 10, fontWeight: FontWeight.semibold }}>Total Dépenses</Text>
              <Text style={{ color: Colors.textPrimary, fontSize: FontSize.xs, fontWeight: FontWeight.bold }} numberOfLines={1}>
                {totalExpenses.toLocaleString('fr-MA', { minimumFractionDigits: 0 })} {activeResidence?.currency ?? 'DH'}
              </Text>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end', paddingLeft: Spacing.sm }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 10, fontWeight: FontWeight.semibold }}>Solde</Text>
              <Text style={{ color: balance >= 0 ? Colors.primary : Colors.danger, fontSize: FontSize.sm, fontWeight: FontWeight.bold }} numberOfLines={1}>
                {balance.toLocaleString('fr-MA', { minimumFractionDigits: 0 })} {activeResidence?.currency ?? 'DH'}
              </Text>
            </View>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xl, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.navyCard, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderRightWidth: 1, borderColor: Colors.navyBorder, paddingRight: Spacing.sm, marginRight: Spacing.sm }}>
            <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary }}>Année {currentYear}</Text>
          </View>
          
          {/* Balances */}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, borderRightWidth: 1, borderColor: Colors.navyBorder, paddingRight: Spacing.sm }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 10, fontWeight: FontWeight.semibold }}>Total Dépenses</Text>
              <Text style={{ color: Colors.textPrimary, fontSize: FontSize.xs, fontWeight: FontWeight.bold }} numberOfLines={1}>
                {totalExpenses.toLocaleString('fr-MA', { minimumFractionDigits: 0 })} {activeResidence?.currency ?? 'DH'}
              </Text>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end', paddingLeft: Spacing.sm }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 10, fontWeight: FontWeight.semibold }}>Solde</Text>
              <Text style={{ color: balance >= 0 ? Colors.primary : Colors.danger, fontSize: FontSize.sm, fontWeight: FontWeight.bold }} numberOfLines={1}>
                {balance.toLocaleString('fr-MA', { minimumFractionDigits: 0 })} {activeResidence?.currency ?? 'DH'}
              </Text>
            </View>
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

function createStyles(Colors: any) {
  return StyleSheet.create({
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
    width: 90, height: 38,
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
}
