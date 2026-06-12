import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { fr, enUS, ar } from 'date-fns/locale';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../../hooks/useNotifications';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius, ThemeColors } from '../../constants/theme';
import { useLanguageStore } from '../../store/language.store';
import { useAuthStore } from '../../store/auth.store';
import { DeclarationConvertModal } from './DeclarationConvertModal';
import type { AppNotification } from '../../types';

type FilterTab = 'all' | 'unread' | 'read' | 'archived' | 'declarations';

const TYPE_ICON: Record<string, any> = {
  reminder: 'alarm-outline',
  payment: 'cash-outline',
  payment_declaration: 'document-text-outline',
  expense: 'receipt-outline',
  system: 'information-circle-outline',
};

interface NotificationPanelProps {
  visible: boolean;
  onClose: () => void;
}

export function NotificationPanel({ visible, onClose }: NotificationPanelProps) {
  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const { t, locale } = useLanguageStore();
  const { isAdmin, isManager } = useAuthStore();
  const isAdminOrManager = isAdmin() || isManager();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('unread');
  const [convertNotif, setConvertNotif] = useState<AppNotification | null>(null);
  const dateLocale = locale === 'ar' ? ar : locale === 'en' ? enUS : fr;

  const {
    notifications,
    unreadCount,
    isLoading,
    refetch,
    handleMarkRead,
    handleMarkAllRead,
    handleArchive,
    invalidate,
  } = useNotifications();

  const declarationsCount = notifications.filter(
    (n) => n.type === 'payment_declaration' && !n.is_archived
  ).length;

  const FILTERS: { key: FilterTab; label: string; count?: number }[] = [
    { key: 'all', label: t('notifications.filter_all') },
    { key: 'unread', label: t('notifications.filter_unread') },
    { key: 'declarations' as FilterTab, label: t('notifications.filter_declarations'), count: declarationsCount },
    { key: 'read', label: t('notifications.filter_read') },
    { key: 'archived', label: t('notifications.filter_archived') },
  ];

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'archived') return n.is_archived;
    if (activeFilter === 'unread') return !n.is_read && !n.is_archived;
    if (activeFilter === 'read') return n.is_read && !n.is_archived;
    if (activeFilter === 'declarations') return n.type === 'payment_declaration' && !n.is_archived;
    return true;
  });

  const handleConvertSuccess = async (notificationId: string) => {
    await handleArchive(notificationId);
    invalidate();
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const isPaymentDecl = item.type === 'payment_declaration';
    const showConvertAction = isPaymentDecl && isAdminOrManager && !item.is_archived;

    return (
      <TouchableOpacity
        style={[styles.item, !item.is_read && styles.itemUnread]}
        activeOpacity={0.7}
        onPress={() => !item.is_read && handleMarkRead(item.id)}
      >
        <View style={[styles.iconWrap, { backgroundColor: item.is_read ? Colors.navyBorder : Colors.primaryLight }]}>
          <Ionicons
            name={TYPE_ICON[item.type] ?? 'notifications-outline'}
            size={18}
            color={item.is_read ? Colors.textMuted : Colors.primary}
          />
        </View>
        <View style={styles.itemContent}>
          <Text style={[styles.itemTitle, !item.is_read && styles.itemTitleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.itemBody} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.itemDate}>
            {format(new Date(item.created_at), 'dd MMM HH:mm', { locale: dateLocale })}
          </Text>

          {/* Convert to contribution action — admin/manager only on payment_declaration */}
          {showConvertAction && (
            <TouchableOpacity
              style={styles.convertBtn}
              onPress={() => {
                if (!item.is_read) handleMarkRead(item.id);
                setConvertNotif(item);
              }}
            >
              <Ionicons name="swap-horizontal-outline" size={13} color={Colors.primary} />
              <Text style={styles.convertBtnText}>{t('notifications.payment_declaration_action')}</Text>
            </TouchableOpacity>
          )}
        </View>
        {activeFilter !== 'archived' && (
          <TouchableOpacity style={styles.archiveBtn} onPress={() => handleArchive(item.id)}>
            <Ionicons name="archive-outline" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={onClose}
      >
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        {/* Panel */}
        <View style={[styles.panel, { paddingBottom: insets.bottom + Spacing.lg }]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>{t('notifications.title')}</Text>
            <View style={styles.panelHeaderRight}>
              {unreadCount > 0 && (
                <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllRead}>
                  <Ionicons name="checkmark-done-outline" size={16} color={Colors.primary} />
                  <Text style={styles.markAllText}>{t('notifications.mark_all_read')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Filter tabs */}
          <View style={styles.filterRowWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterTab, activeFilter === f.key && styles.filterTabActive]}
                  onPress={() => setActiveFilter(f.key)}
                >
                  <Text style={[styles.filterLabel, activeFilter === f.key && styles.filterLabelActive]}>
                    {f.label}
                  </Text>
                  {f.key === 'unread' && unreadCount > 0 && (
                    <View style={styles.filterBadge}>
                      <Text style={styles.filterBadgeText}>{unreadCount}</Text>
                    </View>
                  )}
                  {f.key === 'declarations' && (f.count ?? 0) > 0 && (
                    <View style={[styles.filterBadge, { backgroundColor: Colors.warning }]}>
                      <Text style={styles.filterBadgeText}>{f.count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Content */}
          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : filteredNotifications.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="notifications-off-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>{t('notifications.empty_title')}</Text>
              <Text style={styles.emptyDesc}>
                {activeFilter === 'archived' ? t('notifications.empty_archived') : t('notifications.empty_desc')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredNotifications}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              onRefresh={refetch}
              refreshing={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.list}
              ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
            />
          )}
        </View>
      </Modal>

      {/* Convert declaration modal — rendered outside the panel modal to avoid nesting */}
      <DeclarationConvertModal
        visible={!!convertNotif}
        notification={convertNotif}
        onClose={() => setConvertNotif(null)}
        onSuccess={handleConvertSuccess}
      />
    </>
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
    height: '60%',
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
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderColor: Colors.navyBorder,
  },
  panelTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  panelHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markAllText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  closeBtn: {
    padding: 4,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },
  emptyDesc: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  list: {
    padding: Spacing.xl,
    paddingTop: Spacing.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  itemUnread: {
    borderColor: Colors.primary,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemContent: { flex: 1, gap: 2 },
  itemTitle: { fontSize: FontSize.sm, color: Colors.textSecondary },
  itemTitleUnread: { color: Colors.textPrimary, fontWeight: FontWeight.bold },
  itemBody: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 17 },
  itemDate: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  archiveBtn: { padding: 4, marginTop: 2 },

  convertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.sm,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(76,175,80,0.3)',
  },
  convertBtnText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },

  filterRowWrap: {
    borderBottomWidth: 1,
    borderColor: Colors.navyBorder,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 5,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.navyCard,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  filterTabActive: {
    backgroundColor: Colors.primarySurface,
    borderColor: Colors.primary,
  },
  filterLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  filterLabelActive: {
    color: Colors.primary,
  },
  filterBadge: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: {
    fontSize: 9,
    color: Colors.white,
    fontWeight: FontWeight.bold,
  },
});
