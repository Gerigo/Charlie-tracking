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
  /** Bleu nuit profond — états sommeil, fond du hero "en cours" */
  night: string;
  nightSoft: string;
  /** Crème chaud — fond du hero matin / contexte tendre */
  cream: string;
  creamSoft: string;
  /** Vert sauge frais — success, croissance positive */
  mint: string;
  mintSoft: string;
  fontLight: string;
  fontRegular: string;
  fontMedium: string;
  fontSemiBold: string;
  fontBold: string;
  fontExtraBold: string;
  fontDisplay: string;
  fontDisplayItalic: string;
}

// ─── Direction D · Carnet d'aquarelle ─────────────────────────────────────
//
// Palette inspired by hand-painted journals: cream paper, terracotta ink,
// rose-washed pinks, faded sage greens, honey ochre. Cards are paper, the
// background is an open notebook page, accents feel like watercolour blooms.
//
// Reference swatches (used across the app):
//   Encre brune     #3A2F2C   primary text
//   Terracotta      #A8624D   primary action / accent
//   Terracotta dark #7E4533   gradient anchor / pressed state
//   Rose lavé       #E8A8A8   warm container, diaper accents
//   Sauge fanée     #9DAB8E   success, growth, mint replacement
//   Ocre miel       #D4A857   warning, ornaments, ochre highlights
//   Cream paper     #FAF3E8   page background
//   White paper     #FFFFFF   card surface
//
// All other tokens are derived to keep WCAG AA on body text and meaningful
// hierarchy across textMuted / textSoft tiers.

export const lightTheme: AppTheme = {
  name: 'light',
  isDark: false,
  background: '#FAF3E8',
  backgroundElevated: '#F5EBDD',
  surface: '#FFFFFF',
  surfaceLowest: '#FFFFFF',
  surfaceContainer: '#EDE2D2',
  surfaceContainerHigh: '#E5D7C3',
  surfaceRaised: '#FBF5EC',
  surfaceSoft: '#EDE2D2',
  cardBorder: 'rgba(168, 98, 77, 0.22)',
  cardBorderStrong: 'rgba(168, 98, 77, 0.38)',
  outline: '#7E4533',
  text: '#3A2F2C',
  textMuted: '#5A4945',
  textSoft: '#8C766F',
  primary: '#A8624D',
  primaryContainer: '#E8A8A8',
  primarySoft: '#7E4533',
  primaryGlow: 'rgba(168, 98, 77, 0.14)',
  secondaryContainer: '#F0CFD0',
  onPrimary: '#FFFFFF',
  success: '#9DAB8E',
  warning: '#D4A857',
  danger: '#B5524C',
  sleep: '#8C7BA1',
  feed: '#A8624D',
  diaper: '#9DAB8E',
  visit: '#7B8FA1',
  temperature: '#D4A857',
  growth: '#9DAB8E',
  // Opaque so each component's shadowOpacity is the source of truth.
  // Without this, RN Web multiplies the alpha and shadows fade to ~3 %.
  shadow: '#5E3529',
  hairline: 'rgba(168, 98, 77, 0.18)',
  headerGradientA: 'rgba(232, 168, 168, 0.20)',
  headerGradientB: 'rgba(157, 171, 142, 0.16)',
  gradientStart: '#7E4533',
  gradientEnd: '#A8624D',
  tracker: '#A8624D',
  today: '#9DAB8E',
  evolution: '#8C7BA1',
  data: '#7B8FA1',
  history: '#D4A857',
  settings: '#7E4533',
  night: '#3A2F2C',
  nightSoft: '#5A4945',
  cream: '#FBF5EC',
  creamSoft: '#F5EBDD',
  mint: '#9DAB8E',
  mintSoft: '#C8D2BB',
  fontLight: 'Manrope_300Light',
  fontRegular: 'Manrope_400Regular',
  fontMedium: 'Manrope_500Medium',
  fontSemiBold: 'Manrope_600SemiBold',
  fontBold: 'Manrope_700Bold',
  fontExtraBold: 'Manrope_800ExtraBold',
  fontDisplay: 'Fraunces_300Light',
  fontDisplayItalic: 'Fraunces_300Light_Italic',
};

// ─── Direction D · Carnet de nuit ─────────────────────────────────────────
//
// Dark mirror of the carnet d'aquarelle: encre brune background as if the
// notebook were closed at night, paper-cream text, terracotta brightened
// just enough to read on a brown ground. Same accent vocabulary (rose, sage,
// ochre) but slightly warmed so the watercolour identity holds in the dark.

export const darkTheme: AppTheme = {
  name: 'dark',
  isDark: true,
  background: '#1F1814',
  backgroundElevated: '#2B221E',
  surface: '#2B221E',
  surfaceLowest: '#322822',
  surfaceContainer: '#3D312A',
  surfaceContainerHigh: '#4A3C33',
  surfaceRaised: '#36292B',
  surfaceSoft: '#3D312A',
  cardBorder: 'rgba(216, 138, 111, 0.22)',
  cardBorderStrong: 'rgba(216, 138, 111, 0.40)',
  outline: '#C9A89A',
  text: '#F0E6D6',
  textMuted: '#D4C5B0',
  textSoft: '#A89682',
  primary: '#D88A6F',
  primaryContainer: '#7E4533',
  primarySoft: '#E8A8A8',
  primaryGlow: 'rgba(216, 138, 111, 0.14)',
  secondaryContainer: '#5A3A33',
  onPrimary: '#241712',
  success: '#B5C4A6',
  warning: '#E5B97D',
  danger: '#E89993',
  sleep: '#B0A2C0',
  feed: '#D88A6F',
  diaper: '#B5C4A6',
  visit: '#A6B6C8',
  temperature: '#E5B97D',
  growth: '#B5C4A6',
  // Opaque black; component shadowOpacity drives intensity on dark surfaces.
  shadow: '#000000',
  hairline: 'rgba(216, 138, 111, 0.16)',
  headerGradientA: 'rgba(216, 138, 111, 0.12)',
  headerGradientB: 'rgba(181, 196, 166, 0.10)',
  gradientStart: '#7E4533',
  gradientEnd: '#D88A6F',
  tracker: '#D88A6F',
  today: '#B5C4A6',
  evolution: '#B0A2C0',
  data: '#A6B6C8',
  history: '#E5B97D',
  settings: '#C9A89A',
  night: '#0E0A08',
  nightSoft: '#1F1814',
  cream: '#3D312A',
  creamSoft: '#322822',
  mint: '#B5C4A6',
  mintSoft: '#4D5A42',
  fontLight: 'Manrope_300Light',
  fontRegular: 'Manrope_400Regular',
  fontMedium: 'Manrope_500Medium',
  fontSemiBold: 'Manrope_600SemiBold',
  fontBold: 'Manrope_700Bold',
  fontExtraBold: 'Manrope_800ExtraBold',
  fontDisplay: 'Fraunces_300Light',
  fontDisplayItalic: 'Fraunces_300Light_Italic',
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
