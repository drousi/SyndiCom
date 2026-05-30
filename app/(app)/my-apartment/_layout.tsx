import { Stack } from 'expo-router';

export default function MyApartmentLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="declare" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
