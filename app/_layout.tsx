import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { View, ActivityIndicator, Appearance, Platform } from 'react-native';
import { SQLiteProvider, useSQLiteContext } from '@/utils/platform/storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { migrateDatabase } from '@/db/schema';
import { getAllSettings } from '@/db/queries';
import { useThemeColors, ThemeContext, type ThemeMode } from '@/theme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

function ThemeManager({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();

  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (Platform.OS === 'web') {
      try {
        const saved = localStorage.getItem('app-theme');
        if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
      } catch {}
    }
    return 'system';
  });

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    if (Platform.OS === 'web') {
      try { localStorage.setItem('app-theme', m); } catch {}
    } else if (typeof Appearance.setColorScheme === 'function') {
      Appearance.setColorScheme(m === 'system' ? null : m);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  useEffect(() => {
    getAllSettings(db).then(s => {
      setMode(s.theme ?? 'system');
    });
  }, [db, setMode]);

  return (
    <ThemeContext.Provider value={{ mode, setMode }}>
      <StatusBar style="auto" />
      {children}
    </ThemeContext.Provider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Suspense fallback={<LoadingScreen />}>
        <SQLiteProvider
          databaseName="stundennachweis.db"
          onInit={migrateDatabase}
          useSuspense
        >
          <ThemeManager>
            <Stack screenListeners={{ state: () => SplashScreen.hideAsync() }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="entry/[id]"
                options={{ presentation: 'fullScreenModal', headerShown: false }}
              />
            </Stack>
          </ThemeManager>
        </SQLiteProvider>
      </Suspense>
    </GestureHandlerRootView>
  );
}

function LoadingScreen() {
  const colors = useThemeColors();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.screen, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
