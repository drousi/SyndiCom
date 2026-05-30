import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../src/constants/theme';

export default function Index() {
  // This is a dummy initial route. The RootLayout will immediately 
  // redirect the user to /(app) or /(auth) based on authentication state.
  return (
    <View style={{ flex: 1, backgroundColor: Colors.navy, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}
