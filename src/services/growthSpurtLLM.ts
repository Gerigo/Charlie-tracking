import { env } from '@/src/lib/env';
import { preflightQuota, recordQuotaSuccess } from '@/src/lib/llmQuota';
import type { BabyProfile, TrackedEvent } from '@/src/types/domain';
import type { GrowthSpurtAnalysis } from '@/src/utils/growthSpurts';

/**
 * Calls our Vercel Edge Function (`/api/growth-spurt-analysis`) which
 * forwards a structured, anonymised payload to Mistral with a server-side
 * key. The Mistral key is NEVER bundled into the client JS — only the
 * proxy endpoint URL is.
 *
 * The function is the source of truth for the prompt template; the client
 * only sends typed analysis fields. That way a malicious script that
 * extracts and replays the request can't repurpose the key for arbitrary
 * generation — the prompt is fixed server-side.
 *
 * Local dev: run `vercel dev` so the `/api` route resolves locally.
 * Without it, the client gets a 404 and the banner shows an error.
 */

// `/api/growth-spurt-analysis` is served by Vercel from the same origin —
// so a relative path is enough in browser builds. Native builds (which we
// don't ship for charlie-web) would need an absolute URL.
const PROXY_ENDPOINT = '/api/growth-spurt-analysis';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export function isGrowthSpurtLLMConfigured(): boolean {
  return env.mistralEnabled;
}

interface RequestParams {
  events: TrackedEvent[];
  baby: BabyProfile;
  analysis: GrowthSpurtAnalysis;
}

/**
 * Builds the anonymised payload, sends it to the proxy, returns the
 * generated interpretation text. Throws on any failure — caller handles
 * the surface.
 */
export async function requestGrowthSpurtAnalysis({ events, baby, analysis }: RequestParams): Promise<string> {
  if (!env.mistralEnabled) {
    throw new Error('Analyse LLM désactivée (EXPO_PUBLIC_MISTRAL_ENABLED non défini)');
  }

  // Client-side rate limit. Throws QuotaError on cooldown / daily / lifetime.
  // The server has no rate limit yet — this is the only guard against
  // accidental loops or repeated clicks. If you ever expose this beyond
  // your private Vercel domain, add Upstash KV-based rate limiting in
  // the function itself.
  await preflightQuota(env.mistralDailyLimit);

  // Structured anonymised payload — no first name, no IDs, only aggregates.
  const payload = {
    ageInDays: ageInDays(baby.birthDate),
    summary: buildAnonymisedSummary(events, baby),
    confidence: analysis.confidence,
    ageWindowMatch: analysis.ageWindowMatch,
    ageWindowLabel: analysis.ageWindowLabel,
    signalLabels: analysis.signals.map((s) => s.label),
  };

  let response: Response;
  try {
    response = await fetch(PROXY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Connexion impossible au serveur d\'analyse');
  }

  // In local Expo dev (`npm run start`), the SPA fallback rewrites
  // `/api/*` to `index.html` because the Vercel function isn't being
  // served. The HTML response is "OK" but isn't JSON, so the parse
  // below would throw a cryptic Safari-flavoured error. Detect this
  // case via Content-Type and surface a clear instruction.
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      'L\'endpoint /api n\'est pas disponible en dev local. Lance `vercel dev` (au lieu de `npm run start`) pour servir la fonction Mistral, ou teste depuis l\'URL Vercel déployée.',
    );
  }

  if (!response.ok) {
    let errMsg = `Erreur ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) errMsg = body.error;
    } catch {
      /* swallow — already non-OK + non-JSON case is rare here */
    }
    throw new Error(errMsg);
  }

  let data: { text?: string; error?: string };
  try {
    data = (await response.json()) as { text?: string; error?: string };
  } catch {
    throw new Error('Réponse serveur invalide (JSON malformé)');
  }
  if (!data.text) {
    throw new Error(data.error ?? 'Réponse vide du serveur');
  }

  // Only successful calls count toward the daily / lifetime caps.
  // Cooldown was already armed inside preflightQuota().
  await recordQuotaSuccess();

  return data.text;
}

// ─── Internals ──────────────────────────────────────────────────────────────

function ageInDays(birthDateIso: string): number {
  const birth = new Date(birthDateIso).getTime();
  if (Number.isNaN(birth)) return 0;
  return Math.max(0, Math.floor((Date.now() - birth) / DAY_MS));
}

function buildAnonymisedSummary(events: TrackedEvent[], baby: BabyProfile): string {
  const now = Date.now();
  const start14d = now - 14 * DAY_MS;
  const start24h = now - DAY_MS;
  const start7dStart = now - 8 * DAY_MS;
  const start7dEnd = start24h;

  const babyEvents = events.filter((e) => e.babyId === baby.id && e.startTime >= start14d);

  const last24 = babyEvents.filter((e) => e.startTime >= start24h);
  const baseline7 = babyEvents.filter((e) => e.startTime >= start7dStart && e.startTime < start7dEnd);

  const feedCount = (list: TrackedEvent[]) => list.filter((e) => e.type === 'feed').length;
  const diaperCount = (list: TrackedEvent[]) => list.filter((e) => e.type === 'diaper').length;
  const sleepHours = (list: TrackedEvent[]): string => {
    const total = list
      .filter((e) => e.type === 'sleep' && e.endTime)
      .reduce((sum, e) => sum + ((e.endTime ?? 0) - e.startTime), 0);
    return (total / HOUR_MS).toFixed(1);
  };
  const nightWakings = (list: TrackedEvent[]) =>
    list.filter((e) => {
      if (e.type !== 'sleep' || !e.endTime) return false;
      const h = new Date(e.endTime).getHours();
      return h >= 22 || h < 7;
    }).length;

  return [
    `- 24h récentes : ${feedCount(last24)} tétées, ${diaperCount(last24)} couches, ${sleepHours(last24)}h de sommeil, ${nightWakings(last24)} réveils nocturnes`,
    `- 7j de baseline (avant 24h récentes) : ${feedCount(baseline7)} tétées (~${(feedCount(baseline7) / 7).toFixed(1)}/j), ${diaperCount(baseline7)} couches (~${(diaperCount(baseline7) / 7).toFixed(1)}/j), ${(parseFloat(sleepHours(baseline7)) / 7).toFixed(1)}h sommeil/j, ${(nightWakings(baseline7) / 7).toFixed(1)} réveils/nuit en moyenne`,
  ].join('\n');
}
