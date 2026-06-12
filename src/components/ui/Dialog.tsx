import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, Radius, FontSize, FontWeight, Spacing, ThemeColors } from '../../constants/theme';
import { Button } from './Button';

interface DialogAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
}

interface DialogProps {
  visible: boolean;
  title: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  actions: DialogAction[];
  onClose: () => void;
  dismissable?: boolean;
}

export function Dialog({
  visible,
  title,
  message,
  icon,
  iconColor,
  actions,
  onClose,
  dismissable = true,
}: DialogProps) {
  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  
  // Use passed iconColor or fallback to theme primary
  const actualIconColor = iconColor || Colors.primary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => dismissable && onClose()}
    >
      <TouchableWithoutFeedback onPress={() => dismissable && onClose()}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.dialogContainer}
            >
              {icon && (
                <View style={[styles.iconContainer, { backgroundColor: actualIconColor + '20' }]}>
                  <Ionicons name={icon} size={32} color={actualIconColor} />
                </View>
              )}
              <Text style={styles.title}>{title}</Text>
              {message && <Text style={styles.message}>{message}</Text>}

              <View style={styles.actionsContainer}>
                {actions.map((action, index) => (
                  <Button
                    key={index}
                    label={action.label}
                    onPress={action.onPress}
                    variant={action.variant || 'primary'}
                    style={styles.actionButton}
                    fullWidth
                  />
                ))}
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  dialogContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.white,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  actionsContainer: {
    width: '100%',
    gap: Spacing.sm,
  },
  actionButton: {
    marginTop: 4,
  },
});
