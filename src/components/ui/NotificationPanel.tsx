import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../../hooks/useNotifications';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';
import { useLanguageStore } from '../../store/language.store';
import type { AppNotification } from '../../types';

const TYPE_ICON: Record<string, any> = {
  reminder: 'alarm-outline',
  payment: 'cash-outline',
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
  const { t } = useLanguageStore();

  const {
    notifications,
    unreadCount,
    isLoading,
    refetch,
    handleMarkRead,
    handleMarkAllRead,
    handleArchive,
  } = useNotifications();

  const visibleNotifications = notifications.filter((n) => !n.is_archived);

  const renderItem = ({ item }: { item: AppNotification }) => (
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
          {format(new Date(item.created_at), 'dd MMM HH:mm', { locale: fr })}
        </Text>
      </View>
      <TouchableOpacity style={styles.archiveBtn} onPress={() => handleArchive(item.id)}>
        <Ionicons name="archive-outline" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
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

        {/* Content */}
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : visibleNotifications.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="notifications-off-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>{t('notifications.empty_title')}</Text>
            <Text style={styles.emptyDesc}>{t('notifications.empty_desc')}</Text>
          </View>
        ) : (
          <FlatList
            data={visibleNotifications}
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
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
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
    maxHeight: '75%',
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
});
