import '../global.css';

import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from '../tw';
import { AppProvider } from '../context/AppContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeModeProvider, useThemeMode } from '../context/ThemeModeContext';
import DisclaimerModal from '../components/DisclaimerModal';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, loading } = useAuth();
  const { resolvedMode, colors } = useThemeMode();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const navTheme = {
    ...(resolvedMode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(resolvedMode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.primary,
      background: colors.bg,
      card: colors.surface,
      text: colors.text,
      border: colors.divider,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />
      <AppProvider>
        {session ? <DisclaimerModal /> : null}
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Protected guard={!!session}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="compound/[id]" options={{ title: 'Compound' }} />
            <Stack.Screen name="library" options={{ title: 'Peptide Library' }} />
            <Stack.Screen name="logbook" options={{ title: 'Activity' }} />
            <Stack.Screen name="progress" options={{ title: 'Progress' }} />
            <Stack.Screen name="alerts" options={{ title: 'Alerts & Warnings' }} />
          </Stack.Protected>
          <Stack.Protected guard={!session}>
            <Stack.Screen name="login" options={{ headerShown: false }} />
          </Stack.Protected>
        </Stack>
      </AppProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeModeProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeModeProvider>
  );
}
