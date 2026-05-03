import {
  ActivityIcon,
  resolveFeedIconKind,
} from "@/src/components/editorial/ActivityIcon";
import { EditorialTopBar } from "@/src/components/editorial/TopBar";
import { AppButton, AppInput, AppModal, Chip, Screen } from "@/src/components/ui";
import { isStoolColorNormal, stoolColorLabelKey } from "@/src/constants/i18n";
import type { AppTheme } from "@/src/constants/theme";
import { radii, spacing } from "@/src/constants/theme";
import { useI18n } from "@/src/hooks/useI18n";
import {
  triggerImpactFeedback,
  triggerSelectionFeedback,
} from "@/src/lib/feedback";
import { useAppContext } from "@/src/providers/AppProvider";
import { useAppTheme } from "@/src/providers/ThemeProvider";
import type { DiaperType, StoolColor } from "@/src/types/domain";
import { getCareOptionsWithDefaults, getVisitOptions } from "@/src/utils/careEvents";
import { formatClock, formatRelativeShort } from "@/src/utils/date";
import {
  getLastEventOfType,
  getLastFeedSide,
} from "@/src/utils/eventSummaries";
import { Icon } from "@/src/components/ui/Icon";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const STOOL_GROUPS: Array<{
  key: "normal" | "warning";
  labelKey: "tracker.stool.normal_group" | "tracker.stool.abnormal_group";
  tintKey: "success" | "warning";
  colors: StoolColor[];
}> = [
  {
    key: "warning",
    labelKey: "tracker.stool.abnormal_group",
    tintKey: "warning",
    colors: ["jaune_pale", "beige", "blanc_mastic"],
  },
  {
    key: "normal",
    labelKey: "tracker.stool.normal_group",
    tintKey: "success",
    colors: ["jaune_or", "ocre_bronze", "vert"],
  },
];

const DIAPER_ACTIONS = [
  { key: "wet", diaperType: "wet" as const, labelKey: "tracker.pee" as const },
  {
    key: "dirty",
    diaperType: "dirty" as const,
    labelKey: "tracker.poop" as const,
  },
  {
    key: "both",
    diaperType: "both" as const,
    labelKey: "tracker.both" as const,
  },
] as const;

const CARE_ACTIONS = [
  {
    key: "vitamin_d",
    value: "vitamin_d",
    labelKey: "tracker.vitamin_d" as const,
    custom: false,
  },
  {
    key: "bath",
    value: "bath",
    labelKey: "tracker.bath" as const,
    custom: false,
  },
  {
    key: "medication",
    value: "medication",
    labelKey: "tracker.medication" as const,
    custom: true,
  },
] as const;

const BUILT_IN_VISIT_ACTIONS = [
  { key: "midwife", value: "midwife", labelKey: "tracker.midwife" as const },
  {
    key: "pediatrician",
    value: "pediatrician",
    labelKey: "tracker.pediatrician" as const,
  },
  { key: "one", value: "one", labelKey: "tracker.one" as const },
] as const;

type DiaperAction = (typeof DIAPER_ACTIONS)[number];
type CareAction = (typeof CARE_ACTIONS)[number];
type ActionKind =
  | "sleep"
  | "breast"
  | "bottle"
  | "temperature"
  | "diaper"
  | "care"
  | "visit";

function getActionPalette(theme: AppTheme, kind: ActionKind, active?: boolean) {
  // Carnet d'aquarelle: tile backgrounds are watercolour washes of the
  // activity colour over the cream paper. Borders sit at slightly higher
  // opacity than backgrounds — visible but soft. Hex `+ alpha-suffix`
  // (e.g. `${color}14` ≈ 8% opacity) layers cleanly over the page.
  if (kind === "sleep") {
    return active
      ? {
          background: theme.night,
          border: "rgba(240, 230, 214, 0.10)",
          iconBackground: "rgba(255,255,255,0.10)",
          emoji: "#FFFFFF",
          label: "#FFFFFF",
          subtitle: "rgba(240, 230, 214, 0.85)",
          accentA: "rgba(255,255,255,0.08)",
          accentB: "rgba(255,255,255,0.14)",
          eyebrow: "rgba(240, 230, 214, 0.95)",
        }
      : {
          background: `${theme.sleep}14`,
          border: `${theme.sleep}33`,
          iconBackground: `${theme.sleep}1F`,
          emoji: theme.sleep,
          label: theme.text,
          subtitle: theme.textMuted,
          accentA: `${theme.sleep}10`,
          accentB: `${theme.sleep}1C`,
          eyebrow: theme.sleep,
        };
  }

  if (kind === "breast" || kind === "bottle") {
    return {
      background: `${theme.feed}14`,
      border: `${theme.feed}33`,
      iconBackground: `${theme.feed}1F`,
      emoji: theme.feed,
      label: theme.text,
      subtitle: theme.textMuted,
      accentA: `${theme.feed}10`,
      accentB: `${theme.feed}1C`,
      eyebrow: theme.feed,
    };
  }

  if (kind === "temperature") {
    return {
      background: `${theme.temperature}1A`,
      border: `${theme.temperature}38`,
      iconBackground: `${theme.temperature}24`,
      emoji: theme.temperature,
      label: theme.text,
      subtitle: theme.textMuted,
      accentA: `${theme.temperature}14`,
      accentB: `${theme.temperature}22`,
      eyebrow: theme.temperature,
    };
  }

  if (kind === "diaper") {
    return {
      background: `${theme.diaper}14`,
      border: `${theme.diaper}33`,
      iconBackground: `${theme.diaper}1F`,
      emoji: theme.diaper,
      label: theme.text,
      subtitle: theme.textMuted,
      accentA: `${theme.diaper}10`,
      accentB: `${theme.diaper}1C`,
      eyebrow: theme.diaper,
    };
  }

  if (kind === "visit") {
    return {
      background: `${theme.visit}14`,
      border: `${theme.visit}33`,
      iconBackground: `${theme.visit}1F`,
      emoji: theme.visit,
      label: theme.text,
      subtitle: theme.textMuted,
      accentA: `${theme.visit}10`,
      accentB: `${theme.visit}1C`,
      eyebrow: theme.visit,
    };
  }

  // Default fallback (care kind) — terracotta wash.
  return {
    background: `${theme.primary}14`,
    border: `${theme.primary}33`,
    iconBackground: `${theme.primary}1F`,
    emoji: theme.primary,
    label: theme.text,
    subtitle: theme.textMuted,
    accentA: `${theme.primary}10`,
    accentB: `${theme.primary}1C`,
    eyebrow: theme.primary,
  };
}

function translateStoredCareLabel(
  value: string | undefined,
  t: ReturnType<typeof useI18n>["t"],
) {
  switch (value) {
    case "vitamin_d":
    case "Vitamine D":
      return t("tracker.vitamin_d");
    case "bath":
    case "Bain":
      return t("tracker.bath");
    case "midwife":
    case "SF":
    case "Sage Femme":
      return t("tracker.midwife");
    case "pediatrician":
    case "Pédiatre":
      return t("tracker.pediatrician");
    case "one":
    case "ONE":
      return t("tracker.one");
    default:
      return value ?? t("event.action_recorded");
  }
}

function translateDiaperType(
  type: DiaperType | undefined,
  t: ReturnType<typeof useI18n>["t"],
) {
  switch (type) {
    case "wet":
      return t("tracker.pee");
    case "dirty":
      return t("tracker.poop");
    case "both":
      return t("tracker.both");
    default:
      return t("today.diaper");
  }
}

function formatFeedSubtitle(
  lastFeed: ReturnType<typeof getLastEventOfType>,
  t: ReturnType<typeof useI18n>["t"],
  language: "fr" | "en",
) {
  if (!lastFeed) return t("tracker.no_meal");
  const prefix =
    language === "fr"
      ? `Dernier repas à ${formatClock(lastFeed.startTime)}`
      : `Last feed at ${formatClock(lastFeed.startTime)}`;
  const detail =
    lastFeed.details?.feedSide === "left"
      ? t("event.feed.left")
      : lastFeed.details?.feedSide === "right"
        ? t("event.feed.right")
        : typeof lastFeed.details?.feedAmountMl === "number"
          ? t("event.feed.amount_ml", { value: lastFeed.details.feedAmountMl })
          : t("event.feed.bottle");
  return `${prefix} · ${detail}`;
}

function AnimatedActionGlyph({
  kind,
  accent,
  size = 28,
}: {
  kind: ActionKind;
  accent: string;
  size?: number;
}) {
  const motion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(motion, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(motion, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [motion]);

  const baseTransform =
    kind === "sleep"
      ? [
          {
            translateY: motion.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0, -3, 0],
            }),
          },
        ]
      : kind === "temperature"
        ? [
            {
              rotate: motion.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: ["0deg", "5deg", "0deg"],
              }),
            },
          ]
        : [
            {
              scale: motion.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 1.08, 1],
              }),
            },
          ];

  return (
    <View style={styles.actionGlyphWrap}>
      <Animated.View style={{ transform: baseTransform }}>
        <ActivityIcon kind={kind} size={size} color={accent} />
      </Animated.View>
      {kind === "sleep" ? (
        <Animated.Text
          style={[
            styles.actionGlyphZ,
            {
              color: accent,
              opacity: motion.interpolate({
                inputRange: [0, 0.2, 0.9, 1],
                outputRange: [0, 0.7, 0.2, 0],
              }),
              transform: [
                {
                  translateY: motion.interpolate({
                    inputRange: [0, 1],
                    outputRange: [3, -10],
                  }),
                },
                {
                  translateX: motion.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 4],
                  }),
                },
              ],
            },
          ]}
        >
          z
        </Animated.Text>
      ) : null}
      {kind === "breast" || kind === "bottle" ? (
        <Animated.View
          style={[
            styles.actionGlyphBubble,
            {
              backgroundColor: accent,
              opacity: motion.interpolate({
                inputRange: [0, 0.3, 1],
                outputRange: [0, 0.4, 0],
              }),
              transform: [
                {
                  translateY: motion.interpolate({
                    inputRange: [0, 1],
                    outputRange: [4, -8],
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}
      {kind === "care" ? (
        <Animated.View
          style={[
            styles.actionGlyphSpark,
            {
              opacity: motion.interpolate({
                inputRange: [0, 0.4, 1],
                outputRange: [0.2, 0.8, 0.2],
              }),
              transform: [
                {
                  scale: motion.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.9, 1.12, 0.9],
                  }),
                },
              ],
            },
          ]}
        >
          <Icon name="add" size={9} color={accent} />
        </Animated.View>
      ) : null}
    </View>
  );
}

function ActionTile({
  kind,
  label,
  eyebrow,
  iconNode,
  active,
  disabled,
  variant = "regular",
  onPress,
}: {
  kind: ActionKind;
  label: string;
  eyebrow: string;
  iconNode?: ReactNode;
  active?: boolean;
  disabled?: boolean;
  variant?: "hero" | "regular";
  onPress: () => void;
}) {
  const { theme } = useAppTheme();
  const isSleepActive = active && kind === "sleep";
  const palette = getActionPalette(theme, kind, active);
  const orbPrimary = useRef(new Animated.Value(0)).current;
  const orbSecondary = useRef(new Animated.Value(0)).current;
  const orbPrimaryDuration = useRef(
    4200 + Math.round(Math.random() * 1200),
  ).current;
  const orbSecondaryDuration = useRef(
    5200 + Math.round(Math.random() * 1400),
  ).current;
  const orbPrimaryOffset = useRef(4 + Math.round(Math.random() * 5)).current;
  const orbSecondaryOffset = useRef(2 + Math.round(Math.random() * 4)).current;
  const sleepDrift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSleepActive) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(sleepDrift, {
            toValue: 1,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(sleepDrift, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    }

    const createLoop = (
      value: Animated.Value,
      duration: number,
      delay: number,
    ) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );

    const animations = [
      createLoop(orbPrimary, orbPrimaryDuration, 0),
      createLoop(orbSecondary, orbSecondaryDuration, 450),
    ];
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [
    isSleepActive,
    orbPrimary,
    orbPrimaryDuration,
    orbSecondary,
    orbSecondaryDuration,
    sleepDrift,
  ]);

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionTile,
        variant === "hero" ? styles.actionTileHero : styles.actionTileRegular,
        isSleepActive ? styles.actionTileSleepActive : null,
        {
          backgroundColor: palette.background,
          shadowColor: theme.shadow,
          borderColor: palette.border,
          opacity: disabled ? 0.6 : 1,
        },
        active ? styles.actionTileActive : null,
        pressed ? { transform: [{ scale: 0.98 }] } : null,
      ]}
    >
      {!isSleepActive ? (
        <>
          <Animated.View
            style={[
              styles.actionAccentBubblePrimary,
              {
                backgroundColor: palette.accentA,
                opacity: orbPrimary.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.32, 0.22, 0.28],
                }),
                transform: [
                  {
                    translateY: orbPrimary.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 5],
                    }),
                  },
                  {
                    translateX: orbPrimary.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -orbPrimaryOffset],
                    }),
                  },
                  {
                    scaleX: orbPrimary.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [1, 1.08, 1.01],
                    }),
                  },
                  {
                    scaleY: orbPrimary.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [1.01, 0.96, 1.04],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.actionAccentBubbleSecondary,
              {
                backgroundColor: palette.accentB,
                opacity: orbSecondary.interpolate({
                  inputRange: [0, 0.45, 1],
                  outputRange: [0.28, 0.18, 0.24],
                }),
                transform: [
                  {
                    translateY: orbSecondary.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -4],
                    }),
                  },
                  {
                    translateX: orbSecondary.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, orbSecondaryOffset],
                    }),
                  },
                  {
                    scaleX: orbSecondary.interpolate({
                      inputRange: [0, 0.55, 1],
                      outputRange: [1, 0.96, 1.03],
                    }),
                  },
                  {
                    scaleY: orbSecondary.interpolate({
                      inputRange: [0, 0.55, 1],
                      outputRange: [1, 1.06, 0.98],
                    }),
                  },
                ],
              },
            ]}
          />
        </>
      ) : (
        <>
          <Icon
            name="moon"
            size={90}
            color="rgba(248, 238, 241, 0.08)"
            style={styles.actionTileMoon}
          />
          <Animated.Text
            style={[
              styles.actionTileSleepZ,
              {
                color: "#F0E6D6",
                opacity: sleepDrift.interpolate({
                  inputRange: [0, 0.2, 0.95, 1],
                  outputRange: [0, 0.7, 0.24, 0],
                }),
                transform: [
                  {
                    translateY: sleepDrift.interpolate({
                      inputRange: [0, 1],
                      outputRange: [2, -10],
                    }),
                  },
                  {
                    translateX: sleepDrift.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 5],
                    }),
                  },
                ],
              },
            ]}
          >
            z
          </Animated.Text>
        </>
      )}
      <View
        style={[
          styles.actionIconWrap,
          variant === "hero" ? styles.actionIconWrapHero : null,
          {
            backgroundColor: isSleepActive
              ? "rgba(255,255,255,0.08)"
              : palette.iconBackground,
          },
        ]}
      >
        {iconNode}
      </View>
      <View
        style={[
          styles.actionTextWrap,
          variant === "hero" ? styles.actionTextWrapHero : null,
        ]}
      >
        <Text
          style={[
            styles.actionEyebrow,
            { color: palette.eyebrow, fontFamily: theme.fontBold },
          ]}
        >
          {eyebrow}
        </Text>
        <Text
          style={[
            styles.actionLabel,
            variant === "hero" ? styles.actionLabelHero : null,
            { color: palette.label, fontFamily: theme.fontSemiBold },
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function QuickTile({
  kind,
  label,
  lastLabel,
  accent,
  pulsing,
  active,
  confirmation,
  onLongPress,
  children,
}: {
  kind: ActionKind;
  label: string;
  /** "Dernier · il y a 1h", or fallback "—" */
  lastLabel: string;
  accent: string;
  pulsing?: boolean;
  active?: boolean;
  /** When set, replaces lastLabel for ~2.5s with a mint check confirmation */
  confirmation?: string | null;
  onLongPress?: () => void;
  children: ReactNode;
}) {
  const { theme } = useAppTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!pulsing) return;
    pulse.setValue(0);
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 240, useNativeDriver: false, easing: Easing.out(Easing.quad) }),
      Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
    ]).start();
  }, [pulsing, pulse]);

  const baseBg = active ? theme.night : theme.surfaceLowest;
  const pulseColor = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [baseBg, theme.mintSoft],
  });

  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.55],
  });

  const labelColor = active ? "#FFFFFF" : theme.text;
  const lastColor = active ? "rgba(255,255,255,0.55)" : theme.textSoft;
  const dotsColor = active ? "rgba(255,255,255,0.4)" : theme.textSoft;
  const dividerColor = active ? "rgba(255,255,255,0.12)" : theme.hairline;

  const showingConfirmation = Boolean(confirmation);

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={350}
      style={styles.quickTileWrap}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.quickTileGlow,
          { backgroundColor: theme.mint, opacity: glowOpacity },
        ]}
      />
      <Animated.View
        style={[
          styles.quickTile,
          {
            backgroundColor: pulsing ? pulseColor : baseBg,
            borderColor: active ? "rgba(255,255,255,0.10)" : theme.cardBorder,
            shadowColor: active ? "#000" : theme.shadow,
          },
        ]}
      >
        {/* Subtle accent wash spanning the whole tile (top stronger, fades to bottom) */}
        <View
          pointerEvents="none"
          style={[styles.quickTileAccentWash, { backgroundColor: `${accent}14` }]}
        />

        {/* Glass — top highlight gradient + bottom shade */}
        <LinearGradient
          pointerEvents="none"
          colors={
            active
              ? ["rgba(255,255,255,0.22)", "rgba(255,255,255,0.04)", "rgba(0,0,0,0.18)"]
              : ["rgba(255,255,255,0.50)", "rgba(255,255,255,0.10)", "rgba(0,0,0,0.04)"]
          }
          locations={[0, 0.45, 1]}
          style={styles.quickTileGlass}
        />
        <View pointerEvents="none" style={[styles.quickTileTopHairline, { backgroundColor: active ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.85)" }]} />

        {/* Top row — icon bubble + ⋯ */}
        <View style={styles.quickTileTop}>
          <View style={[styles.quickTileIconBubble, { backgroundColor: `${accent}26` }]}>
            <ActivityIcon kind={kind} size={24} color={active ? "#FFFFFF" : accent} />
          </View>
          {onLongPress ? (
            <View style={styles.quickTileDots}>
              <Icon name="ellipsis-horizontal" size={14} color={dotsColor} />
            </View>
          ) : null}
        </View>

        {/* Hero typography — label is THE design element */}
        <View style={styles.quickTileType}>
          <Text
            numberOfLines={1}
            style={[styles.quickTileLabel, { color: labelColor, fontFamily: theme.fontDisplayItalic }]}
          >
            {label}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.quickTileLast,
              {
                color: showingConfirmation ? theme.mint : lastColor,
                fontFamily: theme.fontMedium,
              },
            ]}
          >
            {showingConfirmation ? `✓ ${confirmation}` : lastLabel}
          </Text>
        </View>

        {/* Divider */}
        <View style={[styles.quickTileDivider, { backgroundColor: dividerColor }]} />

        {/* Chips footer */}
        <View style={styles.quickTileFooter}>{children}</View>
      </Animated.View>
    </Pressable>
  );
}

function QuickChip({
  children,
  accent,
  tone = "tinted",
  disabled,
  marked,
  onPress,
}: {
  children: ReactNode;
  accent: string;
  tone?: "tinted" | "danger" | "ghost";
  disabled?: boolean;
  /** Marks this chip as the "last used" — shows a small dot indicator */
  marked?: boolean;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();
  const bg =
    tone === "danger"
      ? theme.danger
      : tone === "ghost"
        ? "transparent"
        : marked
          ? `${accent}33`
          : `${accent}1F`;
  const fg =
    tone === "danger"
      ? theme.onPrimary
      : tone === "ghost"
        ? theme.textSoft
        : accent;
  const borderColor = tone === "ghost"
    ? theme.hairline
    : marked
      ? accent
      : "transparent";

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        onPress();
      }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.quickChip,
        { backgroundColor: bg, borderColor, opacity: disabled ? 0.45 : 1 },
        pressed && !disabled ? { transform: [{ scale: 0.92 }] } : null,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[styles.quickChipLabel, { color: fg, fontFamily: theme.fontSemiBold }]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

function QuickIconChip({
  icon,
  accent,
  disabled,
  onPress,
}: {
  icon: string;
  accent: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        onPress();
      }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.quickIconChip,
        { backgroundColor: `${accent}1F`, opacity: disabled ? 0.45 : 1 },
        pressed && !disabled ? { transform: [{ scale: 0.92 }] } : null,
      ]}
    >
      <Icon name={icon} size={15} color={accent} />
    </Pressable>
  );
}

function FeedChoiceCard({
  label,
  helper,
  tint,
  disabled,
  selected,
  onPress,
}: {
  label: string;
  helper?: string | null;
  tint: string;
  disabled?: boolean;
  selected?: boolean;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.feedChoice,
        {
          backgroundColor: selected ? `${tint}28` : `${tint}12`,
          borderColor: selected ? `${tint}80` : `${tint}35`,
          opacity: disabled ? 0.55 : 1,
        },
        pressed ? { transform: [{ scale: 0.985 }] } : null,
      ]}
    >
      <Text
        style={[
          styles.feedChoiceLabel,
          { color: theme.text, fontFamily: theme.fontSemiBold },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.feedChoiceHelper,
          {
            color: helper ? tint : "transparent",
            fontFamily: theme.fontMedium,
          },
        ]}
      >
        {helper ?? " "}
      </Text>
    </Pressable>
  );
}

export function TrackerScreen() {
  const { theme } = useAppTheme();
  const { t, language } = useI18n();
  const {
    events,
    activeSession,
    saving,
    recordFeed,
    recordDiaper,
    recordMedication,
    recordTemperature,
    triggerSleep,
    stopSleep,
    feedingMode,
    currentFamily,
    isViewer,
  } = useAppContext();
  const [feedModalVisible, setFeedModalVisible] = useState(false);
  const [breastSide, setBreastSide] = useState<'left' | 'right' | null>(null);
  const [breastSupplement, setBreastSupplement] = useState('');
  const [diaperModalVisible, setDiaperModalVisible] = useState(false);
  const [careModalVisible, setCareModalVisible] = useState(false);
  const [visitModalVisible, setVisitModalVisible] = useState(false);
  const [temperatureValue, setTemperatureValue] = useState("");
  const [temperatureModalVisible, setTemperatureModalVisible] = useState(false);
  const [bottleAmount, setBottleAmount] = useState("");
  const [selectedDiaperAction, setSelectedDiaperAction] = useState<
    DiaperAction["key"] | null
  >(null);
  const [selectedCareAction, setSelectedCareAction] = useState<
    CareAction["key"] | null
  >(null);
  const [selectedVisitAction, setSelectedVisitAction] = useState<string | null>(
    null,
  );
  const [careNote, setCareNote] = useState("");
  const [visitNote, setVisitNote] = useState("");
  const [customCareName, setCustomCareName] = useState("");
  const [selectedSavedCareType, setSelectedSavedCareType] = useState<string | null>(null);
  const [stoolColor, setStoolColor] = useState<StoolColor | null>(null);
  // Inline tile state
  const [inlineTemp, setInlineTemp] = useState(36.7);
  const [pulseKind, setPulseKind] = useState<ActionKind | null>(null);
  const [confirmation, setConfirmation] = useState<{ kind: ActionKind; message: string } | null>(null);
  const triggerPulse = (kind: ActionKind, message: string) => {
    setPulseKind(kind);
    setConfirmation({ kind, message });
    setTimeout(() => setPulseKind(null), 1200);
    setTimeout(() => setConfirmation(null), 2800);
  };

  const lastFeed = getLastEventOfType(events, "feed");
  const lastFeedSide = getLastFeedSide(events);
  const lastSleep = getLastEventOfType(events, "sleep");
  const lastDiaper = getLastEventOfType(events, "diaper");
  const lastTemperature = getLastEventOfType(events, "temperature");
  const lastCare = useMemo(
    () =>
      [...events]
        .filter(
          (e) =>
            e.type === "medication" && e.details?.careCategory !== "visit",
        )
        .sort((a, b) => b.startTime - a.startTime)[0] ?? null,
    [events],
  );
  const lastVisit = useMemo(
    () =>
      [...events]
        .filter(
          (e) =>
            e.type === "medication" && e.details?.careCategory === "visit",
        )
        .sort((a, b) => b.startTime - a.startTime)[0] ?? null,
    [events],
  );

  const relativeOrDash = (event: typeof lastFeed) =>
    event ? formatRelativeShort(event.startTime, language).toLowerCase() : "—";

  const lastLabelFor = (event: typeof lastFeed, fallback?: string) => {
    if (!event) return fallback ?? (language === "fr" ? "—" : "—");
    const rel = formatRelativeShort(event.startTime, language).toLowerCase();
    return language === "fr" ? `Dernier · ${rel}` : `Last · ${rel}`;
  };


  const selectedDiaper =
    DIAPER_ACTIONS.find((action) => action.key === selectedDiaperAction) ??
    null;
  const selectedCare =
    CARE_ACTIONS.find((action) => action.key === selectedCareAction) ?? null;
  const stoolColorRequired =
    selectedDiaper?.diaperType === "dirty" ||
    selectedDiaper?.diaperType === "both";
  const canSaveDiaper = Boolean(
    selectedDiaper && (!stoolColorRequired || stoolColor),
  );
  const canSaveCare = Boolean(
    selectedSavedCareType ||
      (selectedCare && (!selectedCare.custom || customCareName.trim())),
  );
  const canSaveVisit = Boolean(selectedVisitAction);
  const stoolAssessmentNormal = stoolColor
    ? isStoolColorNormal(stoolColor)
    : null;
  const visitOptions = useMemo(
    () =>
      getVisitOptions(currentFamily).map((value) => {
        const builtIn = BUILT_IN_VISIT_ACTIONS.find(
          (item) => item.value === value,
        );
        return {
          value,
          label: builtIn ? t(builtIn.labelKey) : value,
        };
      }),
    [currentFamily, t],
  );

  const resetDiaper = () => {
    setSelectedDiaperAction(null);
    setStoolColor(null);
    setCareNote("");
  };

  const resetCare = () => {
    setSelectedCareAction(null);
    setCareNote("");
    setCustomCareName("");
    setSelectedSavedCareType(null);
  };

  const careTypesEffective = useMemo(
    () => getCareOptionsWithDefaults(currentFamily ?? null, language),
    [currentFamily, language],
  );

  const resetVisit = () => {
    setSelectedVisitAction(null);
    setVisitNote("");
  };

  useFocusEffect(
    useCallback(() => {
      setFeedModalVisible(false);
      setDiaperModalVisible(false);
      setCareModalVisible(false);
      setVisitModalVisible(false);
      setTemperatureModalVisible(false);
      setTemperatureValue("");
      setBottleAmount("");
      resetDiaper();
      resetCare();
      resetVisit();
    }, []),
  );

  const handleSleepPress = async () => {
    if (saving) return;
    triggerImpactFeedback();
    if (activeSession) {
      await stopSleep();
      return;
    }
    await triggerSleep();
  };

  const handleTemperatureSave = async () => {
    const numericValue = Number.parseFloat(temperatureValue.replace(",", "."));
    if (!Number.isFinite(numericValue)) return;
    triggerImpactFeedback();
    await recordTemperature(numericValue);
    setTemperatureValue("");
    setTemperatureModalVisible(false);
  };

  const resetFeedModal = () => {
    setBreastSide(null);
    setBreastSupplement('');
    setBottleAmount('');
    setFeedModalVisible(false);
  };

  const handleFeedRecord = async (
    feedSide: "left" | "right" | "bottle",
    amountMl?: number,
    supplement?: number,
  ) => {
    triggerImpactFeedback();
    await recordFeed(feedSide, amountMl, supplement);
    resetFeedModal();
  };

  const handleBottleSave = async () => {
    const numericValue = Number.parseInt(bottleAmount.trim(), 10);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return;
    await handleFeedRecord("bottle", numericValue);
  };

  const handleBreastSave = async () => {
    if (!breastSide) return;
    const supplement = breastSupplement.trim()
      ? Number.parseInt(breastSupplement.trim(), 10)
      : undefined;
    await handleFeedRecord(breastSide, undefined, Number.isFinite(supplement ?? NaN) ? supplement : undefined);
  };

  const handleDiaperSave = async () => {
    if (!selectedDiaper) return;
    triggerImpactFeedback();

    await recordDiaper({
      diaperType: selectedDiaper.diaperType,
      stoolColor: stoolColorRequired ? (stoolColor ?? undefined) : undefined,
      notes: careNote.trim() || undefined,
    });

    resetDiaper();
    setDiaperModalVisible(false);
  };

  const handleCareSave = async () => {
    triggerImpactFeedback();

    const medicationName = selectedSavedCareType
      ? selectedSavedCareType
      : selectedCare?.custom
        ? customCareName.trim()
        : selectedCare?.value ?? "";
    if (!medicationName) return;

    await recordMedication({
      medicationName,
      careCategory: "care",
      notes: careNote.trim() || undefined,
    });

    resetCare();
    setCareModalVisible(false);
  };

  const handleVisitSave = async () => {
    if (!selectedVisitAction) return;
    triggerImpactFeedback();

    await recordMedication({
      medicationName: selectedVisitAction,
      careCategory: "visit",
      notes: visitNote.trim() || undefined,
    });

    resetVisit();
    setVisitModalVisible(false);
  };

  return (
    <Screen>
      <EditorialTopBar />

      {isViewer ? (
        <View style={[styles.viewerBanner, { backgroundColor: `${theme.warning}15`, borderColor: `${theme.warning}30` }]}>
          <Icon name="eye-outline" size={16} color={theme.warning} />
          <Text style={[styles.viewerBannerText, { color: theme.warning, fontFamily: theme.fontMedium }]}>
            {language === 'fr'
              ? 'Mode lecture seule — vous pouvez consulter mais pas enregistrer.'
              : 'Read-only mode — you can view but not record.'}
          </Text>
        </View>
      ) : null}

      {/* Hint global pour le long-press */}
      <Text style={[styles.gridHint, { color: theme.textSoft, fontFamily: theme.fontMedium }]}>
        <Icon name="ellipsis-horizontal" size={11} color={theme.textSoft} />
        {"  "}
        {language === "fr"
          ? "Maintenir une tuile pour les options avancées"
          : "Hold a tile for advanced options"}
      </Text>

      <View style={styles.quickGrid}>
        {/* ── Sleep ── */}
        <QuickTile
          kind="sleep"
          label={t("tracker.sleep")}
          lastLabel={
            activeSession
              ? language === "fr" ? "En cours" : "In progress"
              : lastLabelFor(lastSleep)
          }
          accent={theme.sleep}
          active={Boolean(activeSession)}
          pulsing={pulseKind === "sleep"}
          confirmation={confirmation?.kind === "sleep" ? confirmation.message : null}
        >
          <QuickChip
            accent={activeSession ? "#FFFFFF" : theme.sleep}
            tone={activeSession ? "danger" : "tinted"}
            disabled={saving || isViewer}
            onPress={() => {
              void handleSleepPress();
              triggerPulse(
                "sleep",
                activeSession
                  ? language === "fr" ? "Arrêté" : "Stopped"
                  : language === "fr" ? "Démarré" : "Started",
              );
            }}
          >
            {activeSession
              ? language === "fr" ? "Arrêter" : "Stop"
              : language === "fr" ? "Démarrer" : "Start"}
          </QuickChip>
        </QuickTile>

        {/* ── Feed ── */}
        <QuickTile
          kind={resolveFeedIconKind(undefined, feedingMode)}
          label={t("tracker.feed")}
          lastLabel={
            lastFeedSide === "left"
              ? lastFeed
                ? `${lastLabelFor(lastFeed)} · G`
                : lastLabelFor(lastFeed)
              : lastFeedSide === "right"
                ? lastFeed
                  ? `${lastLabelFor(lastFeed)} · D`
                  : lastLabelFor(lastFeed)
                : lastLabelFor(lastFeed)
          }
          accent={theme.feed}
          pulsing={pulseKind === "breast" || pulseKind === "bottle"}
          confirmation={
            confirmation?.kind === "breast" || confirmation?.kind === "bottle"
              ? confirmation.message
              : null
          }
          onLongPress={() => {
            triggerSelectionFeedback();
            setFeedModalVisible(true);
          }}
        >
          {feedingMode !== "bottle" ? (
            <>
              <QuickChip
                accent={theme.feed}
                marked={lastFeedSide === "left"}
                disabled={saving || isViewer}
                onPress={() => {
                  triggerImpactFeedback();
                  void recordFeed("left");
                  triggerPulse("breast", language === "fr" ? "Sein G enregistré" : "Left recorded");
                }}
              >
                G
              </QuickChip>
              <QuickChip
                accent={theme.feed}
                marked={lastFeedSide === "right"}
                disabled={saving || isViewer}
                onPress={() => {
                  triggerImpactFeedback();
                  void recordFeed("right");
                  triggerPulse("breast", language === "fr" ? "Sein D enregistré" : "Right recorded");
                }}
              >
                D
              </QuickChip>
            </>
          ) : null}
          <QuickChip
            accent={theme.feed}
            disabled={saving || isViewer}
            onPress={() => {
              triggerSelectionFeedback();
              setFeedModalVisible(true);
            }}
          >
            {language === "fr" ? "Bib." : "Btl"}
          </QuickChip>
        </QuickTile>

        {/* ── Diaper ── */}
        <QuickTile
          kind="diaper"
          label={t("tracker.diaper")}
          lastLabel={lastLabelFor(lastDiaper)}
          accent={theme.diaper}
          pulsing={pulseKind === "diaper"}
          confirmation={confirmation?.kind === "diaper" ? confirmation.message : null}
          onLongPress={() => {
            triggerSelectionFeedback();
            setDiaperModalVisible(true);
          }}
        >
          <QuickChip
            accent={theme.diaper}
            disabled={saving || isViewer}
            onPress={() => {
              triggerImpactFeedback();
              void recordDiaper({ diaperType: "wet" });
              triggerPulse("diaper", language === "fr" ? "Pipi enregistré" : "Pee recorded");
            }}
          >
            {t("tracker.pee")}
          </QuickChip>
          <QuickChip
            accent={theme.diaper}
            disabled={saving || isViewer}
            onPress={() => {
              triggerImpactFeedback();
              void recordDiaper({ diaperType: "dirty" });
              triggerPulse("diaper", language === "fr" ? "Caca enregistré" : "Poop recorded");
            }}
          >
            {t("tracker.poop")}
          </QuickChip>
          <QuickChip
            accent={theme.diaper}
            disabled={saving || isViewer}
            onPress={() => {
              triggerImpactFeedback();
              void recordDiaper({ diaperType: "both" });
              triggerPulse("diaper", language === "fr" ? "Les 2 enregistrés" : "Both recorded");
            }}
          >
            2
          </QuickChip>
        </QuickTile>

        {/* ── Temperature ── */}
        <QuickTile
          kind="temperature"
          label={t("tracker.temperature")}
          lastLabel={lastLabelFor(lastTemperature)}
          accent={theme.temperature}
          pulsing={pulseKind === "temperature"}
          confirmation={confirmation?.kind === "temperature" ? confirmation.message : null}
          onLongPress={() => {
            triggerSelectionFeedback();
            setTemperatureModalVisible(true);
          }}
        >
          <QuickIconChip
            icon="remove-circle-outline"
            accent={theme.temperature}
            disabled={saving || isViewer}
            onPress={() => setInlineTemp((v) => Math.max(34, Math.round((v - 0.1) * 10) / 10))}
          />
          <View style={styles.tempValueWrap}>
            <Text style={[styles.tempValue, { color: theme.text, fontFamily: theme.fontDisplayItalic }]}>
              {inlineTemp.toFixed(1)}°
            </Text>
          </View>
          <QuickIconChip
            icon="add-circle-outline"
            accent={theme.temperature}
            disabled={saving || isViewer}
            onPress={() => setInlineTemp((v) => Math.min(42, Math.round((v + 0.1) * 10) / 10))}
          />
          <QuickIconChip
            icon="checkmark-circle"
            accent={theme.temperature}
            disabled={saving || isViewer}
            onPress={() => {
              triggerImpactFeedback();
              void recordTemperature(inlineTemp);
              triggerPulse(
                "temperature",
                language === "fr" ? `${inlineTemp.toFixed(1)}° enregistré` : `${inlineTemp.toFixed(1)}° saved`,
              );
            }}
          />
        </QuickTile>

        {/* ── Care ── */}
        <QuickTile
          kind="care"
          label={t("tracker.care")}
          lastLabel={lastLabelFor(lastCare)}
          accent={theme.primary}
          pulsing={pulseKind === "care"}
          confirmation={confirmation?.kind === "care" ? confirmation.message : null}
          onLongPress={() => {
            triggerSelectionFeedback();
            setCareModalVisible(true);
          }}
        >
          {careTypesEffective.slice(0, 2).map((careName) => (
            <QuickChip
              key={careName}
              accent={theme.primary}
              disabled={saving || isViewer}
              onPress={() => {
                triggerImpactFeedback();
                void recordMedication({ medicationName: careName, careCategory: "care" });
                triggerPulse(
                  "care",
                  language === "fr" ? `${careName} enregistré` : `${careName} saved`,
                );
              }}
            >
              {careName}
            </QuickChip>
          ))}
          <QuickChip
            accent={theme.primary}
            tone="ghost"
            disabled={saving || isViewer}
            onPress={() => {
              triggerSelectionFeedback();
              setCareModalVisible(true);
            }}
          >
            +
          </QuickChip>
        </QuickTile>

        {/* ── Visit ── */}
        <QuickTile
          kind="visit"
          label={t("tracker.visits")}
          lastLabel={lastLabelFor(lastVisit)}
          accent={theme.visit}
          pulsing={pulseKind === "visit"}
          confirmation={confirmation?.kind === "visit" ? confirmation.message : null}
          onLongPress={() => {
            triggerSelectionFeedback();
            setVisitModalVisible(true);
          }}
        >
          {BUILT_IN_VISIT_ACTIONS.slice(0, 2).map((action) => (
            <QuickChip
              key={action.key}
              accent={theme.visit}
              disabled={saving || isViewer}
              onPress={() => {
                triggerImpactFeedback();
                void recordMedication({ medicationName: action.value, careCategory: "visit" });
                const visitMsg =
                  action.value === "midwife"
                    ? language === "fr" ? "Sage-femme enregistrée" : "Midwife saved"
                    : language === "fr" ? "Pédiatre enregistré" : "Pediatrician saved";
                triggerPulse("visit", visitMsg);
              }}
            >
              {action.value === "midwife"
                ? language === "fr" ? "S-femme" : "Midwife"
                : action.value === "pediatrician"
                  ? language === "fr" ? "Pédiatre" : "Pedi."
                  : t(action.labelKey)}
            </QuickChip>
          ))}
          <QuickChip
            accent={theme.visit}
            tone="ghost"
            disabled={saving || isViewer}
            onPress={() => {
              triggerSelectionFeedback();
              setVisitModalVisible(true);
            }}
          >
            +
          </QuickChip>
        </QuickTile>
      </View>

      <AppModal visible={feedModalVisible} onClose={resetFeedModal}>
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.surfaceLowest,
                shadowColor: theme.shadow,
              },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text
              style={[
                styles.detailTitle,
                { color: theme.text, fontFamily: theme.fontSemiBold },
              ]}
            >
              {t("tracker.feed")}
            </Text>
            <Text
              style={[
                styles.detailBody,
                { color: theme.textMuted, fontFamily: theme.fontRegular },
              ]}
            >
              {t(
                feedingMode === "bottle"
                  ? "tracker.feed_prompt_bottle"
                  : feedingMode === "mixed"
                    ? "tracker.feed_prompt_mixed"
                    : "tracker.feed_prompt_breastfeeding",
              )}
            </Text>
            {lastFeed ? (
              <Text
                style={[
                  styles.detailMeta,
                  { color: theme.textSoft, fontFamily: theme.fontMedium },
                ]}
              >
                {formatFeedSubtitle(lastFeed, t, language)}
              </Text>
            ) : null}

            {/* ── Sein gauche / droit ── */}
            {feedingMode !== "bottle" ? (
              <View style={styles.feedButtonsRow}>
                <FeedChoiceCard
                  label={t("event.feed.left")}
                  helper={lastFeedSide === "left" ? t("tracker.last_side") : null}
                  tint={theme.feed}
                  disabled={saving}
                  selected={breastSide === 'left'}
                  onPress={() => {
                    if (feedingMode === 'breastfeeding') {
                      // Mode allaitement pur : enregistrement immédiat
                      void handleFeedRecord("left");
                    } else {
                      // Mode mixte : sélection pour confirm
                      setBreastSide((s) => s === 'left' ? null : 'left');
                      setBreastSupplement('');
                    }
                  }}
                />
                <FeedChoiceCard
                  label={t("event.feed.right")}
                  helper={lastFeedSide === "right" ? t("tracker.last_side") : null}
                  tint={theme.feed}
                  disabled={saving}
                  selected={breastSide === 'right'}
                  onPress={() => {
                    if (feedingMode === 'breastfeeding') {
                      void handleFeedRecord("right");
                    } else {
                      setBreastSide((s) => s === 'right' ? null : 'right');
                      setBreastSupplement('');
                    }
                  }}
                />
              </View>
            ) : null}

            {/* ── Complément biberon (mode mixte, sein sélectionné) ── */}
            {feedingMode === 'mixed' && breastSide ? (
              <AppInput
                label={language === 'fr' ? 'Complément biberon (ml, optionnel)' : 'Bottle supplement (ml, optional)'}
                value={breastSupplement}
                onChangeText={setBreastSupplement}
                placeholder="60"
                keyboardType="number-pad"
              />
            ) : null}

            {/* ── Séparateur visuel en mode mixte si sein + biberon ── */}
            {feedingMode === 'mixed' && breastSide === null ? (
              <Text style={[styles.orSeparator, { color: theme.textSoft, fontFamily: theme.fontMedium }]}>
                {language === 'fr' ? '— ou biberon seul —' : '— or bottle only —'}
              </Text>
            ) : null}

            {/* ── Biberon ── */}
            {feedingMode !== "breastfeeding" && breastSide === null ? (
              <AppInput
                label={t("tracker.amount_ml")}
                value={bottleAmount}
                onChangeText={setBottleAmount}
                placeholder="120"
                keyboardType="number-pad"
              />
            ) : null}

            <View style={styles.modalActions}>
              <AppButton
                style={styles.modalButton}
                variant="secondary"
                onPress={resetFeedModal}
              >
                {t("common.cancel")}
              </AppButton>
              {feedingMode === 'mixed' && breastSide ? (
                <AppButton
                  style={styles.modalButton}
                  disabled={saving}
                  onPress={() => void handleBreastSave()}
                >
                  {t("common.save")}
                </AppButton>
              ) : feedingMode !== "breastfeeding" ? (
                <AppButton
                  style={styles.modalButton}
                  disabled={saving || !bottleAmount.trim()}
                  onPress={() => void handleBottleSave()}
                >
                  {t("common.save")}
                </AppButton>
              ) : null}
            </View>
          </Pressable>
      </AppModal>

      <AppModal visible={diaperModalVisible} onClose={() => setDiaperModalVisible(false)}>
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.surfaceLowest,
                shadowColor: theme.shadow,
              },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text
              style={[
                styles.detailTitle,
                { color: theme.text, fontFamily: theme.fontSemiBold },
              ]}
            >
              {t("tracker.diaper")}
            </Text>
            <View style={styles.trackerChipsRow}>
              {DIAPER_ACTIONS.map((action) => (
                <Chip
                  key={action.key}
                  label={t(action.labelKey)}
                  selected={selectedDiaperAction === action.key}
                  tone="success"
                  onPress={() => {
                    setSelectedDiaperAction(action.key);
                    if (
                      action.diaperType !== "dirty" &&
                      action.diaperType !== "both"
                    ) {
                      setStoolColor(null);
                    }
                  }}
                />
              ))}
            </View>

            {stoolColorRequired ? (
              <View style={styles.stoolSection}>
                <Text
                  style={[
                    styles.stoolTitle,
                    { color: theme.text, fontFamily: theme.fontSemiBold },
                  ]}
                >
                  {t("tracker.stool_color")}
                </Text>
                {STOOL_GROUPS.map((group) => {
                  const tint =
                    group.tintKey === "success" ? theme.success : theme.warning;

                  return (
                    <View key={group.key} style={styles.stoolGroup}>
                      <Text
                        style={[
                          styles.stoolGroupTitle,
                          { color: tint, fontFamily: theme.fontBold },
                        ]}
                      >
                        {t(group.labelKey)}
                      </Text>
                      <View style={styles.stoolChips}>
                        {group.colors.map((color) => {
                          const selected = stoolColor === color;
                          return (
                            <Pressable
                              key={color}
                              onPress={() => {
                                triggerSelectionFeedback();
                                setStoolColor(color);
                              }}
                              style={[
                                styles.stoolChip,
                                {
                                  backgroundColor: selected
                                    ? `${tint}16`
                                    : theme.surfaceRaised,
                                  borderColor: selected
                                    ? `${tint}4A`
                                    : "transparent",
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.stoolChipText,
                                  {
                                    color: theme.text,
                                    fontFamily: selected
                                      ? theme.fontSemiBold
                                      : theme.fontMedium,
                                  },
                                ]}
                              >
                                {t(stoolColorLabelKey(color))}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
                {stoolColor ? (
                  <Text
                    style={[
                      styles.stoolHint,
                      {
                        color: stoolAssessmentNormal
                          ? theme.success
                          : theme.warning,
                        fontFamily: theme.fontMedium,
                      },
                    ]}
                  >
                    {t(
                      stoolAssessmentNormal
                        ? "tracker.stool.normal"
                        : "tracker.stool.concerning",
                    )}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <AppInput
              label={t("common.optional_note")}
              value={careNote}
              onChangeText={setCareNote}
              placeholder={t("tracker.note_placeholder")}
            />

            <View style={styles.modalActions}>
              <AppButton
                style={styles.modalButton}
                variant="secondary"
                onPress={() => {
                  resetDiaper();
                  setDiaperModalVisible(false);
                }}
              >
                {t("common.cancel")}
              </AppButton>
              <AppButton
                style={styles.modalButton}
                disabled={saving || !canSaveDiaper}
                onPress={() => void handleDiaperSave()}
              >
                {t("common.save")}
              </AppButton>
            </View>
          </Pressable>
      </AppModal>

      <AppModal visible={careModalVisible} onClose={() => setCareModalVisible(false)}>
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.surfaceLowest,
                shadowColor: theme.shadow,
              },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text
              style={[
                styles.detailTitle,
                { color: theme.text, fontFamily: theme.fontSemiBold },
              ]}
            >
              {t("tracker.care")}
            </Text>
            <Text
              style={[
                styles.detailBody,
                { color: theme.textMuted, fontFamily: theme.fontRegular },
              ]}
            >
              {t("tracker.care_subtitle")}
            </Text>
            <View style={styles.trackerChipsRow}>
              {careTypesEffective.map((name) => {
                const selected = selectedSavedCareType === name;
                return (
                  <Pressable
                    key={name}
                    onPress={() => {
                      triggerSelectionFeedback();
                      setSelectedCareAction(null);
                      setSelectedSavedCareType(selected ? null : name);
                    }}
                    style={[
                      styles.savedCareChip,
                      {
                        backgroundColor: selected ? `${theme.primary}33` : theme.surfaceContainer,
                        borderColor: selected ? theme.primary : "transparent",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.savedCareChipLabel,
                        { color: theme.text, fontFamily: theme.fontSemiBold },
                      ]}
                    >
                      {name}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => {
                  triggerSelectionFeedback();
                  setSelectedSavedCareType(null);
                  setSelectedCareAction("medication");
                }}
                style={[
                  styles.savedCareChip,
                  {
                    backgroundColor: selectedCareAction === "medication" ? `${theme.primary}33` : "transparent",
                    borderColor: selectedCareAction === "medication" ? theme.primary : theme.hairline,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.savedCareChipLabel,
                    { color: theme.textSoft, fontFamily: theme.fontMedium },
                  ]}
                >
                  {language === "fr" ? "Autre…" : "Other…"}
                </Text>
              </Pressable>
            </View>

            <Text
              style={[
                styles.careHint,
                { color: theme.textSoft, fontFamily: theme.fontRegular },
              ]}
            >
              {language === "fr"
                ? "Gérer la liste depuis Profil → Soins personnalisés"
                : "Manage the list from Profile → Custom care"}
            </Text>

            {selectedCareAction === "medication" && !selectedSavedCareType ? (
              <AppInput
                label={t("tracker.medication")}
                value={customCareName}
                onChangeText={setCustomCareName}
                placeholder={language === "fr" ? "Doliprane" : "Paracetamol"}
              />
            ) : null}

            <AppInput
              label={t("common.optional_note")}
              value={careNote}
              onChangeText={setCareNote}
              placeholder={t("tracker.note_placeholder")}
            />

            <View style={styles.modalActions}>
              <AppButton
                style={styles.modalButton}
                variant="secondary"
                onPress={() => {
                  resetCare();
                  setCareModalVisible(false);
                }}
              >
                {t("common.cancel")}
              </AppButton>
              <AppButton
                style={styles.modalButton}
                disabled={saving || !canSaveCare}
                onPress={() => void handleCareSave()}
              >
                {t("common.save")}
              </AppButton>
            </View>
          </Pressable>
      </AppModal>

      <AppModal visible={visitModalVisible} onClose={() => setVisitModalVisible(false)}>
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.surfaceLowest,
                shadowColor: theme.shadow,
              },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text
              style={[
                styles.detailTitle,
                { color: theme.text, fontFamily: theme.fontSemiBold },
              ]}
            >
              {t("tracker.visits")}
            </Text>
            <Text
              style={[
                styles.detailBody,
                { color: theme.textMuted, fontFamily: theme.fontRegular },
              ]}
            >
              {t("tracker.visit_subtitle")}
            </Text>
            <View style={styles.trackerChipsRow}>
              {visitOptions.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={selectedVisitAction === option.value}
                  tone="neutral"
                  onPress={() => setSelectedVisitAction(option.value)}
                />
              ))}
            </View>

            <AppInput
              label={t("common.optional_note")}
              value={visitNote}
              onChangeText={setVisitNote}
              placeholder={t("tracker.note_placeholder")}
            />

            <View style={styles.modalActions}>
              <AppButton
                style={styles.modalButton}
                variant="secondary"
                onPress={() => {
                  resetVisit();
                  setVisitModalVisible(false);
                }}
              >
                {t("common.cancel")}
              </AppButton>
              <AppButton
                style={styles.modalButton}
                disabled={saving || !canSaveVisit}
                onPress={() => void handleVisitSave()}
              >
                {t("common.save")}
              </AppButton>
            </View>
          </Pressable>
      </AppModal>

      <AppModal visible={temperatureModalVisible} onClose={() => setTemperatureModalVisible(false)}>
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.surfaceLowest,
                shadowColor: theme.shadow,
              },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text
              style={[
                styles.detailTitle,
                { color: theme.text, fontFamily: theme.fontSemiBold },
              ]}
            >
              {t("tracker.temperature")}
            </Text>
            <AppInput
              label={t("tracker.new_measure")}
              value={temperatureValue}
              onChangeText={setTemperatureValue}
              placeholder="36.8"
              keyboardType="decimal-pad"
            />
            <View style={styles.modalActions}>
              <AppButton
                style={styles.modalButton}
                variant="secondary"
                onPress={() => setTemperatureModalVisible(false)}
              >
                {t("common.cancel")}
              </AppButton>
              <AppButton
                style={styles.modalButton}
                disabled={saving || !temperatureValue}
                onPress={() => void handleTemperatureSave()}
              >
                {t("common.save")}
              </AppButton>
            </View>
          </Pressable>
      </AppModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  viewerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  viewerBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  hero: {
    gap: spacing.xs,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  gridHint: {
    fontSize: 11,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
    opacity: 0.7,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  quickTileWrap: {
    width: "47.5%",
    position: "relative",
  },
  quickTileGlow: {
    position: "absolute",
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 28,
    filter: "blur(14px)" as never,
  },
  quickTile: {
    // Slight asymmetric pinwheel — magazine-y, hint of personality
    borderTopLeftRadius: 14,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 14,
    borderWidth: 1,
    padding: spacing.sm + 4,
    minHeight: 162,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    overflow: "hidden",
    position: "relative",
  },
  quickTileAccentWash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 1,
  },
  quickTileGlass: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  quickTileTopHairline: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 28,
    height: 1,
  },
  quickTileTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quickTileIconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  quickTileDots: {
    paddingLeft: 4,
  },
  quickTileType: {
    flex: 1,
    justifyContent: "flex-end",
    paddingTop: spacing.sm,
    paddingBottom: 6,
    gap: 2,
  },
  quickTileLabel: {
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.4,
  },
  quickTileLast: {
    fontSize: 10.5,
    letterSpacing: 0.2,
  },
  quickTileDivider: {
    height: 1,
    marginBottom: 10,
    opacity: 0.6,
  },
  quickTileFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  quickChipLabel: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  quickIconChip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  tempValueWrap: {
    flex: 1,
    alignItems: "center",
  },
  tempValue: {
    fontSize: 17,
    letterSpacing: -0.4,
  },
  subSectionLabel: {
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: spacing.xs,
  },
  savedCareChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  savedCareChipLabel: {
    fontSize: 13,
    letterSpacing: 0.1,
  },
  careHint: {
    fontSize: 11,
    letterSpacing: 0.1,
    opacity: 0.85,
    marginTop: -spacing.xs,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  actionTile: {
    width: "47.5%",
    minHeight: 130,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 14,
    shadowOpacity: 0.06,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    borderWidth: 1.5,
    overflow: "hidden",
    position: "relative",
  },
  actionTileRegular: {
    flexGrow: 0,
  },
  actionTileHero: {
    width: "47.5%",
    minHeight: 130,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 14,
  },
  actionTileActive: {
    transform: [{ scale: 0.99 }],
  },
  actionTileSleepActive: {
    shadowOpacity: 0.13,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
  },
  actionIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconWrapHero: {
    width: 70,
    height: 70,
    borderRadius: 22,
  },
  actionAccentBubblePrimary: {
    position: "absolute",
    width: 42,
    height: 42,
    borderRadius: 21,
    top: 14,
    right: 14,
  },
  actionAccentBubbleSecondary: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    bottom: 20,
    right: 40,
  },
  actionTileMoon: {
    position: "absolute",
    right: -8,
    top: -8,
  },
  actionTileSleepZ: {
    position: "absolute",
    top: 22,
    right: 28,
    fontSize: 16,
    fontWeight: "700",
  },
  actionGlyphWrap: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  actionTextWrap: {
    alignItems: "center",
    gap: 4,
  },
  actionTextWrapHero: {
    alignItems: "center",
    maxWidth: "88%",
  },
  actionEyebrow: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  actionGlyphZ: {
    position: "absolute",
    top: -8,
    right: -4,
    fontSize: 10,
    fontWeight: "700",
  },
  actionGlyphBubble: {
    position: "absolute",
    width: 7,
    height: 7,
    borderRadius: 999,
    top: -3,
    right: 2,
  },
  actionGlyphSpark: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 999,
    top: -7,
    right: -6,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 19,
    textAlign: "center",
  },
  actionLabelHero: {
    fontSize: 21,
    lineHeight: 26,
    textAlign: "center",
  },
  detailCard: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
    shadowOpacity: 0.07,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
  },
  detailTitle: {
    fontSize: 20,
  },
  detailBody: {
    fontSize: 14,
    lineHeight: 22,
  },
  detailMeta: {
    fontSize: 12,
  },
  feedButtonsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  orSeparator: {
    textAlign: 'center',
    fontSize: 12,
    marginVertical: spacing.xs,
  },
  feedChoice: {
    flex: 1,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    gap: 4,
  },
  feedChoiceLabel: {
    fontSize: 15,
  },
  feedChoiceHelper: {
    fontSize: 11,
  },
  trackerChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  stoolSection: {
    gap: spacing.sm,
  },
  stoolGroup: {
    gap: spacing.xs,
  },
  stoolTitle: {
    fontSize: 15,
  },
  stoolGroupTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  stoolChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  stoolChip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1.5,
  },
  stoolChipText: {
    fontSize: 13,
  },
  stoolHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  recentSection: {
    gap: spacing.md,
  },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  recentHeading: {
    fontSize: 20,
  },
  recentLink: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  recentList: {
    gap: spacing.md,
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  recentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  recentCopy: {
    flex: 1,
    gap: 2,
  },
  recentTitle: {
    fontSize: 16,
  },
  recentBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  recentTime: {
    fontSize: 12,
    fontStyle: "italic",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(27, 28, 25, 0.22)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
    shadowOpacity: 0.16,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
});
