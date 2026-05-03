import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Icon } from '@/src/components/ui/Icon';
import DateTimePicker from '@/src/components/ui/PlatformDateTimePicker';
import { format } from 'date-fns';
import { fr as dateFnsFr } from 'date-fns/locale';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ActivityIcon } from '@/src/components/editorial/ActivityIcon';
import { AppButton, AppInput, AppModal, Card, Chip, EmptyState, Screen, SectionTitle } from '@/src/components/ui';
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

export function HistoryScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { t, language } = useI18n();
  const { events, familyMembers, viewerRole, updateEvent, deleteEvent, saving, refreshData } = useAppContext();
  const canManageEvent = (_event: TrackedEvent) =>
    viewerRole === 'manager';
  const [editingEvent, setEditingEvent] = useState<TrackedEvent | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editFeedSide, setEditFeedSide] = useState<FeedSide>('left');
  const [editFeedAmount, setEditFeedAmount] = useState('');
  const [editBottleSupplement, setEditBottleSupplement] = useState('');
  const [editDiaperType, setEditDiaperType] = useState<DiaperType>('wet');
  const [editStoolColor, setEditStoolColor] = useState<StoolColor | null>(null);
  const [editMedicationName, setEditMedicationName] = useState('');
  const [editMedicationCategory, setEditMedicationCategory] = useState<CareCategory>('care');
  const [editTemperature, setEditTemperature] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editHeight, setEditHeight] = useState('');
  const [editHead, setEditHead] = useState('');
  const [editStartTime, setEditStartTime] = useState(new Date());
  const [editEndTime, setEditEndTime] = useState<Date | null>(null);

  const openEditor = (event: TrackedEvent) => {
    setEditingEvent(event);
    setEditNotes(event.notes ?? '');
    setEditFeedSide(event.details?.feedSide ?? 'left');
    setEditFeedAmount(typeof event.details?.feedAmountMl === 'number' ? String(event.details.feedAmountMl) : '');
    setEditBottleSupplement(typeof event.details?.bottleSupplement === 'number' ? String(event.details.bottleSupplement) : '');
    setEditDiaperType(event.details?.diaperType ?? 'wet');
    setEditStoolColor(event.details?.stoolColor ?? null);
    setEditMedicationName(
      translateMedicationName(event.details?.medicationName, t) ??
        event.details?.medicationName ??
        '',
    );
    setEditMedicationCategory(inferMedicationCategory(event.details?.medicationName, event.details?.careCategory));
    setEditTemperature(typeof event.details?.temperature === 'number' ? String(event.details.temperature) : '');
    setEditWeight(typeof event.details?.weight === 'number' ? String(event.details.weight) : '');
    setEditHeight(typeof event.details?.height === 'number' ? String(event.details.height) : '');
    setEditHead(typeof event.details?.head === 'number' ? String(event.details.head) : '');
    const safeStart = typeof event.startTime === 'number' && event.startTime > 0
      ? new Date(event.startTime)
      : new Date();
    setEditStartTime(safeStart);
    setEditEndTime(typeof event.endTime === 'number' && event.endTime > 0 ? new Date(event.endTime) : null);
  };

  const closeEditor = () => {
    setEditingEvent(null);
  };

  const saveEdit = async () => {
    if (!editingEvent) return;

    const timeUpdates = {
      startTime: editStartTime.getTime(),
      ...(editingEvent.type === 'sleep' && editEndTime ? { endTime: editEndTime.getTime() } : {}),
    };

    if (editingEvent.type === 'feed') {
      await updateEvent(editingEvent.id, {
        ...timeUpdates,
        notes: editNotes.trim() || undefined,
        details: {
          ...editingEvent.details,
          feedSide: editFeedSide,
          feedAmountMl: editFeedSide === 'bottle' && editFeedAmount.trim() ? Number(editFeedAmount) : undefined,
          bottleSupplement: (editFeedSide === 'left' || editFeedSide === 'right') && editBottleSupplement.trim() ? Number(editBottleSupplement) : undefined,
        },
      });
    } else if (editingEvent.type === 'diaper') {
      await updateEvent(editingEvent.id, {
        ...timeUpdates,
        notes: editNotes.trim() || undefined,
        details: {
          ...editingEvent.details,
          diaperType: editDiaperType,
          stoolColor: editDiaperType === 'dirty' || editDiaperType === 'both' ? editStoolColor ?? undefined : undefined,
        },
      });
    } else if (editingEvent.type === 'medication') {
      await updateEvent(editingEvent.id, {
        ...timeUpdates,
        notes: editNotes.trim() || undefined,
        details: {
          ...editingEvent.details,
          medicationName: editMedicationName.trim() || undefined,
          careCategory: editMedicationCategory,
        },
      });
    } else if (editingEvent.type === 'temperature') {
      await updateEvent(editingEvent.id, {
        ...timeUpdates,
        notes: editNotes.trim() || undefined,
        details: {
          ...editingEvent.details,
          temperature: editTemperature.trim() ? Number(editTemperature.replace(',', '.')) : undefined,
        },
      });
    } else if (editingEvent.type === 'growth') {
      await updateEvent(editingEvent.id, {
        ...timeUpdates,
        notes: editNotes.trim() || undefined,
        details: {
          ...editingEvent.details,
          weight: editWeight.trim() ? Number(editWeight.replace(',', '.')) : undefined,
          height: editHeight.trim() ? Number(editHeight.replace(',', '.')) : undefined,
          head: editHead.trim() ? Number(editHead.replace(',', '.')) : undefined,
        },
      });
    } else {
      await updateEvent(editingEvent.id, { ...timeUpdates, notes: editNotes.trim() || undefined });
    }

    closeEditor();
  };

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
              router.back();
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
                              <Pressable onPress={() => openEditor(event)} style={styles.iconAction}>
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

      <AppModal visible={Boolean(editingEvent)} onClose={closeEditor}>
          <Pressable style={[styles.modalCard, { backgroundColor: theme.surfaceLowest, shadowColor: theme.shadow }]} onPress={(event) => event.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: theme.text, fontFamily: theme.fontSemiBold }]}>
              {editingEvent ? eventMeta(editingEvent, t).title : t('history.edit_event')}
            </Text>

            {/* Date + time pickers */}
            <View style={styles.editTimeRow}>
              <View style={styles.editTimeField}>
                <Text style={[styles.editTimeLabel, { color: theme.textMuted, fontFamily: theme.fontMedium }]}>
                  Date
                </Text>
                <DateTimePicker
                  key={`date-${editStartTime.getTime()}`}
                  value={editStartTime}
                  mode="date"
                  display="compact"
                  locale={language}
                  themeVariant={theme.isDark ? 'dark' : 'light'}
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
                <Text style={[styles.editTimeLabel, { color: theme.textMuted, fontFamily: theme.fontMedium }]}>
                  {editingEvent?.type === 'sleep' ? 'Début' : 'Heure'}
                </Text>
                <DateTimePicker
                  key={`time-${editStartTime.getTime()}`}
                  value={editStartTime}
                  mode="time"
                  display="compact"
                  locale={language}
                  themeVariant={theme.isDark ? 'dark' : 'light'}
                  textColor={theme.text}
                  accentColor={theme.primary}
                  onChange={(_, date) => { if (date) setEditStartTime(date); }}
                  style={styles.editTimePicker}
                />
              </View>
              {editingEvent?.type === 'sleep' && editEndTime ? (
                <View style={styles.editTimeField}>
                  <Text style={[styles.editTimeLabel, { color: theme.textMuted, fontFamily: theme.fontMedium }]}>
                    Réveil
                  </Text>
                  <DateTimePicker
                    key={`end-${editEndTime?.getTime()}`}
                    value={editEndTime}
                    mode="time"
                    display="compact"
                    locale={language}
                    themeVariant={theme.isDark ? 'dark' : 'light'}
                    textColor={theme.text}
                    accentColor={theme.primary}
                    onChange={(_, date) => { if (date) setEditEndTime(date); }}
                    style={styles.editTimePicker}
                  />
                </View>
              ) : null}
            </View>

            {editingEvent?.type === 'feed' ? (
              <>
                <View style={styles.chipsRow}>
                  <Chip label={t('event.feed.left')} selected={editFeedSide === 'left'} tone="feed" onPress={() => setEditFeedSide('left')} />
                  <Chip label={t('event.feed.right')} selected={editFeedSide === 'right'} tone="feed" onPress={() => setEditFeedSide('right')} />
                  <Chip label={t('event.feed.bottle')} selected={editFeedSide === 'bottle'} tone="feed" onPress={() => setEditFeedSide('bottle')} />
                </View>
                {editFeedSide === 'bottle' ? (
                  <AppInput
                    label={t('tracker.amount_ml')}
                    value={editFeedAmount}
                    onChangeText={setEditFeedAmount}
                    keyboardType="number-pad"
                    placeholder="120"
                  />
                ) : null}
                {(editFeedSide === 'left' || editFeedSide === 'right') ? (
                  <AppInput
                    label={language === 'fr' ? 'Complément biberon (ml, optionnel)' : 'Bottle supplement (ml, optional)'}
                    value={editBottleSupplement}
                    onChangeText={setEditBottleSupplement}
                    keyboardType="number-pad"
                    placeholder="60"
                  />
                ) : null}
              </>
            ) : null}

            {editingEvent?.type === 'diaper' ? (
              <>
                <View style={styles.chipsRow}>
                  <Chip label={t('tracker.pee')} selected={editDiaperType === 'wet'} tone="success" onPress={() => setEditDiaperType('wet')} />
                  <Chip label={t('tracker.poop')} selected={editDiaperType === 'dirty'} tone="warning" onPress={() => setEditDiaperType('dirty')} />
                  <Chip label={t('tracker.both')} selected={editDiaperType === 'both'} tone="warning" onPress={() => setEditDiaperType('both')} />
                </View>
                {editDiaperType === 'dirty' || editDiaperType === 'both' ? (
                  <View style={styles.chipsRow}>
                    {stoolColors.map((color) => (
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

            {editingEvent?.type === 'medication' ? (
              <>
                <View style={styles.chipsRow}>
                  <Chip label={t('tracker.care')} selected={editMedicationCategory === 'care'} tone="success" onPress={() => setEditMedicationCategory('care')} />
                  <Chip label={t('tracker.visits')} selected={editMedicationCategory === 'visit'} tone="neutral" onPress={() => setEditMedicationCategory('visit')} />
                </View>
                <AppInput
                  label={editMedicationCategory === 'visit' ? t('tracker.visits') : t('tracker.care')}
                  value={editMedicationName}
                  onChangeText={setEditMedicationName}
                  placeholder={editMedicationCategory === 'visit' ? t('tracker.pediatrician') : t('tracker.vitamin_d')}
                />
              </>
            ) : null}

            {editingEvent?.type === 'temperature' ? (
              <AppInput
                label={t('tracker.temperature')}
                value={editTemperature}
                onChangeText={setEditTemperature}
                keyboardType="decimal-pad"
                placeholder="36.8"
              />
            ) : null}

            {editingEvent?.type === 'growth' ? (
              <>
                <AppInput label={t('growth.weight_label')} value={editWeight} onChangeText={setEditWeight} keyboardType="decimal-pad" placeholder="4.2" />
                <AppInput label={t('growth.height_label')} value={editHeight} onChangeText={setEditHeight} keyboardType="decimal-pad" placeholder="55.4" />
                <AppInput label={t('growth.head_label')} value={editHead} onChangeText={setEditHead} keyboardType="decimal-pad" placeholder="37.5" />
              </>
            ) : null}

            <AppInput
              label={t('common.optional_note')}
              value={editNotes}
              onChangeText={setEditNotes}
              placeholder={t('tracker.note_placeholder')}
            />

            <View style={styles.modalActions}>
              <AppButton style={styles.modalButton} variant="secondary" onPress={closeEditor}>
                {t('common.cancel')}
              </AppButton>
              <AppButton style={styles.modalButton} disabled={saving} onPress={() => void saveEdit()}>
                {t('common.save')}
              </AppButton>
            </View>
          </Pressable>
      </AppModal>
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
