/**
 * Vercel Edge Function — Mistral proxy for the growth-spurt analysis feature.
 *
 * The client posts a typed, anonymised payload here. This function:
 *   1. Checks the request comes from one of our trusted origins (basic
 *      protection — the client-side EXPO_PUBLIC_MISTRAL_API_KEY is gone,
 *      so the worst an origin-spoofing attacker can do is grind through
 *      whatever cap you put on the Mistral key itself).
 *   2. Builds the system + user prompt server-side. The client cannot
 *      inject free-form text into the LLM call — only structured
 *      analysis fields are accepted, the prompt template is fixed.
 *   3. Calls Mistral with MISTRAL_API_KEY (server-only env var, never
 *      bundled into the JS).
 *   4. Returns just the generated text. Mistral errors are translated
 *      to a generic message so we don't leak internals.
 *
 * Server-side env vars (set in Vercel dashboard):
 *   - MISTRAL_API_KEY    (required, secret)
 *   - MISTRAL_MODEL      (optional, defaults to mistral-small-latest)
 *   - ALLOWED_ORIGINS    (optional, comma-separated; defaults to
 *                        the Vercel project URL + localhost dev)
 */

export const config = {
  runtime: 'edge',
};

const MISTRAL_ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';

const SYSTEM_PROMPT = `Tu es un assistant pédiatrique bienveillant qui aide à interpréter des données de tracking bébé.
Tes réponses respectent strictement ces règles :
- 3 à 4 phrases maximum, en français
- Ton chaleureux, factuel, jamais alarmiste
- Tu ne donnes jamais de diagnostic, juste une interprétation possible
- Tu termines toujours par une suggestion concrète (ex: "consultez si la situation persiste")
- Tu ne mentionnes jamais le prénom du bébé (les données fournies sont anonymisées)`;

interface RequestPayload {
  ageInDays: number;
  summary: string;
  confidence: number;
  ageWindowMatch: boolean;
  ageWindowLabel?: string;
  signalLabels: string[];
}

function isValidPayload(value: unknown): value is RequestPayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.ageInDays === 'number' &&
    typeof v.summary === 'string' &&
    v.summary.length < 4000 && // hard cap so the prompt can't blow up
    typeof v.confidence === 'number' &&
    typeof v.ageWindowMatch === 'boolean' &&
    (v.ageWindowLabel === undefined || typeof v.ageWindowLabel === 'string') &&
    Array.isArray(v.signalLabels) &&
    v.signalLabels.length < 20 &&
    v.signalLabels.every((s) => typeof s === 'string' && s.length < 200)
  );
}

function buildUserPrompt(p: RequestPayload): string {
  const lines: string[] = [
    `Bébé âgé de ${p.ageInDays} jours.`,
    ``,
    `Statistiques des 14 derniers jours :`,
    p.summary,
    ``,
    `Analyse locale automatique :`,
    `- Confiance détectée : ${Math.round(p.confidence)}/100`,
    p.ageWindowMatch && p.ageWindowLabel
      ? `- Fenêtre typique : ${p.ageWindowLabel}`
      : `- Hors fenêtre typique`,
    p.signalLabels.length > 0
      ? `- Signaux : ${p.signalLabels.join('; ')}`
      : `- Aucun signal particulier`,
    ``,
    `Donne une interprétation contextuelle en 3-4 phrases. Pas de diagnostic.`,
  ];
  return lines.join('\n');
}

function getAllowedOrigins(): string[] {
  const fromEnv = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // Always allow localhost dev (Expo defaults to 8081) and the Vercel
  // project URL if set.
  const defaults = [
    'http://localhost:8081',
    'http://localhost:3000',
  ];
  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
  return [...fromEnv, ...defaults, ...(vercelUrl ? [vercelUrl] : [])];
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  // Only POST.
  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  // Origin check — first line of defense. Spoofable from curl, but blocks
  // casual XHR attacks from random sites embedding a script.
  const origin = req.headers.get('origin') ?? '';
  const allowed = getAllowedOrigins();
  if (!allowed.includes(origin)) {
    return jsonError('Origin not allowed', 403);
  }

  // Validate the payload.
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  if (!isValidPayload(payload)) {
    return jsonError('Invalid payload shape', 400);
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return jsonError('Server not configured (missing MISTRAL_API_KEY)', 500);
  }
  const model = process.env.MISTRAL_MODEL ?? 'mistral-small-latest';

  const userPrompt = buildUserPrompt(payload);

  let mistralResp: Response;
  try {
    mistralResp = await fetch(MISTRAL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 350,
        temperature: 0.4,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
  } catch {
    return jsonError('Upstream network error', 502);
  }

  if (!mistralResp.ok) {
    // Don't echo Mistral's error body back — it might contain headers /
    // hints we don't want to leak.
    return jsonError(`Upstream error (${mistralResp.status})`, 502);
  }

  let data: unknown;
  try {
    data = await mistralResp.json();
  } catch {
    return jsonError('Upstream returned non-JSON', 502);
  }

  const text =
    (data as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]
      ?.message?.content?.trim() ?? '';

  if (!text) {
    return jsonError('Upstream returned empty response', 502);
  }

  return new Response(JSON.stringify({ text }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
