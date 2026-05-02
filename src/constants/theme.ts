import type { Theme as NavigationTheme } from '@react-navigation/native';

export interface AppTheme {
  name: 'light' | 'dark';
  isDark: boolean;
  background: string;
  backgroundElevated: string;
  surface: string;
  surfaceLowest: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceRaised: string;
  surfaceSoft: string;
  cardBorder: string;
  cardBorderStrong: string;
  outline: string;
  text: string;
  textMuted: string;
  textSoft: string;
  primary: string;
  primaryContainer: string;
  primarySoft: string;
  primaryGlow: string;
  secondaryContainer: string;
  onPrimary: string;
  success: string;
  warning: string;
  danger: string;
  sleep: string;
  feed: string;
  diaper: string;
  visit: string;
  temperature: string;
  growth: string;
  shadow: string;
  hairline: string;
  headerGradientA: string;
  headerGradientB: string;
  gradientStart: string;
  gradientEnd: string;
  tracker: string;
  today: string;
  evolution: string;
  data: string;
  history: string;
  settings: string;
  fontLight: string;
  fontRegular: string;
  fontMedium: string;
  fontSemiBold: string;
  fontBold: string;
  fontExtraBold: string;
}

export const lightTheme: AppTheme = {
  name: 'light',
  isDark: false,
  background: '#FCF9F7',
  backgroundElevated: '#F7F2EF',
  surface: '#FCF9F7',
  surfaceLowest: '#FFFFFF',
  surfaceContainer: '#E8E3E0',
  surfaceContainerHigh: '#DDD8D4',
  surfaceRaised: '#F1EBE8',
  surfaceSoft: '#E2DCD8',
  cardBorder: 'rgba(180, 158, 160, 0.30)',
  cardBorderStrong: 'rgba(180, 158, 160, 0.45)',
  outline: '#6E6062',
  text: '#2A2324',
  textMuted: '#534547',
  textSoft: '#736366',
  primary: '#805354',
  primaryContainer: '#E8B4B8',
  primarySoft: '#6D4548',
  primaryGlow: 'rgba(232, 180, 184, 0.12)',
  secondaryContainer: '#FDDADD',
  onPrimary: '#FFFFFF',
  success: '#8E9A72',
  warning: '#C99462',
  danger: '#BA1A1A',
  sleep: '#8E666D',
  feed: '#A06C63',
  diaper: '#8E9A72',
  visit: '#7B8FA1',
  temperature: '#BC8B74',
  growth: '#9A7C72',
  shadow: 'rgba(124, 83, 87, 0.12)',
  hairline: 'rgba(124, 83, 87, 0.14)',
  headerGradientA: 'rgba(232, 180, 184, 0.10)',
  headerGradientB: 'rgba(253, 218, 221, 0.12)',
  gradientStart: '#7C5357',
  gradientEnd: '#E8B4B8',
  tracker: '#805354',
  today: '#7B8760',
  evolution: '#8B7693',
  data: '#6F8C87',
  history: '#A07870',
  settings: '#8A716C',
  fontLight: 'Manrope_300Light',
  fontRegular: 'Manrope_400Regular',
  fontMedium: 'Manrope_500Medium',
  fontSemiBold: 'Manrope_600SemiBold',
  fontBold: 'Manrope_700Bold',
  fontExtraBold: 'Manrope_800ExtraBold',
};

export const darkTheme: AppTheme = {
  name: 'dark',
  isDark: true,
  background: '#2B2325',
  backgroundElevated: '#33292B',
  surface: '#2F2628',
  surfaceLowest: '#3B3033',
  surfaceContainer: '#352B2D',
  surfaceContainerHigh: '#43373A',
  surfaceRaised: '#3A2F31',
  surfaceSoft: '#4A3E41',
  cardBorder: 'rgba(255, 217, 220, 0.16)',
  cardBorderStrong: 'rgba(255, 217, 220, 0.28)',
  outline: '#B9A4A8',
  text: '#F6F0ED',
  textMuted: '#DECED1',
  textSoft: '#BFAEB1',
  primary: '#EAB8BC',
  primaryContainer: '#7C5357',
  primarySoft: '#FFD9DC',
  primaryGlow: 'rgba(234, 184, 188, 0.10)',
  secondaryContainer: '#5C4549',
  onPrimary: '#2F1417',
  success: '#AFBE8A',
  warning: '#E5B07A',
  danger: '#FFB4AB',
  sleep: '#E4BFC6',
  feed: '#E4B29E',
  diaper: '#BAC89D',
  visit: '#B8C7D8',
  temperature: '#E8B58E',
  growth: '#D6B0A3',
  shadow: 'rgba(0, 0, 0, 0.22)',
  hairline: 'rgba(255, 255, 255, 0.08)',
  headerGradientA: 'rgba(234, 184, 188, 0.07)',
  headerGradientB: 'rgba(124, 83, 87, 0.12)',
  gradientStart: '#7C5357',
  gradientEnd: '#EAB8BC',
  tracker: '#EAB8BC',
  today: '#C3CF9E',
  evolution: '#D8C3E2',
  data: '#B8D2CB',
  history: '#D4A89A',
  settings: '#C4A79F',
  fontLight: 'Manrope_300Light',
  fontRegular: 'Manrope_400Regular',
  fontMedium: 'Manrope_500Medium',
  fontSemiBold: 'Manrope_600SemiBold',
  fontBold: 'Manrope_700Bold',
  fontExtraBold: 'Manrope_800ExtraBold',
};

export type ThemeMode = 'light' | 'dark' | 'system';

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export function createNavigationTheme(theme: AppTheme): NavigationTheme {
  return {
    dark: theme.isDark,
    colors: {
      primary: theme.primary,
      background: theme.background,
      card: theme.surface,
      text: theme.text,
      border: theme.cardBorder,
      notification: theme.danger,
    },
    fonts: {
      regular: { fontFamily: theme.fontRegular, fontWeight: '400' },
      medium: { fontFamily: theme.fontMedium, fontWeight: '500' },
      bold: { fontFamily: theme.fontBold, fontWeight: '700' },
      heavy: { fontFamily: theme.fontExtraBold, fontWeight: '800' },
    },
  };
}
