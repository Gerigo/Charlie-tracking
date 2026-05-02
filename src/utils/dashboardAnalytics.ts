import { differenceInCalendarDays, eachDayOfInterval, endOfDay, format, startOfDay } from 'date-fns';
import type { TrackedEvent, TrackedEventType } from '@/src/types/domain';

export const HOURS_PER_DAY = 24;
const DAY_MINUTES = 24 * 60;
const MIN_MEAL_OBSERVATION_MINUTES = 30;

export interface HourRange {
  start: number;
  end: number;
}

export interface TrendPoint {
  hour: number;
  sleepPercent: number;
  mealPercent: number;
  awakePercent: number;
}

export interface TrendOverview {
  usageDays: number;
  firstDataDateLabel: string;
  averageSleepMinutesPerDay: number;
  averageMealsPerDay: number;
  yDomainMax: number;
  points: TrendPoint[];
  sleepRanges: HourRange[];
  awakeRanges: HourRange[];
  mealRanges: HourRange[];
}

export interface DashboardData {
  overview: TrendOverview | null;
  sleepByDay: Array<{ date: string; sleepHours: number }>;
  mealsByDay: Array<{ date: string; mealCount: number }>;
  temperatureByDay: Array<{ date: string; morning: number | null; evening: number | null }>;
}

function inferTemperaturePeriod(event: TrackedEvent) {
  if (event.details?.temperaturePeriod) return event.details.temperaturePeriod;
  const hour = new Date(event.startTime).getHours();
  return hour < 15 ? 'morning' : 'evening';
}

export function dayKeyFromTimestamp(timestamp: number) {
  return format(new Date(timestamp), 'yyyy-MM-dd');
}

export function minutesSinceMidnight(timestamp: number) {
  const date = new Date(timestamp);
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

function addEventDays(dayKeys: Set<string>, startTime: number, endTime: number) {
  const cursor = new Date(startTime);
  cursor.setHours(0, 0, 0, 0);

  const end = new Date(endTime);
  end.setHours(0, 0, 0, 0);

  while (cursor.getTime() <= end.getTime()) {
    dayKeys.add(format(cursor, 'yyyy-MM-dd'));
    cursor.setDate(cursor.getDate() + 1);
  }
}

function addMinutesToHours(target: number[], startTime: number, endTime: number) {
  let cursor = new Date(startTime);
  const end = new Date(endTime);

  while (cursor.getTime() < end.getTime()) {
    const hour = cursor.getHours();
    const nextBoundary = new Date(cursor);
    nextBoundary.setHours(hour + 1, 0, 0, 0);

    const segmentEnd = Math.min(nextBoundary.getTime(), end.getTime());
    target[hour] += (segmentEnd - cursor.getTime()) / 60000;
    cursor = new Date(segmentEnd);
  }
}

function addObservableWindow(observableMinutesByHour: number[], observableMealDaysByHour: number[], startMinute: number, endMinute: number) {
  if (endMinute <= startMinute) return;

  for (let hour = 0; hour < HOURS_PER_DAY; hour += 1) {
    const hourStart = hour * 60;
    const hourEnd = hourStart + 60;
    const overlap = Math.max(0, Math.min(hourEnd, endMinute) - Math.max(hourStart, startMinute));

    if (overlap > 0) observableMinutesByHour[hour] += overlap;
    if (overlap >= MIN_MEAL_OBSERVATION_MINUTES) observableMealDaysByHour[hour] += 1;
  }
}

function addMinutesByDay(target: Map<string, number>, startTime: number, endTime: number) {
  let cursor = new Date(startTime);
  const end = new Date(endTime);

  while (cursor.getTime() < end.getTime()) {
    const endOfCurrentDay = endOfDay(cursor);
    const segmentEnd = Math.min(endOfCurrentDay.getTime(), end.getTime());
    const key = format(cursor, 'yyyy-MM-dd');
    target.set(key, (target.get(key) ?? 0) + (segmentEnd - cursor.getTime()) / 60000);
    cursor = new Date(segmentEnd + 1);
  }
}

export function buildDailyBuckets(startTimestamp: number) {
  const start = startOfDay(new Date(startTimestamp));
  const end = startOfDay(new Date());

  return eachDayOfInterval({ start, end }).map((day) => ({
    key: format(day, 'yyyy-MM-dd'),
    date: format(day, 'dd/MM'),
  }));
}

export function buildHourRanges(values: number[], threshold: number) {
  const ranges: HourRange[] = [];
  let start: number | null = null;

  for (let hour = 0; hour <= HOURS_PER_DAY; hour += 1) {
    const active = hour < HOURS_PER_DAY && values[hour] >= threshold;

    if (active && start === null) start = hour;
    if (!active && start !== null) {
      ranges.push({ start, end: hour });
      start = null;
    }
  }

  return ranges;
}

export function invertRanges(ranges: HourRange[]) {
  if (ranges.length === 0) return [{ start: 0, end: HOURS_PER_DAY }];

  const awakeRanges: HourRange[] = [];
  let cursor = 0;

  ranges.forEach((range) => {
    if (range.start > cursor) awakeRanges.push({ start: cursor, end: range.start });
    cursor = range.end;
  });

  if (cursor < HOURS_PER_DAY) awakeRanges.push({ start: cursor, end: HOURS_PER_DAY });
  return awakeRanges;
}

export function buildDashboardData(events: TrackedEvent[]): DashboardData {
  const trackerEvents = events.filter((event) => event.type !== 'growth' && event.type !== 'temperature');
  const temperatureEvents = events.filter((event) => event.type === 'temperature');

  let overview: TrendOverview | null = null;
  let sleepByDay: Array<{ date: string; sleepHours: number }> = [];
  let mealsByDay: Array<{ date: string; mealCount: number }> = [];
  let temperatureByDay: Array<{ date: string; morning: number | null; evening: number | null }> = [];

  if (trackerEvents.length > 0) {
    const sleepMinutesByHour = Array.from({ length: HOURS_PER_DAY }, () => 0);
    const observableMinutesByHour = Array.from({ length: HOURS_PER_DAY }, () => 0);
    const observableMealDaysByHour = Array.from({ length: HOURS_PER_DAY }, () => 0);
    const mealDaysByHour = Array.from({ length: HOURS_PER_DAY }, () => 0);
    const touchedDays = new Set<string>();
    const mealPresenceByDay = new Map<string, Set<number>>();
    const sleepMinutesPerDay = new Map<string, number>();
    const mealCountPerDay = new Map<string, number>();

    let firstTimestamp = Number.POSITIVE_INFINITY;
    let latestObservedTimestamp = Number.NEGATIVE_INFINITY;
    let totalSleepMinutes = 0;
    let totalMealEvents = 0;

    trackerEvents.forEach((event) => {
      const eventEnd = event.endTime ?? event.startTime;
      const observedEnd = event.endTime ?? Date.now();

      firstTimestamp = Math.min(firstTimestamp, event.startTime);
      latestObservedTimestamp = Math.max(latestObservedTimestamp, observedEnd);
      addEventDays(touchedDays, event.startTime, eventEnd);

      if (event.type === 'sleep' && observedEnd > event.startTime) {
        totalSleepMinutes += (observedEnd - event.startTime) / 60000;
        addMinutesToHours(sleepMinutesByHour, event.startTime, observedEnd);
        addMinutesByDay(sleepMinutesPerDay, event.startTime, observedEnd);
      }

      if (event.type === 'feed') {
        totalMealEvents += 1;
        const eventDayKey = dayKeyFromTimestamp(event.startTime);
        const eventHour = new Date(event.startTime).getHours();
        const mealHours = mealPresenceByDay.get(eventDayKey) ?? new Set<number>();
        mealHours.add(eventHour);
        mealPresenceByDay.set(eventDayKey, mealHours);
        mealCountPerDay.set(eventDayKey, (mealCountPerDay.get(eventDayKey) ?? 0) + 1);
      }
    });

    const sortedDays = Array.from(touchedDays).sort();
    if (sortedDays.length > 0) {
      const firstDayKey = dayKeyFromTimestamp(firstTimestamp);
      const lastDayKey = dayKeyFromTimestamp(latestObservedTimestamp);
      const firstMinute = minutesSinceMidnight(firstTimestamp);
      const lastMinute = Math.min(DAY_MINUTES, minutesSinceMidnight(latestObservedTimestamp));

      sortedDays.forEach((dayKey) => {
        let startMinute = 0;
        let endMinute = DAY_MINUTES;

        if (dayKey === firstDayKey) startMinute = firstMinute;
        if (dayKey === lastDayKey) endMinute = lastMinute;
        if (firstDayKey === lastDayKey) {
          startMinute = firstMinute;
          endMinute = lastMinute;
        }

        addObservableWindow(observableMinutesByHour, observableMealDaysByHour, startMinute, endMinute);
      });

      mealPresenceByDay.forEach((mealHours) => {
        mealHours.forEach((hour) => {
          mealDaysByHour[hour] += 1;
        });
      });

      const usageDays = Math.max(1, differenceInCalendarDays(startOfDay(new Date()), startOfDay(new Date(firstTimestamp))) + 1);

      const points = Array.from({ length: HOURS_PER_DAY }, (_, hour) => {
        const sleepPercent = observableMinutesByHour[hour] > 0
          ? Math.round((sleepMinutesByHour[hour] / observableMinutesByHour[hour]) * 100)
          : 0;
        const mealPercent = observableMealDaysByHour[hour] > 0
          ? Math.round((mealDaysByHour[hour] / observableMealDaysByHour[hour]) * 100)
          : 0;

        const boundedSleep = Math.max(0, Math.min(100, sleepPercent));
        const boundedMeals = Math.max(0, Math.min(100, mealPercent));

        return {
          hour,
          sleepPercent: boundedSleep,
          mealPercent: boundedMeals,
          awakePercent: Math.max(0, 100 - boundedSleep),
        };
      });

      const maxTrendValue = points.reduce((maxValue, point) => Math.max(maxValue, point.sleepPercent, point.mealPercent), 0);
      const yDomainMax = Math.max(20, Math.min(100, Math.ceil((Math.max(maxTrendValue, 10) + 5) / 5) * 5));

      const maxSleep = points.reduce((maxValue, point) => Math.max(maxValue, point.sleepPercent), 0);
      const maxMeals = points.reduce((maxValue, point) => Math.max(maxValue, point.mealPercent), 0);
      const sleepRanges = buildHourRanges(points.map((point) => point.sleepPercent), Math.max(40, Math.round(maxSleep * 0.65)));
      const awakeRanges = invertRanges(sleepRanges);
      const rawMealRanges = buildHourRanges(points.map((point) => point.mealPercent), Math.max(25, Math.round(maxMeals * 0.75)));
      const mealRanges = rawMealRanges.length > 0
        ? rawMealRanges
        : points
            .filter((point) => point.mealPercent > 0)
            .sort((left, right) => right.mealPercent - left.mealPercent)
            .slice(0, 4)
            .sort((left, right) => left.hour - right.hour)
            .map((point) => ({ start: point.hour, end: point.hour + 1 }));

      const dailyBuckets = buildDailyBuckets(firstTimestamp);
      sleepByDay = dailyBuckets.map((bucket) => ({
        date: bucket.date,
        sleepHours: Number(((sleepMinutesPerDay.get(bucket.key) ?? 0) / 60).toFixed(1)),
      }));
      mealsByDay = dailyBuckets.map((bucket) => ({
        date: bucket.date,
        mealCount: mealCountPerDay.get(bucket.key) ?? 0,
      }));

      overview = {
        usageDays,
        firstDataDateLabel: format(new Date(firstTimestamp), 'dd/MM'),
        averageSleepMinutesPerDay: totalSleepMinutes / usageDays,
        averageMealsPerDay: totalMealEvents / usageDays,
        yDomainMax,
        points,
        sleepRanges,
        awakeRanges,
        mealRanges,
      };
    }
  }

  if (temperatureEvents.length > 0) {
    const firstTemperatureTimestamp = Math.min(...temperatureEvents.map((event) => event.startTime));
    const temperatureMap = new Map<string, { date: string; morning: number | null; evening: number | null; morningTs?: number; eveningTs?: number }>();

    buildDailyBuckets(firstTemperatureTimestamp).forEach((bucket) => {
      temperatureMap.set(bucket.key, { date: bucket.date, morning: null, evening: null });
    });

    temperatureEvents.forEach((event) => {
      const value = event.details?.temperature;
      if (typeof value !== 'number') return;

      const key = dayKeyFromTimestamp(event.startTime);
      const existing = temperatureMap.get(key) ?? { date: format(event.startTime, 'dd/MM'), morning: null, evening: null };
      const period = inferTemperaturePeriod(event);

      if (period === 'morning') {
        if (!existing.morningTs || event.startTime >= existing.morningTs) {
          existing.morning = value;
          existing.morningTs = event.startTime;
        }
      } else {
        if (!existing.eveningTs || event.startTime >= existing.eveningTs) {
          existing.evening = value;
          existing.eveningTs = event.startTime;
        }
      }

      temperatureMap.set(key, existing);
    });

    temperatureByDay = Array.from(temperatureMap.values()).map((entry) => ({
      date: entry.date,
      morning: entry.morning,
      evening: entry.evening,
    }));
  }

  return { overview, sleepByDay, mealsByDay, temperatureByDay };
}
