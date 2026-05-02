import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { radii, spacing } from '@/src/constants/theme';
import { triggerSelectionFeedback } from '@/src/lib/feedback';
import { useAppContext } from '@/src/providers/AppProvider';
import { useAppTheme } from '@/src/providers/ThemeProvider';

export function SyncErrorBanner() {
  const { syncStatus, refreshData, language } = useAppContext();
  const { theme } = useAppTheme();

  const isVisible = syncStatus === 'error' || syncStatus === 'offline';
  const [visible, setVisible] = useState(isVisible);
  const mountAnim = useRef(new Animated.Value(isVisible ? 1 : 0)).current;

  useEffect(() => {
    if (syncStatus === 'error' || syncStatus === 'offline') {
      setVisible(true);
      Animated.timing(mountAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(mountAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setVisible(false);
    });
  }, [syncStatus, mountAnim]);

  if (!visible) return null;

  const fr = language === 'fr';
  const isOffline = syncStatus === 'offline';

  const message = isOffline
    ? (fr ? 'Pas de connexion.' : 'No connection.')
    : (fr ? 'Synchronisation en erreur.' : 'Sync failed.');

  const icon = isOffline ? 'cloud-offline-outline' : 'alert-circle';
  const cta = fr ? 'Réessayer' : 'Retry';

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          backgroundColor: `${theme.warning}15`,
          borderColor: `${theme.warning}35`,
          opacity: mountAnim,
          transform: [
            {
              translateY: mountAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-8, 0],
              }),
            },
          ],
        },
      ]}
    >
      {isOffline ? (
        <Animated.View style={styles.row}>
          <Ionicons name={icon} size={16} color={theme.warning} />
          <Text style={[styles.message, { color: theme.warning, fontFamily: theme.fontMedium }]}>
            {message}
          </Text>
        </Animated.View>
      ) : (
        <Pressable
          onPress={() => {
            triggerSelectionFeedback();
            refreshData();
          }}
          accessibilityRole="button"
          accessibilityLabel={`${message} ${cta}`}
          style={styles.row}
        >
          <Ionicons name={icon} size={16} color={theme.warning} />
          <Text style={[styles.message, { color: theme.warning, fontFamily: theme.fontMedium }]}>
            {message}
          </Text>
          <Text style={[styles.cta, { color: theme.warning, fontFamily: theme.fontBold }]}>
            {cta}
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  message: {
    flex: 1,
    fontSize: 13,
  },
  cta: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
