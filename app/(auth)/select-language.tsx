import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  DevSettings,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguageStore, LanguageCode } from '../../src/store/language.store';
import { Button } from '../../src/components/ui/Button';
import { Logo } from '../../src/components/ui/Logo';
import { useThemeColors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../src/constants/theme';

export default function SelectLanguageScreen() {
  const router = useRouter();
  const Colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const { locale, setLocale, setHasChosenLanguage } = useLanguageStore();
  const [selected, setSelected] = useState<LanguageCode>(locale);

  // Labels for live language preview
  const titleText = {
    fr: 'Choisissez votre langue',
    en: 'Choose your language',
    ar: 'اختر لغتك',
  };

  const subtitleText = {
    fr: 'Sélectionnez la langue par défaut de l\'application.',
    en: 'Select the default application language.',
    ar: 'حدد اللغة الافتراضية للتطبيق.',
  };

  const btnText = {
    fr: 'Continuer',
    en: 'Continue',
    ar: 'متابعة',
  };

  const handleLanguageChange = (lang: LanguageCode) => {
    setSelected(lang);
    setLocale(lang); // updates it live so theme/fonts sync
  };

  const handleValidate = () => {
    const needsRestart = setLocale(selected);
    setHasChosenLanguage(true);
    if (needsRestart && __DEV__ && DevSettings && typeof DevSettings.reload === 'function') {
      DevSettings.reload();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />
      <View style={styles.content}>
        
        {/* Header / Logo */}
        <View style={styles.header}>
          <Logo width={160} height={45} />
          <Text style={styles.tagline}>La gestion de syndic simplifiée</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={[styles.title, selected === 'ar' && styles.titleAr]}>
            {titleText[selected]}
          </Text>
          <Text style={[styles.subtitle, selected === 'ar' && styles.subtitleAr]}>
            {subtitleText[selected]}
          </Text>

          {/* Options list */}
          <View style={styles.optionsList}>
            {/* French */}
            <TouchableOpacity
              style={[
                styles.optionCard,
                selected === 'fr' && styles.optionCardSelected,
              ]}
              activeOpacity={0.7}
              onPress={() => handleLanguageChange('fr')}
            >
              <View style={styles.optionLeft}>
                <Text style={styles.flag}>🇫🇷</Text>
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionTitle}>Français</Text>
                  <Text style={styles.optionSub}>French</Text>
                </View>
              </View>
              {selected === 'fr' && (
                <View style={styles.checkWrap}>
                  <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                </View>
              )}
            </TouchableOpacity>

            {/* English */}
            <TouchableOpacity
              style={[
                styles.optionCard,
                selected === 'en' && styles.optionCardSelected,
              ]}
              activeOpacity={0.7}
              onPress={() => handleLanguageChange('en')}
            >
              <View style={styles.optionLeft}>
                <Text style={styles.flag}>🇬🇧</Text>
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionTitle}>English</Text>
                  <Text style={styles.optionSub}>Anglais</Text>
                </View>
              </View>
              {selected === 'en' && (
                <View style={styles.checkWrap}>
                  <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                </View>
              )}
            </TouchableOpacity>

            {/* Arabic */}
            <TouchableOpacity
              style={[
                styles.optionCard,
                selected === 'ar' && styles.optionCardSelected,
                { flexDirection: 'row-reverse' }
              ]}
              activeOpacity={0.7}
              onPress={() => handleLanguageChange('ar')}
            >
              <View style={[styles.optionLeft, { flexDirection: 'row-reverse' }]}>
                <Text style={styles.flag}>🇲🇦</Text>
                <View style={[styles.optionTextWrap, { alignItems: 'flex-end', marginLeft: 0, marginRight: Spacing.md }]}>
                  <Text style={styles.optionTitle}>العربية</Text>
                  <Text style={styles.optionSub}>Arabe</Text>
                </View>
              </View>
              {selected === 'ar' && (
                <View style={styles.checkWrap}>
                  <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Validation Button */}
          <Button
            label={btnText[selected]}
            onPress={handleValidate}
            fullWidth
            size="lg"
            style={styles.submitBtn}
          />
        </View>

      </View>
    </SafeAreaView>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.navy,
  },
  content: {
    flex: 1,
    padding: Spacing.xl,
    justifyContent: 'center',
    gap: Spacing.xxl,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  tagline: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.regular,
  },
  card: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    gap: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    ...Shadow.md,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  titleAr: {
    fontFamily: 'Cairo_700Bold',
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: -Spacing.xs,
  },
  subtitleAr: {
    fontFamily: 'Cairo_400Regular',
  },
  optionsList: {
    gap: Spacing.md,
    marginVertical: Spacing.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.navyCard,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.navyBorder,
  },
  optionCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySurface,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flag: {
    fontSize: 26,
  },
  optionTextWrap: {
    marginLeft: Spacing.md,
  },
  optionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  optionSub: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  checkWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtn: {
    marginTop: Spacing.xs,
  },
});
