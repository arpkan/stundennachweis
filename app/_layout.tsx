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
      if (Platform.OS === 'web') {
        try {
          localStorage.setItem('reminder_enabled', s.reminderEnabled ? 'true' : 'false');
          localStorage.setItem('reminder_time', s.reminderTime || '17:00');
        } catch {}
      }
    });
  }, [db, setMode]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !('Notification' in window)) return;

    const check = () => {
      try {
        if (localStorage.getItem('reminder_enabled') !== 'true') return;
        if (Notification.permission !== 'granted') return;
        const time = localStorage.getItem('reminder_time') || '17:00';
        const [h, mn] = time.split(':').map(Number);
        const now = new Date();
        const today = now.toDateString();
        if (localStorage.getItem('reminder_last_shown') === today) return;
        const due = new Date(); due.setHours(h, mn, 0, 0);
        if (now >= due) {
          try {
            new Notification('Stundennachweis vergessen?', {
              body: 'Nicht vergessen, deine heutigen Fahrten einzutragen!',
              icon: '/icon-192.png',
            });
            localStorage.setItem('reminder_last_shown', today);
          } catch {
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then((reg) => {
                if (reg.active) {
                  reg.active.postMessage({
                    type: 'SHOW_NOTIFICATION',
                    title: 'Stundennachweis vergessen?',
                    options: { body: 'Nicht vergessen, deine heutigen Fahrten einzutragen!', icon: '/icon-192.png', tag: 'daily-reminder' },
                  });
                  localStorage.setItem('reminder_last_shown', today);
                }
              }).catch(() => {});
            }
          }
        }
      } catch {}
    };

    check(); // fire immediately if it's past reminder time and not yet shown today
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

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
