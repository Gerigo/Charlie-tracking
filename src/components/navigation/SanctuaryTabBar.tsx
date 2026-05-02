import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/src/hooks/useI18n';
import { triggerSelectionFeedback } from '@/src/lib/feedback';
import { radii, spacing } from '@/src/constants/theme';
import { useAppTheme } from '@/src/providers/ThemeProvider';

function withAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

function routeMeta(
  name: string,
  theme: ReturnType<typeof useAppTheme>['theme'],
  t: ReturnType<typeof useI18n>['t'],
) {
  switch (name) {
    case 'today':
      return { label: t('tab.today'), color: theme.today, icon: 'today-outline' as const, iconActive: 'today' as const };
    case 'tracker':
      return { label: t('tab.log'), color: theme.tracker, icon: 'add-circle-outline' as const, iconActive: 'add-circle' as const };
    case 'evolution':
      return { label: t('tab.evolution'), color: theme.evolution, icon: 'stats-chart-outline' as const, iconActive: 'stats-chart' as const };
    case 'data':
      return { label: t('tab.data'), color: theme.data, icon: 'folder-open-outline' as const, iconActive: 'folder-open' as const };
    case 'growth':
      return { label: t('tab.growth'), color: theme.growth, icon: 'analytics-outline' as const, iconActive: 'analytics' as const };
    case 'settings':
      return { label: t('tab.settings'), color: theme.settings, icon: 'person-circle-outline' as const, iconActive: 'person-circle' as const };
    case 'social':
      return { label: t('tab.social'), color: theme.evolution, icon: 'heart-outline' as const, iconActive: 'heart' as const };
    default:
      return { label: name, color: theme.primary, icon: 'ellipse-outline' as const, iconActive: 'ellipse' as const };
  }
}

interface Props extends BottomTabBarProps {
  /** Routes à cacher dans la tab bar (ex: ['history', 'data']) */
  hiddenRoutes?: string[];
}

export function SanctuaryTabBar({ state, descriptors, navigation, hiddenRoutes = [] }: Props) {
  const { theme } = useAppTheme();
  const { t } = useI18n();
  const shellColor = theme.isDark ? theme.surfaceContainerHigh : theme.surfaceLowest;

  return (
    <View style={[styles.wrap, { backgroundColor: shellColor, shadowColor: theme.shadow, borderTopColor: theme.hairline }]}>
      <View style={[styles.inner, { backgroundColor: shellColor }]}>
        {state.routes.map((route, index) => {
          if (hiddenRoutes.includes(route.name)) return null;

          const focused = state.index === index;
          const meta = routeMeta(route.name, theme, t);
          const color = focused ? meta.color : withAlpha(meta.color, theme.isDark ? '99' : '80');

          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!focused && !event.defaultPrevented) {
                  triggerSelectionFeedback();
                  navigation.navigate(route.name);
                }
              }}
              style={styles.item}
            >
              <View
                style={[
                  styles.pill,
                  focused
                    ? {
                        backgroundColor: withAlpha(meta.color, theme.isDark ? '26' : '18'),
                      }
                    : null,
                ]}
              >
                <Ionicons name={focused ? meta.iconActive : meta.icon} size={20} color={color} />
                <Text style={[styles.label, { color, fontFamily: focused ? theme.fontBold : theme.fontMedium }]} numberOfLines={1}>
                  {meta.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.sm,
    paddingTop: 10,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    shadowOpacity: 0.12,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -10 },
    elevation: 10,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'visible',
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
  pill: {
    width: '100%',
    minHeight: 56,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 2,
    paddingVertical: 6,
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.1,
  },
});
