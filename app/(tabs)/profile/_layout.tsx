import { Stack } from 'expo-router/stack';

import { GrottoTokens } from '@/constants/theme';

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerTintColor: GrottoTokens.gold,
        headerStyle: { backgroundColor: GrottoTokens.white },
        contentStyle: { backgroundColor: GrottoTokens.offWhite },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Profile' }} />
      <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
      <Stack.Screen name="sign-up" options={{ title: 'Sign up' }} />
    </Stack>
  );
}
