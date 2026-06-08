import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, FlatList
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Svg, Line } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useAuthStore } from '../../../src/store/auth.store';
import { supabase } from '../../../src/supabase/client';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../../src/constants/theme';
import { MONTHS_FR, MONTHS_SHORT_FR } from '../../../src/constants/app';
import { getApartmentsByResidence } from '../../../src/db/repositories/apartments';
import { getContributionsByResidence, createContribution, updateContribution } from '../../../src/db/repositories/contributions';
import { useContributionsData } from '../../../src/hooks/useContributionsData';
import { BalanceCard } from '../../../src/components/ui/BalanceCard';
import { AddContributionModal } from '../../../src/components/ui/AddContributionModal';
import { generateDashboardPDF } from '../../../src/services/pdf.service';
import type { Apartment, Contribution, Expense } from '../../../src/types';

export default function ContributionsScreen() {
  const { profile, activeResidence, hasPermission } = useAuthStore();
  const queryClient = useQueryClient();
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const {
    apartments, contributions, expenses, balance, totalExpenses,
    isLoading, refetch
  } = useContributionsData(activeResidence?.id, currentYear);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAptId, setSelectedAptId] = useState<string>('');
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

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
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
    if (balance !== null && totalExpenses !== null && apartments && contributions && expenses) {
      try {
        const stats = {
          totalContributions: (balance ?? 0) + (totalExpenses ?? 0),
          totalExpenses: totalExpenses ?? 0,
          balance: balance ?? 0,
          monthlyContributions: 0,
          monthlyExpenses: 0,
          paidApartments: 0,
          totalApartments: apartments.length,
          paidPercent: 0,
        };
        await generateDashboardPDF(contributions, apartments, expenses, stats as any, activeResidence);
      } catch (error: any) {
        Alert.alert('Erreur', 'Impossible de générer le PDF');
      }
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
      queryClient.setQueryData(['contributions_page', activeResidence.id, currentYear], (old: any) => {
        if (!old) return old;
        return { ...old, contributions: old.contributions.filter((c: any) => c.id !== contrib.id) };
      });
      
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
        refetch().finally(() => processingCellsRef.current.delete(cellKey));
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
      
      queryClient.setQueryData(['contributions_page', activeResidence.id, currentYear], (old: any) => {
        if (!old) return old;
        return { ...old, contributions: [...old.contributions, newContrib] };
      });

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
        
        queryClient.setQueryData(['contributions_page', activeResidence.id, currentYear], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            contributions: old.contributions.map((c: any) => c.id === tempId ? newRecord : c)
          };
        });
        processingCellsRef.current.delete(cellKey);
      } catch (e: any) {
        Alert.alert('Erreur', 'Impossible de créer la contribution: ' + e.message);
        refetch().finally(() => processingCellsRef.current.delete(cellKey));
      }
    }
  };

  const openPaymentDialog = (aptId?: string) => {
    if (!canManage) return;
    setSelectedAptId(aptId || (apartments.length > 0 ? apartments[0].id : ''));
    setModalVisible(true);
  };

  if (isLoading) {
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', height: 24, maxWidth: 84, borderRadius: 12, borderWidth: 1, borderColor: Colors.primary, overflow: 'hidden' }}>
                    <View style={{ backgroundColor: Colors.primary, paddingHorizontal: 6, height: '100%', justifyContent: 'center' }}>
                      <Ionicons name="checkmark" size={12} color={Colors.white} />
                    </View>
                    <View style={{ paddingHorizontal: 6, height: '100%', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: Colors.primary }} numberOfLines={1} adjustsFontSizeToFit>
                        {contrib.amount} <Text style={{ fontSize: 8 }}>{activeResidence?.currency || 'DH'}</Text>
                      </Text>
                    </View>
                  </View>
                ) : isPartial ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', height: 24, maxWidth: 84, borderRadius: 12, borderWidth: 1, borderColor: Colors.warning, overflow: 'hidden' }}>
                    <View style={{ backgroundColor: Colors.warning, paddingHorizontal: 6, height: '100%', justifyContent: 'center' }}>
                      <Ionicons name="pie-chart" size={12} color={Colors.white} />
                    </View>
                    <View style={{ paddingHorizontal: 6, height: '100%', justifyContent: 'center' }}>
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

  const renderAptColumn = ({ item: apt }: { item: Apartment }) => {
    const aptTotal = contributions
      .filter(c => c.apartment_id === apt.id)
      .reduce((sum, c) => sum + c.amount, 0);

    return (
      <View style={{ flexDirection: 'column' }}>
        {/* Header Cell */}
        <TouchableOpacity 
          style={[styles.cell, styles.headerCell]}
          activeOpacity={0.7}
          onPress={() => handleDoubleTap(`apt_${apt.id}`, () => openPaymentDialog(apt.id))}
        >
          <Text style={styles.headerCellApt}>App. {apt.number}</Text>
          <Text style={styles.headerCellName} numberOfLines={1}>{apt.owner_name || 'N/A'}</Text>
        </TouchableOpacity>

        {/* 12 Months Cells */}
        {Array.from({ length: 12 }, (_, i) => i + 1).map((month, index) => {
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
                <View style={{ flexDirection: 'row', alignItems: 'center', height: 24, maxWidth: 84, borderRadius: 12, borderWidth: 1, borderColor: Colors.primary, overflow: 'hidden' }}>
                  <View style={{ backgroundColor: Colors.primary, paddingHorizontal: 6, height: '100%', justifyContent: 'center' }}>
                    <Ionicons name="checkmark" size={12} color={Colors.white} />
                  </View>
                  <View style={{ paddingHorizontal: 6, height: '100%', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: Colors.primary }} numberOfLines={1} adjustsFontSizeToFit>
                      {contrib.amount} <Text style={{ fontSize: 8 }}>{activeResidence?.currency || 'DH'}</Text>
                    </Text>
                  </View>
                </View>
              ) : isPartial ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', height: 24, maxWidth: 84, borderRadius: 12, borderWidth: 1, borderColor: Colors.warning, overflow: 'hidden' }}>
                  <View style={{ backgroundColor: Colors.warning, paddingHorizontal: 6, height: '100%', justifyContent: 'center' }}>
                    <Ionicons name="pie-chart" size={12} color={Colors.white} />
                  </View>
                  <View style={{ paddingHorizontal: 6, height: '100%', justifyContent: 'center' }}>
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

        {/* Total Cell */}
        <View style={[styles.cell, styles.totalDataCell]}>
          <Text style={styles.totalDataText} numberOfLines={1} adjustsFontSizeToFit>
            {aptTotal} <Text style={{ fontSize: 9 }}>{activeResidence?.currency || 'DH'}</Text>
          </Text>
        </View>
      </View>
    );
  };

  const totalContribs = (balance ?? 0) + (totalExpenses ?? 0);

  return (
    <View style={styles.container}>
      <ScrollView 
        style={[styles.container, isCapturing && { flex: undefined, height: 'auto' }]}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
      >
        <ScreenHeader title="Contributions" />

      {/* Balance Card */}
      {balance !== null && totalExpenses !== null && (
        <BalanceCard
          currentYear={currentYear}
          setCurrentYear={setCurrentYear}
          totalContributions={balance + totalExpenses}
          totalExpenses={totalExpenses}
          balance={balance}
          currency={activeResidence?.currency ?? 'DH'}
        />
      )}

      <View style={{ flex: 1 }}>
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
          <FlatList 
            horizontal 
            data={apartments}
            keyExtractor={apt => apt.id}
            showsHorizontalScrollIndicator={false}
            bounces={false}
            style={styles.tableScrollX} 
            contentContainerStyle={[styles.tableContentX, { paddingLeft: 0 }]}
            renderItem={renderAptColumn}
            initialNumToRender={4}
            maxToRenderPerBatch={4}
            windowSize={5}
          />
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
                <View style={{ marginBottom: Spacing.xl }}>
                  <BalanceCard
                    currentYear={currentYear}
                    setCurrentYear={setCurrentYear}
                    totalContributions={balance + totalExpenses}
                    totalExpenses={totalExpenses}
                    balance={balance}
                    currency={activeResidence?.currency ?? 'DH'}
                  />
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

      </ScrollView>

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
              <Ionicons name="document-text-outline" size={20} color={Colors.white} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={[styles.fabAction, action2Style, { bottom: Spacing.md }]} pointerEvents={isMenuOpen ? "auto" : "none"}>
            <TouchableOpacity style={[styles.fabSubButton, { elevation: 8 }]} onPress={() => { closeMenu(); shareMatrix(); }}>
              <Ionicons name="logo-whatsapp" size={20} color={Colors.white} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={[styles.fabAction, action1Style, { bottom: Spacing.md }]} pointerEvents={isMenuOpen ? "auto" : "none"}>
            <TouchableOpacity style={[styles.fabSubButton, { elevation: 8 }]} onPress={() => { closeMenu(); openPaymentDialog(); }}>
              <Ionicons name="wallet-outline" size={20} color={Colors.white} />
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity style={[styles.fab, { zIndex: 100, elevation: 12 }]} onPress={toggleMenu} activeOpacity={0.8}>
            <Animated.View style={fabStyle}>
              <Ionicons name="add" size={24} color={Colors.white} />
            </Animated.View>
          </TouchableOpacity>
        </>
      )}

      {/* Payment Dialog */}
      <AddContributionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={() => {
          setTimeout(() => refetch(), 100);
        }}
        apartments={apartments}
        contributions={contributions}
        currentYear={currentYear}
        monthlyFee={monthlyFee}
        preselectedAptId={selectedAptId}
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
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.green,
  },
  fab: {
    position: 'absolute', bottom: Spacing.md, right: Spacing.xl,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 100,
    ...Shadow.green,
  },
});
}
