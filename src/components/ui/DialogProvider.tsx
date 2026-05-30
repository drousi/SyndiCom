import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert as RNAlert, AlertButton } from 'react-native';
import { Dialog } from './Dialog';
import { Colors } from '../../constants/theme';

interface DialogParams {
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

interface DialogContextType {
  show: (title: string, message?: string, buttons?: AlertButton[]) => void;
}

const DialogContext = createContext<DialogContextType | null>(null);

export const useGlobalDialog = () => {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useGlobalDialog must be used within DialogProvider');
  return ctx;
};

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [params, setParams] = useState<DialogParams | null>(null);

  const show = (title: string, message?: string, buttons?: AlertButton[]) => {
    setParams({ title, message, buttons });
  };

  const close = () => {
    setParams(null);
  };

  // Override React Native's default Alert.alert
  useEffect(() => {
    const originalAlert = RNAlert.alert;
    RNAlert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
      show(title, message, buttons);
    };
    return () => {
      RNAlert.alert = originalAlert; // Restore on unmount (rarely happens at root)
    };
  }, []);

  // Map React Native AlertButtons to our Dialog actions
  const actions = (params?.buttons || [{ text: 'OK', onPress: () => close() }]).map(btn => {
    let variant: 'primary' | 'secondary' | 'outline' | 'danger' = 'primary';
    if (btn.style === 'destructive') variant = 'danger';
    if (btn.style === 'cancel') variant = 'outline';

    return {
      label: btn.text || 'OK',
      variant,
      onPress: () => {
        close();
        if (btn.onPress) btn.onPress();
      },
    };
  });

  return (
    <DialogContext.Provider value={{ show }}>
      {children}
      {params && (
        <Dialog
          visible={!!params}
          title={params.title}
          message={params.message}
          actions={actions}
          onClose={close}
          icon={params.title.toLowerCase().includes('erreur') ? 'alert-circle-outline' : 'information-circle-outline'}
          iconColor={params.title.toLowerCase().includes('erreur') ? Colors.danger : Colors.primary}
        />
      )}
    </DialogContext.Provider>
  );
}
