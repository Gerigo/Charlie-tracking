import { radii, spacing } from "@/src/constants/theme";
import { triggerSelectionFeedback } from "@/src/lib/feedback";
import { useAppTheme } from "@/src/providers/ThemeProvider";
import { LinearGradient } from "expo-linear-gradient";
import type { PropsWithChildren, ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type BadgeTone =
  | "primary"
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "sleep"
  | "feed"
  | "diaper"
  | "temperature";

function useToneColor(tone: BadgeTone) {
  const { theme } = useAppTheme();

  switch (tone) {
    case "success":
      return theme.success;
    case "warning":
      return theme.warning;
    case "danger":
      return theme.danger;
    case "sleep":
      return theme.sleep;
    case "feed":
      return theme.feed;
    case "diaper":
      return theme.diaper;
    case "temperature":
      return theme.temperature;
    case "primary":
      return theme.primary;
    default:
      return theme.outline;
  }
}

export function Screen({
  children,
  scroll = true,
  contentContainerStyle,
}: PropsWithChildren<{
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
}>) {
  const { theme } = useAppTheme();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.scrollContent, contentContainerStyle]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.background }]}
      edges={["top", "left", "right"]}
    >
      <View
        style={[
          styles.backgroundOrbTop,
          { backgroundColor: theme.headerGradientA },
        ]}
      />
      <View
        style={[
          styles.backgroundOrbMiddle,
          { backgroundColor: theme.headerGradientB },
        ]}
      />
      <View
        style={[
          styles.backgroundOrbBottom,
          { backgroundColor: theme.primaryGlow },
        ]}
      />
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function AppBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: BadgeTone;
}) {
  const { theme } = useAppTheme();
  const tint = useToneColor(tone);
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor:
            tone === "neutral" ? theme.surfaceContainer : `${tint}18`,
        },
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          {
            color: tone === "neutral" ? theme.textMuted : tint,
            fontFamily: theme.fontBold,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  subtitle,
  right,
  badges,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  badges?: ReactNode;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.sectionHeaderWrap}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderText}>
          {eyebrow ? (
            <Text
              style={[
                styles.eyebrow,
                { color: theme.primary, fontFamily: theme.fontBold },
              ]}
            >
              {eyebrow}
            </Text>
          ) : null}
          <Text
            style={[
              styles.title,
              { color: theme.text, fontFamily: theme.fontLight },
            ]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[
                styles.subtitle,
                { color: theme.textMuted, fontFamily: theme.fontRegular },
              ]}
            >
              {subtitle}
            </Text>
          ) : null}
          {badges ? <View style={styles.badgesRow}>{badges}</View> : null}
        </View>
        {right ? <View style={styles.sectionHeaderRight}>{right}</View> : null}
      </View>
    </View>
  );
}

export function Card({
  children,
  accent,
  compact,
  style,
}: PropsWithChildren<{
  accent?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}>) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.card,
        compact ? styles.cardCompact : null,
        {
          backgroundColor: theme.surfaceLowest,
          shadowColor: theme.shadow,
        },
        style,
      ]}
    >
      {accent ? (
        <View style={[styles.cardAccent, { backgroundColor: accent }]} />
      ) : null}
      {children}
    </View>
  );
}

export function CardTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.cardTitleRow}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={[
            styles.cardTitle,
            { color: theme.text, fontFamily: theme.fontBold },
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[
              styles.cardSubtitle,
              { color: theme.textMuted, fontFamily: theme.fontRegular },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function AppButton({
  children,
  variant = "primary",
  disabled,
  style,
  onPress,
  ...props
}: PropsWithChildren<
  PressableProps & {
    variant?: "primary" | "secondary" | "ghost";
    style?: StyleProp<ViewStyle>;
  }
>) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      {...props}
      disabled={disabled}
      onPress={(event) => {
        if (disabled) return;
        triggerSelectionFeedback();
        onPress?.(event);
      }}
      style={({ pressed }) => [
        styles.buttonShell,
        disabled ? styles.buttonDisabled : null,
        pressed && !disabled ? styles.buttonPressed : null,
        typeof style === "function" ? null : style,
      ]}
    >
      {variant === "primary" ? (
        <LinearGradient
          colors={[theme.gradientStart, theme.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.buttonGradient}
        >
          <Text
            style={[
              styles.buttonText,
              { color: theme.onPrimary, fontFamily: theme.fontBold },
            ]}
          >
            {children}
          </Text>
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.buttonSolid,
            variant === "secondary"
              ? {
                  backgroundColor: theme.surfaceLowest,
                  borderColor: "transparent",
                }
              : { backgroundColor: "transparent", borderColor: "transparent" },
          ]}
        >
          <Text
            style={[
              styles.buttonText,
              {
                color: variant === "ghost" ? theme.primary : theme.text,
                fontFamily: theme.fontBold,
              },
            ]}
          >
            {children}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  tone = "neutral",
  onPress,
}: {
  label: string;
  selected?: boolean;
  tone?: "neutral" | "sleep" | "feed" | "success" | "warning";
  onPress?: () => void;
}) {
  const { theme } = useAppTheme();
  const tint = useToneColor(tone === "neutral" ? "primary" : tone);
  return (
    <Pressable
      onPress={() => {
        triggerSelectionFeedback();
        onPress?.();
      }}
      style={[
        styles.chip,
        {
          backgroundColor: selected
            ? tone === "neutral"
              ? theme.secondaryContainer
              : `${tint}18`
            : theme.surfaceLowest,
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          {
            color: selected ? theme.text : theme.textMuted,
            fontFamily: selected ? theme.fontSemiBold : theme.fontMedium,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function AppInput({
  label,
  helper,
  ...props
}: TextInputProps & { label: string; helper?: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.field}>
      <Text
        style={[
          styles.fieldLabel,
          { color: theme.textMuted, fontFamily: theme.fontMedium },
        ]}
      >
        {label}
      </Text>
      <TextInput
        {...props}
        placeholderTextColor={theme.textSoft}
        style={[
          styles.input,
          {
            backgroundColor: theme.surfaceContainer,
            color: theme.text,
            fontFamily: theme.fontRegular,
          },
          props.style,
        ]}
      />
      {helper ? (
        <Text
          style={[
            styles.helper,
            { color: theme.textSoft, fontFamily: theme.fontRegular },
          ]}
        >
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

export function InlineStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.inlineStat,
        {
          backgroundColor: theme.surfaceLowest,
        },
      ]}
    >
      <Text
        style={[
          styles.inlineStatValue,
          { color: theme.text, fontFamily: theme.fontBold },
        ]}
      >
        {value}
      </Text>
      <Text
        style={[
          styles.inlineStatLabel,
          { color: theme.textMuted, fontFamily: theme.fontMedium },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  const { theme } = useAppTheme();
  return (
    <Card compact>
      <Text
        style={[
          styles.emptyTitle,
          { color: theme.text, fontFamily: theme.fontBold },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.emptyBody,
          { color: theme.textMuted, fontFamily: theme.fontRegular },
        ]}
      >
        {body}
      </Text>
    </Card>
  );
}

export function Divider() {
  const { theme } = useAppTheme();
  return <View style={[styles.divider, { backgroundColor: theme.hairline }]} />;
}

/**
 * Wrapper modal avec backdrop flouté (BlurView expo-blur).
 * Remplace le pattern `<Modal><Pressable modalOverlay>` dans tous les écrans.
 */
export function AppModal({
  visible,
  onClose,
  animationType = "fade",
  children,
}: {
  visible: boolean;
  onClose: () => void;
  animationType?: "fade" | "slide" | "none";
  children: ReactNode;
}) {
  return (
    <Modal
      transparent
      animationType={animationType}
      visible={visible}
      onRequestClose={onClose}
    >
      {/* Overlay neutre foncé — indépendant du fond de l'app (pas de BlurView
          qui piocherait les dégradés roses). */}
      <Pressable style={appModalStyles.backdrop} onPress={onClose}>
        <View style={appModalStyles.backdropInner} />
      </Pressable>
      <KeyboardAvoidingView
        style={appModalStyles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        {children}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const appModalStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropInner: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
  },
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    padding: 20,
  },
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  keyboardWrap: {
    flex: 1,
  },
  backgroundOrbTop: {
    position: "absolute",
    top: -150,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  backgroundOrbMiddle: {
    position: "absolute",
    top: 240,
    left: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  backgroundOrbBottom: {
    position: "absolute",
    bottom: -140,
    right: -50,
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.lg,
  },
  sectionHeaderWrap: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  sectionHeaderText: {
    flex: 1,
    gap: spacing.xs,
  },
  sectionHeaderRight: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  badgesRow: {
    flexDirection: "row",
    gap: spacing.xs,
    flexWrap: "wrap",
    marginTop: spacing.sm,
  },
  eyebrow: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 36,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  badge: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  card: {
    position: "relative",
    overflow: "hidden",
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
    shadowOpacity: 0.08,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 16 },
  },
  cardCompact: {
    paddingVertical: spacing.lg,
  },
  cardAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  cardTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  cardTitle: {
    fontSize: 19,
  },
  cardSubtitle: {
    lineHeight: 20,
  },
  buttonShell: {
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  buttonGradient: {
    minHeight: 56,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  buttonSolid: {
    minHeight: 56,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderWidth: 0,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
  },
  buttonText: {
    fontSize: 15,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  chipText: {
    fontSize: 13,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontSize: 13,
    marginLeft: 10,
  },
  helper: {
    fontSize: 12,
    lineHeight: 17,
    marginLeft: 10,
  },
  input: {
    minHeight: 56,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontSize: 15,
  },
  inlineStat: {
    flex: 1,
    minWidth: 108,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: 4,
  },
  inlineStatValue: {
    fontSize: 20,
  },
  inlineStatLabel: {
    fontSize: 12,
  },
  emptyTitle: {
    fontSize: 18,
  },
  emptyBody: {
    lineHeight: 22,
  },
  divider: {
    height: 1,
  },
});
