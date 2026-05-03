import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Icon } from '@/src/components/ui/Icon';
import { useI18n } from '@/src/hooks/useI18n';
import { triggerSelectionFeedback } from '@/src/lib/feedback';
import { useAppTheme } from '@/src/providers/ThemeProvider';

/**
 * State-based tab bar — visually identical to SanctuaryTabBar (the
 * route-based one we used inside Expo Router's `<Tabs>`), but driven by
 * a simple `activeTab` + `onTabChange` API. This is what makes the SPA
 * shell work: tab switches change React state, never the URL, so iOS
 * PWA stays anchored to its `start_url` and never exits standalone.
 */

const TAB_BAR_HEIGHT = 70;
const TAB_BAR_BOTTOM_INSET = 18;
const TAB_BAR_SIDE_INSET = 14;
const BLOOM_INSET = 8;

function withAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

export type SPATabName =
  | 'tracker'
  | 'today'
  | 'evolution'
  | 'growth'
  | 'settings';

interface RouteMeta {
  label: string;
  color: string;
  icon: string;
  iconActive: string;
}

function tabMeta(
  name: SPATabName,
  theme: ReturnType<typeof useAppTheme>['theme'],
  t: ReturnType<typeof useI18n>['t'],
): RouteMeta {
  switch (name) {
    case 'today':
      return { label: t('tab.today'), color: theme.today, icon: 'today-outline', iconActive: 'today' };
    case 'tracker':
      return { label: t('tab.log'), color: theme.tracker, icon: 'add-circle-outline', iconActive: 'add-circle' };
    case 'evolution':
      return { label: t('tab.evolution'), color: theme.evolution, icon: 'stats-chart-outline', iconActive: 'stats-chart' };
    case 'growth':
      return { label: t('tab.growth'), color: theme.growth, icon: 'analytics-outline', iconActive: 'analytics' };
    case 'settings':
      return { label: t('tab.settings'), color: theme.settings, icon: 'person-circle-outline', iconActive: 'person-circle' };
  }
}

interface TabItemProps {
  meta: RouteMeta;
  focused: boolean;
  onPress: () => void;
  inactiveColor: string;
  fontFamily: string;
}

function TabItem({ meta, focused, onPress, inactiveColor, fontFamily }: TabItemProps) {
  const labelOpacity = useSharedValue(focused ? 1 : 0);
  const iconShift = useSharedValue(focused ? 0 : 4);

  useEffect(() => {
    labelOpacity.value = withTiming(focused ? 1 : 0, { duration: 220 });
    iconShift.value = withTiming(focused ? 0 : 4, { duration: 220 });
  }, [focused, labelOpacity, iconShift]);

  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
    transform: [{ translateY: (1 - labelOpacity.value) * 4 }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: iconShift.value }],
  }));

  const iconColor = focused ? meta.color : inactiveColor;
  const labelColor = meta.color;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        pressed && !focused
          ? { transform: [{ scale: 0.92 }], opacity: 0.85 }
          : null,
      ]}
    >
      <Animated.View style={iconStyle}>
        <Icon name={focused ? meta.iconActive : meta.icon} size={22} color={iconColor} />
      </Animated.View>
      <Animated.Text
        numberOfLines={1}
        style={[
          styles.label,
          { color: labelColor, fontFamily },
          labelStyle,
        ]}
      >
        {meta.label}
      </Animated.Text>
    </Pressable>
  );
}

interface SPATabBarProps {
  activeTab: SPATabName;
  onTabChange: (tab: SPATabName) => void;
  /** Order of tabs in the bar — defaults to a sensible vertical-first layout. */
  tabs?: readonly SPATabName[];
}

const DEFAULT_TABS: readonly SPATabName[] = [
  'today',
  'tracker',
  'evolution',
  'growth',
  'settings',
];

export function SPATabBar({ activeTab, onTabChange, tabs = DEFAULT_TABS }: SPATabBarProps) {
  const { theme } = useAppTheme();
  const { t } = useI18n();

  const activeMeta = tabMeta(activeTab, theme, t);
  const activeIndex = useMemo(() => {
    const idx = tabs.indexOf(activeTab);
    return idx === -1 ? 0 : idx;
  }, [tabs, activeTab]);

  const [rowWidth, setRowWidth] = useState(0);
  const tabCount = tabs.length;
  const tabWidth = tabCount > 0 ? rowWidth / tabCount : 0;

  const bloomX = useSharedValue(0);

  useEffect(() => {
    if (tabWidth === 0) return;
    bloomX.value = withSpring(activeIndex * tabWidth, {
      damping: 22,
      stiffness: 260,
      mass: 0.9,
    });
  }, [activeIndex, tabWidth, bloomX]);

  const bloomStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bloomX.value }],
    width: tabWidth - BLOOM_INSET * 2,
  }));

  // Carnet d'aquarelle — translucent cream paper (matches background tokens).
  const shellBg = theme.isDark
    ? 'rgba(31, 24, 20, 0.55)'
    : 'rgba(250, 243, 232, 0.62)';
  const innerStroke = theme.isDark ? 'rgba(240, 230, 214, 0.10)' : 'rgba(168, 98, 77, 0.10)';
  const bloomBg = withAlpha(activeMeta.color, theme.isDark ? '33' : '26');
  const inactiveColor = withAlpha(theme.textSoft, theme.isDark ? 'AA' : '99');

  return (
    <View pointerEvents="box-none" style={styles.outer}>
      <View
        style={[
          styles.shell,
          {
            shadowColor: theme.shadow,
            borderColor: innerStroke,
          },
        ]}
      >
        <BlurView
          intensity={theme.isDark ? 32 : 40}
          tint={theme.isDark ? 'dark' : 'light'}
          style={[styles.blur, { backgroundColor: shellBg }]}
        >
          <View
            style={styles.row}
            onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
          >
            {tabWidth > 0 ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.bloom,
                  { left: BLOOM_INSET, backgroundColor: bloomBg },
                  bloomStyle,
                ]}
              />
            ) : null}
            {tabs.map((tabName) => {
              const meta = tabMeta(tabName, theme, t);
              const focused = tabName === activeTab;
              return (
                <TabItem
                  key={tabName}
                  meta={meta}
                  focused={focused}
                  inactiveColor={inactiveColor}
                  fontFamily={theme.fontMedium}
                  onPress={() => {
                    if (focused) return;
                    triggerSelectionFeedback();
                    onTabChange(tabName);
                  }}
                />
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: TAB_BAR_SIDE_INSET,
    right: TAB_BAR_SIDE_INSET,
    bottom: TAB_BAR_BOTTOM_INSET,
    alignItems: 'center',
  },
  shell: {
    width: '100%',
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOpacity: 0.18,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  blur: {
    width: '100%',
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: BLOOM_INSET,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  bloom: {
    position: 'absolute',
    top: BLOOM_INSET,
    bottom: BLOOM_INSET,
    borderRadius: 999,
  },
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 9.5,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginTop: -2,
  },
});
