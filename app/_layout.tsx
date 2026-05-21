import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Suspense, useEffect } from 'react';
import { View, ActivityIndicator, Appearance } from 'react-native';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { migrateDatabase } from '@/db/schema';
import { getAllSettings } from '@/db/queries';
import { useThemeColors } from '@/theme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

function ThemeManager({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  useEffect(() => {
    getAllSettings(db).then(settings => {
      Appearance.setColorScheme(settings.theme === 'system' ? null : settings.theme);
    });
  }, [db]);
  return (
    <>
      <StatusBar style="auto" />
      {children}
    </>
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
