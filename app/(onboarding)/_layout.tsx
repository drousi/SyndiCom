import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useThemeStore } from '../../src/store/theme.store';
import { useThemeColors } from '../../src/constants/theme';

export default function OnboardingLayout() {
  const Colors = useThemeColors();
  const isDark = useThemeStore((state) => state.getIsDark());

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={Colors.navy} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.navy } }}>
        <Stack.Screen name="index" />
      </Stack>
    </>
  );
}
