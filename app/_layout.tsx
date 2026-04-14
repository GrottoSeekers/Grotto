import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useFonts } from 'expo-font';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import 'react-native-reanimated';

import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { GrottoTokens } from '@/constants/theme';
import { registerPhotoSchedulerTask, startPhotoSchedulerBackgroundFetch } from '@/lib/photo-scheduler';
import { seedDatabase } from '@/db/seed';

SplashScreen.preventAutoHideAsync();

// Register background task before any component renders
registerPhotoSchedulerTask();

const GrottoTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: GrottoTokens.gold,
    background: GrottoTokens.white,
    card: GrottoTokens.white,
    text: GrottoTokens.textPrimary,
    border: GrottoTokens.borderSubtle,
  },
};

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  const { success: migrationsSuccess, error: migrationsError } = useMigrations(db, migrations);

  useEffect(() => {
    if (migrationsError) {
      console.error('Migration error:', migrationsError);
    }
  }, [migrationsError]);

  useEffect(() => {
    if (fontsLoaded && (migrationsSuccess || migrationsError)) {
      if (migrationsSuccess) {
        seedDatabase().catch(console.error);
        startPhotoSchedulerBackgroundFetch().catch(console.error);
      }
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, migrationsSuccess, migrationsError]);

  if (!fontsLoaded || (!migrationsSuccess && !migrationsError)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: GrottoTokens.white }}>
        <ActivityIndicator color={GrottoTokens.gold} />
      </View>
    );
  }

  if (migrationsError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: GrottoTokens.white, padding: 32 }}>
        <Text style={{ color: GrottoTokens.error, fontFamily: 'Inter_600SemiBold', fontSize: 16, marginBottom: 8 }}>
          Database error
        </Text>
        <Text style={{ color: GrottoTokens.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center' }}>
          {migrationsError.message}
        </Text>
      </View>
    );
  }

  return (
    <ThemeProvider value={GrottoTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="listing/[id]"
          options={{
            headerShown: true,
            title: '',
            headerBackTitle: 'Discover',
            headerTintColor: GrottoTokens.gold,
            headerStyle: { backgroundColor: GrottoTokens.white },
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
