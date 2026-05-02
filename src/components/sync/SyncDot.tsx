import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { radii, spacing } from '@/src/constants/theme';
import { triggerSelectionFeedback } from '@/src/lib/feedback';
import { useAppContext } from '@/src/providers/AppProvider';
import { useAppTheme } from '@/src/providers/ThemeProvider';

export function SyncDot() {
  const { syncStatus, language } = useAppContext();
  const { theme } = useAppTheme();
  const router = useRouter();

  const pillOpacity = useRef(new Animated.Value(1)).current;
  const haloScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (syncStatus === 'syncing') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pillOpacity, { toValue: 0.45, duration: 500, useNativeDriver: true }),
          Animated.timing(pillOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => {
        loop.stop();
        pillOpacity.setValue(1);
      };
    }

    if (syncStatus === 'error') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(haloScale, { toValue: 1.18, duration: 650, useNativeDriver: true }),
          Animated.timing(haloScale, { toValue: 1, duration: 650, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => {
        loop.stop();
        haloScale.setValue(1);
      };
    }

    // live — reset
    pillOpacity.setValue(1);
    haloScale.setValue(1);
    return undefined;
  }, [syncStatus, pillOpacity, haloScale]);

  const fr = language === 'fr';

  const color =
    syncStatus === 'error'
      ? theme.warning
      : syncStatus === 'offline' || syncStatus === 'syncing'
        ? theme.textSoft
        : theme.primary;

  const label =
    syncStatus === 'error'
      ? (fr ? 'Erreur' : 'Error')
      : syncStatus === 'offline'
        ? (fr ? 'Hors ligne' : 'Offline')
        : syncStatus === 'syncing'
          ? (fr ? 'Syncing…' : 'Syncing…')
          : 'Sync';

  const a11yLabel =
    syncStatus === 'error'
      ? (fr ? 'Erreur de synchronisation' : 'Sync error')
      : syncStatus === 'offline'
        ? (fr ? 'Hors ligne' : 'Offline')
        : syncStatus === 'syncing'
          ? (fr ? 'Synchronisation en cours' : 'Syncing')
          : (fr ? 'Synchronisation en temps réel' : 'Live sync');

  return (
    <Pressable
      hitSlop={{ top: 10, right: 10, bottom: 10, left: 4 }}
      onPress={() => {
        triggerSelectionFeedback();
        router.push('/(app)/(tabs)/settings');
      }}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      <Animated.View
        style={[
          styles.pill,
          {
            backgroundColor: `${color}18`,
            borderColor: `${color}40`,
            opacity: pillOpacity,
            transform: [{ scale: haloScale }],
          },
        ]}
      >
        {/* dot */}
        <Animated.View style={[styles.dot, { backgroundColor: color }]} />
        {/* label */}
        <Text style={[styles.label, { color, fontFamily: theme.fontSemiBold }]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.1,
  },
});
