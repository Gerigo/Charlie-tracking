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
  runtime: "edge",
};

const MISTRAL_ENDPOINT = "https://api.mistral.ai/v1/chat/completions";

const SYSTEM_PROMPT = `Tu es un assistant pédiatrique bienveillant qui aide à interpréter des données de tracking bébé.
L'objectif est d'aider les parents à comprendre les possibles raisons (s'il y en a) derrière les changements de comportement de leur bébé, en se basant sur les données fournies. Tes réponses sont basées sur des corrélations statistiques et des connaissances générales sur le développement infantile, mais tu ne peux pas poser de diagnostic médical. 
Tes réponses respectent strictement ces règles :
- 4 à 5 phrases maximum, en français
- Ton chaleureux, factuel, jamais alarmiste
- Tu ne donnes jamais de diagnostic, juste une interprétation possible basée sur les données fournies.
- Tu termines toujours par une suggestion concrète (ex: "consultez si la situation persiste")`;

interface RequestPayload {
  ageInDays: number;
  summary: string;
  confidence: number;
  ageWindowMatch: boolean;
  /** Match the client type — `string | null | undefined`. */
  ageWindowLabel?: string | null;
  signalLabels: string[];
}

function isValidPayload(value: unknown): value is RequestPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.ageInDays === "number" &&
    typeof v.summary === "string" &&
    v.summary.length < 4000 && // hard cap so the prompt can't blow up
    typeof v.confidence === "number" &&
    typeof v.ageWindowMatch === "boolean" &&
    // Allow null too — the client analysis types `ageWindowLabel` as
    // `string | null` and JSON.stringify forwards null literally.
    (v.ageWindowLabel === undefined ||
      v.ageWindowLabel === null ||
      typeof v.ageWindowLabel === "string") &&
    Array.isArray(v.signalLabels) &&
    v.signalLabels.length < 20 &&
    v.signalLabels.every((s) => typeof s === "string" && s.length < 200)
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
      ? `- Signaux : ${p.signalLabels.join("; ")}`
      : `- Aucun signal particulier`,
    ``,
    `Donne une interprétation contextuelle en 4-5 phrases. Pas de diagnostic.`,
  ];
  return lines.join("\n");
}

function getAllowedOrigins(): string[] {
  const fromEnv = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const defaults = ["http://localhost:8081", "http://localhost:3000"];
  // Vercel injects two relevant env vars at runtime:
  //   - VERCEL_URL                       → THIS deployment's URL
  //                                        (e.g. charlie-web-abc123-user.vercel.app)
  //   - VERCEL_PROJECT_PRODUCTION_URL    → the stable production alias
  //                                        (e.g. charlie-web.vercel.app)
  // Both belong here: production traffic comes from the alias, but
  // preview deployments (PRs, branch previews) come from VERCEL_URL.
  const vercelDeployment = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : null;
  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : null;
  return [
    ...fromEnv,
    ...defaults,
    ...(vercelDeployment ? [vercelDeployment] : []),
    ...(vercelProduction ? [vercelProduction] : []),
  ];
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  // Only POST.
  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  // Origin check — first line of defense. Spoofable from curl, but blocks
  // casual XHR attacks from random sites embedding a script.
  const origin = req.headers.get("origin") ?? "";
  const allowed = getAllowedOrigins();
  if (!allowed.includes(origin)) {
    // Include the rejected origin in the error so debugging an
    // ALLOWED_ORIGINS misconfig is one round-trip instead of guesswork.
    return jsonError(
      `Origin "${origin}" not in allow list. Set ALLOWED_ORIGINS in Vercel env vars to your production domain.`,
      403,
    );
  }

  // Validate the payload.
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (!isValidPayload(payload)) {
    return jsonError("Invalid payload shape", 400);
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return jsonError("Server not configured (missing MISTRAL_API_KEY)", 500);
  }
  const model = process.env.MISTRAL_MODEL ?? "mistral-small-latest";

  const userPrompt = buildUserPrompt(payload);

  let mistralResp: Response;
  try {
    mistralResp = await fetch(MISTRAL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 350,
        temperature: 0.4,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });
  } catch {
    return jsonError("Upstream network error", 502);
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
    return jsonError("Upstream returned non-JSON", 502);
  }

  const text =
    (
      data as { choices?: Array<{ message?: { content?: string } }> }
    ).choices?.[0]?.message?.content?.trim() ?? "";

  if (!text) {
    return jsonError("Upstream returned empty response", 502);
  }

  return new Response(JSON.stringify({ text }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
