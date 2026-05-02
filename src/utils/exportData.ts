import { differenceInCalendarDays, endOfDay, format, startOfDay } from 'date-fns';
import type { TrackedEvent, TrackedEventType } from '@/src/types/domain';

const ALL_EVENT_TYPES: TrackedEventType[] = ['sleep', 'feed', 'diaper', 'medication', 'growth', 'temperature'];

export interface ExportDateRange {
  fromDate: string;
  toDate: string;
}

export interface ExportRecord {
  id: string;
  type: TrackedEventType;
  status: 'completed' | 'ongoing';
  userId: string | null;
  actorRole: string | null;
  notes: string | null;
  startTimestamp: number;
  endTimestamp: number | null;
  startAt: string;
  endAt: string | null;
  durationMinutes: number | null;
  startDate: string;
  endDate: string | null;
  diaperType: string | null;
  stoolColor: string | null;
  feedSide: string | null;
  feedAmountMl: number | null;
  medicationName: string | null;
  careCategory: string | null;
  temperatureC: number | null;
  temperaturePeriod: string | null;
  weightKg: number | null;
  heightCm: number | null;
  headCircumferenceCm: number | null;
}

export interface ExportPayload {
  schemaVersion: string;
  exportedAt: string;
  timezone: string;
  source: string;
  period: {
    fromDate: string;
    toDate: string;
    fromTimestamp: number;
    toTimestamp: number;
    days: number;
  };
  summary: {
    eventCount: number;
    completedCount: number;
    ongoingCount: number;
    activeDays: number;
    firstEventAt: string | null;
    lastEventAt: string | null;
    countsByType: Record<TrackedEventType, number>;
  };
  records: ExportRecord[];
}

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`);
}

function getEffectiveEnd(event: TrackedEvent) {
  return event.endTime ?? Date.now();
}

function normalizeRange(range: ExportDateRange): ExportDateRange {
  return range.fromDate <= range.toDate ? range : { fromDate: range.toDate, toDate: range.fromDate };
}

export function getExportDateBounds(events: TrackedEvent[]) {
  const today = format(new Date(), 'yyyy-MM-dd');
  if (events.length === 0) return { minDate: today, maxDate: today };

  const minTimestamp = Math.min(...events.map((event) => event.startTime));
  const maxTimestamp = Math.max(...events.map((event) => getEffectiveEnd(event)));
  return {
    minDate: format(minTimestamp, 'yyyy-MM-dd'),
    maxDate: format(maxTimestamp, 'yyyy-MM-dd'),
  };
}

export function filterEventsForExport(events: TrackedEvent[], range: ExportDateRange) {
  const normalized = normalizeRange(range);
  const rangeStart = startOfDay(parseDateKey(normalized.fromDate)).getTime();
  const rangeEnd = endOfDay(parseDateKey(normalized.toDate)).getTime();

  return events
    .filter((event) => {
      if (event.type === 'sleep' || event.type === 'feed') {
        return event.startTime <= rangeEnd && getEffectiveEnd(event) >= rangeStart;
      }

      return event.startTime >= rangeStart && event.startTime <= rangeEnd;
    })
    .sort((left, right) => left.startTime - right.startTime);
}

function buildRecord(event: TrackedEvent): ExportRecord {
  const startAt = new Date(event.startTime);
  const endAt = event.endTime ? new Date(event.endTime) : null;

  return {
    id: event.id,
    type: event.type,
    status: event.endTime === null ? 'ongoing' : 'completed',
    userId: event.createdByUserId ?? null,
    actorRole: event.createdByRole ?? null,
    notes: event.notes ?? null,
    startTimestamp: event.startTime,
    endTimestamp: event.endTime,
    startAt: startAt.toISOString(),
    endAt: endAt ? endAt.toISOString() : null,
    durationMinutes: event.endTime ? Math.max(0, Math.round((event.endTime - event.startTime) / 60000)) : null,
    startDate: format(startAt, 'yyyy-MM-dd'),
    endDate: endAt ? format(endAt, 'yyyy-MM-dd') : null,
    diaperType: event.details?.diaperType ?? null,
    stoolColor: event.details?.stoolColor ?? null,
    feedSide: event.details?.feedSide ?? null,
    feedAmountMl: typeof event.details?.feedAmountMl === 'number' ? event.details.feedAmountMl : null,
    medicationName: event.details?.medicationName ?? null,
    careCategory: event.details?.careCategory ?? null,
    temperatureC: typeof event.details?.temperature === 'number' ? event.details.temperature : null,
    temperaturePeriod: event.details?.temperaturePeriod ?? null,
    weightKg: typeof event.details?.weight === 'number' ? event.details.weight : null,
    heightCm: typeof event.details?.height === 'number' ? event.details.height : null,
    headCircumferenceCm: typeof event.details?.head === 'number' ? event.details.head : null,
  };
}

export function buildExportPayload(events: TrackedEvent[], range: ExportDateRange): ExportPayload {
  const normalized = normalizeRange(range);
  const filteredEvents = filterEventsForExport(events, normalized);
  const records = filteredEvents.map(buildRecord);
  const countsByType = ALL_EVENT_TYPES.reduce<Record<TrackedEventType, number>>((accumulator, type) => {
    accumulator[type] = records.filter((record) => record.type === type).length;
    return accumulator;
  }, {} as Record<TrackedEventType, number>);

  return {
    schemaVersion: '1.2',
    exportedAt: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    source: 'luna',
    period: {
      fromDate: normalized.fromDate,
      toDate: normalized.toDate,
      fromTimestamp: startOfDay(parseDateKey(normalized.fromDate)).getTime(),
      toTimestamp: endOfDay(parseDateKey(normalized.toDate)).getTime(),
      days: differenceInCalendarDays(parseDateKey(normalized.toDate), parseDateKey(normalized.fromDate)) + 1,
    },
    summary: {
      eventCount: records.length,
      completedCount: records.filter((record) => record.status === 'completed').length,
      ongoingCount: records.filter((record) => record.status === 'ongoing').length,
      activeDays: new Set(records.map((record) => record.startDate)).size,
      firstEventAt: records[0]?.startAt ?? null,
      lastEventAt: records.at(-1)?.endAt ?? records.at(-1)?.startAt ?? null,
      countsByType,
    },
    records,
  };
}

function escapeCsvCell(value: unknown) {
  const stringValue = value === null || value === undefined ? '' : String(value);

  if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function buildExportCsv(events: TrackedEvent[], range: ExportDateRange) {
  const payload = buildExportPayload(events, range);
  const headers: Array<keyof ExportRecord> = [
    'id',
    'type',
    'status',
    'userId',
    'actorRole',
    'notes',
    'startTimestamp',
    'endTimestamp',
    'startAt',
    'endAt',
    'durationMinutes',
    'startDate',
    'endDate',
    'diaperType',
    'stoolColor',
    'feedSide',
    'feedAmountMl',
    'medicationName',
    'careCategory',
    'temperatureC',
    'temperaturePeriod',
    'weightKg',
    'heightCm',
    'headCircumferenceCm',
  ];

  const rows = payload.records.map((record) => headers.map((header) => escapeCsvCell(record[header])).join(','));
  return [headers.join(','), ...rows].join('\n');
}
