import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, FontSize, Radius, Spacing, Shadow } from '../../constants/theme';

export interface DropdownOption {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
}

interface DropdownMenuProps {
  options: DropdownOption[];
  children: React.ReactNode;
}

export function DropdownMenu({ options, children }: DropdownMenuProps) {
  const [visible, setVisible] = useState(false);
  const [menuLayout, setMenuLayout] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<View>(null);

  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get('window').width;
      const menuWidth = 200;
      
      let left = x - menuWidth + width + 8; // align right by default since it's a trailing icon
      if (left < 16) left = 16;
      if (left + menuWidth > screenWidth - 16) left = screenWidth - menuWidth - 16;
      
      let top = y + height + 8;
      
      setMenuLayout({ top, left, width: menuWidth });
      setVisible(true);
    });
  };

  return (
    <>
      <TouchableOpacity ref={triggerRef} onPress={openMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        {children}
      </TouchableOpacity>
      
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View style={styles.overlay}>
            <View style={[styles.menu, { top: menuLayout.top, left: menuLayout.left, width: menuLayout.width }]}>
              {options.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.option, index < options.length - 1 && styles.optionBorder]}
                  onPress={() => {
                    setVisible(false);
                    option.onPress();
                  }}
                >
                  {option.icon && (
                    <Ionicons name={option.icon} size={18} color={option.destructive ? Colors.danger : Colors.textPrimary} />
                  )}
                  <Text style={[styles.optionText, option.destructive && { color: Colors.danger }]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  overlay: { flex: 1 },
  menu: {
    position: 'absolute',
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    ...Shadow.sm,
    zIndex: 1000,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  optionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
  },
  optionText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
});
