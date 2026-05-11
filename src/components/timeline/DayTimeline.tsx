import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/src/components/ui/Icon';
import { stoolColorLabelKey } from '@/src/constants/i18n';
import { getActivityEmoji } from '@/src/constants/activityEmojis';
import type { ActivityIconKind } from '@/src/components/editorial/ActivityIcon';
import { radii, spacing, type AppTheme } from '@/src/constants/theme';
import { useI18n } from '@/src/hooks/useI18n';
import { useAppTheme } from '@/src/providers/ThemeProvider';
import type { DiaperType, TrackedEvent } from '@/src/types/domain';
import { formatClock, formatDuration } from '@/src/utils/date';
import { getEventsForDay } from '@/src/utils/eventSummaries';
import { inferMedicationCategory } from '@/src/utils/careEvents';

/**
 * Read-only timeline of one day's events. Used both on the Today screen
 * (with edit/delete handlers passed in) and on the Tracker screen
 * (read-only as a quick reference of what's been logged so far today).
 *
 * The visual identity matches the Today version exactly: rail with dots
 * + paper card per event, accent colour as a left bookmark, tag chips
 * for sleep duration / temperature / stool colour.
 */

interface DayTimelineProps {
  events: TrackedEvent[];
  /** Day to display. Defaults to today. */
  day?: Date;
  /** Initial preview limit before "View more". Defaults to 5. */
  previewLimit?: number;
  /** Show eyebrow + section title above the list. Defaults to true. */
  showHeader?: boolean;
  /** When provided, renders an edit pencil on each event card. */
  onEdit?: (event: TrackedEvent) => void;
  /** When provided, renders a trash icon on each event card. */
  onDelete?: (event: TrackedEvent) => void;
  /** When provided, renders a "+" pill in the section header — fires
   *  with no args; the parent screen opens the EventEditorModal in
   *  create mode. */
  onAddEvent?: () => void;
}

export function DayTimeline({
  events,
  day,
  previewLimit = 5,
  showHeader = true,
  onEdit,
  onDelete,
  onAddEvent,
}: DayTimelineProps) {
  const { theme } = useAppTheme();
  const { t, language } = useI18n();
  const [showAll, setShowAll] = useState(false);

  const dayEvents = useMemo(() => {
    const target = day ?? new Date();
    return getEventsForDay(events, target).sort((a, b) => b.startTime - a.startTime);
  }, [events, day]);

  const visible = useMemo(
    () => (showAll ? dayEvents : dayEvents.slice(0, previewLimit)),
    [showAll, dayEvents, previewLimit],
  );

  if (dayEvents.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={[styles.emptyTitle, { color: theme.textSoft, fontFamily: theme.fontDisplayItalic }]}>
          {language === 'fr' ? 'Aucun événement aujourd\'hui' : 'No events today'}
        </Text>
        <Text style={[styles.emptyBody, { color: theme.textSoft, fontFamily: theme.fontRegular }]}>
          {language === 'fr'
            ? 'Les actions enregistrées s\'afficheront ici.'
            : 'Logged actions will appear here.'}
        </Text>
        {onAddEvent ? (
          <Pressable
            onPress={onAddEvent}
            style={[styles.emptyAddBtn, { borderColor: theme.primary }]}
          >
            <Icon name="add" size={14} color={theme.primary} />
            <Text style={[styles.emptyAddLabel, { color: theme.primary, fontFamily: theme.fontSemiBold }]}>
              {language === 'fr' ? 'Ajouter manuellement' : 'Add manually'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.section}>
      {showHeader ? (
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text
              style={[styles.title, { color: theme.text, fontFamily: theme.fontSemiBold }]}
            >
              {language === 'fr' ? 'Fil de la journée' : "Today's timeline"}
            </Text>
            <Text style={[styles.hint, { color: theme.textSoft, fontFamily: theme.fontRegular }]}>
              {language === 'fr' ? 'Du plus récent au plus ancien' : 'Newest to oldest'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {onAddEvent ? (
              <Pressable
                onPress={onAddEvent}
                style={[styles.headerActionBtn, { backgroundColor: theme.primary }]}
                hitSlop={6}
              >
                <Icon name="add" size={16} color={theme.onPrimary} />
              </Pressable>
            ) : null}
            {dayEvents.length > previewLimit ? (
              <Pressable
                onPress={() => setShowAll((c) => !c)}
                style={[styles.viewMoreBtn, { backgroundColor: theme.surfaceLowest, borderColor: theme.cardBorder }]}
              >
                <Icon
                  name={showAll ? 'remove' : 'add'}
                  size={16}
                  color={theme.primary}
                />
                <Text style={[styles.viewMoreLabel, { color: theme.primary, fontFamily: theme.fontBold }]}>
                  {showAll ? t('common.view_less') : t('common.view_more')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.list}>
        <View
          style={[styles.rail, { backgroundColor: theme.surfaceContainerHigh }]}
        />
        {visible.map((event) => {
          const meta = describeEvent(event, t, language);
          const accent = getAccentForKind(meta.iconKind, theme);
          const tags = buildEventTags(event, t, language);
          return (
            <View key={event.id} style={styles.item}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: theme.surfaceLowest,
                    shadowColor: theme.shadow,
                    borderColor: `${accent}2E`,
                  },
                ]}
              >
                <View style={[styles.dotInner, { backgroundColor: `${accent}18` }]}>
                  <Text style={styles.emoji}>{getActivityEmoji(meta.iconKind)}</Text>
                </View>
              </View>
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.surfaceLowest,
                    borderLeftColor: accent,
                    borderColor: theme.cardBorder,
                    shadowColor: theme.shadow,
                  },
                ]}
              >
                <Text
                  style={[styles.compactLine, { color: theme.textMuted, fontFamily: theme.fontRegular }]}
                >
                  <Text
                    style={[styles.timeLabel, { color: accent, fontFamily: theme.fontBold }]}
                  >
                    {formatClock(event.startTime)}
                  </Text>
                  <Text>{'  '}</Text>
                  <Text style={[styles.titleInline, { color: theme.text, fontFamily: theme.fontBold }]}>
                    {meta.title}
                  </Text>
                  {meta.body ? (
                    <>
                      <Text>{' · '}</Text>
                      <Text>{meta.body}</Text>
                    </>
                  ) : null}
                </Text>
                {tags.length > 0 ? (
                  <View style={styles.tagsRow}>
                    {tags.map((tag) => (
                      <View
                        key={`${event.id}-${tag}`}
                        style={[styles.tag, { backgroundColor: `${accent}14`, borderColor: `${accent}22` }]}
                      >
                        <Text style={[styles.tagLabel, { color: accent, fontFamily: theme.fontMedium }]}>
                          {tag}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {onEdit || onDelete ? (
                  <View style={styles.cardActions}>
                    {onEdit ? (
                      <Pressable
                        onPress={() => onEdit(event)}
                        style={styles.actionBtn}
                        hitSlop={6}
                      >
                        <Icon name="pencil-outline" size={15} color={theme.textSoft} />
                      </Pressable>
                    ) : null}
                    {onDelete ? (
                      <Pressable
                        onPress={() => onDelete(event)}
                        style={styles.actionBtn}
                        hitSlop={6}
                      >
                        <Icon name="trash-outline" size={15} color={theme.textSoft} />
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Helpers (same logic as TodayScreen, kept inline so the timeline
//      module is self-contained and can be reused without dragging
//      private functions across screens) ─────────────────────────────

type TimelineKind = ActivityIconKind;

function translateCareLabel(value: string | undefined, t: ReturnType<typeof useI18n>['t']) {
  switch (value) {
    case 'vitamin_d':
    case 'Vitamine D':
      return t('tracker.vitamin_d');
    case 'bath':
    case 'Bain':
      return t('tracker.bath');
    case 'midwife':
    case 'SF':
    case 'Sage Femme':
      return t('tracker.midwife');
    case 'pediatrician':
    case 'Pédiatre':
      return t('tracker.pediatrician');
    case 'one':
    case 'ONE':
      return t('tracker.one');
    default:
      return value ?? t('event.action_recorded');
  }
}

function translateDiaperType(value: DiaperType | undefined, t: ReturnType<typeof useI18n>['t']) {
  switch (value) {
    case 'wet':
      return t('tracker.pee');
    case 'dirty':
      return t('tracker.poop');
    case 'both':
      return t('tracker.both');
    default:
      return t('today.diaper');
  }
}

function describeEvent(
  event: TrackedEvent,
  t: ReturnType<typeof useI18n>['t'],
  _language: 'fr' | 'en',
): { title: string; body: string; iconKind: TimelineKind } {
  switch (event.type) {
    case 'feed': {
      const side = event.details?.feedSide;
      const supplement = event.details?.bottleSupplement;
      if (side === 'bottle') {
        return {
          title: t('event.feed.bottle'),
          body:
            typeof event.details?.feedAmountMl === 'number'
              ? t('event.feed.amount_ml', { value: event.details.feedAmountMl })
              : t('event.feed.recorded'),
          iconKind: 'bottle',
        };
      }
      const sideLabel = side === 'left' ? t('event.feed.left') : t('event.feed.right');
      return {
        title: supplement ? t('event.feed.hybrid') : t('event.feed.nursing'),
        body: supplement ? `${sideLabel} + ${supplement} ml` : sideLabel,
        iconKind: 'breast',
      };
    }
    case 'growth':
      return {
        title: t('event.growth.weighing'),
        body: t('event.growth.new_measure'),
        iconKind: 'growth',
      };
    case 'sleep':
      return {
        title: t('tracker.sleep'),
        body: event.endTime
          ? t('event.sleep_duration', { value: formatDuration(event.startTime, event.endTime) })
          : t('event.sleep_in_progress'),
        iconKind: 'sleep',
      };
    case 'temperature':
      return {
        title: t('tracker.temperature'),
        body: '',
        iconKind: 'temperature',
      };
    case 'pumping': {
      const side = event.details?.pumpingSide;
      const total = event.details?.pumpingVolumeMl;
      const left = event.details?.pumpingLeftMl;
      const right = event.details?.pumpingRightMl;
      // Side label (G / D / Deux) keeps things compact on the timeline
      // card — the volume goes in the tags row below.
      const sideLabel =
        side === 'left'
          ? t('tracker.pumping_side_left')
          : side === 'right'
            ? t('tracker.pumping_side_right')
            : side === 'both'
              ? t('tracker.pumping_side_both')
              : '';
      let body = sideLabel;
      if (side === 'both' && typeof left === 'number' && typeof right === 'number') {
        body = `${sideLabel} · ${left} + ${right} ml`;
      } else if (typeof total === 'number') {
        body = sideLabel ? `${sideLabel} · ${total} ml` : `${total} ml`;
      }
      return {
        title: t('tracker.pumping'),
        body,
        iconKind: 'pumping',
      };
    }
    case 'medication': {
      const category = inferMedicationCategory(
        event.details?.medicationName,
        event.details?.careCategory,
      );
      return {
        title:
          category === 'visit'
            ? t('tracker.visits')
            : translateCareLabel(event.details?.medicationName, t),
        body: event.notes?.trim() ? event.notes.trim() : t('event.action_recorded'),
        iconKind: category === 'visit' ? 'visit' : 'care',
      };
    }
    case 'diaper':
      return {
        title: t('today.diaper'),
        body: translateDiaperType(event.details?.diaperType, t),
        iconKind: 'diaper',
      };
    default:
      return {
        title: t('tracker.care'),
        body: t('event.action_recorded'),
        iconKind: 'care',
      };
  }
}

function buildEventTags(
  event: TrackedEvent,
  t: ReturnType<typeof useI18n>['t'],
  language: 'fr' | 'en',
): string[] {
  if (event.type === 'sleep') {
    if (typeof event.endTime === 'number') {
      return [language === 'fr' ? `Fin ${formatClock(event.endTime)}` : `Ended ${formatClock(event.endTime)}`];
    }
    return [language === 'fr' ? 'En cours' : 'Ongoing'];
  }
  if (event.type === 'temperature' && typeof event.details?.temperature === 'number') {
    return [
      `${event.details.temperature.toFixed(1)}°C`,
      event.details?.temperaturePeriod
        ? event.details.temperaturePeriod === 'evening'
          ? t('common.evening')
          : t('common.morning')
        : language === 'fr'
          ? 'Relevé'
          : 'Reading',
    ];
  }
  if (
    event.type === 'diaper' &&
    event.details?.stoolColor &&
    (event.details.diaperType === 'dirty' || event.details.diaperType === 'both')
  ) {
    return [language === 'fr' ? 'Selle' : 'Stool', t(stoolColorLabelKey(event.details.stoolColor))];
  }
  return [];
}

function getAccentForKind(kind: TimelineKind, theme: AppTheme): string {
  switch (kind) {
    case 'sleep':
      return theme.sleep;
    case 'breast':
    case 'bottle':
    case 'pumping':
      return theme.feed;
    case 'diaper':
      return theme.diaper;
    case 'temperature':
      return theme.temperature;
    case 'growth':
      return theme.growth;
    case 'visit':
      return theme.visit;
    case 'care':
    default:
      return theme.primary;
  }
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    letterSpacing: -0.2,
  },
  hint: {
    fontSize: 12,
    letterSpacing: 0.1,
  },
  viewMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  viewMoreLabel: {
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  list: {
    position: 'relative',
    paddingLeft: 4,
    gap: spacing.sm,
  },
  rail: {
    position: 'absolute',
    top: 14,
    bottom: 14,
    left: 25,
    width: 1.5,
    opacity: 0.6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  dot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.10,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    marginTop: 2,
  },
  dotInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 18,
  },
  card: {
    flex: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    shadowOpacity: 0.10,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
    gap: 6,
  },
  compactLine: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  timeLabel: {
    fontSize: 13,
    letterSpacing: 0.1,
  },
  titleInline: {
    fontSize: 13.5,
    letterSpacing: -0.1,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  tagLabel: {
    fontSize: 10.5,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 4,
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  actionBtn: {
    padding: 4,
  },
  emptyWrap: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  emptyTitle: {
    fontSize: 18,
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize: 13,
    textAlign: 'center',
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    marginTop: 8,
  },
  emptyAddLabel: {
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
