import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import {
  createNavigationTheme,
  darkTheme,
  lightTheme,
  type AppTheme,
  type ThemeMode,
} from '@/src/constants/theme';

const STORAGE_KEY = 'charlie-mobile-theme-mode';

interface ThemeContextValue {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  theme: AppTheme;
  navigationTheme: ReturnType<typeof createNavigationTheme>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark') {
        setThemeModeState(stored);
        return;
      }
      if (stored === 'system') {
        setThemeModeState('light');
        void AsyncStorage.setItem(STORAGE_KEY, 'light').catch(() => undefined);
      }
    }).catch(() => undefined);
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    void AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => undefined);
  };

  const theme = useMemo(() => {
    const resolvedMode = themeMode === 'system'
      ? (systemScheme === 'dark' ? 'dark' : 'light')
      : themeMode;
    return resolvedMode === 'dark' ? darkTheme : lightTheme;
  }, [systemScheme, themeMode]);

  const value = useMemo<ThemeContextValue>(() => ({
    themeMode,
    setThemeMode,
    theme,
    navigationTheme: createNavigationTheme(theme),
  }), [theme, themeMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }
  return context;
}
