import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useAppTheme } from '@/src/providers/ThemeProvider';
import { useI18n } from '@/src/hooks/useI18n';
import { radii, spacing } from '@/src/constants/theme';
import { type ConfirmRequest, registerDialogHandler } from '@/src/lib/dialog';

/**
 * Mount once at the root. Listens for confirmAction() calls and renders
 * a themed modal that matches the editorial style of the app.
 */
export function ConfirmDialogHost(): React.ReactElement {
  const { theme } = useAppTheme();
  const { t } = useI18n();
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    registerDialogHandler((req) => setRequest(req));
    return () => registerDialogHandler(null);
  }, []);

  const dismiss = () => setRequest(null);

  const handleCancel = () => {
    request?.onCancel?.();
    dismiss();
  };

  const handleConfirm = () => {
    const callback = request?.onConfirm;
    dismiss();
    callback?.();
  };

  const visible = request !== null;
  const confirmColor = request?.danger ? theme.danger : theme.primary;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <BlurView
        intensity={theme.isDark ? 28 : 36}
        tint={theme.isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <Pressable style={styles.backdrop} onPress={handleCancel}>
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: theme.surfaceLowest,
              borderColor: theme.cardBorder,
              shadowColor: theme.shadow,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            style={[styles.title, { color: theme.text, fontFamily: theme.fontDisplayItalic }]}
          >
            {request?.title ?? ''}
          </Text>
          <Text
            style={[styles.message, { color: theme.textMuted, fontFamily: theme.fontRegular }]}
          >
            {request?.message ?? ''}
          </Text>
          <View style={styles.actions}>
            <Pressable
              onPress={handleCancel}
              style={({ pressed }) => [
                styles.button,
                styles.buttonSecondary,
                {
                  backgroundColor: theme.surfaceContainer,
                  opacity: pressed ? 0.8 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <Text style={[styles.buttonLabel, { color: theme.textMuted, fontFamily: theme.fontMedium }]}>
                {request?.cancelLabel ?? t('common.cancel')}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: confirmColor,
                  opacity: pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <Text style={[styles.buttonLabel, { color: theme.onPrimary, fontFamily: theme.fontSemiBold }]}>
                {request?.confirmLabel ?? t('common.confirm')}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 14, 16, 0.32)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg + 4,
    paddingBottom: spacing.md,
    borderWidth: 1,
    shadowOpacity: 0.18,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 18 },
    elevation: 14,
  },
  title: {
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.4,
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: {
    // Cancel uses a subdued surface; confirm overrides bg via inline style.
  },
  buttonLabel: {
    fontSize: 15,
    letterSpacing: 0.1,
  },
});
