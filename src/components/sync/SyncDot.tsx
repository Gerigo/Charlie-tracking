import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text } from 'react-native';
import { radii, spacing } from '@/src/constants/theme';
import { triggerSelectionFeedback } from '@/src/lib/feedback';
import { useSPANav } from '@/src/lib/spaNav';
import { useAppContext } from '@/src/providers/AppProvider';
import { useAppTheme } from '@/src/providers/ThemeProvider';

export function SyncDot() {
  const { syncStatus, language, livePulseToken } = useAppContext();
  const { theme } = useAppTheme();
  const { goToTab } = useSPANav();

  const haloScale = useRef(new Animated.Value(1)).current;
  const livePulseScale = useRef(new Animated.Value(1)).current;
  // Continuous rotation driver for the syncing spinner ring — keeps the
  // pill visually alive instead of just dimming opacity, which read as
  // "frozen" because the change is so subtle.
  const spinValue = useRef(new Animated.Value(0)).current;
  // Three staggered "breathing" dots when syncing — gives a sense of
  // progression while the spinner ring sweeps.
  const dotA = useRef(new Animated.Value(0)).current;
  const dotB = useRef(new Animated.Value(0)).current;
  const dotC = useRef(new Animated.Value(0)).current;

  // Brief mint pulse when a fresh event arrives from another device
  useEffect(() => {
    if (livePulseToken === 0) return;
    Animated.sequence([
      Animated.timing(livePulseScale, { toValue: 1.18, duration: 220, useNativeDriver: true }),
      Animated.timing(livePulseScale, { toValue: 1, duration: 420, useNativeDriver: true }),
    ]).start();
  }, [livePulseToken, livePulseScale]);

  useEffect(() => {
    if (syncStatus === 'syncing') {
      const spin = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      const wave = (value: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(value, { toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(value, { toValue: 0, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            Animated.delay(420 - delay),
          ]),
        );
      const waveA = wave(dotA, 0);
      const waveB = wave(dotB, 140);
      const waveC = wave(dotC, 280);
      spin.start();
      waveA.start();
      waveB.start();
      waveC.start();
      return () => {
        spin.stop();
        waveA.stop();
        waveB.stop();
        waveC.stop();
        spinValue.setValue(0);
        dotA.setValue(0);
        dotB.setValue(0);
        dotC.setValue(0);
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
    haloScale.setValue(1);
    return undefined;
  }, [syncStatus, haloScale, spinValue, dotA, dotB, dotC]);

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

  const spinDeg = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const isSyncing = syncStatus === 'syncing';

  return (
    <Pressable
      hitSlop={{ top: 10, right: 10, bottom: 10, left: 4 }}
      onPress={() => {
        triggerSelectionFeedback();
        goToTab('settings');
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
            transform: [{ scale: Animated.multiply(haloScale, livePulseScale) }],
          },
        ]}
      >
        {/* leading indicator: spinning ring when syncing, plain dot otherwise */}
        {isSyncing ? (
          <Animated.View
            style={[
              styles.spinner,
              {
                borderColor: `${color}40`,
                borderTopColor: color,
                transform: [{ rotate: spinDeg }],
              },
            ]}
          />
        ) : (
          <Animated.View style={[styles.dot, { backgroundColor: color }]} />
        )}
        {/* label */}
        <Text style={[styles.label, { color, fontFamily: theme.fontSemiBold }]}>
          {label}
        </Text>
        {/* trailing animated dots — only while syncing, to telegraph "work in progress" */}
        {isSyncing ? (
          <Animated.View style={styles.dotsRow}>
            <Animated.View
              style={[
                styles.miniDot,
                {
                  backgroundColor: color,
                  opacity: dotA.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
                  transform: [{ translateY: dotA.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.miniDot,
                {
                  backgroundColor: color,
                  opacity: dotB.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
                  transform: [{ translateY: dotB.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.miniDot,
                {
                  backgroundColor: color,
                  opacity: dotC.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
                  transform: [{ translateY: dotC.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }],
                },
              ]}
            />
          </Animated.View>
        ) : null}
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
  spinner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.1,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    marginLeft: 1,
  },
  miniDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
});
