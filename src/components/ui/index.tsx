import { radii, spacing } from "@/src/constants/theme";
import { Wash } from "@/src/components/decor";
import { triggerSelectionFeedback } from "@/src/lib/feedback";
import { useAppTheme } from "@/src/providers/ThemeProvider";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useState, type PropsWithChildren, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
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
  onRefresh,
  topBar,
}: PropsWithChildren<{
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /**
   * Optional pull-to-refresh handler. Promise resolves when refresh is done —
   * Firestore data is already live so the handler is mostly a UX gesture; a
   * small delay (~600ms) is enough to give the user feedback.
   */
  onRefresh?: () => Promise<void> | void;
  /**
   * Optional sticky element (typically `<EditorialTopBar />`) rendered OUTSIDE
   * the ScrollView so it stays pinned at the top while the body scrolls.
   * Pass nothing if the screen doesn't need a top bar.
   */
  topBar?: ReactNode;
}>) {
  const { theme } = useAppTheme();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await Promise.all([
        Promise.resolve(onRefresh()),
        new Promise((resolve) => setTimeout(resolve, 600)),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const body = scroll ? (
    <ScrollView
      style={styles.scrollFlex}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        ) : undefined
      }
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
      {/* Watercolour atmosphere — rose, sage and ochre pigments blooming
          on the cream paper background. Outside the content flow. */}
      <Wash
        color={theme.primaryContainer}
        size={320}
        top={-120}
        right={-80}
        opacity={theme.isDark ? 0.18 : 0.32}
      />
      <Wash
        color={theme.mint}
        size={240}
        top={180}
        left={-60}
        opacity={theme.isDark ? 0.14 : 0.22}
      />
      <Wash
        color={theme.warning}
        size={200}
        bottom={-80}
        right={-40}
        opacity={theme.isDark ? 0.14 : 0.20}
      />
      <Wash
        color={theme.primaryContainer}
        size={140}
        bottom={120}
        left={-40}
        opacity={theme.isDark ? 0.12 : 0.18}
      />
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Sticky top bar — rendered above the ScrollView so it doesn't
            scroll away. Padded over the safe-area top, doesn't affect the
            scrollable body. */}
        {topBar ? <View style={styles.stickyTopBar}>{topBar}</View> : null}
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
          borderColor: theme.cardBorder,
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

export function EmptyState({
  title,
  body,
  glyph,
  ctaLabel,
  onCtaPress,
}: {
  title: string;
  body: string;
  /** Optional decorative glyph (emoji or short string). Renders giant in Fraunces italic. */
  glyph?: string;
  /** Optional CTA — renders as a primary button below the body */
  ctaLabel?: string;
  onCtaPress?: () => void;
}) {
  const { theme } = useAppTheme();
  return (
    <Card compact>
      <View style={styles.emptyInner}>
        {glyph ? (
          <Text
            style={[
              styles.emptyGlyph,
              { color: theme.primary, fontFamily: theme.fontDisplayItalic },
            ]}
          >
            {glyph}
          </Text>
        ) : null}
        <Text
          style={[
            styles.emptyTitle,
            { color: theme.text, fontFamily: theme.fontDisplayItalic },
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
        {ctaLabel && onCtaPress ? (
          <View style={styles.emptyCta}>
            <AppButton onPress={onCtaPress}>{ctaLabel}</AppButton>
          </View>
        ) : null}
      </View>
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
  stickyTopBar: {
    // No absolute positioning — flow item above the ScrollView. The
    // EditorialTopBar provides its own background blur + padding.
    zIndex: 10,
  },
  scrollFlex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl * 4,
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
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    // Warmer, more present shadow — matches the watercolour identity where
    // cards sit like loose papers on the cream notebook page.
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
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
    transform: [{ scale: 0.96 }],
    opacity: 0.92,
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
  emptyInner: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  emptyGlyph: {
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -1.4,
    marginBottom: spacing.xs,
    opacity: 0.85,
  },
  emptyTitle: {
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyCta: {
    marginTop: spacing.md,
    minWidth: 180,
  },
  divider: {
    height: 1,
  },
});
