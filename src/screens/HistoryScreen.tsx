import { useEffect, useMemo, useState } from 'react';
// HistoryScreen is rendered as a full-screen Modal in the SPA shell.
// Closing is driven by an `onClose` callback prop, not router.back.
import { Icon } from '@/src/components/ui/Icon';
import DateTimePicker from '@/src/components/ui/PlatformDateTimePicker';
import { format } from 'date-fns';
import { fr as dateFnsFr } from 'date-fns/locale';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ActivityIcon } from '@/src/components/editorial/ActivityIcon';
import { AppButton, Card, EmptyState, Screen, SectionTitle } from '@/src/components/ui';
import { EventEditorModal } from '@/src/components/event/EventEditorModal';
import { radii, spacing } from '@/src/constants/theme';
import { stoolColorLabelKey } from '@/src/constants/i18n';
import { useI18n } from '@/src/hooks/useI18n';
import { confirmAction } from '@/src/lib/dialog';
import { triggerSelectionFeedback } from '@/src/lib/feedback';
import { useAppContext } from '@/src/providers/AppProvider';
import { useAppTheme } from '@/src/providers/ThemeProvider';
import type { CareCategory, DiaperType, FeedSide, StoolColor, TrackedEvent } from '@/src/types/domain';
import { inferMedicationCategory } from '@/src/utils/careEvents';
import { formatDateTime, formatDuration, isToday, isYesterday } from '@/src/utils/date';

const PAGE_SIZE = 7; // days per page

function dayKey(timestamp: number) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(timestamp: number, language: string) {
  if (isToday(timestamp)) return language === 'fr' ? "Aujourd'hui" : 'Today';
  if (isYesterday(timestamp)) return language === 'fr' ? 'Hier' : 'Yesterday';
  return format(timestamp, language === 'fr' ? 'EEEE d MMMM' : 'EEEE, MMMM d', {
    locale: language === 'fr' ? dateFnsFr : undefined,
  });
}

function eventMeta(event: TrackedEvent, t: ReturnType<typeof useI18n>['t']) {
  switch (event.type) {
    case 'sleep':
      return { title: t('event.sleep'), iconKind: 'sleep' as const };
    case 'feed':
      if (event.details?.feedSide === 'bottle') {
        return { title: t('event.feed.bottle'), iconKind: 'bottle' as const };
      }
      if (event.details?.bottleSupplement) {
        return { title: t('event.feed.hybrid'), iconKind: 'breast' as const };
      }
      return { title: t('event.feed.nursing'), iconKind: 'breast' as const };
    case 'diaper':
      return { title: t('today.diaper'), iconKind: 'diaper' as const };
    case 'temperature':
      return { title: t('tracker.temperature'), iconKind: 'temperature' as const };
    case 'growth':
      return { title: t('growth.title'), iconKind: 'growth' as const };
    default:
      return inferMedicationCategory(event.details?.medicationName, event.details?.careCategory) === 'visit'
        ? { title: t('tracker.visits'), iconKind: 'visit' as const }
        : { title: t('tracker.care'), iconKind: 'care' as const };
  }
}

function translateMedicationName(value: string | undefined, t: ReturnType<typeof useI18n>['t']) {
  switch (value) {
    case 'vitamin_d':
      return t('tracker.vitamin_d');
    case 'bath':
      return t('tracker.bath');
    case 'midwife':
      return t('tracker.midwife');
    case 'pediatrician':
      return t('tracker.pediatrician');
    case 'one':
      return t('tracker.one');
    default:
      return value ?? t('event.action_recorded');
  }
}

function eventSummary(event: TrackedEvent, t: ReturnType<typeof useI18n>['t']) {
  switch (event.type) {
    case 'feed': {
      const side = event.details?.feedSide;
      const supplement = event.details?.bottleSupplement;
      if (side === 'left' || side === 'right') {
        const sideLabel = side === 'left' ? t('event.feed.left') : t('event.feed.right');
        return supplement ? `${sideLabel} + ${supplement} ml` : sideLabel;
      }
      if (typeof event.details?.feedAmountMl === 'number') return t('event.feed.amount_ml', { value: event.details.feedAmountMl });
      return t('event.feed.recorded');
    }
    case 'diaper':
      return event.details?.stoolColor
        ? `${t(`tracker.${event.details.diaperType === 'wet' ? 'pee' : event.details.diaperType === 'dirty' ? 'poop' : 'both'}` as 'tracker.pee' | 'tracker.poop' | 'tracker.both')} · ${t(stoolColorLabelKey(event.details.stoolColor))}`
        : t(`tracker.${event.details?.diaperType === 'wet' ? 'pee' : event.details?.diaperType === 'dirty' ? 'poop' : 'both'}` as 'tracker.pee' | 'tracker.poop' | 'tracker.both');
    case 'temperature':
      return typeof event.details?.temperature === 'number' ? `${event.details.temperature.toFixed(1)}°C` : t('common.not_available');
    case 'growth':
      return [
        typeof event.details?.weight === 'number' ? `${event.details.weight.toFixed(2)} kg` : null,
        typeof event.details?.height === 'number' ? `${event.details.height.toFixed(1)} cm` : null,
        typeof event.details?.head === 'number' ? `${event.details.head.toFixed(1)} cm` : null,
      ].filter(Boolean).join(' · ');
    case 'medication':
      return translateMedicationName(event.details?.medicationName, t);
    default:
      return event.endTime ? formatDuration(event.startTime, event.endTime) : t('event.sleep_in_progress');
  }
}

const stoolColors: StoolColor[] = ['jaune_pale', 'beige', 'blanc_mastic', 'jaune_or', 'ocre_bronze', 'vert', 'marron', 'noir', 'blanc', 'rouge'];

export function HistoryScreen({ onClose }: { onClose?: () => void } = {}) {
  const { theme } = useAppTheme();
  const { t, language } = useI18n();
  const { events, familyMembers, viewerRole, deleteEvent, refreshData, loadFullHistory } = useAppContext();

  // History journal lets the user scroll to lifetime start → pull older events.
  useEffect(() => {
    void loadFullHistory();
  }, [loadFullHistory]);
  const canManageEvent = (_event: TrackedEvent) =>
    viewerRole === 'manager';

  // Editor lives in <EventEditorModal/>, History just toggles null/event.
  const [editingEvent, setEditingEvent] = useState<TrackedEvent | null>(null);

  const roleLabel = useMemo(() => ({
    manager: t('role.manager'),
    viewer: language === 'fr' ? 'Lecture seule' : 'Read-only',
  }), [t, language]);

  // Group all events by calendar day (events already sorted newest-first by context)
  const daySections = useMemo(() => {
    const map = new Map<string, TrackedEvent[]>();
    for (const event of events) {
      const key = dayKey(event.startTime);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return Array.from(map.entries()).map(([key, dayEvents]) => ({
      key,
      label: dayLabel(dayEvents[0].startTime, language),
      events: dayEvents,
    }));
  }, [events, language]);

  const [maxDays, setMaxDays] = useState(PAGE_SIZE);
  const visibleSections = daySections.slice(0, maxDays);
  const hasMore = daySections.length > maxDays;

  return (
    <Screen onRefresh={refreshData}>
      <SectionTitle
        eyebrow={t('history.eyebrow')}
        title={t('history.title')}
        subtitle={t('history.subtitle')}
        right={(
          <Pressable
            onPress={() => {
              triggerSelectionFeedback();
              onClose?.();
            }}
            style={[styles.backButton, { backgroundColor: theme.surfaceRaised }]}
          >
            <Icon name="close" size={18} color={theme.primary} />
          </Pressable>
        )}
      />

      {events.length === 0 ? (
        <EmptyState title={t('history.empty_title')} body={t('history.empty_body')} />
      ) : (
        <>
          {visibleSections.map((section) => (
            <View key={section.key}>
              <Text style={[styles.dayHeader, { color: theme.textSoft, fontFamily: theme.fontSemiBold }]}>
                {section.label}
              </Text>
              <Card>
                {section.events.map((event, index) => {
                  const meta = eventMeta(event, t);
                  return (
                    <View
                      key={event.id}
                      style={[
                        styles.row,
                        index === section.events.length - 1 ? null : { borderBottomWidth: 1, borderBottomColor: theme.hairline },
                      ]}
                    >
                      <View style={[styles.iconWrap, { backgroundColor: `${theme.primaryContainer}33` }]}>
                        <ActivityIcon kind={meta.iconKind} size={18} color={theme.primary} />
                      </View>
                      <View style={styles.copy}>
                        <View style={styles.titleRow}>
                          <Text style={[styles.title, { color: theme.text, fontFamily: theme.fontBold }]}>{meta.title}</Text>
                          <Text style={[styles.body, { color: theme.textSoft, fontFamily: theme.fontMedium }]}>{formatDateTime(event.startTime)}</Text>
                        </View>
                        <Text style={[styles.body, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
                          {eventSummary(event, t)}
                        </Text>
                        {event.notes ? (
                          <Text style={[styles.body, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>{event.notes}</Text>
                        ) : null}
                        <View style={styles.footerRow}>
                          <Text style={[styles.role, { color: theme.primary, fontFamily: theme.fontSemiBold }]}>
                            {event.createdByLabel ??
                              familyMembers.find((m) => m.uid === event.createdByUserId)?.parentLabel ??
                              (familyMembers.length > 1 ? roleLabel[event.createdByRole] : undefined)}
                          </Text>
                          {canManageEvent(event) ? (
                            <View style={styles.actionRow}>
                              <Pressable onPress={() => setEditingEvent(event)} style={styles.iconAction}>
                                <Icon name="create-outline" size={18} color={theme.textSoft} />
                              </Pressable>
                              <Pressable
                                onPress={() => {
                                  confirmAction(
                                    language === 'fr' ? 'Supprimer' : 'Delete',
                                    language === 'fr' ? 'Supprimer cet événement ?' : 'Delete this event?',
                                    () => void deleteEvent(event.id),
                                    {
                                      confirmLabel: language === 'fr' ? 'Supprimer' : 'Delete',
                                      danger: true,
                                    },
                                  );
                                }}
                                style={styles.iconAction}
                              >
                                <Icon name="trash-outline" size={18} color={theme.danger} />
                              </Pressable>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </Card>
            </View>
          ))}

          {hasMore ? (
            <AppButton
              variant="secondary"
              onPress={() => {
                triggerSelectionFeedback();
                setMaxDays((n) => n + PAGE_SIZE);
              }}
            >
              {language === 'fr'
                ? `Voir ${Math.min(PAGE_SIZE, daySections.length - maxDays)} jours de plus`
                : `Load ${Math.min(PAGE_SIZE, daySections.length - maxDays)} more days`}
            </AppButton>
          ) : null}
        </>
      )}

      {/* Shared editor modal — same as Today + Tracker. */}
      <EventEditorModal event={editingEvent} onClose={() => setEditingEvent(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayHeader: {
    fontSize: 13,
    textTransform: 'capitalize',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    fontSize: 16,
    flex: 1,
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  role: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconAction: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(27, 28, 25, 0.22)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
    shadowOpacity: 0.12,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
  },
  modalTitle: {
    fontSize: 20,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
  editTimeRow: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  editTimeField: {
    flex: 1,
    minWidth: 100,
    gap: 4,
  },
  editTimeLabel: {
    fontSize: 13,
    marginLeft: 2,
  },
  editTimePicker: {
    alignSelf: 'flex-start',
    marginLeft: -6,
  },
});
