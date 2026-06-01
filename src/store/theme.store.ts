import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { Appearance, LayoutAnimation, Platform, UIManager } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const secureStorage = {
  getItem: (name: string) => {
    return SecureStore.getItemAsync(name);
  },
  setItem: (name: string, value: string) => {
    return SecureStore.setItemAsync(name, value);
  },
  removeItem: (name: string) => {
    return SecureStore.deleteItemAsync(name);
  },
};

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  getIsDark: () => boolean;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'dark', // Default to dark since the app was designed for it
      
      setMode: (mode: ThemeMode) => {
        set({ mode });
      },
      
      getIsDark: () => {
        const { mode } = get();
        if (mode === 'system') {
          return Appearance.getColorScheme() === 'dark';
        }
        return mode === 'dark';
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
