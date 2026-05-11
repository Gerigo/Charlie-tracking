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

  for (const event of scopedEvents) {
    if (event.type === 'sleep') {
      // Proportional split — a session is counted on every calendar
      // day it intersects, in proportion. The contiguous "night" view
      // (which crosses midnight) lives in getLastNightSleep below, so
      // this total can stay strictly per-calendar-day and never bias
      // long-term aggregates that consume the same numbers.
      const effectiveEnd = event.endTime ?? (activeSession?.eventId === event.id ? Date.now() : event.startTime);
      const overlapStart = Math.max(event.startTime, dayStart);
      const overlapEnd = Math.min(effectiveEnd, nextDayStart);
      summary.totalSleepMinutes += Math.max(0, Math.round((overlapEnd - overlapStart) / 60000));
    }

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
 * Uses the same proportional split as `getDailySummary` so the delta
 * stays consistent with the displayed total. The contiguous-night
 * view is a separate concern handled by `getLastNightSleep`.
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

  let total = 0;
  for (const event of events) {
    if (event.type !== 'sleep') continue;
    if (event.startTime >= cutoff) continue;

    const isActive = activeSession?.eventId === event.id && event.endTime == null;
    const effectiveEnd = isActive
      ? Math.min(Date.now(), cutoff)
      : event.endTime ?? event.startTime;

    const overlapStart = Math.max(event.startTime, dayStart);
    const overlapEnd = Math.min(effectiveEnd, cutoff);
    if (overlapEnd <= overlapStart) continue;
    total += Math.max(0, Math.round((overlapEnd - overlapStart) / 60000));
  }
  return total;
}

/**
 * Result of `getLastNightSleep` — the contiguous cluster of sleep
 * sessions that make up the night ending on the given morning.
 */
export interface LastNightSleep {
  /** When the first session of the cluster started. Typically the
   *  previous evening. */
  startTime: number;
  /** When the last session of the cluster ended (or `Date.now()` if
   *  it's still ongoing). */
  endTime: number;
  /** Total sleep minutes across every sub-session in the cluster. A
   *  baby that slept 22→02:30 + 03:00→07:00 reads as 570 min. */
  totalMinutes: number;
  /** How many gaps (wake-ups) the cluster contains. 0 = uninterrupted
   *  night, 1+ = the parent had to feed / soothe at least once. */
  wakeUps: number;
  /** True if the latest session of the cluster is still running. */
  ongoing: boolean;
}

/**
 * Reconstruct "last night's sleep" for the morning of `date` — the
 * contiguous cluster of sleep sessions that ended (or is still
 * ending) in the early-morning window. Sessions separated by less
 * than `NIGHT_GAP_MS` (default 2h, the typical night-feed break) are
 * grouped into the same night. This is purely a display helper: the
 * per-day totals above keep using the simple proportional split so
 * historical averages stay honest.
 *
 * Returns null when there's no recent sleep that fits the morning
 * window — e.g. on a day where the baby skipped the night entirely,
 * or when looking at a future day.
 */
const NIGHT_GAP_MS = 2 * 60 * 60 * 1000;
const NIGHT_MORNING_END_HOUR = 11;
const NIGHT_LOOKBACK_HOURS = 18;

export function getLastNightSleep(
  events: TrackedEvent[],
  date: Date,
  activeSession: ActiveSession | null,
): LastNightSleep | null {
  const dayStart = startOfDay(date).getTime();
  const morningEnd = dayStart + NIGHT_MORNING_END_HOUR * 60 * 60 * 1000;
  const earliest = dayStart - NIGHT_LOOKBACK_HOURS * 60 * 60 * 1000;
  const now = Date.now();

  // Each sleep session normalised with its effective end. We only
  // consider sessions whose effective end falls in the morning
  // window — anything later is a daytime nap, not "the night".
  type Item = { startTime: number; endTime: number; ongoing: boolean };
  const items: Item[] = [];
  for (const event of events) {
    if (event.type !== 'sleep') continue;
    const isActive = activeSession?.eventId === event.id && event.endTime == null;
    const end = isActive ? now : event.endTime;
    if (end == null) continue;
    if (end <= earliest || end > morningEnd) continue;
    items.push({ startTime: event.startTime, endTime: end, ongoing: isActive });
  }
  if (items.length === 0) return null;
  // Order chronologically so the cluster-building walks forward in
  // time and the last cluster is the most recent one (= the night).
  items.sort((a, b) => a.startTime - b.startTime);

  let cluster: Item[] = [];
  for (const item of items) {
    if (cluster.length === 0) {
      cluster.push(item);
      continue;
    }
    const prev = cluster[cluster.length - 1];
    const gap = item.startTime - prev.endTime;
    if (gap <= NIGHT_GAP_MS && gap >= 0) {
      cluster.push(item);
    } else {
      // Long break — the new session starts a fresh cluster, the
      // previous one is discarded (we only ever surface the most
      // recent night).
      cluster = [item];
    }
  }

  const startTime = cluster[0].startTime;
  const last = cluster[cluster.length - 1];
  const totalMinutes = cluster.reduce(
    (acc, item) => acc + Math.max(0, Math.round((item.endTime - item.startTime) / 60000)),
    0,
  );
  return {
    startTime,
    endTime: last.endTime,
    totalMinutes,
    wakeUps: cluster.length - 1,
    ongoing: last.ongoing,
  };
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
