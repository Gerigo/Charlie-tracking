import type { BabyProfile, TrackedEvent } from '@/src/types/domain';

/**
 * Growth-spurt detection — local algorithm.
 *
 * Cross-references the baby's encoded events with the typical growth-spurt
 * windows from pediatric literature (AAP, NCT, La Leche League, OMS).
 *
 * The output is a *non-medical* signal — explicitly framed as "indice à
 * vérifier avec votre pédiatre" everywhere it surfaces in the UI.
 *
 * Sources for the windows + signals:
 *  - American Academy of Pediatrics (HealthyChildren.org) "Growth Spurts" guide
 *  - NCT UK "Baby growth spurts: signs and how to handle them"
 *  - La Leche League France (cluster feeding pendant les pics)
 *  - WHO Child Growth Standards (percentile basis used elsewhere)
 *
 * Typical windows (days from birth, ±3 days unless noted):
 *   ~7-10d, ~21d, ~42d (6w), ~84d (3m), ~120d (4m, sleep regression),
 *   ~180d (6m), ~270d (9m), ~365d (12m).
 */

export type GrowthSpurtSignalKey =
  | 'cluster_feeding'
  | 'shorter_feed_intervals'
  | 'sleep_fragmentation'
  | 'sleep_total_reduced'
  | 'diaper_output_high';

export interface GrowthSpurtSignal {
  key: GrowthSpurtSignalKey;
  /** Z-score-ish strength: 0-1 (1 = very strong). */
  strength: number;
  /** Human-readable French sentence (UI uses it directly). */
  label: string;
}

export interface GrowthSpurtAnalysis {
  /** 0-100. Above 60 → "probable", 40-60 → "possible", below → silent. */
  confidence: number;
  /** Detected signals, ordered by descending strength. */
  signals: GrowthSpurtSignal[];
  /** True if today falls within ±3 days of a known typical spurt window. */
  ageWindowMatch: boolean;
  /** If ageWindowMatch, the matching window label (e.g. "3 mois"). */
  ageWindowLabel: string | null;
  /** UI shortcut: "Pic probable" | "Possibles signes" | null when silent. */
  humanLabel: string | null;
}

const TYPICAL_WINDOWS_DAYS: Array<{ day: number; label: string }> = [
  { day: 8, label: '7-10 jours' },
  { day: 21, label: '3 semaines' },
  { day: 42, label: '6 semaines' },
  { day: 84, label: '3 mois' },
  { day: 120, label: '4 mois' },
  { day: 180, label: '6 mois' },
  { day: 270, label: '9 mois' },
  { day: 365, label: '12 mois' },
];

const WINDOW_TOLERANCE_DAYS = 3;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function ageInDays(birthDateIso: string, now: number): number {
  const birth = new Date(birthDateIso).getTime();
  if (Number.isNaN(birth)) return 0;
  return Math.max(0, Math.floor((now - birth) / DAY_MS));
}

function eventsInWindow(events: TrackedEvent[], from: number, to: number) {
  return events.filter((e) => e.startTime >= from && e.startTime < to);
}

function nightWakingsCount(events: TrackedEvent[], from: number, to: number): number {
  // Count sleep events that ENDED between 22:00 and 07:00 (i.e., the baby
  // woke up during night hours). We count distinct end-of-sleep transitions.
  let count = 0;
  for (const e of events) {
    if (e.type !== 'sleep' || !e.endTime) continue;
    if (e.endTime < from || e.endTime >= to) continue;
    const hour = new Date(e.endTime).getHours();
    if (hour >= 22 || hour < 7) count++;
  }
  return count;
}

function sleepTotalMs(events: TrackedEvent[], from: number, to: number): number {
  let total = 0;
  for (const e of events) {
    if (e.type !== 'sleep' || !e.endTime) continue;
    // Clip to the window
    const start = Math.max(e.startTime, from);
    const end = Math.min(e.endTime, to);
    if (end > start) total += end - start;
  }
  return total;
}

function feedIntervals(events: TrackedEvent[], from: number, to: number): number[] {
  const feeds = events
    .filter((e) => e.type === 'feed' && e.startTime >= from && e.startTime < to)
    .sort((a, b) => a.startTime - b.startTime);
  const intervals: number[] = [];
  for (let i = 1; i < feeds.length; i++) {
    intervals.push(feeds[i].startTime - feeds[i - 1].startTime);
  }
  return intervals;
}

function diaperWetCount(events: TrackedEvent[], from: number, to: number): number {
  let n = 0;
  for (const e of events) {
    if (e.type !== 'diaper' || e.startTime < from || e.startTime >= to) continue;
    const t = e.details?.diaperType;
    if (t === 'wet' || t === 'both') n++;
  }
  return n;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function detectAgeWindow(birthDateIso: string, now: number): { match: boolean; label: string | null } {
  const ageDays = ageInDays(birthDateIso, now);
  for (const win of TYPICAL_WINDOWS_DAYS) {
    if (Math.abs(ageDays - win.day) <= WINDOW_TOLERANCE_DAYS) {
      return { match: true, label: win.label };
    }
  }
  return { match: false, label: null };
}

/**
 * Main entry point — returns the analysis for the given baby + events.
 *
 * Heuristic strategy:
 *  1. Compare the LAST 24h to the 7-day baseline (excluding last 24h).
 *  2. Each metric crossing a threshold contributes a "signal" with strength
 *     proportional to the deviation.
 *  3. If today falls in a typical age window, boost the confidence.
 *  4. Final confidence = clamp(weighted_signal_sum + age_boost, 0, 100).
 */
export function detectGrowthSpurt(events: TrackedEvent[], baby: BabyProfile, nowMs = Date.now()): GrowthSpurtAnalysis {
  const last24From = nowMs - DAY_MS;
  const baselineFrom = nowMs - 8 * DAY_MS;
  const baselineTo = last24From; // 7 days ending 24h ago

  // Filter to this baby's events only — relevant in multi-baby families
  const babyEvents = events.filter((e) => e.babyId === baby.id);

  // ── 1. Cluster feeding (count per 24h) ──
  const last24Feeds = eventsInWindow(babyEvents, last24From, nowMs).filter((e) => e.type === 'feed').length;
  const baselineDailyFeeds = (
    eventsInWindow(babyEvents, baselineFrom, baselineTo).filter((e) => e.type === 'feed').length
  ) / 7;

  // ── 2. Shorter feed intervals (median minutes between feeds) ──
  const last24Intervals = feedIntervals(babyEvents, last24From, nowMs);
  const baselineIntervals = feedIntervals(babyEvents, baselineFrom, baselineTo);
  const last24MedianInterval = median(last24Intervals);
  const baselineMedianInterval = median(baselineIntervals);

  // ── 3. Sleep fragmentation (night wakings count) ──
  const last24NightWakings = nightWakingsCount(babyEvents, last24From, nowMs);
  const baselineDailyNightWakings = nightWakingsCount(babyEvents, baselineFrom, baselineTo) / 7;

  // ── 4. Sleep total reduced (24h total in ms) ──
  const last24SleepMs = sleepTotalMs(babyEvents, last24From, nowMs);
  const baselineDailySleepMs = sleepTotalMs(babyEvents, baselineFrom, baselineTo) / 7;

  // ── 5. Diaper output (wet count) ──
  const last24Diapers = diaperWetCount(babyEvents, last24From, nowMs);
  const baselineDailyDiapers = diaperWetCount(babyEvents, baselineFrom, baselineTo) / 7;

  const signals: GrowthSpurtSignal[] = [];

  // Cluster feeding signal — needs at least a baseline of 3 feeds/day to be reliable
  if (baselineDailyFeeds >= 3 && last24Feeds > baselineDailyFeeds * 1.4) {
    const strength = Math.min(1, (last24Feeds / baselineDailyFeeds - 1) / 0.6);
    signals.push({
      key: 'cluster_feeding',
      strength,
      label: `Tétées plus fréquentes (${last24Feeds} sur 24h vs ${baselineDailyFeeds.toFixed(1)} en moyenne)`,
    });
  }

  // Shorter intervals
  if (
    baselineMedianInterval > 0 &&
    last24MedianInterval > 0 &&
    last24MedianInterval < baselineMedianInterval * 0.75 &&
    last24Intervals.length >= 3
  ) {
    const strength = Math.min(1, (1 - last24MedianInterval / baselineMedianInterval) * 1.3);
    const minDelta = Math.round((baselineMedianInterval - last24MedianInterval) / 60_000);
    signals.push({
      key: 'shorter_feed_intervals',
      strength,
      label: `Intervalles entre tétées plus courts (~${minDelta} min de moins)`,
    });
  }

  // Sleep fragmentation
  if (baselineDailyNightWakings > 0 && last24NightWakings > baselineDailyNightWakings * 1.5) {
    const strength = Math.min(1, (last24NightWakings / baselineDailyNightWakings - 1) / 1.0);
    signals.push({
      key: 'sleep_fragmentation',
      strength,
      label: `Plus de réveils nocturnes (${last24NightWakings} cette nuit vs ${baselineDailyNightWakings.toFixed(1)} en moyenne)`,
    });
  }

  // Sleep total reduced (only if we have ≥3h baseline to be meaningful)
  if (baselineDailySleepMs >= 3 * HOUR_MS && last24SleepMs < baselineDailySleepMs * 0.85) {
    const strength = Math.min(1, (1 - last24SleepMs / baselineDailySleepMs) * 1.5);
    const hoursLost = ((baselineDailySleepMs - last24SleepMs) / HOUR_MS).toFixed(1);
    signals.push({
      key: 'sleep_total_reduced',
      strength,
      label: `Sommeil total réduit d'environ ${hoursLost}h sur 24h`,
    });
  }

  // Diaper output high (booster, only weakly indicative)
  if (baselineDailyDiapers >= 4 && last24Diapers > baselineDailyDiapers * 1.3) {
    const strength = Math.min(1, (last24Diapers / baselineDailyDiapers - 1) / 0.6);
    signals.push({
      key: 'diaper_output_high',
      strength: strength * 0.7, // booster only — weight reduced
      label: `Couches mouillées plus fréquentes`,
    });
  }

  // Sort by descending strength
  signals.sort((a, b) => b.strength - a.strength);

  // ── Age window match ──
  const { match: ageWindowMatch, label: ageWindowLabel } = detectAgeWindow(baby.birthDate, nowMs);

  // ── Confidence aggregation ──
  // Each signal contributes up to 22 points (5 signals × 22 = 110 max from signals alone).
  // Age window adds +20 if matched.
  const signalScore = signals.reduce((sum, s) => sum + s.strength * 22, 0);
  const ageBoost = ageWindowMatch ? 20 : 0;
  const confidence = Math.max(0, Math.min(100, signalScore + ageBoost));

  let humanLabel: string | null = null;
  if (confidence >= 60) humanLabel = 'Pic de croissance probable';
  else if (confidence >= 40) humanLabel = 'Possibles signes de pic';

  return {
    confidence,
    signals,
    ageWindowMatch,
    ageWindowLabel,
    humanLabel,
  };
}
