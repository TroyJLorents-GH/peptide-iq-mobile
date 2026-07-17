import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VariableContextProvider } from 'react-native-css';
import { palette, type Palette, type ThemeMode } from '../theme/colors';
import { cssVars } from '../theme/cssVars';

// What the user picked. 'auto' follows the OS color scheme.
export type ThemePreference = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'peptideiq_theme_mode';

interface ThemeModeContextValue {
  preference: ThemePreference;      // what the user chose
  resolvedMode: ThemeMode;          // what's actually applied (auto -> light/dark)
  colors: Palette;                  // raw values for charts/icons
  setPreference: (p: ThemePreference) => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('auto');
  // useColorScheme reflects Appearance overrides, so it tracks both the OS
  // scheme and our explicit setColorScheme calls — exactly what CSS
  // light-dark() resolves against.
  const systemScheme = useColorScheme();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(v => {
      if (v === 'light' || v === 'dark' || v === 'auto') {
        setPreferenceState(v);
        Appearance.setColorScheme(v === 'auto' ? 'unspecified' : v);
      }
    }).catch(() => {
      // storage unavailable — in-memory default applies
    });
  }, []);

  const setPreference = (p: ThemePreference) => {
    setPreferenceState(p);
    // Overriding the app-level scheme flips every light-dark() variable in
    // global.css; 'auto' clears the override back to the OS scheme.
    Appearance.setColorScheme(p === 'auto' ? 'unspecified' : p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {
      // ignore write failures — the in-memory preference still applies
    });
  };

  const resolvedMode: ThemeMode = systemScheme === 'dark' ? 'dark' : 'light';

  const value = useMemo(
    () => ({ preference, resolvedMode, colors: palette[resolvedMode], setPreference }),
    [preference, resolvedMode],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      {/* Inject every Tailwind theme token as a concrete value for the
          resolved mode. Inherited variables win over the CSS :root pipeline
          and, unlike it, reach content inside native <Modal>s. */}
      <VariableContextProvider value={cssVars[resolvedMode]}>
        {children}
      </VariableContextProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode(): ThemeModeContextValue {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider');
  return ctx;
}
