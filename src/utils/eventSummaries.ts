import { isSameDay, startOfDay } from 'date-fns';
import { type ActiveSession, type FeedSide, type TrackedEvent } from '@/src/types/domain';
import { inferMedicationCategory } from '@/src/utils/careEvents';

export interface DailySummary {
  totalSleepMinutes: number;
  feedCount: number;
  diaperCount: number;
  medicationCount: number;
  visitCount: number;
  temperatures: Array<{ value: number; label: string }>;
}

export function getEventsForDay(events: TrackedEvent[], date: Date) {
  const dayStart = startOfDay(date).getTime();
  const nextDayStart = startOfDay(new Date(date.getTime() + 24 * 60 * 60 * 1000)).getTime();
  return events.filter((event) => {
    if ((event.endTime ?? event.startTime) < dayStart) return false;
    return event.startTime < nextDayStart;
  });
}

/**
 * Compute the sleep minutes that "belong" to a given day under the
 * end-day attribution rule used by Today and the daily summary.
 *
 *   - Completed sessions count their FULL duration on the day they
 *     ENDED. A night that started yesterday at 22:00 and ended today
 *     at 08:00 contributes 10h to today's total (and 0h to yesterday).
 *     This matches how parents think about "last night's sleep" when
 *     they open the app in the morning.
 *   - The active (in-progress) session counts from start to now, but
 *     only when "now" is in the day being viewed. The live counter
 *     belongs to the day it's running on, regardless of when the
 *     session started.
 *   - An optional `cutoff` timestamp limits both kinds of contribution
 *     so callers can compare today-so-far with yesterday-at-the-same-
 *     time.
 */
function sleepMinutesForDay(
  events: TrackedEvent[],
  dayStart: number,
  nextDayStart: number,
  activeSession: ActiveSession | null,
  cutoff: number,
): number {
  let total = 0;
  for (const event of events) {
    if (event.type !== 'sleep') continue;
    const isActive = activeSession?.eventId === event.id && event.endTime == null;

    if (event.endTime != null && !isActive) {
      // Completed → attribute to end-day, full duration.
      if (event.endTime >= dayStart && event.endTime <= cutoff) {
        total += Math.max(0, Math.round((event.endTime - event.startTime) / 60000));
      }
      continue;
    }

    if (isActive) {
      // Active session — attribute its running total to the day "now"
      // is in. Don't double-attribute it to the start day if "now"
      // has already crossed midnight.
      const now = Date.now();
      if (now < dayStart || now >= nextDayStart) continue;
      const end = Math.min(now, cutoff);
      if (end <= event.startTime) continue;
      total += Math.max(0, Math.round((end - event.startTime) / 60000));
    }
  }
  return total;
}

export function getDailySummary(events: TrackedEvent[], activeSession: ActiveSession | null, date = new Date()): DailySummary {
  const scopedEvents = getEventsForDay(events, date);
  const dayStart = startOfDay(date).getTime();
  const nextDayStart = dayStart + 24 * 60 * 60 * 1000;

  const summary: DailySummary = {
    totalSleepMinutes: 0,
    feedCount: 0,
    diaperCount: 0,
    medicationCount: 0,
    visitCount: 0,
    temperatures: [],
  };

  // Sleep total uses the end-day attribution rule (see
  // sleepMinutesForDay) so a 22h→08h night reads as 10h on the
  // morning view, not 8h.
  summary.totalSleepMinutes = sleepMinutesForDay(
    events,
    dayStart,
    nextDayStart,
    activeSession,
    nextDayStart,
  );

  for (const event of scopedEvents) {
    if (event.type === 'feed') summary.feedCount += 1;
    if (event.type === 'diaper') summary.diaperCount += 1;
    if (event.type === 'medication') {
      if (inferMedicationCategory(event.details?.medicationName, event.details?.careCategory) === 'visit') {
        summary.visitCount += 1;
      } else {
        summary.medicationCount += 1;
      }
    }
    if (event.type === 'temperature' && typeof event.details?.temperature === 'number') {
      summary.temperatures.push({
        value: event.details.temperature,
        label: event.details.temperaturePeriod === 'evening' ? 'Soir' : 'Matin',
      });
    }
  }

  return summary;
}

/**
 * Sum sleep minutes inside a given day, optionally up to a wall-clock
 * cutoff. Mirrors `countFeedsUntil` on the consumer side: lets the
 * "Today" screen compare *sleep so far* to the same offset yesterday.
 *
 * Uses the same end-day attribution as `getDailySummary` so the delta
 * stays consistent with the displayed total: a 22h→08h night counts
 * fully on the morning of the day it ENDED, not split across the two
 * calendar days it intersects.
 */
export function sumSleepMinutesUntil(
  events: TrackedEvent[],
  date: Date,
  cutoffTimestamp: number,
  activeSession?: ActiveSession | null,
): number {
  const dayStart = startOfDay(date).getTime();
  const nextDayStart = dayStart + 24 * 60 * 60 * 1000;
  const cutoff = Math.min(cutoffTimestamp, nextDayStart);
  return sleepMinutesForDay(events, dayStart, nextDayStart, activeSession ?? null, cutoff);
}

export function getLastFeedSide(events: TrackedEvent[]): FeedSide | null {
  const feed = [...events]
    .filter((event) => event.type === 'feed' && event.details?.feedSide)
    .sort((a, b) => b.startTime - a.startTime)[0];
  return feed?.details?.feedSide ?? null;
}

export function getLastEventOfType(events: TrackedEvent[], type: TrackedEvent['type']) {
  return [...events]
    .filter((event) => event.type === type)
    .sort((a, b) => b.startTime - a.startTime)[0] ?? null;
}

export function getGrowthEntries(events: TrackedEvent[]) {
  return [...events]
    .filter((event) => event.type === 'growth')
    .sort((a, b) => a.startTime - b.startTime);
}

export function isEventToday(event: TrackedEvent) {
  return isSameDay(event.startTime, Date.now());
}
