import DateTimePicker from '@/src/components/ui/PlatformDateTimePicker';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Icon } from '@/src/components/ui/Icon';
import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { EditorialTopBar } from '@/src/components/editorial/TopBar';
import { ActivityIcon } from '@/src/components/editorial/ActivityIcon';
import { AppBadge, AppButton, Card, EmptyState, Screen } from '@/src/components/ui';
import { radii, spacing } from '@/src/constants/theme';
import { useI18n } from '@/src/hooks/useI18n';
import { triggerSelectionFeedback } from '@/src/lib/feedback';
import { useAppContext } from '@/src/providers/AppProvider';
import { useAppTheme } from '@/src/providers/ThemeProvider';
import type { TrackedEventType } from '@/src/types/domain';
import { inferMedicationCategory } from '@/src/utils/careEvents';
import { buildExportCsv, buildExportPayload, getExportDateBounds, type ExportDateRange } from '@/src/utils/exportData';

type PresetRange = '7' | '14' | 'all' | 'custom';
type DateField = 'from' | 'to';

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return format(date, 'yyyy-MM-dd');
}

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`);
}

function formatVisibleDate(dateKey: string, language: 'fr' | 'en') {
  return new Intl.DateTimeFormat(language === 'fr' ? 'fr-BE' : 'en-US', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parseDateKey(dateKey));
}

function presetRangeToBounds(preset: PresetRange, minDate: string, maxDate: string): ExportDateRange {
  switch (preset) {
    case '7':
      return { fromDate: dateDaysAgo(6), toDate: maxDate };
    case '14':
      return { fromDate: dateDaysAgo(13), toDate: maxDate };
    default:
      return { fromDate: minDate, toDate: maxDate };
  }
}

async function shareFile(name: string, content: string, mimeType: string, fallbackMessage: string) {
  const available = await Sharing.isAvailableAsync();
  if (!available || !FileSystem.cacheDirectory) {
    await Clipboard.setStringAsync(content);
    return fallbackMessage;
  }

  const uri = `${FileSystem.cacheDirectory}${name}`;
  await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: name });
  return fallbackMessage;
}

function describeType(type: TrackedEventType, t: ReturnType<typeof useI18n>['t'], medicationCategory?: 'care' | 'visit') {
  switch (type) {
    case 'sleep':
      return { label: t('tracker.sleep'), iconKind: 'sleep' as const, tone: 'sleep' as const };
    case 'feed':
      return { label: t('tracker.feed'), iconKind: 'feed' as const, tone: 'feed' as const };
    case 'diaper':
      return { label: t('today.diaper'), iconKind: 'diaper' as const, tone: 'diaper' as const };
    case 'medication':
      return medicationCategory === 'visit'
        ? { label: t('tracker.visits'), iconKind: 'visit' as const, tone: 'neutral' as const }
        : { label: t('tracker.care'), iconKind: 'care' as const, tone: 'success' as const };
    case 'growth':
      return { label: t('growth.title'), iconKind: 'growth' as const, tone: 'warning' as const };
    case 'temperature':
      return { label: t('tracker.temperature'), iconKind: 'temperature' as const, tone: 'temperature' as const };
    default:
      return { label: type, iconKind: 'data' as const, tone: 'neutral' as const };
  }
}

export function DataScreen({ onClose }: { onClose?: () => void } = {}) {
  const { theme } = useAppTheme();
  const { t, language } = useI18n();
  const { events, viewerRole } = useAppContext();
  const canExportData = viewerRole === 'manager';
  const bounds = useMemo(() => getExportDateBounds(events), [events]);
  const [rangePreset, setRangePreset] = useState<PresetRange>('all');
  const [fromDate, setFromDate] = useState(bounds.minDate);
  const [toDate, setToDate] = useState(bounds.maxDate);
  const [pickerField, setPickerField] = useState<DateField | null>(null);
  const [pickerValue, setPickerValue] = useState(new Date());

  const selectedRange = useMemo(() => {
    if (rangePreset === 'custom') {
      return fromDate <= toDate ? { fromDate, toDate } : { fromDate: toDate, toDate: fromDate };
    }
    if (rangePreset === 'all') return { fromDate: bounds.minDate, toDate: bounds.maxDate };
    return presetRangeToBounds(rangePreset, bounds.minDate, bounds.maxDate);
  }, [bounds.maxDate, bounds.minDate, fromDate, rangePreset, toDate]);

  const payload = useMemo(() => buildExportPayload(events, selectedRange), [events, selectedRange]);
  const counts = useMemo(() => {
    const medicationCareCount = payload.records.filter((record) => record.type === 'medication' && inferMedicationCategory(record.medicationName ?? undefined, record.careCategory === 'visit' ? 'visit' : record.careCategory === 'care' ? 'care' : undefined) === 'care').length;
    const medicationVisitCount = payload.records.filter((record) => record.type === 'medication' && inferMedicationCategory(record.medicationName ?? undefined, record.careCategory === 'visit' ? 'visit' : record.careCategory === 'care' ? 'care' : undefined) === 'visit').length;
    const items: Array<[TrackedEventType, number, 'care' | 'visit' | undefined]> = [
      ['sleep', payload.summary.countsByType.sleep, undefined],
      ['feed', payload.summary.countsByType.feed, undefined],
      ['diaper', payload.summary.countsByType.diaper, undefined],
      ['medication', medicationCareCount, 'care'],
      ['medication', medicationVisitCount, 'visit'],
      ['temperature', payload.summary.countsByType.temperature, undefined],
      ['growth', payload.summary.countsByType.growth, undefined],
    ];
    return items.filter(([, value]) => value > 0);
  }, [payload.records, payload.summary.countsByType]);

  const openPicker = (field: DateField) => {
    triggerSelectionFeedback();
    setPickerField(field);
    setPickerValue(parseDateKey(field === 'from' ? selectedRange.fromDate : selectedRange.toDate));
  };

  const closePicker = () => setPickerField(null);

  const confirmPicker = () => {
    const nextKey = format(pickerValue, 'yyyy-MM-dd');
    setRangePreset('custom');
    if (pickerField === 'from') {
      setFromDate(nextKey);
    } else if (pickerField === 'to') {
      setToDate(nextKey);
    }
    closePicker();
  };

  const exportJson = async () => {
    await shareFile(
      `charlie-data-${selectedRange.fromDate}_${selectedRange.toDate}.json`,
      `${JSON.stringify(payload, null, 2)}\n`,
      'application/json',
      t('data.export_copied'),
    );
  };

  const exportCsv = async () => {
    await shareFile(
      `charlie-data-${selectedRange.fromDate}_${selectedRange.toDate}.csv`,
      buildExportCsv(events, selectedRange),
      'text/csv',
      t('data.export_copied'),
    );
  };

  if (events.length === 0) {
    return (
      <Screen>
        {onClose ? (
          <View style={[styles.modalHeader, { borderBottomColor: theme.hairline }]}>
            <Text style={[styles.modalTitle, { color: theme.text, fontFamily: theme.fontSemiBold }]}>
              {t('data.title')}
            </Text>
            <Pressable onPress={onClose} style={styles.modalCloseBtn} hitSlop={12}>
              <Icon name="close" size={22} color={theme.textSoft} />
            </Pressable>
          </View>
        ) : (
          <EditorialTopBar />
        )}
        <EmptyState title={t('data.title')} body={t('data.empty_period')} />
      </Screen>
    );
  }

  return (
    <Screen>
      {onClose ? (
        <View style={[styles.modalHeader, { borderBottomColor: theme.hairline }]}>
          <Text style={[styles.modalTitle, { color: theme.text, fontFamily: theme.fontSemiBold }]}>
            {t('data.title')}
          </Text>
          <Pressable onPress={onClose} style={styles.modalCloseBtn} hitSlop={12}>
            <Icon name="close" size={22} color={theme.textSoft} />
          </Pressable>
        </View>
      ) : (
        <EditorialTopBar />
      )}

      <View style={styles.hero}>
        <Text style={[styles.title, { color: theme.text, fontFamily: theme.fontLight }]}>{t('data.title')}</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>{t('data.subtitle')}</Text>
      </View>

      <Card>
        <View style={styles.selectorRow}>
          {[
            { value: '7' as const, label: t('data.range_7') },
            { value: '14' as const, label: t('data.range_14') },
            { value: 'all' as const, label: t('data.range_all_short') },
          ].map((option) => {
            const selected = rangePreset === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  triggerSelectionFeedback();
                  setRangePreset(option.value);
                }}
                style={[styles.selectorChip, { backgroundColor: selected ? theme.secondaryContainer : theme.surfaceRaised }]}
              >
                <Text style={[styles.selectorLabel, { color: theme.text, fontFamily: selected ? theme.fontBold : theme.fontMedium }]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.dateRow}>
          <Pressable
            onPress={() => openPicker('from')}
            style={[styles.dateCard, { backgroundColor: theme.surfaceRaised, borderColor: theme.cardBorderStrong }]}
          >
            <View style={styles.dateCardHeader}>
              <Text style={[styles.dateLabel, { color: theme.textSoft, fontFamily: theme.fontBold }]}>{t('common.from')}</Text>
              <Icon name="calendar-outline" size={16} color={theme.primary} />
            </View>
            <Text style={[styles.dateValue, { color: theme.text, fontFamily: theme.fontSemiBold }]}>
              {formatVisibleDate(selectedRange.fromDate, language)}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => openPicker('to')}
            style={[styles.dateCard, { backgroundColor: theme.surfaceRaised, borderColor: theme.cardBorderStrong }]}
          >
            <View style={styles.dateCardHeader}>
              <Text style={[styles.dateLabel, { color: theme.textSoft, fontFamily: theme.fontBold }]}>{t('common.to')}</Text>
              <Icon name="calendar-outline" size={16} color={theme.primary} />
            </View>
            <Text style={[styles.dateValue, { color: theme.text, fontFamily: theme.fontSemiBold }]}>
              {formatVisibleDate(selectedRange.toDate, language)}
            </Text>
          </Pressable>
        </View>

        <AppBadge
          label={`${formatVisibleDate(selectedRange.fromDate, language)} → ${formatVisibleDate(selectedRange.toDate, language)}`}
          tone="neutral"
        />
      </Card>

      <View style={styles.metricsGrid}>
        <Card compact style={styles.metricCard}>
          <Text style={[styles.metricLabel, { color: theme.textSoft, fontFamily: theme.fontBold }]}>{t('data.events')}</Text>
          <Text style={[styles.metricValue, { color: theme.text, fontFamily: theme.fontBold }]}>{payload.summary.eventCount}</Text>
        </Card>
        <Card compact style={styles.metricCard}>
          <Text style={[styles.metricLabel, { color: theme.textSoft, fontFamily: theme.fontBold }]}>{t('data.active_days')}</Text>
          <Text style={[styles.metricValue, { color: theme.text, fontFamily: theme.fontBold }]}>{payload.summary.activeDays}</Text>
        </Card>
      </View>

      {canExportData ? (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.text, fontFamily: theme.fontSemiBold }]}>{t('data.export_actions')}</Text>
          <View style={styles.actionsRow}>
            <AppButton style={styles.actionButton} onPress={() => void exportJson()}>
              {t('data.export_json')}
            </AppButton>
            <AppButton style={styles.actionButton} variant="secondary" onPress={() => void exportCsv()}>
              {t('data.export_csv')}
            </AppButton>
          </View>
        </Card>
      ) : null}

      <Card>
        <Text style={[styles.cardTitle, { color: theme.text, fontFamily: theme.fontSemiBold }]}>{t('data.breakdown_title')}</Text>
        {counts.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>{t('data.empty_period')}</Text>
        ) : (
          <View style={styles.countGrid}>
            {counts.map(([type, count, medicationCategory]) => {
              const meta = describeType(type, t, medicationCategory);
              return (
                <View key={`${type}-${medicationCategory ?? 'base'}`} style={[styles.countCard, { backgroundColor: theme.surfaceRaised }]}>
                  <View style={[styles.countIcon, { backgroundColor: `${theme.primary}10` }]}>
                    <ActivityIcon kind={meta.iconKind} size={18} color={theme.primary} />
                  </View>
                  <View style={styles.countCopy}>
                    <Text style={[styles.countLabel, { color: theme.text, fontFamily: theme.fontSemiBold }]}>{meta.label}</Text>
                    <Text style={[styles.countValue, { color: theme.textSoft, fontFamily: theme.fontMedium }]}>{count}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Card>

      <Modal transparent animationType="fade" visible={Boolean(pickerField)} onRequestClose={closePicker}>
        <Pressable style={styles.modalOverlay} onPress={closePicker}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: theme.surfaceLowest, shadowColor: theme.shadow }]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={[styles.cardTitle, { color: theme.text, fontFamily: theme.fontSemiBold }]}>
              {pickerField === 'from' ? t('data.pick_from_date') : t('data.pick_to_date')}
            </Text>
            <DateTimePicker
              value={pickerValue}
              mode="date"
              locale={language}
              themeVariant={theme.isDark ? 'dark' : 'light'}
              textColor={theme.text}
              accentColor={theme.primary}
              maximumDate={parseDateKey(bounds.maxDate)}
              minimumDate={parseDateKey(bounds.minDate)}
              onChange={(_event, selected) => {
                if (selected) {
                  setPickerValue(selected);
                  const nextKey = format(selected, 'yyyy-MM-dd');
                  setRangePreset('custom');
                  if (pickerField === 'from') setFromDate(nextKey);
                  if (pickerField === 'to') setToDate(nextKey);
                }
                closePicker();
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: 17,
  },
  modalCloseBtn: {
    padding: spacing.sm,
  },
  hero: {
    gap: spacing.xs,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  selectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  selectorChip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectorLabel: {
    fontSize: 12,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dateCard: {
    flex: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
  },
  dateCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dateValue: {
    fontSize: 14,
    lineHeight: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  metricValue: {
    marginTop: spacing.xs,
    fontSize: 28,
  },
  cardTitle: {
    fontSize: 18,
    marginBottom: spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  countGrid: {
    gap: spacing.sm,
  },
  countCard: {
    borderRadius: radii.lg,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  countIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countCopy: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  countLabel: {
    fontSize: 15,
  },
  countValue: {
    fontSize: 15,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
});
