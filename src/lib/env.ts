export const env = {
  firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
  appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? (__DEV__ ? 'development' : 'production'),
  /** Whether the LLM growth-spurt analysis is wired up for this build.
   * The actual Mistral API key lives ONLY on the server (Vercel env var
   * `MISTRAL_API_KEY`), never in the client bundle. This flag just lets
   * the UI know whether to render the "Demander une analyse" button. */
  mistralEnabled: (process.env.EXPO_PUBLIC_MISTRAL_ENABLED ?? '').toLowerCase() === 'true',
  /** Soft client-side cap on successful analyses per day per device.
   * Defaults to 10 — plenty for a parent app, low enough that an accidental
   * loop or stuck button can't drain the API quota. The server proxy has
   * no rate limit yet, so this remains a useful guard even after the
   * key migration. */
  mistralDailyLimit: clampPositiveInt(process.env.EXPO_PUBLIC_MISTRAL_DAILY_LIMIT, 10),
};

function clampPositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

export const isFirebaseConfigured = Boolean(
  env.firebaseApiKey &&
  env.firebaseAuthDomain &&
  env.firebaseProjectId &&
  env.firebaseAppId
);

export const isProductionBuild = env.appEnv === 'production' && !__DEV__;
export const canUseDevTools = !isProductionBuild;
