import { EditorialTopBar } from "@/src/components/editorial/TopBar";
import { GrowthSpurtBanner } from "@/src/components/editorial/GrowthSpurtBanner";
import {
  AppBadge,
  AppButton,
  AppInput,
  AppModal,
  Chip,
  Screen,
} from "@/src/components/ui";
import { getActivityEmoji } from "@/src/constants/activityEmojis";
import { stoolColorLabelKey } from "@/src/constants/i18n";
import { radii, spacing } from "@/src/constants/theme";
import { useI18n } from "@/src/hooks/useI18n";
import { confirmAction } from "@/src/lib/dialog";
import { triggerSelectionFeedback } from "@/src/lib/feedback";
import { useAppContext } from "@/src/providers/AppProvider";
import { useAppTheme } from "@/src/providers/ThemeProvider";
import type {
  CareCategory,
  DiaperType,
  FeedSide,
  StoolColor,
  TrackedEvent,
} from "@/src/types/domain";
import {
  inferMedicationCategory,
  isCareEvent,
  isVisitEvent,
} from "@/src/utils/careEvents";
import {
  formatClock,
  formatDuration,
  formatRelativeShort,
} from "@/src/utils/date";
import { getDailySummary, getEventsForDay } from "@/src/utils/eventSummaries";
import { Icon } from "@/src/components/ui/Icon";
import DateTimePicker from "@/src/components/ui/PlatformDateTimePicker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { endOfDay, isSameDay, startOfDay } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type TodayVisualKind =
  | "sleep"
  | "breast"
  | "bottle"
  | "diaper"
  | "care"
  | "visit"
  | "temperature"
  | "growth";

function translateCareLabel(
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
  value: DiaperType | undefined,
  t: ReturnType<typeof useI18n>["t"],
) {
  switch (value) {
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

function feedDeltaLabel(
  todayCount: number,
  yesterdayCount: number,
  language: "fr" | "en",
  compareMode: "same-time" | "full-day",
) {
  const diff = todayCount - yesterdayCount;
  const equalLabel =
    compareMode === "same-time"
      ? language === "fr"
        ? "Comme hier à la même heure"
        : "Same as yesterday by this time"
      : language === "fr"
        ? "Comme la veille"
        : "Same as the previous day";

  if (diff === 0) {
    return equalLabel;
  }

  const suffix =
    compareMode === "same-time"
      ? language === "fr"
        ? "qu’hier à la même heure"
        : "than yesterday by this time"
      : language === "fr"
        ? "que la veille"
        : "than the previous day";

  if (diff > 0) {
    return language === "fr"
      ? `C’est ${diff} de plus ${suffix}`
      : `That’s ${diff} more ${suffix}`;
  }
  return language === "fr"
    ? `C’est ${Math.abs(diff)} de moins ${suffix}`
    : `That’s ${Math.abs(diff)} less ${suffix}`;
}

function feedCountLabel(count: number, language: "fr" | "en") {
  if (language === "fr") return `${count} repas`;
  return `${count} feed${count === 1 ? "" : "s"}`;
}

function diaperCountLabel(count: number, language: "fr" | "en") {
  if (language === "fr") return `${count} couche${count > 1 ? "s" : ""}`;
  return `${count} diaper${count === 1 ? "" : "s"}`;
}

function careCountLabel(count: number, language: "fr" | "en") {
  if (language === "fr") return `${count} soin${count > 1 ? "s" : ""}`;
  return `${count} care event${count === 1 ? "" : "s"}`;
}

function careBodyLabel(count: number, language: "fr" | "en") {
  if (count === 0)
    return language === "fr"
      ? "Aucun soin aujourd’hui"
      : "No care logged today";
  return language === "fr"
    ? `${careCountLabel(count, language)} aujourd’hui`
    : `${careCountLabel(count, language)} today`;
}

function describeCareTag(
  event: TrackedEvent,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (event.type === "medication") {
    return translateCareLabel(event.details?.medicationName, t);
  }
  return null;
}

function feedBreakdownBadges(
  events: TrackedEvent[],
  language: "fr" | "en",
): string[] {
  const leftCount = events.filter((e) => e.details?.feedSide === "left").length;
  const rightCount = events.filter(
    (e) => e.details?.feedSide === "right",
  ).length;
  const bottleCount = events.filter(
    (e) => e.details?.feedSide === "bottle",
  ).length;
  const totalMl = events.reduce((sum, e) => {
    const bottle = typeof e.details?.feedAmountMl === "number" ? e.details.feedAmountMl : 0;
    const supplement = typeof e.details?.bottleSupplement === "number" ? e.details.bottleSupplement : 0;
    return sum + bottle + supplement;
  }, 0);
  const badges: string[] = [];
  if (leftCount > 0)
    badges.push(
      language === "fr" ? `Gauche ×${leftCount}` : `Left ×${leftCount}`,
    );
  if (rightCount > 0)
    badges.push(
      language === "fr" ? `Droite ×${rightCount}` : `Right ×${rightCount}`,
    );
  if (bottleCount > 0)
    badges.push(
      language === "fr" ? `Biberon ×${bottleCount}` : `Bottle ×${bottleCount}`,
    );
  if (totalMl > 0) badges.push(`${totalMl} ml`);
  return badges;
}

function diaperDetailLabel(
  events: TrackedEvent[],
  language: "fr" | "en",
): string | undefined {
  const diapers = events.filter((e) => e.type === "diaper");
  if (diapers.length === 0) return undefined;
  const wetCount = diapers.filter(
    (e) => e.details?.diaperType === "wet" || e.details?.diaperType === "both",
  ).length;
  const dirtyCount = diapers.filter(
    (e) =>
      e.details?.diaperType === "dirty" || e.details?.diaperType === "both",
  ).length;
  if (wetCount === 0 && dirtyCount === 0) return undefined;
  const parts: string[] = [];
  if (language === "fr") {
    if (wetCount > 0) parts.push(`${wetCount} pipi`);
    if (dirtyCount > 0)
      parts.push(`${dirtyCount} selle${dirtyCount > 1 ? "s" : ""}`);
  } else {
    if (wetCount > 0) parts.push(`${wetCount} wet`);
    if (dirtyCount > 0) parts.push(`${dirtyCount} dirty`);
  }
  return parts.join(" · ");
}

function visitCountLabel(count: number, language: "fr" | "en") {
  if (language === "fr") return `${count} visite${count > 1 ? "s" : ""}`;
  return `${count} visit${count !== 1 ? "s" : ""}`;
}

function temperatureValueLabel(temp: number | undefined): string {
  if (temp === undefined) return "—";
  return `${temp.toFixed(1)}°C`;
}

function formatDayLabel(date: Date, language: "fr" | "en") {
  return new Intl.DateTimeFormat(language === "fr" ? "fr-BE" : "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

function formatSectionLabel(date: Date, language: "fr" | "en") {
  return new Intl.DateTimeFormat(language === "fr" ? "fr-BE" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function trackedLabelForDate(
  date: Date,
  language: "fr" | "en",
  viewingToday: boolean,
) {
  if (viewingToday) {
    return language === "fr" ? "Suivi aujourd’hui" : "Tracked today";
  }

  return language === "fr"
    ? `Suivi du ${formatSectionLabel(date, language)}`
    : `Tracked on ${formatSectionLabel(date, language)}`;
}

function totalSleepLabel(
  language: "fr" | "en",
  viewingToday: boolean,
  date: Date,
) {
  if (viewingToday) {
    return language === "fr" ? "Aujourd’hui" : "Today";
  }

  return language === "fr"
    ? `Sommeil total du ${formatSectionLabel(date, language)}`
    : `Total sleep on ${formatSectionLabel(date, language)}`;
}

function countFeedsUntil(
  events: TrackedEvent[],
  date: Date,
  cutoffTimestamp: number,
) {
  const dayStart = startOfDay(date).getTime();
  const limit = Math.min(cutoffTimestamp, endOfDay(date).getTime());
  return events.filter(
    (event) =>
      event.type === "feed" &&
      event.startTime >= dayStart &&
      event.startTime <= limit,
  ).length;
}

function buildEventTags(
  event: TrackedEvent,
  t: ReturnType<typeof useI18n>["t"],
  language: "fr" | "en",
) {
  if (event.type === "sleep") {
    const tags = [];
    if (typeof event.endTime === "number") {
      tags.push(
        language === "fr"
          ? `Fin ${formatClock(event.endTime)}`
          : `Ended ${formatClock(event.endTime)}`,
      );
      //tags.push(formatDuration(event.startTime, event.endTime));
      return tags;
    }
    tags.push(language === "fr" ? "En cours" : "Ongoing");
    return tags;
  }

  if (
    event.type === "temperature" &&
    typeof event.details?.temperature === "number"
  ) {
    return [
      `${event.details.temperature.toFixed(1)}°C`,
      event.details?.temperaturePeriod
        ? event.details.temperaturePeriod === "evening"
          ? t("common.evening")
          : t("common.morning")
        : language === "fr"
          ? "Relevé"
          : "Reading",
    ];
  }

  if (
    event.type === "diaper" &&
    event.details?.stoolColor &&
    (event.details.diaperType === "dirty" ||
      event.details.diaperType === "both")
  ) {
    return [
      language === "fr" ? "Selle" : "Stool",
      t(stoolColorLabelKey(event.details.stoolColor)),
    ];
  }

  return [];
}

function describeEvent(
  event: TrackedEvent,
  t: ReturnType<typeof useI18n>["t"],
) {
  switch (event.type) {
    case "feed": {
      const side = event.details?.feedSide;
      const supplement = event.details?.bottleSupplement;
      if (side === "bottle") {
        return {
          title: t("event.feed.bottle"),
          body: typeof event.details?.feedAmountMl === "number"
            ? t("event.feed.amount_ml", { value: event.details.feedAmountMl })
            : t("event.feed.recorded"),
          iconKind: "bottle" as const,
        };
      }
      const sideLabel = side === "left" ? t("event.feed.left") : t("event.feed.right");
      return {
        title: supplement ? t("event.feed.hybrid") : t("event.feed.nursing"),
        body: supplement ? `${sideLabel} + ${supplement} ml` : sideLabel,
        iconKind: "breast" as const,
      };
    }
    case "growth":
      return {
        title: t("event.growth.weighing"),
        body: t("event.growth.new_measure"),
        iconKind: "growth" as const,
      };
    case "sleep":
      return {
        title: t("tracker.sleep"),
        body: event.endTime
          ? t("event.sleep_duration", {
              value: formatDuration(event.startTime, event.endTime),
            })
          : t("event.sleep_in_progress"),
        iconKind: "sleep" as const,
      };
    case "temperature":
      return {
        title: t("tracker.temperature"),
        body: "",
        iconKind: "temperature" as const,
      };
    case "medication":
      return {
        title:
          inferMedicationCategory(
            event.details?.medicationName,
            event.details?.careCategory,
          ) === "visit"
            ? t("tracker.visits")
            : translateCareLabel(event.details?.medicationName, t),
        body: event.notes?.trim()
          ? event.notes.trim()
          : t("event.action_recorded"),
        iconKind:
          inferMedicationCategory(
            event.details?.medicationName,
            event.details?.careCategory,
          ) === "visit"
            ? ("visit" as const)
            : ("care" as const),
      };
    case "diaper":
      return {
        title: t("today.diaper"),
        body: translateDiaperType(event.details?.diaperType, t),
        iconKind: "diaper" as const,
      };
    default:
      return {
        title: t("tracker.care"),
        body: t("event.action_recorded"),
        iconKind: "care" as const,
      };
  }
}

function getAccentForKind(
  kind: TodayVisualKind,
  theme: ReturnType<typeof useAppTheme>["theme"],
) {
  switch (kind) {
    case "sleep":
      return theme.sleep;
    case "breast":
    case "bottle":
      return theme.feed;
    case "diaper":
      return theme.diaper;
    case "temperature":
      return theme.temperature;
    case "growth":
      return theme.growth;
    case "visit":
      return theme.visit;
    case "care":
    default:
      return theme.primary;
  }
}

function AnimatedSummaryIcon({
  kind,
  accent,
}: {
  kind:
    | "sleep"
    | "breast"
    | "bottle"
    | "diaper"
    | "care"
    | "visit"
    | "temperature";
  accent: string;
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
              outputRange: [0, -2, 0],
            }),
          },
        ]
      : kind === "diaper"
        ? [
            {
              rotate: motion.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: ["0deg", "6deg", "0deg"],
              }),
            },
          ]
        : [
            {
              scale: motion.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 1.06, 1],
              }),
            },
          ];

  return (
    <View style={styles.animatedIconWrap}>
      <Animated.View style={{ transform: baseTransform }}>
        <Text style={[styles.summaryEmoji, { color: accent }]}>
          {getActivityEmoji(kind)}
        </Text>
      </Animated.View>
      {kind === "sleep" ? (
        <>
          <Animated.Text
            style={[
              styles.iconZPrimary,
              {
                color: accent,
                opacity: motion.interpolate({
                  inputRange: [0, 0.2, 0.9, 1],
                  outputRange: [0, 0.7, 0.3, 0],
                }),
                transform: [
                  {
                    translateY: motion.interpolate({
                      inputRange: [0, 1],
                      outputRange: [4, -10],
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
          <Animated.Text
            style={[
              styles.iconZSecondary,
              {
                color: accent,
                opacity: motion.interpolate({
                  inputRange: [0, 0.35, 1],
                  outputRange: [0, 0.45, 0],
                }),
                transform: [
                  {
                    translateY: motion.interpolate({
                      inputRange: [0, 1],
                      outputRange: [6, -6],
                    }),
                  },
                  {
                    translateX: motion.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 2],
                    }),
                  },
                ],
              },
            ]}
          >
            z
          </Animated.Text>
        </>
      ) : null}
      {kind === "breast" || kind === "bottle" ? (
        <>
          <Animated.View
            style={[
              styles.iconBubble,
              styles.iconBubbleSmall,
              {
                backgroundColor: accent,
                opacity: motion.interpolate({
                  inputRange: [0, 0.2, 0.8, 1],
                  outputRange: [0, 0.45, 0.1, 0],
                }),
                transform: [
                  {
                    translateY: motion.interpolate({
                      inputRange: [0, 1],
                      outputRange: [6, -8],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.iconBubble,
              styles.iconBubbleLarge,
              {
                backgroundColor: accent,
                opacity: motion.interpolate({
                  inputRange: [0, 0.35, 1],
                  outputRange: [0, 0.35, 0],
                }),
                transform: [
                  {
                    translateY: motion.interpolate({
                      inputRange: [0, 1],
                      outputRange: [4, -4],
                    }),
                  },
                ],
              },
            ]}
          />
        </>
      ) : null}
      {kind === "diaper" ? (
        <Animated.View
          style={[
            styles.iconPulseRing,
            {
              borderColor: `${accent}55`,
              opacity: motion.interpolate({
                inputRange: [0, 0.45, 1],
                outputRange: [0.28, 0.1, 0.28],
              }),
              transform: [
                {
                  scale: motion.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.92, 1.08, 0.92],
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
            styles.iconSparkle,
            {
              opacity: motion.interpolate({
                inputRange: [0, 0.2, 0.7, 1],
                outputRange: [0.2, 0.7, 0.3, 0.2],
              }),
              transform: [
                {
                  scale: motion.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.85, 1.08, 0.85],
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

function SummaryTile({
  iconKind,
  title,
  meta,
  value,
  secondaryValue,
  detail,
  badges,
  active,
}: {
  iconKind:
    | "sleep"
    | "breast"
    | "bottle"
    | "diaper"
    | "care"
    | "visit"
    | "temperature";
  title?: string;
  meta: string;
  value: string;
  /** Deuxième valeur affichée avec le même style que value (égale importance) */
  secondaryValue?: string;
  detail?: string;
  badges?: string[];
  active?: boolean;
}) {
  const { theme } = useAppTheme();
  const accent = getAccentForKind(iconKind, theme);
  const isSleepActive = active && iconKind === "sleep";
  const driftPrimary = useRef(new Animated.Value(0)).current;
  const driftSecondary = useRef(new Animated.Value(0)).current;
  const orbPrimary = useRef(new Animated.Value(0)).current;
  const orbSecondary = useRef(new Animated.Value(0)).current;
  const orbTertiary = useRef(new Animated.Value(0)).current;
  const orbPrimaryDuration = useRef(
    4200 + Math.round(Math.random() * 1400),
  ).current;
  const orbSecondaryDuration = useRef(
    5200 + Math.round(Math.random() * 1800),
  ).current;
  const orbTertiaryDuration = useRef(
    3600 + Math.round(Math.random() * 1200),
  ).current;
  const orbPrimaryOffset = useRef(4 + Math.round(Math.random() * 6)).current;
  const orbSecondaryOffset = useRef(3 + Math.round(Math.random() * 5)).current;
  const orbTertiaryOffset = useRef(2 + Math.round(Math.random() * 4)).current;

  useEffect(() => {
    if (!isSleepActive) return;

    const createLoop = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 2400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

    const animations = [
      createLoop(driftPrimary, 0),
      createLoop(driftSecondary, 700),
    ];
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [driftPrimary, driftSecondary, isSleepActive]);

  useEffect(() => {
    if (isSleepActive) return;

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
      createLoop(orbSecondary, orbSecondaryDuration, 500),
      createLoop(orbTertiary, orbTertiaryDuration, 250),
    ];
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [
    isSleepActive,
    orbPrimary,
    orbPrimaryDuration,
    orbSecondary,
    orbSecondaryDuration,
    orbTertiary,
    orbTertiaryDuration,
  ]);

  return (
    <View
      style={[
        styles.summaryTile,
        isSleepActive
          ? [
              styles.summaryTileSleepActive,
              {
                backgroundColor: theme.night,
                borderColor: "rgba(240, 230, 214, 0.10)",
              },
            ]
          : {
              // Carnet d'aquarelle: solid white paper so the tile reads as
              // a card on the cream page. Accent tint is delivered by the
              // animated orbs inside + a stronger tinted border, not by a
              // near-invisible 6% wash that vanished on the new background.
              backgroundColor: theme.surfaceLowest,
              borderColor: `${accent}3D`,
              shadowColor: theme.shadow,
            },
      ]}
    >
      {!isSleepActive ? (
        <Animated.View
          style={[
            styles.summaryAccentOrb,
            {
              backgroundColor: `${accent}0D`,
              opacity: orbPrimary.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.32, 0.22, 0.3],
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
                    outputRange: [0, -orbPrimaryOffset - 1],
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
      ) : null}
      {!isSleepActive ? (
        <Animated.View
          style={[
            styles.summaryAccentBubbleSecondary,
            {
              backgroundColor: `${accent}0B`,
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
                    outputRange: [0, orbSecondaryOffset + 1],
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
      ) : null}
      {!isSleepActive ? (
        <Animated.View
          style={[
            styles.summaryAccentBubbleTertiary,
            {
              backgroundColor: `${accent}12`,
              opacity: orbTertiary.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.34, 0.2, 0.28],
              }),
              transform: [
                {
                  translateY: orbTertiary.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 3],
                  }),
                },
                {
                  translateX: orbTertiary.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -orbTertiaryOffset],
                  }),
                },
                {
                  scaleX: orbTertiary.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [1, 1.05, 0.98],
                  }),
                },
                {
                  scaleY: orbTertiary.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [1, 0.97, 1.03],
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}
      {isSleepActive ? (
        <Icon
          name="moon"
          size={88}
          color="rgba(248, 238, 241, 0.08)"
          style={styles.summaryTileMoon}
        />
      ) : null}
      {isSleepActive ? (
        <>
          <Animated.Text
            style={[
              styles.summaryTileSleepZPrimary,
              {
                color: "#F0E6D6",
                opacity: driftPrimary.interpolate({
                  inputRange: [0, 0.2, 0.95, 1],
                  outputRange: [0, 0.68, 0.22, 0],
                }),
                transform: [
                  {
                    translateY: driftPrimary.interpolate({
                      inputRange: [0, 1],
                      outputRange: [2, -10],
                    }),
                  },
                  {
                    translateX: driftPrimary.interpolate({
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
          <Animated.Text
            style={[
              styles.summaryTileSleepZSecondary,
              {
                color: "#D4C5B0",
                opacity: driftSecondary.interpolate({
                  inputRange: [0, 0.25, 1],
                  outputRange: [0, 0.5, 0],
                }),
                transform: [
                  {
                    translateY: driftSecondary.interpolate({
                      inputRange: [0, 1],
                      outputRange: [4, -6],
                    }),
                  },
                  {
                    translateX: driftSecondary.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 3],
                    }),
                  },
                ],
              },
            ]}
          >
            z
          </Animated.Text>
        </>
      ) : null}
      <View style={styles.summaryHeader}>
        <View
          style={[
            styles.summaryIcon,
            {
              backgroundColor: isSleepActive
                ? "rgba(255,255,255,0.08)"
                : `${accent}20`,
            },
          ]}
        >
          <AnimatedSummaryIcon
            kind={iconKind}
            accent={isSleepActive ? "#F0E6D6" : accent}
          />
        </View>
        <Text
          style={[
            styles.summaryMeta,
            {
              color: isSleepActive ? "#A89682" : theme.textSoft,
              fontFamily: theme.fontMedium,
            },
          ]}
        >
          {meta}
        </Text>
      </View>
      {title ? (
        <Text
          style={[
            styles.summaryTitle,
            {
              color: isSleepActive ? "#FFFFFF" : theme.text,
              fontFamily: theme.fontBold,
            },
          ]}
        >
          {title}
        </Text>
      ) : null}
      <Text
        style={[
          styles.summaryValue,
          {
            color: isSleepActive ? "#F0E6D6" : accent,
            fontFamily: theme.fontBold,
          },
        ]}
      >
        {value}
      </Text>
      {secondaryValue ? (
        <Text
          style={[
            styles.summaryValue,
            {
              color: isSleepActive ? "#F0E6D6" : accent,
              fontFamily: theme.fontBold,
            },
          ]}
        >
          {secondaryValue}
        </Text>
      ) : null}
      {detail ? (
        <Text
          numberOfLines={2}
          style={[
            styles.summaryBody,
            {
              color: isSleepActive ? "#D4C5B0" : theme.textMuted,
              fontFamily: theme.fontRegular,
            },
          ]}
        >
          {detail}
        </Text>
      ) : null}
      {badges && badges.length > 0 ? (
        <View style={styles.badgesRow}>
          {badges.slice(0, 3).map((badge) => (
            <AppBadge key={badge} label={badge} tone="neutral" />
          ))}
          {badges.length > 3 ? (
            <AppBadge label={`+${badges.length - 3}`} tone="neutral" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Detail list — used in Today to surface care + visit events with timestamp,
 * not just aggregate badges. Each item is a row: dot · label · time, with
 * an optional note line below.
 */
function DetailListBlock({
  title,
  accent,
  items,
}: {
  title: string;
  accent: string;
  items: Array<{ id: string; label: string; time: string; note?: string }>;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.detailBlock, { backgroundColor: theme.surfaceLowest, borderColor: theme.cardBorder, shadowColor: theme.shadow }]}>
      <View style={styles.detailBlockHeader}>
        <Text style={[styles.detailBlockTitle, { color: theme.text, fontFamily: theme.fontDisplayItalic }]}>
          {title}
        </Text>
        <View style={[styles.detailBlockCount, { backgroundColor: `${accent}1F` }]}>
          <Text style={[styles.detailBlockCountLabel, { color: accent, fontFamily: theme.fontSemiBold }]}>
            {items.length}
          </Text>
        </View>
      </View>
      <View style={[styles.detailBlockDivider, { backgroundColor: theme.hairline }]} />
      <View style={styles.detailBlockList}>
        {items.map((item, index) => (
          <View key={item.id} style={styles.detailBlockRow}>
            <View style={[styles.detailBlockDot, { backgroundColor: accent }]} />
            <View style={styles.detailBlockRowText}>
              <Text style={[styles.detailBlockLabel, { color: theme.text, fontFamily: theme.fontSemiBold }]}>
                {item.label}
              </Text>
              {item.note ? (
                <Text style={[styles.detailBlockNote, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
                  {item.note}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.detailBlockTime, { color: theme.textSoft, fontFamily: theme.fontMedium }]}>
              {item.time}
            </Text>
            {index < items.length - 1 ? null : null}
          </View>
        ))}
      </View>
    </View>
  );
}

export function TodayScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { t, language } = useI18n();
  const {
    authUser,
    currentBaby,
    familyMembers,
    events,
    activeSession,
    stopSleep,
    deleteEvent,
    updateEvent,
    viewerRole,
    saving,
    refreshData,
  } = useAppContext();
  const canManageEvent = (_event: TrackedEvent) =>
    viewerRole === "manager";
  const [showAllTimeline, setShowAllTimeline] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TrackedEvent | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editFeedSide, setEditFeedSide] = useState<FeedSide>("left");
  const [editFeedAmount, setEditFeedAmount] = useState("");
  const [editDiaperType, setEditDiaperType] = useState<DiaperType>("wet");
  const [editStoolColor, setEditStoolColor] = useState<StoolColor | null>(null);
  const [editMedicationName, setEditMedicationName] = useState("");
  const [editMedicationCategory, setEditMedicationCategory] =
    useState<CareCategory>("care");
  const [editTemperature, setEditTemperature] = useState("");
  const [editStartTime, setEditStartTime] = useState(new Date());
  const [editEndTime, setEditEndTime] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [liveNow, setLiveNow] = useState(Date.now());
  const driftA = useRef(new Animated.Value(0)).current;
  const driftB = useRef(new Animated.Value(0)).current;
  const driftC = useRef(new Animated.Value(0)).current;
  const viewingToday = isSameDay(selectedDate, liveNow);
  const liveSleepActive = viewingToday && Boolean(activeSession);
  const summary = useMemo(
    () => getDailySummary(events, viewingToday ? activeSession : null, selectedDate),
    [events, activeSession, viewingToday, selectedDate],
  );
  const todayEvents = useMemo(
    () =>
      getEventsForDay(events, selectedDate).sort(
        (a, b) => b.startTime - a.startTime,
      ),
    [events, selectedDate],
  );
  const comparisonCutoff = useMemo(() => {
    if (viewingToday) return liveNow;
    return endOfDay(selectedDate).getTime();
  }, [liveNow, selectedDate, viewingToday]);
  const feedCountAtSameTime = useMemo(
    () => countFeedsUntil(events, selectedDate, comparisonCutoff),
    [comparisonCutoff, events, selectedDate],
  );
  const yesterdayFeedCountAtSameTime = useMemo(() => {
    const previousDate = new Date(selectedDate.getTime() - 24 * 60 * 60 * 1000);
    const cutoffOffset = comparisonCutoff - startOfDay(selectedDate).getTime();
    return countFeedsUntil(
      events,
      previousDate,
      startOfDay(previousDate).getTime() + cutoffOffset,
    );
  }, [comparisonCutoff, events, selectedDate]);
  const careEvents = useMemo(
    () => todayEvents.filter((event) => isCareEvent(event)),
    [todayEvents],
  );
  const visitEvents = useMemo(
    () => todayEvents.filter((event) => isVisitEvent(event)),
    [todayEvents],
  );
  const visibleTimelineEvents = useMemo(
    () => (showAllTimeline ? todayEvents : todayEvents.slice(0, 5)),
    [showAllTimeline, todayEvents],
  );
  const todayCareTags = useMemo(
    () => [
      ...new Set(
        careEvents
          .map((event) => describeCareTag(event, t))
          .filter((value): value is string => Boolean(value)),
      ),
    ],
    [careEvents, t],
  );
  const lastFeed = todayEvents.find((event) => event.type === "feed") ?? null;
  const lastDiaper =
    todayEvents.find((event) => event.type === "diaper") ?? null;
  const lastCare = careEvents[0] ?? null;
  const lastVisit = visitEvents[0] ?? null;

  const todayFeedEvents = useMemo(
    () => todayEvents.filter((e) => e.type === "feed"),
    [todayEvents],
  );
  const todayTempEvents = useMemo(
    () => todayEvents.filter((e) => e.type === "temperature"),
    [todayEvents],
  );
  const feedBadges = useMemo(
    () => feedBreakdownBadges(todayFeedEvents, language),
    [todayFeedEvents, language],
  );
  const diaperDetail = useMemo(
    () =>
      diaperDetailLabel(
        todayEvents.filter((e) => e.type === "diaper"),
        language,
      ),
    [todayEvents, language],
  );
  const diaperStoolBadges = useMemo(() => {
    const counts = new Map<string, number>();
    todayEvents
      .filter(
        (e) =>
          e.type === "diaper" &&
          e.details?.stoolColor &&
          (e.details.diaperType === "dirty" || e.details.diaperType === "both"),
      )
      .forEach((e) => {
        const label = t(stoolColorLabelKey(e.details!.stoolColor!));
        counts.set(label, (counts.get(label) ?? 0) + 1);
      });
    return [...counts.entries()].map(([label, n]) =>
      n > 1 ? `${label} ×${n}` : label,
    );
  }, [todayEvents, t]);
  const morningTempEvent = todayTempEvents.find(
    (e) => e.details?.temperaturePeriod !== "evening",
  );
  const eveningTempEvent = todayTempEvents.find(
    (e) => e.details?.temperaturePeriod === "evening",
  );
  const morningTemp = morningTempEvent?.details?.temperature;
  const eveningTemp = eveningTempEvent?.details?.temperature;
  const lastTempEvent = todayTempEvents[0] ?? null;
  const visitBadges = useMemo(
    () => [
      ...new Set(
        visitEvents
          .map((e) => translateCareLabel(e.details?.medicationName, t))
          .filter((v): v is string => Boolean(v)),
      ),
    ],
    [visitEvents, t],
  );

  const heroTitle = liveSleepActive
    ? t("today.sleeping_since", { name: currentBaby?.firstName ?? "Charlie" })
    : viewingToday
      ? t("today.overview", { name: currentBaby?.firstName ?? "Charlie" })
      : `${currentBaby?.firstName ?? "Charlie"} · ${formatDayLabel(selectedDate, language)}`;

  const heroValue =
    liveSleepActive && activeSession
      ? formatDuration(activeSession.startTime, liveNow)
      : null;

  useEffect(() => {
    if (!viewingToday) return;

    const interval = setInterval(() => {
      setLiveNow(Date.now());
    }, 15000);

    return () => clearInterval(interval);
  }, [viewingToday]);

  useEffect(() => {
    if (!liveSleepActive || !activeSession) return;

    const animate = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 2600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

    const animations = [
      animate(driftA, 0),
      animate(driftB, 550),
      animate(driftC, 1100),
    ];
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [activeSession, driftA, driftB, driftC, liveSleepActive]);

  const openEditor = (event: TrackedEvent) => {
    setEditingEvent(event);
    setEditNotes(event.notes ?? "");
    setEditFeedSide(event.details?.feedSide ?? "left");
    setEditFeedAmount(
      typeof event.details?.feedAmountMl === "number"
        ? String(event.details.feedAmountMl)
        : "",
    );
    setEditDiaperType(event.details?.diaperType ?? "wet");
    setEditStoolColor(event.details?.stoolColor ?? null);
    setEditMedicationName(
      translateCareLabel(event.details?.medicationName, t) ??
        event.details?.medicationName ??
        "",
    );
    setEditMedicationCategory(
      inferMedicationCategory(
        event.details?.medicationName,
        event.details?.careCategory,
      ),
    );
    setEditTemperature(
      typeof event.details?.temperature === "number"
        ? String(event.details.temperature)
        : "",
    );
    const safeStart = typeof event.startTime === 'number' && event.startTime > 0
      ? new Date(event.startTime)
      : new Date();
    setEditStartTime(safeStart);
    setEditEndTime(
      typeof event.endTime === 'number' && event.endTime > 0 ? new Date(event.endTime) : null,
    );
  };

  const closeEditor = () => setEditingEvent(null);

  const saveEdit = async () => {
    if (!editingEvent) return;
    const timeUpdates = {
      startTime: editStartTime.getTime(),
      ...(editingEvent.type === "sleep" && editEndTime
        ? { endTime: editEndTime.getTime() }
        : {}),
    };
    if (editingEvent.type === "feed") {
      await updateEvent(editingEvent.id, {
        ...timeUpdates,
        notes: editNotes.trim() || undefined,
        details: {
          ...editingEvent.details,
          feedSide: editFeedSide,
          feedAmountMl:
            editFeedSide === "bottle" && editFeedAmount.trim()
              ? Number(editFeedAmount)
              : undefined,
        },
      });
    } else if (editingEvent.type === "diaper") {
      await updateEvent(editingEvent.id, {
        ...timeUpdates,
        notes: editNotes.trim() || undefined,
        details: {
          ...editingEvent.details,
          diaperType: editDiaperType,
          stoolColor:
            editDiaperType === "dirty" || editDiaperType === "both"
              ? (editStoolColor ?? undefined)
              : undefined,
        },
      });
    } else if (editingEvent.type === "medication") {
      await updateEvent(editingEvent.id, {
        ...timeUpdates,
        notes: editNotes.trim() || undefined,
        details: {
          ...editingEvent.details,
          medicationName: editMedicationName.trim() || undefined,
          careCategory: editMedicationCategory,
        },
      });
    } else if (editingEvent.type === "temperature") {
      await updateEvent(editingEvent.id, {
        ...timeUpdates,
        notes: editNotes.trim() || undefined,
        details: {
          ...editingEvent.details,
          temperature: editTemperature.trim()
            ? Number(editTemperature.replace(",", "."))
            : undefined,
        },
      });
    } else {
      await updateEvent(editingEvent.id, {
        ...timeUpdates,
        notes: editNotes.trim() || undefined,
      });
    }
    closeEditor();
  };

  const zStyle = (value: Animated.Value, size: number, opacity: number) => ({
    opacity: value.interpolate({
      inputRange: [0, 0.15, 0.85, 1],
      outputRange: [0, opacity, opacity * 0.9, 0],
    }),
    transform: [
      {
        translateY: value.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -28],
        }),
      },
      {
        translateX: value.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 10],
        }),
      },
      {
        scale: value.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1.08],
        }),
      },
    ],
    fontSize: size,
  });

  return (
    <Screen onRefresh={refreshData} topBar={<EditorialTopBar />}>
      {currentBaby ? (
        <GrowthSpurtBanner events={events} baby={currentBaby} />
      ) : null}

      <View
        style={[
          styles.heroCard,
          liveSleepActive
            ? [
                styles.heroCardSleep,
                {
                  backgroundColor: theme.night,
                  shadowColor: theme.shadow,
                },
              ]
            : {
                backgroundColor: theme.cream,
                shadowColor: theme.shadow,
              },
        ]}
      >
        {/* Carnet identity = paper, not glass. Active (sleep dark) keeps a
            subtle moonlight highlight; inactive renders no gloss so the
            text reads cleanly on the white card. */}
        {liveSleepActive ? (
          <>
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0.02)", "rgba(0,0,0,0.12)"]}
              locations={[0, 0.45, 1]}
              style={styles.heroGlass}
            />
            <View
              pointerEvents="none"
              style={[styles.heroTopHairline, { backgroundColor: "rgba(255,255,255,0.14)" }]}
            />
          </>
        ) : null}
        <View style={styles.heroTopRow}>
          <View style={styles.heroDateWrap}>
            <Pressable
              onPress={() => setDatePickerVisible(true)}
              style={[
                styles.dateChip,
                {
                  backgroundColor: viewingToday
                    ? theme.secondaryContainer
                    : theme.surfaceRaised,
                },
              ]}
            >
              <Icon
                name="calendar-outline"
                size={15}
                color={theme.primary}
              />
              <Text
                style={[
                  styles.dateChipLabel,
                  { color: theme.text, fontFamily: theme.fontMedium },
                ]}
              >
                {formatDayLabel(selectedDate, language)}
              </Text>
            </Pressable>
            {!viewingToday ? (
              <Pressable
                onPress={() => setSelectedDate(new Date())}
                style={[
                  styles.dateResetChip,
                  { backgroundColor: theme.surfaceRaised },
                ]}
              >
                <Text
                  style={[
                    styles.dateResetLabel,
                    { color: theme.primary, fontFamily: theme.fontBold },
                  ]}
                >
                  {language === "fr"
                    ? "Revenir à aujourd’hui"
                    : "Back to today"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        {liveSleepActive ? (
          <Icon
            name="moon"
            size={180}
            color="rgba(248, 238, 241, 0.08)"
            style={styles.heroBackgroundMoon}
          />
        ) : null}
        {liveSleepActive ? (
          <>
            <Animated.Text
              style={[
                styles.heroSleepZ,
                { color: "#F0E6D6" },
                zStyle(driftA, 30, 0.78),
              ]}
            >
              z
            </Animated.Text>
            <Animated.Text
              style={[
                styles.heroSleepZSecondary,
                { color: "#D4C5B0" },
                zStyle(driftB, 22, 0.62),
              ]}
            >
              z
            </Animated.Text>
            <Animated.Text
              style={[
                styles.heroSleepZSmall,
                { color: "#A89682" },
                zStyle(driftC, 16, 0.48),
              ]}
            >
              z
            </Animated.Text>
          </>
        ) : null}
        <Text
          style={[
            styles.heroEyebrow,
            {
              color: liveSleepActive ? "#D4C5B0" : theme.textSoft,
              fontFamily: theme.fontBold,
            },
          ]}
        >
          {t("today.current_status")}
        </Text>
        {heroValue ? (
          <View style={styles.heroTitleRow}>
            <Text
              style={[
                styles.heroTitleInline,
                {
                  color: liveSleepActive ? "rgba(255,255,255,0.7)" : theme.textSoft,
                  fontFamily: theme.fontLight,
                },
              ]}
            >
              {heroTitle}
            </Text>
            <Text
              style={[
                styles.heroValueInline,
                {
                  color: liveSleepActive ? "#FFFFFF" : theme.text,
                  fontFamily: theme.fontDisplayItalic,
                },
              ]}
            >
              {heroValue}
            </Text>
          </View>
        ) : (
          <Text
            style={[
              styles.heroTitle,
              {
                color: liveSleepActive ? "#FFFFFF" : theme.text,
                fontFamily: theme.fontDisplay,
              },
            ]}
          >
            {heroTitle}
          </Text>
        )}
        {liveSleepActive ? (
          <AppButton onPress={stopSleep}>{t("today.wake_now")}</AppButton>
        ) : null}
      </View>

      <View style={styles.summaryGrid}>
        <SummaryTile
          iconKind="sleep"
          title={language === "fr" ? "Sommeil total" : "Total sleep"}
          meta={
            liveSleepActive && activeSession
              ? formatRelativeShort(activeSession.startTime, language)
              : summary.totalSleepMinutes > 0
                ? trackedLabelForDate(selectedDate, language, viewingToday)
                : t("common.not_available")
          }
          value={
            summary.totalSleepMinutes > 0
              ? formatDuration(0, summary.totalSleepMinutes * 60 * 1000)
              : "—"
          }
          detail={
            liveSleepActive
              ? language === "fr"
                ? `${totalSleepLabel(language, viewingToday, selectedDate)}`
                : `${totalSleepLabel(language, viewingToday, selectedDate)}`
              : summary.totalSleepMinutes > 0
                ? totalSleepLabel(language, viewingToday, selectedDate)
                : undefined
          }
          active={liveSleepActive}
        />
        <SummaryTile
          iconKind={currentBaby?.feedingMode === "bottle" ? "bottle" : "breast"}
          title={summary.feedCount > 0 ? undefined : t("tracker.feed")}
          meta={
            lastFeed
              ? formatRelativeShort(lastFeed.startTime, language)
              : t("common.not_available")
          }
          value={feedCountLabel(summary.feedCount, language)}
          detail={
            summary.feedCount > 0
              ? feedDeltaLabel(
                  feedCountAtSameTime,
                  yesterdayFeedCountAtSameTime,
                  language,
                  viewingToday ? "same-time" : "full-day",
                )
              : t("today.no_meal")
          }
          badges={undefined}
        />
        <SummaryTile
          iconKind="diaper"
          title={summary.diaperCount > 0 ? undefined : t("today.diaper")}
          meta={
            lastDiaper
              ? formatRelativeShort(lastDiaper.startTime, language)
              : t("common.not_available")
          }
          value={diaperCountLabel(summary.diaperCount, language)}
          detail={
            diaperDetail ??
            (summary.diaperCount === 0 ? t("today.no_diaper") : undefined)
          }
          badges={diaperStoolBadges.length > 0 ? diaperStoolBadges : undefined}
        />
        <SummaryTile
          iconKind="care"
          title={careEvents.length > 0 ? undefined : t("tracker.care")}
          meta={
            lastCare
              ? formatRelativeShort(lastCare.startTime, language)
              : t("common.not_available")
          }
          value={careCountLabel(careEvents.length, language)}
          detail={
            careEvents.length === 0
              ? careBodyLabel(careEvents.length, language)
              : undefined
          }
          badges={todayCareTags.length > 0 ? todayCareTags : undefined}
        />
        <SummaryTile
          iconKind="visit"
          title={visitEvents.length > 0 ? undefined : t("tracker.visits")}
          meta={
            lastVisit
              ? formatRelativeShort(lastVisit.startTime, language)
              : t("common.not_available")
          }
          value={visitCountLabel(visitEvents.length, language)}
          detail={
            visitEvents.length === 0
              ? language === "fr"
                ? "Aucune visite"
                : "No visits"
              : undefined
          }
          badges={visitBadges.length > 0 ? visitBadges : undefined}
        />
        <SummaryTile
          iconKind="temperature"
          title={t("tracker.temperature")}
          meta={
            lastTempEvent
              ? formatRelativeShort(lastTempEvent.startTime, language)
              : t("common.not_available")
          }
          value={
            morningTemp !== undefined
              ? `${language === "fr" ? "Matin" : "Morning"} · ${morningTemp.toFixed(1)}°C`
              : eveningTemp !== undefined
                ? `${language === "fr" ? "Soir" : "Evening"} · ${eveningTemp.toFixed(1)}°C`
                : temperatureValueLabel(undefined)
          }
          secondaryValue={
            morningTemp !== undefined && eveningTemp !== undefined
              ? `${language === "fr" ? "Soir" : "Evening"} · ${eveningTemp.toFixed(1)}°C`
              : undefined
          }
        />
      </View>

      {/* ── Soins du jour — détail horodaté ── */}
      {careEvents.length > 0 ? (
        <DetailListBlock
          title={language === "fr" ? "Soins du jour" : "Care today"}
          accent={theme.primary}
          items={careEvents.map((event) => ({
            id: event.id,
            label: translateCareLabel(event.details?.medicationName, t) ?? event.details?.medicationName ?? t("tracker.care"),
            time: formatClock(event.startTime),
            note: event.notes,
          }))}
        />
      ) : null}

      {/* ── Rendez-vous du jour — détail horodaté ── */}
      {visitEvents.length > 0 ? (
        <DetailListBlock
          title={language === "fr" ? "Rendez-vous du jour" : "Appointments today"}
          accent={theme.visit}
          items={visitEvents.map((event) => ({
            id: event.id,
            label: translateCareLabel(event.details?.medicationName, t) ?? event.details?.medicationName ?? t("tracker.visits"),
            time: formatClock(event.startTime),
            note: event.notes,
          }))}
        />
      ) : null}

      <View style={styles.timelineSection}>
        <View style={styles.timelineHeader}>
          <View style={styles.timelineHeaderCopy}>
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.text, fontFamily: theme.fontSemiBold },
              ]}
            >
              {viewingToday
                ? t("today.section")
                : formatSectionLabel(selectedDate, language)}
            </Text>
            <Text
              style={[
                styles.sectionHint,
                { color: theme.textSoft, fontFamily: theme.fontRegular },
              ]}
            >
              {language === "fr"
                ? "Du plus récent au plus ancien"
                : "Newest to oldest"}
            </Text>
          </View>
          {todayEvents.length > 5 ? (
            <Pressable
              onPress={() => setShowAllTimeline((current) => !current)}
              style={[
                styles.viewMoreButton,
                { backgroundColor: theme.surfaceLowest },
              ]}
            >
              <Icon
                name={showAllTimeline ? "remove" : "add"}
                size={16}
                color={theme.primary}
              />
              <Text
                style={[
                  styles.viewMoreLabel,
                  { color: theme.primary, fontFamily: theme.fontBold },
                ]}
              >
                {showAllTimeline
                  ? t("common.view_less")
                  : t("common.view_more")}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.timelineList}>
          <View
            style={[
              styles.timelineRail,
              { backgroundColor: theme.surfaceContainerHigh },
            ]}
          />
          {visibleTimelineEvents.map((event) => {
            const meta = describeEvent(event, t);
            const accent = getAccentForKind(meta.iconKind, theme);
            const tags = buildEventTags(event, t, language);
            return (
              <View key={event.id} style={styles.timelineItem}>
                <View
                  style={[
                    styles.timelineDot,
                    {
                      backgroundColor: theme.surfaceLowest,
                      shadowColor: theme.shadow,
                      borderColor: `${accent}2E`,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.timelineDotInner,
                      { backgroundColor: `${accent}18` },
                    ]}
                  >
                    <Text style={styles.timelineEmoji}>
                      {getActivityEmoji(meta.iconKind)}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.timelineCard,
                    {
                      // Carnet d'aquarelle: white paper card with a coloured
                      // bookmark accent on the left edge. The 5% wash that
                      // used to fill these vanished against the new cream bg.
                      backgroundColor: theme.surfaceLowest,
                      borderLeftColor: accent,
                      borderColor: theme.cardBorder,
                      shadowColor: theme.shadow,
                    },
                  ]}
                >
                  <View style={styles.timelineCardRow}>
                    <View style={styles.timelineCardContent}>
                      <Text
                        style={[
                          styles.timelineCompactLine,
                          {
                            color: theme.textMuted,
                            fontFamily: theme.fontRegular,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.timelineTimeLabel,
                            { color: accent, fontFamily: theme.fontBold },
                          ]}
                        >
                          {formatClock(event.startTime)}
                        </Text>
                        <Text>{"  "}</Text>
                        <Text
                          style={[
                            styles.timelineTitleInline,
                            { color: theme.text, fontFamily: theme.fontBold },
                          ]}
                        >
                          {meta.title}
                        </Text>
                        {meta.body ? (
                          <>
                            <Text>{" · "}</Text>
                            <Text>{meta.body}</Text>
                          </>
                        ) : null}
                      </Text>
                      {tags.length > 0 ? (
                        <View style={styles.timelineTagsRow}>
                          {tags.map((tag) => (
                            <View
                              key={`${event.id}-${tag}`}
                              style={[
                                styles.timelineTag,
                                {
                                  backgroundColor: `${accent}14`,
                                  borderColor: `${accent}22`,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.timelineTagLabel,
                                  {
                                    color: accent,
                                    fontFamily: theme.fontMedium,
                                  },
                                ]}
                              >
                                {tag}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                      {(() => {
                        const memberLabel =
                          familyMembers.find(
                            (m) => m.uid === event.createdByUserId,
                          )?.parentLabel ?? null;
                        const byLabel =
                          event.createdByLabel ??
                          memberLabel ??
                          (familyMembers.length > 1
                            ? null
                            : null);
                        return byLabel ? (
                          <Text
                            style={[
                              styles.timelineByLine,
                              {
                                color: theme.textMuted,
                                fontFamily: theme.fontRegular,
                              },
                            ]}
                          >
                            {language === "fr" ? `par ${byLabel}` : `by ${byLabel}`}
                          </Text>
                        ) : null;
                      })()}
                    </View>
                    {canManageEvent(event) ? (
                      <View style={styles.timelineCardButtons}>
                        <Pressable
                          onPress={() => openEditor(event)}
                          style={styles.timelineActionBtn}
                          hitSlop={6}
                        >
                          <Icon
                            name="pencil-outline"
                            size={16}
                            color={theme.textSoft}
                          />
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            confirmAction(
                              language === "fr" ? "Supprimer" : "Delete",
                              language === "fr" ? "Supprimer cet événement ?" : "Delete this event?",
                              () => void deleteEvent(event.id),
                              {
                                confirmLabel: language === "fr" ? "Supprimer" : "Delete",
                                danger: true,
                              },
                            );
                          }}
                          style={styles.timelineActionBtn}
                          hitSlop={6}
                        >
                          <Icon
                            name="trash-outline"
                            size={16}
                            color={theme.textSoft}
                          />
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* ── Lien vers l'historique complet ── */}
      <Pressable
        onPress={() => { triggerSelectionFeedback(); router.push('/history'); }}
        style={styles.historyLink}
      >
        <Icon name="time-outline" size={15} color={theme.textSoft} />
        <Text style={[styles.historyLinkLabel, { color: theme.textSoft, fontFamily: theme.fontMedium }]}>
          {language === 'fr' ? 'Voir tout l\'historique' : 'View full history'}
        </Text>
        <Icon name="chevron-forward" size={14} color={theme.textSoft} />
      </Pressable>

      <AppModal visible={Boolean(editingEvent)} onClose={closeEditor}>
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.surfaceLowest,
                shadowColor: theme.shadow,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text
              style={[
                styles.modalTitle,
                { color: theme.text, fontFamily: theme.fontSemiBold },
              ]}
            >
              {editingEvent ? describeEvent(editingEvent, t).title : ""}
            </Text>

            <View style={styles.editTimeRow}>
              <View style={styles.editTimeField}>
                <Text
                  style={[
                    styles.editTimeLabel,
                    { color: theme.textMuted, fontFamily: theme.fontMedium },
                  ]}
                >
                  {language === "fr" ? "Date" : "Date"}
                </Text>
                <DateTimePicker
                  key={`date-${editStartTime.getTime()}`}
                  value={editStartTime}
                  mode="date"
                  display="compact"
                  locale={language === "fr" ? "fr-BE" : "en-US"}
                  themeVariant={theme.isDark ? "dark" : "light"}
                  textColor={theme.text}
                  accentColor={theme.primary}
                  onChange={(_, date) => {
                    if (date) {
                      const updated = new Date(editStartTime);
                      updated.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                      setEditStartTime(updated);
                    }
                  }}
                  style={styles.editTimePicker}
                />
              </View>
              <View style={styles.editTimeField}>
                <Text
                  style={[
                    styles.editTimeLabel,
                    { color: theme.textMuted, fontFamily: theme.fontMedium },
                  ]}
                >
                  {editingEvent?.type === "sleep"
                    ? language === "fr"
                      ? "Début"
                      : "Start"
                    : language === "fr"
                      ? "Heure"
                      : "Time"}
                </Text>
                <DateTimePicker
                  key={`time-${editStartTime.getTime()}`}
                  value={editStartTime}
                  mode="time"
                  display="compact"
                  locale={language === "fr" ? "fr-BE" : "en-US"}
                  themeVariant={theme.isDark ? "dark" : "light"}
                  textColor={theme.text}
                  accentColor={theme.primary}
                  onChange={(_, date) => {
                    if (date) setEditStartTime(date);
                  }}
                  style={styles.editTimePicker}
                />
              </View>
              {editingEvent?.type === "sleep" && editEndTime ? (
                <View style={styles.editTimeField}>
                  <Text
                    style={[
                      styles.editTimeLabel,
                      { color: theme.textMuted, fontFamily: theme.fontMedium },
                    ]}
                  >
                    {language === "fr" ? "Réveil" : "Wake"}
                  </Text>
                  <DateTimePicker
                    key={`end-${editEndTime?.getTime()}`}
                    value={editEndTime!}
                    mode="time"
                    display="compact"
                    locale={language === "fr" ? "fr-BE" : "en-US"}
                    themeVariant={theme.isDark ? "dark" : "light"}
                    textColor={theme.text}
                    accentColor={theme.primary}
                    onChange={(_, date) => {
                      if (date) setEditEndTime(date);
                    }}
                    style={styles.editTimePicker}
                  />
                </View>
              ) : null}
            </View>

            {editingEvent?.type === "feed" ? (
              <>
                <View style={styles.chipsRow}>
                  <Chip
                    label={t("event.feed.left")}
                    selected={editFeedSide === "left"}
                    tone="feed"
                    onPress={() => setEditFeedSide("left")}
                  />
                  <Chip
                    label={t("event.feed.right")}
                    selected={editFeedSide === "right"}
                    tone="feed"
                    onPress={() => setEditFeedSide("right")}
                  />
                  <Chip
                    label={t("event.feed.bottle")}
                    selected={editFeedSide === "bottle"}
                    tone="feed"
                    onPress={() => setEditFeedSide("bottle")}
                  />
                </View>
                {editFeedSide === "bottle" ? (
                  <AppInput
                    label={t("tracker.amount_ml")}
                    value={editFeedAmount}
                    onChangeText={setEditFeedAmount}
                    keyboardType="number-pad"
                    placeholder="120"
                  />
                ) : null}
              </>
            ) : null}

            {editingEvent?.type === "diaper" ? (
              <>
                <View style={styles.chipsRow}>
                  <Chip
                    label={t("tracker.pee")}
                    selected={editDiaperType === "wet"}
                    tone="success"
                    onPress={() => setEditDiaperType("wet")}
                  />
                  <Chip
                    label={t("tracker.poop")}
                    selected={editDiaperType === "dirty"}
                    tone="warning"
                    onPress={() => setEditDiaperType("dirty")}
                  />
                  <Chip
                    label={t("tracker.both")}
                    selected={editDiaperType === "both"}
                    tone="warning"
                    onPress={() => setEditDiaperType("both")}
                  />
                </View>
                {editDiaperType === "dirty" || editDiaperType === "both" ? (
                  <View style={styles.chipsRow}>
                    {(
                      [
                        "jaune_pale",
                        "beige",
                        "blanc_mastic",
                        "jaune_or",
                        "ocre_bronze",
                        "vert",
                      ] as StoolColor[]
                    ).map((color) => (
                      <Chip
                        key={color}
                        label={t(stoolColorLabelKey(color))}
                        selected={editStoolColor === color}
                        tone="warning"
                        onPress={() => setEditStoolColor(color)}
                      />
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}

            {editingEvent?.type === "medication" ? (
              <>
                <View style={styles.chipsRow}>
                  <Chip
                    label={t("tracker.care")}
                    selected={editMedicationCategory === "care"}
                    tone="success"
                    onPress={() => {
                      setEditMedicationCategory("care");
                      setEditMedicationName("");
                    }}
                  />
                  <Chip
                    label={t("tracker.visits")}
                    selected={editMedicationCategory === "visit"}
                    tone="neutral"
                    onPress={() => {
                      setEditMedicationCategory("visit");
                      setEditMedicationName("");
                    }}
                  />
                </View>
                <AppInput
                  label={
                    editMedicationCategory === "visit"
                      ? t("tracker.visits")
                      : t("tracker.care")
                  }
                  value={editMedicationName}
                  onChangeText={setEditMedicationName}
                  placeholder=""
                />
              </>
            ) : null}

            {editingEvent?.type === "temperature" ? (
              <AppInput
                label={t("tracker.temperature")}
                value={editTemperature}
                onChangeText={setEditTemperature}
                keyboardType="decimal-pad"
                placeholder="36.8"
              />
            ) : null}

            <AppInput
              label={t("common.optional_note")}
              value={editNotes}
              onChangeText={setEditNotes}
              placeholder={t("tracker.note_placeholder")}
            />

            <View style={styles.modalActions}>
              <AppButton
                style={styles.modalButton}
                variant="secondary"
                onPress={closeEditor}
              >
                {t("common.cancel")}
              </AppButton>
              <AppButton
                style={styles.modalButton}
                disabled={saving}
                onPress={() => void saveEdit()}
              >
                {t("common.save")}
              </AppButton>
            </View>
          </Pressable>
      </AppModal>
      <AppModal visible={datePickerVisible} onClose={() => setDatePickerVisible(false)}>
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
                styles.modalTitle,
                { color: theme.text, fontFamily: theme.fontSemiBold },
              ]}
            >
              {language === "fr" ? "Choisir une date" : "Choose a date"}
            </Text>
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="inline"
              locale={language === "fr" ? "fr-BE" : "en-US"}
              themeVariant={theme.isDark ? "dark" : "light"}
              textColor={theme.text}
              accentColor={theme.primary}
              onChange={(_, date) => {
                if (date) {
                  setSelectedDate(date);
                  setShowAllTimeline(false);
                  setDatePickerVisible(false);
                }
              }}
            />
          </Pressable>
      </AppModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
    shadowOpacity: 0.08,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 16 },
    overflow: "hidden",
    position: "relative",
  },
  heroGlass: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroTopHairline: {
    position: "absolute",
    top: 0,
    left: radii.xl,
    right: radii.xl,
    height: 1,
  },
  heroCardSleep: {
    minHeight: 220,
    justifyContent: "center",
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    zIndex: 1,
  },
  heroDateWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    alignItems: "center",
  },
  dateChip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  dateChipLabel: {
    fontSize: 13,
  },
  dateResetChip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dateResetLabel: {
    fontSize: 12,
  },
  heroBackgroundMoon: {
    position: "absolute",
    right: -24,
    top: -18,
  },
  heroSleepZ: {
    position: "absolute",
    top: 56,
    right: 72,
    fontWeight: "700",
  },
  heroSleepZSecondary: {
    position: "absolute",
    top: 38,
    right: 52,
    fontWeight: "700",
  },
  heroSleepZSmall: {
    position: "absolute",
    top: 24,
    right: 34,
    fontWeight: "700",
  },
  heroEyebrow: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.3,
  },
  heroTitleRow: {
    flexDirection: "column",
    gap: 2,
  },
  heroTitleInline: {
    fontSize: 18,
    lineHeight: 24,
  },
  heroValueInline: {
    fontSize: 44,
    lineHeight: 52,
    letterSpacing: -0.5,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  summaryTile: {
    width: "47.5%",
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    minHeight: 124,
    gap: 6,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    // Carnet identity: soft warm shadow so the tile reads as a paper card
    // resting on the cream page. Sleep-active state overrides this with
    // a deeper shadow tuned for the dark hero.
    shadowOpacity: 0.10,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  summaryTileSleepActive: {
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  summaryIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "visible",
  },
  summaryAccentOrb: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    top: 12,
    right: 14,
  },
  summaryAccentBubbleSecondary: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    bottom: 18,
    right: 42,
  },
  summaryAccentBubbleTertiary: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    top: 40,
    right: 24,
  },
  animatedIconWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  summaryEmoji: {
    fontSize: 22,
    lineHeight: 24,
  },
  iconZPrimary: {
    position: "absolute",
    top: -8,
    right: -6,
    fontSize: 10,
    fontWeight: "700",
  },
  iconZSecondary: {
    position: "absolute",
    top: -4,
    right: -2,
    fontSize: 8,
    fontWeight: "700",
  },
  iconBubble: {
    position: "absolute",
    borderRadius: 999,
  },
  iconBubbleSmall: {
    width: 5,
    height: 5,
    top: 1,
    right: -1,
  },
  iconBubbleLarge: {
    width: 7,
    height: 7,
    top: -3,
    right: 2,
  },
  iconPulseRing: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  iconSparkle: {
    position: "absolute",
    top: -6,
    right: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryMeta: {
    flex: 1,
    textAlign: "right",
    fontSize: 10,
    fontStyle: "italic",
  },
  summaryTitle: {
    fontSize: 17,
  },
  summaryValue: {
    fontSize: 19,
    lineHeight: 24,
  },
  summaryBody: {
    fontSize: 12,
    lineHeight: 17,
    fontStyle: "italic",
    minHeight: 34,
  },
  summaryTileMoon: {
    position: "absolute",
    right: -10,
    top: -10,
  },
  summaryTileSleepZPrimary: {
    position: "absolute",
    top: 18,
    right: 24,
    fontSize: 16,
    fontWeight: "700",
  },
  summaryTileSleepZSecondary: {
    position: "absolute",
    top: 10,
    right: 14,
    fontSize: 11,
    fontWeight: "700",
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: "auto",
  },
  detailBlock: {
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    // Carnet identity: warmer shadow so the block lifts off the cream page.
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    gap: spacing.xs,
  },
  detailBlockHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailBlockTitle: {
    fontSize: 18,
    letterSpacing: -0.3,
  },
  detailBlockCount: {
    minWidth: 24,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  detailBlockCountLabel: {
    fontSize: 12,
    letterSpacing: 0.1,
  },
  detailBlockDivider: {
    height: 1,
    opacity: 0.5,
  },
  detailBlockList: {
    gap: spacing.xs + 2,
    paddingTop: 4,
  },
  detailBlockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  detailBlockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  detailBlockRowText: {
    flex: 1,
    gap: 1,
  },
  detailBlockLabel: {
    fontSize: 14,
    letterSpacing: 0.05,
  },
  detailBlockNote: {
    fontSize: 11,
    lineHeight: 15,
  },
  detailBlockTime: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
  timelineSection: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  timelineHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  timelineHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 20,
  },
  sectionHint: {
    fontSize: 11,
    fontStyle: "italic",
  },
  timelineList: {
    gap: spacing.md,
    position: "relative",
    paddingLeft: 6,
  },
  timelineRail: {
    position: "absolute",
    left: 21,
    top: 8,
    bottom: 8,
    width: 4,
    borderRadius: radii.pill,
  },
  timelineItem: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  timelineDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    zIndex: 1,
  },
  timelineDotInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineEmoji: {
    fontSize: 17,
    lineHeight: 20,
  },
  timelineCard: {
    flex: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderLeftWidth: 3,
    // Carnet identity: subtle border on remaining 3 edges + warm shadow,
    // so the card sits on the cream page like a journal entry.
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    shadowOpacity: 0.10,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  timelineCardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  timelineCardContent: {
    flex: 1,
  },
  timelineCardButtons: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    paddingTop: 1,
  },
  timelineActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineCardHeader: {},
  timelineTitle: {
    fontSize: 16,
    flex: 1,
  },
  timelineTimeLabel: {
    fontSize: 12,
    fontStyle: "italic",
  },
  timelineCompactLine: {
    fontSize: 14,
    lineHeight: 20,
  },
  timelineTitleInline: {
    fontSize: 14,
  },
  timelineTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  timelineTag: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  timelineTagLabel: {
    fontSize: 11,
  },
  timelineByLine: {
    fontSize: 11,
    marginTop: 3,
    opacity: 0.7,
  },
  viewMoreButton: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  viewMoreLabel: {
    fontSize: 14,
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
  modalTitle: {
    fontSize: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  editTimeRow: {
    flexDirection: "row",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  editTimeField: {
    flex: 1,
    minWidth: 120,
    gap: 4,
  },
  editTimeLabel: {
    fontSize: 13,
    marginLeft: 2,
  },
  editTimePicker: {
    alignSelf: "flex-start",
    marginLeft: -6,
  },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
  },
  historyLinkLabel: {
    fontSize: 13,
  },
});
