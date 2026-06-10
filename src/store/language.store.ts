import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { I18nManager } from 'react-native';

import fr from '../locales/fr.json';
import en from '../locales/en.json';
import ar from '../locales/ar.json';

const secureStorage = {
  getItem: (name: string) => SecureStore.getItemAsync(name),
  setItem: (name: string, value: string) => SecureStore.setItemAsync(name, value),
  removeItem: (name: string) => SecureStore.deleteItemAsync(name),
};

const translations: Record<string, any> = { fr, en, ar };

export type LanguageCode = 'fr' | 'en' | 'ar';

interface LanguageState {
  locale: LanguageCode;
  setLocale: (locale: LanguageCode) => boolean; // Returns true if a restart is needed for RTL
  t: (key: string, variables?: Record<string, string | number>) => string;
  isRTL: boolean;
  hasChosenLanguage: boolean;
  setHasChosenLanguage: (hasChosen: boolean) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      locale: 'fr',
      isRTL: false,
      hasChosenLanguage: false,

      setHasChosenLanguage: (hasChosen: boolean) => {
        set({ hasChosenLanguage: hasChosen });
      },

      setLocale: (locale: LanguageCode) => {
        const currentLocale = get().locale;
        if (currentLocale === locale) return false;

        const isArabic = locale === 'ar';
        const wasArabic = currentLocale === 'ar';
        const needsRTLChange = isArabic !== wasArabic;

        if (needsRTLChange) {
          I18nManager.allowRTL(isArabic);
          I18nManager.forceRTL(isArabic);
        }

        set({ locale, isRTL: isArabic });
        return needsRTLChange;
      },

      t: (key: string, variables?: Record<string, string | number>) => {
        const { locale } = get();
        const dictionary = translations[locale] || translations['fr'];
        
        // Resolve nested keys e.g. "settings.residence.warning_desc"
        const keys = key.split('.');
        let result = dictionary;
        for (const k of keys) {
          if (result && typeof result === 'object' && k in result) {
            result = result[k];
          } else {
            result = undefined;
            break;
          }
        }

        if (typeof result !== 'string') {
          // Fallback to English, then French, then key name
          let fallback = translations['en'];
          for (const k of keys) {
            fallback = fallback?.[k];
          }
          if (typeof fallback === 'string') {
            result = fallback;
          } else {
            let fallbackFr = translations['fr'];
            for (const k of keys) {
              fallbackFr = fallbackFr?.[k];
            }
            result = typeof fallbackFr === 'string' ? fallbackFr : key;
          }
        }

        // Interpolate variables e.g. {number} or {count}
        if (variables && result) {
          let interpolated = result;
          Object.entries(variables).forEach(([name, val]) => {
            interpolated = interpolated.replace(new RegExp(`{${name}}`, 'g'), String(val));
          });
          return interpolated;
        }

        return result;
      },
    }),
    {
      name: 'language-storage',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
