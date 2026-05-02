import { differenceInCalendarDays, format, startOfDay } from 'date-fns';
import type { TrackedEvent } from '@/src/types/domain';

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const DAY_MINUTES = HOURS_PER_DAY * MINUTES_PER_HOUR;
const MIN_OBSERVABLE_MEAL_MINUTES = 30;
export const IMPORTANT_MEAL_PROBABILITY = 40;

export type TrendRange = 'all' | 'day' | 'night';
export type DominantTrend = 'sleep' | 'awake';
export type TrendSignal = 'sleep' | 'awake' | 'meal';

export interface TrendHourRange {
  start: number;
  end: number;
}

export interface TrendHourPoint {
  hour: number;
  label: string;
  segment: 'day' | 'night';
  observedDays: number;
  coveragePercent: number;
  sleepProbability: number;
  awakeProbability: number;
  mealProbability: number;
  smoothedSleepProbability: number;
  smoothedAwakeProbability: number;
  smoothedMealProbability: number;
  mealSalience: number;
  mealPeak: boolean;
  mealNotable: boolean;
  dominant: DominantTrend;
  focus: TrendSignal;
}

export interface TrendLabOverview {
  usageDays: number;
  firstDataDateLabel: string;
  points: TrendHourPoint[];
  sleepRanges: TrendHourRange[];
  awakeRanges: TrendHourRange[];
  mealPeakHours: number[];
}

export interface TrendLabData {
  overview: TrendLabOverview | null;
}

interface DayObservation {
  earliestMinute: number;
  latestMinute: number;
  sleepMinutesByHour: number[];
  mealHours: Set<number>;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundPercent(value: number) {
  return Math.round(clamp(value, 0, 100));
}

function createDayObservation(): DayObservation {
  return {
    earliestMinute: DAY_MINUTES,
    latestMinute: 0,
    sleepMinutesByHour: Array.from({ length: HOURS_PER_DAY }, () => 0),
    mealHours: new Set<number>(),
  };
}

function ensureDayObservation(map: Map<string, DayObservation>, dayKey: string) {
  const existing = map.get(dayKey);
  if (existing) return existing;

  const created = createDayObservation();
  map.set(dayKey, created);
  return created;
}

function minuteInDay(timestamp: number, dayStartMs: number) {
  return clamp((timestamp - dayStartMs) / 60000, 0, DAY_MINUTES);
}

function addSleepMinutesByHour(target: number[], segmentStartMinute: number, segmentEndMinute: number) {
  if (segmentEndMinute <= segmentStartMinute) return;

  for (let hour = 0; hour < HOURS_PER_DAY; hour += 1) {
    const hourStart = hour * MINUTES_PER_HOUR;
    const hourEnd = hourStart + MINUTES_PER_HOUR;
    const overlap = Math.max(0, Math.min(hourEnd, segmentEndMinute) - Math.max(hourStart, segmentStartMinute));

    if (overlap > 0) target[hour] += overlap;
  }
}

function addObservableMinutes(observableMinutesByHour: number[], observableDaysByHour: number[], startMinute: number, endMinute: number) {
  if (endMinute <= startMinute) return;

  for (let hour = 0; hour < HOURS_PER_DAY; hour += 1) {
    const hourStart = hour * MINUTES_PER_HOUR;
    const hourEnd = hourStart + MINUTES_PER_HOUR;
    const overlap = Math.max(0, Math.min(hourEnd, endMinute) - Math.max(hourStart, startMinute));

    if (overlap > 0) observableMinutesByHour[hour] += overlap;
    if (overlap >= MIN_OBSERVABLE_MEAL_MINUTES) observableDaysByHour[hour] += 1;
  }
}

function smoothCircular(values: number[]) {
  return values.map((_, index) => {
    const previous = values[(index - 1 + values.length) % values.length];
    const current = values[index];
    const next = values[(index + 1) % values.length];
    return roundPercent(previous * 0.25 + current * 0.5 + next * 0.25);
  });
}

function buildRanges(values: number[], threshold: number) {
  const ranges: TrendHourRange[] = [];
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

function detectMealPeaks(values: number[]) {
  const maxMeal = values.reduce((maxValue, value) => Math.max(maxValue, value), 0);
  if (maxMeal === 0) return [];

  const threshold = Math.max(12, Math.round(maxMeal * 0.42));
  const peaks = values.reduce<number[]>((accumulator, value, hour) => {
    const previous = values[(hour - 1 + values.length) % values.length];
    const next = values[(hour + 1) % values.length];

    if (value < threshold) return accumulator;
    if (value < previous || value < next) return accumulator;
    if (value === previous && value === next) return accumulator;

    accumulator.push(hour);
    return accumulator;
  }, []);

  return peaks.length > 0
    ? peaks
    : values
        .map((value, hour) => ({ hour, value }))
        .filter((entry) => entry.value > 0)
        .sort((left, right) => right.value - left.value)
        .slice(0, 6)
        .map((entry) => entry.hour)
        .sort((left, right) => left - right);
}

export function selectTrendHours(points: TrendHourPoint[], range: TrendRange) {
  if (range === 'day') return points.filter((point) => point.hour >= 6 && point.hour < 18);
  if (range === 'night') return points.filter((point) => point.hour >= 18).concat(points.filter((point) => point.hour < 6));
  return points;
}

export function buildTrendLabData(events: TrackedEvent[], referenceTime = Date.now()): TrendLabData {
  const trackerEvents = events.filter((event) => event.type !== 'growth' && event.type !== 'temperature');
  if (trackerEvents.length === 0) return { overview: null };

  const observationsByDay = new Map<string, DayObservation>();
  const observableMinutesByHour = Array.from({ length: HOURS_PER_DAY }, () => 0);
  const observableDaysByHour = Array.from({ length: HOURS_PER_DAY }, () => 0);
  const sleepMinutesByHour = Array.from({ length: HOURS_PER_DAY }, () => 0);
  const mealDaysByHour = Array.from({ length: HOURS_PER_DAY }, () => 0);

  const firstTimestamp = Math.min(...trackerEvents.map((event) => event.startTime));
  const usageDays = Math.max(1, differenceInCalendarDays(startOfDay(referenceTime), startOfDay(firstTimestamp)) + 1);

  trackerEvents.forEach((event) => {
    const eventStart = event.startTime;
    const rawEnd = event.endTime ?? (event.type === 'sleep' || event.type === 'feed' ? referenceTime : event.startTime + 60000);
    const eventEnd = Math.max(eventStart + 60000, rawEnd);

    let cursorStart = eventStart;
    while (cursorStart < eventEnd) {
      const dayStart = startOfDay(cursorStart).getTime();
      const nextDayStart = dayStart + DAY_MINUTES * 60000;
      const segmentEnd = Math.min(eventEnd, nextDayStart);
      const dayKey = format(dayStart, 'yyyy-MM-dd');
      const observation = ensureDayObservation(observationsByDay, dayKey);
      const startMinute = minuteInDay(cursorStart, dayStart);
      const endMinute = minuteInDay(segmentEnd, dayStart);

      observation.earliestMinute = Math.min(observation.earliestMinute, startMinute);
      observation.latestMinute = Math.max(observation.latestMinute, endMinute);

      if (event.type === 'sleep') addSleepMinutesByHour(observation.sleepMinutesByHour, startMinute, endMinute);
      cursorStart = segmentEnd;
    }

    if (event.type === 'feed') {
      const dayKey = format(startOfDay(event.startTime), 'yyyy-MM-dd');
      const observation = ensureDayObservation(observationsByDay, dayKey);
      observation.mealHours.add(new Date(event.startTime).getHours());
    }
  });

  observationsByDay.forEach((observation) => {
    addObservableMinutes(observableMinutesByHour, observableDaysByHour, observation.earliestMinute, observation.latestMinute);
    observation.sleepMinutesByHour.forEach((minutes, hour) => {
      sleepMinutesByHour[hour] += minutes;
    });
    observation.mealHours.forEach((hour) => {
      mealDaysByHour[hour] += 1;
    });
  });

  const sleepProbabilities = Array.from({ length: HOURS_PER_DAY }, (_, hour) => (
    observableMinutesByHour[hour] > 0 ? roundPercent((sleepMinutesByHour[hour] / observableMinutesByHour[hour]) * 100) : 0
  ));
  const awakeProbabilities = sleepProbabilities.map((value) => roundPercent(100 - value));
  const mealProbabilities = Array.from({ length: HOURS_PER_DAY }, (_, hour) => (
    observableDaysByHour[hour] > 0 ? roundPercent((mealDaysByHour[hour] / observableDaysByHour[hour]) * 100) : 0
  ));

  const smoothedSleep = smoothCircular(sleepProbabilities);
  const smoothedAwake = smoothCircular(awakeProbabilities);
  const smoothedMeals = smoothCircular(mealProbabilities);
  const mealPeakHours = detectMealPeaks(mealProbabilities);
  const maxMealProbability = mealProbabilities.reduce((maxValue, value) => Math.max(maxValue, value), 0);

  const points: TrendHourPoint[] = Array.from({ length: HOURS_PER_DAY }, (_, hour) => {
    const mealPeak = mealPeakHours.includes(hour);
    const mealNotable = mealPeak || mealProbabilities[hour] >= IMPORTANT_MEAL_PROBABILITY;
    const mealSalience = maxMealProbability > 0 ? roundPercent((mealProbabilities[hour] / maxMealProbability) * 100) : 0;
    const dominant: DominantTrend = smoothedSleep[hour] >= smoothedAwake[hour] ? 'sleep' : 'awake';
    const focus: TrendSignal = mealNotable ? 'meal' : dominant;

    return {
      hour,
      label: `${String(hour).padStart(2, '0')}h`,
      segment: hour >= 6 && hour < 18 ? 'day' : 'night',
      observedDays: observableDaysByHour[hour],
      coveragePercent: roundPercent(observableMinutesByHour[hour] / MINUTES_PER_HOUR / Math.max(1, usageDays) * 100),
      sleepProbability: sleepProbabilities[hour],
      awakeProbability: awakeProbabilities[hour],
      mealProbability: mealProbabilities[hour],
      smoothedSleepProbability: smoothedSleep[hour],
      smoothedAwakeProbability: smoothedAwake[hour],
      smoothedMealProbability: smoothedMeals[hour],
      mealSalience,
      mealPeak,
      mealNotable,
      dominant,
      focus,
    };
  });

  const sleepRanges = buildRanges(smoothedSleep, Math.max(38, Math.round(Math.max(...smoothedSleep) * 0.7)));
  const awakeRanges = buildRanges(smoothedAwake, Math.max(38, Math.round(Math.max(...smoothedAwake) * 0.7)));

  return {
    overview: {
      usageDays,
      firstDataDateLabel: format(new Date(firstTimestamp), 'dd/MM'),
      points,
      sleepRanges,
      awakeRanges,
      mealPeakHours,
    },
  };
}
