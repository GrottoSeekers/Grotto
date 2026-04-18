import { Stack } from 'expo-router/stack';

import { GrottoTokens, FontFamily } from '@/constants/theme';

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerTintColor: GrottoTokens.textPrimary,
        headerStyle: { backgroundColor: GrottoTokens.white },
        contentStyle: { backgroundColor: GrottoTokens.offWhite },
        headerTitleStyle: {
          fontFamily: FontFamily.sansSemiBold,
          fontSize: 17,
          color: GrottoTokens.textPrimary,
        },
        headerBackTitle: '',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Profile', headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
      <Stack.Screen name="sign-up" options={{ title: 'Sign up' }} />
      <Stack.Screen name="verify-email" options={{ title: 'Verify email' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Forgot password' }} />
      <Stack.Screen name="reset-password" options={{ title: 'Reset password' }} />
      <Stack.Screen
        name="view"
        options={{
          title: 'My profile',
          headerTintColor: GrottoTokens.textPrimary,
        }}
      />
      <Stack.Screen
        name="edit"
        options={{
          title: 'Edit profile',
          headerTintColor: GrottoTokens.textPrimary,
        }}
      />
      <Stack.Screen
        name="testimonials"
        options={{
          title: 'Testimonials',
          headerTintColor: GrottoTokens.textPrimary,
        }}
      />
      <Stack.Screen
        name="request-testimonial"
        options={{
          title: 'Request a testimonial',
          headerTintColor: GrottoTokens.textPrimary,
        }}
      />
      <Stack.Screen
        name="add-testimonial"
        options={{
          title: 'Add testimonial',
          headerTintColor: GrottoTokens.textPrimary,
        }}
      />
      <Stack.Screen
        name="preview"
        options={{
          title: 'Profile preview',
          headerTintColor: GrottoTokens.textPrimary,
        }}
      />
    </Stack>
  );
}
