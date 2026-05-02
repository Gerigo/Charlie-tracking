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
