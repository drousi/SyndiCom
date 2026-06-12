import React, { useState, useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, Radius, Spacing, FontSize, FontWeight, ThemeColors } from '../../constants/theme';
import { Button } from './Button';
import { MONTHS_FR } from '../../constants/app';
import { useLanguageStore } from '../../store/language.store';

interface DatePickerModalProps {
  visible: boolean;
  date: string; // YYYY-MM-DD
  onConfirm: (date: string) => void;
  onCancel: () => void;
}

export function DatePickerModal({ visible, date, onConfirm, onCancel }: DatePickerModalProps) {
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { isRTL, t } = useLanguageStore();

  const initialDate = date ? new Date(date) : new Date();
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth());
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
  const [selectedDate, setSelectedDate] = useState(date);

  // Generate days for the grid
  const days = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // JS getDay() is 0 for Sunday. Convert to 1 for Monday, 7 for Sunday
    const startDay = firstDay === 0 ? 6 : firstDay - 1;
    
    const cells = [];
    // Empty cells before start
    for (let i = 0; i < startDay; i++) {
      cells.push(null);
    }
    // Days
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push(i);
    }
    return cells;
  }, [currentMonth, currentYear]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const mm = String(currentMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    setSelectedDate(`${currentYear}-${mm}-${dd}`);
  };

  const DAYS_WEEK = [
    t('days_min.lun'), t('days_min.mar'), t('days_min.mer'),
    t('days_min.jeu'), t('days_min.ven'), t('days_min.sam'), t('days_min.dim')
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.container}>
              
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity onPress={handlePrevMonth} style={styles.navBtn}>
                  <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                  {t(`periods.m${currentMonth + 1}` as any)} {currentYear}
                </Text>
                <TouchableOpacity onPress={handleNextMonth} style={styles.navBtn}>
                  <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Weekdays */}
              <View style={styles.weekRow}>
                {DAYS_WEEK.map((d, i) => (
                  <Text key={i} style={styles.weekText}>{d}</Text>
                ))}
              </View>

              {/* Days Grid */}
              <View style={styles.daysGrid}>
                {days.map((day, index) => {
                  if (day === null) {
                    return <View key={`empty_${index}`} style={styles.dayCell} />;
                  }
                  const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isSelected = dateStr === selectedDate;
                  const isToday = dateStr === new Date().toISOString().split('T')[0];

                  return (
                    <TouchableOpacity 
                      key={day} 
                      style={styles.dayCell}
                      onPress={() => handleSelectDay(day)}
                    >
                      <View style={[
                        styles.dayCircle,
                        isSelected && styles.dayCircleSelected,
                        !isSelected && isToday && styles.dayCircleToday
                      ]}>
                        <Text style={[
                          styles.dayText,
                          isSelected && styles.dayTextSelected,
                          !isSelected && isToday && styles.dayTextToday
                        ]}>
                          {day}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <Button label={t('common.cancel')} variant="outline" onPress={onCancel} style={{ flex: 1 }} />
                <Button label={t('common.confirm')} onPress={() => onConfirm(selectedDate)} style={{ flex: 1 }} />
              </View>

            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: Spacing.xl,
  },
  container: {
    width: '100%', maxWidth: 350, backgroundColor: Colors.navyCard,
    borderRadius: Radius.xl, padding: Spacing.xl,
    borderWidth: 1, borderColor: Colors.navyBorder,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  navBtn: { padding: Spacing.sm },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  
  weekRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  weekText: { flex: 1, textAlign: 'center', fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: 'bold' },
  
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: '14.28%', aspectRatio: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  dayCircle: {
    width: 36, height: 36,
    borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  dayCircleSelected: { backgroundColor: Colors.primary },
  dayCircleToday: { backgroundColor: Colors.navyBorder },
  
  dayText: { 
    fontSize: FontSize.md, 
    color: Colors.textPrimary,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  dayTextSelected: { color: Colors.white, fontWeight: FontWeight.bold },
  dayTextToday: { color: Colors.primary, fontWeight: FontWeight.bold },

  actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
});
