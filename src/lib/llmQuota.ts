import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Client-side rate limit for the Mistral analysis feature.
 *
 * ⚠️ Important caveat:
 * Because EXPO_PUBLIC_MISTRAL_API_KEY is bundled into the JS, a determined
 * attacker who inspects the bundle can extract the key and call the API
 * directly, bypassing this guard. This module protects you against the
 * REALISTIC threats:
 *   - A coding bug that loops over requestGrowthSpurtAnalysis()
 *   - A user (you, your partner, a curious relative) clicking the button
 *     too many times
 *   - A leftover tab in a browser re-rendering on focus
 *
 * For real protection against bundle extraction, you must move the call
 * server-side (Vercel Function, Cloud Function, etc.) and never expose
 * the key to the client. See README / .env.example for the migration path.
 *
 * Three layers of safety:
 *   1. Cooldown — at least N seconds between calls (prevents spam clicks)
 *   2. Daily limit — at most N successful calls per local-day per device
 *   3. Circuit breaker — hard cap on total lifetime calls per device
 */

const STORAGE_KEY = '@charlie:llm_quota_v1';
const COOLDOWN_MS = 30_000; // 30s between attempts
const HARD_TOTAL_CAP = 500; // lifetime ceiling per device — circuit breaker

interface QuotaState {
  /** Local-date key, YYYY-MM-DD. Resets `count` when day rolls over. */
  date: string;
  /** Successful calls today. */
  count: number;
  /** Last attempt timestamp (success or fail). Used for cooldown. */
  lastAttemptAt: number;
  /** Successful calls ever. Used for the lifetime circuit breaker. */
  totalEver: number;
}

export type QuotaErrorKind = 'daily' | 'cooldown' | 'circuit';

export class QuotaError extends Error {
  readonly kind: QuotaErrorKind;
  readonly retryAfterSec?: number;

  constructor(message: string, kind: QuotaErrorKind, retryAfterSec?: number) {
    super(message);
    this.name = 'QuotaError';
    this.kind = kind;
    this.retryAfterSec = retryAfterSec;
  }
}

function todayKey(): string {
  // Local date — matches the user's perception of "today".
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function emptyState(): QuotaState {
  return { date: todayKey(), count: 0, lastAttemptAt: 0, totalEver: 0 };
}

async function loadState(): Promise<QuotaState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<QuotaState>;
    const today = todayKey();
    return {
      date: parsed.date === today ? today : today,
      count: parsed.date === today ? (parsed.count ?? 0) : 0,
      lastAttemptAt: parsed.lastAttemptAt ?? 0,
      totalEver: parsed.totalEver ?? 0,
    };
  } catch {
    return emptyState();
  }
}

async function saveState(state: QuotaState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable — degrade silently. Worst case, no rate limiting,
    // which is the same as before this module existed.
  }
}

/**
 * Verify the request is allowed, then mark the attempt timestamp so the
 * cooldown kicks in on the next click. Does NOT increment the daily count
 * yet — that happens only after a successful response, via {@link recordQuotaSuccess}.
 *
 * Throws {@link QuotaError} if any limit is exceeded.
 */
export async function preflightQuota(dailyLimit: number): Promise<void> {
  const state = await loadState();
  const now = Date.now();

  if (state.totalEver >= HARD_TOTAL_CAP) {
    throw new QuotaError(
      `Plafond total atteint (${HARD_TOTAL_CAP} analyses sur cet appareil). Réinitialise le compteur dans Réglages si tu veux continuer.`,
      'circuit'
    );
  }

  const elapsed = now - state.lastAttemptAt;
  if (elapsed < COOLDOWN_MS) {
    const wait = Math.max(1, Math.ceil((COOLDOWN_MS - elapsed) / 1000));
    throw new QuotaError(
      `Patiente ${wait}s avant la prochaine analyse.`,
      'cooldown',
      wait
    );
  }

  if (state.count >= dailyLimit) {
    throw new QuotaError(
      `Limite quotidienne atteinte (${dailyLimit} analyses aujourd'hui). Réessaie demain.`,
      'daily'
    );
  }

  await saveState({ ...state, lastAttemptAt: now });
}

/**
 * Increment the daily and lifetime counters. Call this after a successful
 * API response — failed attempts (network, 5xx, etc.) don't burn quota,
 * only the cooldown applies to them.
 */
export async function recordQuotaSuccess(): Promise<void> {
  const state = await loadState();
  await saveState({
    ...state,
    count: state.count + 1,
    totalEver: state.totalEver + 1,
  });
}

export interface QuotaSnapshot {
  used: number;
  limit: number;
  remaining: number;
  totalEver: number;
  totalCap: number;
}

export async function getQuotaSnapshot(dailyLimit: number): Promise<QuotaSnapshot> {
  const state = await loadState();
  return {
    used: state.count,
    limit: dailyLimit,
    remaining: Math.max(0, dailyLimit - state.count),
    totalEver: state.totalEver,
    totalCap: HARD_TOTAL_CAP,
  };
}

/** Wipes the quota state — exposed in Settings for emergencies / debugging. */
export async function resetQuota(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
