import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@/src/components/ui/PlatformDateTimePicker';
import { AppButton, AppInput, AppModal, Chip } from '@/src/components/ui';
import { radii, spacing } from '@/src/constants/theme';
import { stoolColorLabelKey } from '@/src/constants/i18n';
import { useI18n } from '@/src/hooks/useI18n';
import { useAppContext, type ManualEventInput } from '@/src/providers/AppProvider';
import { useAppTheme } from '@/src/providers/ThemeProvider';
import type { CareCategory, DiaperType, FeedSide, StoolColor, TrackedEvent } from '@/src/types/domain';
import { inferMedicationCategory } from '@/src/utils/careEvents';

/**
 * Shared event editor modal.
 *
 * Used by HistoryScreen, TrackerScreen, and any other surface that
 * displays the day timeline and wants to let parents tweak past
 * entries. Encapsulates all the per-type form state + the save logic
 * so callers just plug in `event` + `onClose`.
 *
 * The modal renders only when `event` is non-null. Caller resets `event`
 * to null after `onClose`.
 */

const stoolColors: StoolColor[] = [
  'jaune_pale',
  'beige',
  'blanc_mastic',
  'jaune_or',
  'ocre_bronze',
  'vert',
  'marron',
  'noir',
  'blanc',
  'rouge',
];

function translateMedicationName(value: string | undefined, t: ReturnType<typeof useI18n>['t']) {
  switch (value) {
    case 'vitamin_d': return t('tracker.vitamin_d');
    case 'bath': return t('tracker.bath');
    case 'midwife': return t('tracker.midwife');
    case 'pediatrician': return t('tracker.pediatrician');
    case 'one': return t('tracker.one');
    default: return value ?? t('event.action_recorded');
  }
}

type CreateType = 'feed' | 'diaper' | 'medication' | 'temperature' | 'growth' | 'sleep';

interface Props {
  /** Event being edited. Pass `null` + `createMode=true` to open in
   *  creation mode; pass `null` + `createMode=false` (or omit) to close. */
  event: TrackedEvent | null;
  onClose: () => void;
  /** When true and event is null, the modal opens in creation mode with
   *  a type picker. */
  createMode?: boolean;
  /** Default day for the new event (creation mode). Defaults to today. */
  defaultDate?: Date;
}

export function EventEditorModal({ event, onClose, createMode, defaultDate }: Props) {
  const { theme } = useAppTheme();
  const { t, language } = useI18n();
  const { updateEvent, createManualEvent, saving } = useAppContext();

  const isOpen = createMode || event !== null;
  const isCreating = createMode && !event;
  // The "active" type drives which fields render. In edit mode it comes
  // from the event; in create mode it's a state controlled by the chip
  // picker. Default to 'feed' as the most common manual entry.
  const [createType, setCreateType] = useState<CreateType>('feed');
  const activeType: CreateType | TrackedEvent['type'] = event?.type ?? createType;

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

  // Hydrate the form ONLY when the modal transitions to a new
  // event/mode — not on every parent render. Without this guard, the
  // create-mode reset path was firing whenever `t` or `defaultDate`
  // changed identity (each parent render), wiping the user's chip
  // selection back to "feed" the moment they tapped "Couche".
  const lastEventIdRef = useRef<string | null>(null);
  const wasCreatingRef = useRef<boolean>(false);
  // Refs to read the latest props inside the effect without depending
  // on them (would otherwise cause spurious re-runs).
  const defaultDateRef = useRef(defaultDate);
  defaultDateRef.current = defaultDate;
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    const transitionedToEvent = event && event.id !== lastEventIdRef.current;
    const transitionedToCreate = isCreating && !wasCreatingRef.current;

    if (transitionedToEvent) {
      lastEventIdRef.current = event.id;
      wasCreatingRef.current = false;
      setEditNotes(event.notes ?? '');
      setEditFeedSide(event.details?.feedSide ?? 'left');
      setEditFeedAmount(typeof event.details?.feedAmountMl === 'number' ? String(event.details.feedAmountMl) : '');
      setEditBottleSupplement(typeof event.details?.bottleSupplement === 'number' ? String(event.details.bottleSupplement) : '');
      setEditDiaperType(event.details?.diaperType ?? 'wet');
      setEditStoolColor(event.details?.stoolColor ?? null);
      setEditMedicationName(
        translateMedicationName(event.details?.medicationName, tRef.current) ??
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
      return;
    }

    if (transitionedToCreate) {
      lastEventIdRef.current = null;
      wasCreatingRef.current = true;
      const now = new Date();
      const start = defaultDateRef.current ? new Date(defaultDateRef.current) : now;
      start.setHours(now.getHours(), now.getMinutes(), 0, 0);
      setEditNotes('');
      setEditFeedSide('left');
      setEditFeedAmount('');
      setEditBottleSupplement('');
      setEditDiaperType('wet');
      setEditStoolColor(null);
      setEditMedicationName('');
      setEditMedicationCategory('care');
      setEditTemperature('');
      setEditWeight('');
      setEditHeight('');
      setEditHead('');
      setEditStartTime(start);
      setEditEndTime(new Date(start.getTime() + 60 * 60 * 1000));
      setCreateType('feed');
      return;
    }

    // Modal was just closed (no event, not creating) — reset the refs
    // so the next open re-triggers a hydrate.
    if (!event && !isCreating) {
      lastEventIdRef.current = null;
      wasCreatingRef.current = false;
    }
  }, [event, isCreating]);

  const saveCreate = async () => {
    const startTime = editStartTime.getTime();
    let payload: ManualEventInput;
    switch (createType) {
      case 'feed':
        payload = {
          type: 'feed',
          startTime,
          notes: editNotes.trim() || undefined,
          details: {
            feedSide: editFeedSide,
            ...(editFeedSide === 'bottle' && editFeedAmount.trim()
              ? { feedAmountMl: Number(editFeedAmount) }
              : {}),
            ...((editFeedSide === 'left' || editFeedSide === 'right') && editBottleSupplement.trim()
              ? { bottleSupplement: Number(editBottleSupplement) }
              : {}),
          },
        };
        break;
      case 'diaper':
        payload = {
          type: 'diaper',
          startTime,
          notes: editNotes.trim() || undefined,
          details: {
            diaperType: editDiaperType,
            ...((editDiaperType === 'dirty' || editDiaperType === 'both') && editStoolColor
              ? { stoolColor: editStoolColor }
              : {}),
          },
        };
        break;
      case 'medication':
        payload = {
          type: 'medication',
          startTime,
          notes: editNotes.trim() || undefined,
          details: {
            medicationName: editMedicationName.trim() || undefined,
            careCategory: editMedicationCategory,
          },
        };
        break;
      case 'temperature':
        payload = {
          type: 'temperature',
          startTime,
          notes: editNotes.trim() || undefined,
          details: { temperature: Number((editTemperature || '0').replace(',', '.')) },
        };
        break;
      case 'growth':
        payload = {
          type: 'growth',
          startTime,
          notes: editNotes.trim() || undefined,
          details: {
            ...(editWeight.trim() ? { weight: Number(editWeight.replace(',', '.')) } : {}),
            ...(editHeight.trim() ? { height: Number(editHeight.replace(',', '.')) } : {}),
            ...(editHead.trim() ? { head: Number(editHead.replace(',', '.')) } : {}),
          },
        };
        break;
      case 'sleep': {
        // If the user bumped the start time past the (auto-set) end time,
        // pad the end forward by 1 minute so the save still succeeds rather
        // than silently aborting.
        const rawEnd = (editEndTime ?? new Date(startTime + 60 * 60 * 1000)).getTime();
        const end = rawEnd <= startTime ? startTime + 60 * 1000 : rawEnd;
        payload = {
          type: 'sleep',
          startTime,
          endTime: end,
          notes: editNotes.trim() || undefined,
        };
        break;
      }
    }
    await createManualEvent(payload);
    onClose();
  };

  const saveEdit = async () => {
    if (!event) return;
    const startMs = editStartTime.getTime();
    // Sleep: if the user bumped the start past the saved end, push the end
    // forward so we never persist start > end (otherwise the event becomes
    // invisible in the day timeline).
    const sleepEndMs =
      event.type === 'sleep' && editEndTime
        ? Math.max(editEndTime.getTime(), startMs + 60 * 1000)
        : null;
    const timeUpdates = {
      startTime: startMs,
      ...(sleepEndMs !== null ? { endTime: sleepEndMs } : {}),
    };
    if (event.type === 'feed') {
      await updateEvent(event.id, {
        ...timeUpdates,
        notes: editNotes.trim() || undefined,
        details: {
          ...event.details,
          feedSide: editFeedSide,
          feedAmountMl:
            editFeedSide === 'bottle' && editFeedAmount.trim() ? Number(editFeedAmount) : undefined,
          bottleSupplement:
            (editFeedSide === 'left' || editFeedSide === 'right') && editBottleSupplement.trim()
              ? Number(editBottleSupplement)
              : undefined,
        },
      });
    } else if (event.type === 'diaper') {
      await updateEvent(event.id, {
        ...timeUpdates,
        notes: editNotes.trim() || undefined,
        details: {
          ...event.details,
          diaperType: editDiaperType,
          stoolColor:
            editDiaperType === 'dirty' || editDiaperType === 'both'
              ? editStoolColor ?? undefined
              : undefined,
        },
      });
    } else if (event.type === 'medication') {
      await updateEvent(event.id, {
        ...timeUpdates,
        notes: editNotes.trim() || undefined,
        details: {
          ...event.details,
          medicationName: editMedicationName.trim() || undefined,
          careCategory: editMedicationCategory,
        },
      });
    } else if (event.type === 'temperature') {
      await updateEvent(event.id, {
        ...timeUpdates,
        notes: editNotes.trim() || undefined,
        details: {
          ...event.details,
          temperature: editTemperature.trim() ? Number(editTemperature.replace(',', '.')) : undefined,
        },
      });
    } else if (event.type === 'growth') {
      await updateEvent(event.id, {
        ...timeUpdates,
        notes: editNotes.trim() || undefined,
        details: {
          ...event.details,
          weight: editWeight.trim() ? Number(editWeight.replace(',', '.')) : undefined,
          height: editHeight.trim() ? Number(editHeight.replace(',', '.')) : undefined,
          head: editHead.trim() ? Number(editHead.replace(',', '.')) : undefined,
        },
      });
    } else {
      await updateEvent(event.id, { ...timeUpdates, notes: editNotes.trim() || undefined });
    }
    onClose();
  };

  return (
    <AppModal visible={isOpen} onClose={onClose}>
      <Pressable
        style={[styles.modalCard, { backgroundColor: theme.surfaceLowest, shadowColor: theme.shadow }]}
        onPress={(e) => e.stopPropagation()}
      >
        <Text style={[styles.modalTitle, { color: theme.text, fontFamily: theme.fontSemiBold }]}>
          {isCreating
            ? language === 'fr' ? 'Ajouter un événement' : 'Add event'
            : language === 'fr' ? 'Modifier l\'événement' : 'Edit event'}
        </Text>

        {/* Type picker — only shown in creation mode */}
        {isCreating ? (
          <View style={styles.chipsRow}>
            <Chip label={t('tracker.feed')} selected={createType === 'feed'} tone="feed" onPress={() => setCreateType('feed')} />
            <Chip label={t('today.diaper')} selected={createType === 'diaper'} tone="success" onPress={() => setCreateType('diaper')} />
            <Chip label={t('tracker.sleep')} selected={createType === 'sleep'} tone="sleep" onPress={() => setCreateType('sleep')} />
            <Chip label={t('tracker.care')} selected={createType === 'medication'} tone="neutral" onPress={() => setCreateType('medication')} />
            <Chip label={t('tracker.temperature')} selected={createType === 'temperature'} tone="warning" onPress={() => setCreateType('temperature')} />
            <Chip label={t('event.growth.weighing')} selected={createType === 'growth'} tone="neutral" onPress={() => setCreateType('growth')} />
          </View>
        ) : null}

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
              {activeType === 'sleep' ? 'Début' : 'Heure'}
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
              onChange={(_, date) => {
                if (date) setEditStartTime(date);
              }}
              style={styles.editTimePicker}
            />
          </View>
          {activeType === 'sleep' && editEndTime ? (
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
                onChange={(_, date) => {
                  if (date) setEditEndTime(date);
                }}
                style={styles.editTimePicker}
              />
            </View>
          ) : null}
        </View>

        {activeType === 'feed' ? (
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
            {editFeedSide === 'left' || editFeedSide === 'right' ? (
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

        {activeType === 'diaper' ? (
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

        {activeType === 'medication' ? (
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

        {activeType === 'temperature' ? (
          <AppInput
            label={t('tracker.temperature')}
            value={editTemperature}
            onChangeText={setEditTemperature}
            keyboardType="decimal-pad"
            placeholder="36.8"
          />
        ) : null}

        {activeType === 'growth' ? (
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
          <AppButton style={styles.modalButton} variant="secondary" onPress={onClose}>
            {t('common.cancel')}
          </AppButton>
          <AppButton
            style={styles.modalButton}
            disabled={saving}
            onPress={() => void (isCreating ? saveCreate() : saveEdit())}
          >
            {t('common.save')}
          </AppButton>
        </View>
      </Pressable>
    </AppModal>
  );
}

const styles = StyleSheet.create({
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
    gap: 4,
    flex: 1,
    minWidth: 140,
  },
  editTimeLabel: {
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  editTimePicker: {
    alignSelf: 'flex-start',
  },
});
