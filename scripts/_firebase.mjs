/**
 * Shared Firebase config for all migration / verification scripts.
 *
 * Reads from process.env so the API key never lands in source.
 * Use one of these to load `.env.local` automatically:
 *
 *   1. Built-in (Node 20.6+):
 *        node --env-file=.env.local scripts/<name>.mjs <args>
 *
 *   2. Or pass each var inline (CI / one-offs):
 *        EXPO_PUBLIC_FIREBASE_API_KEY=... \
 *        EXPO_PUBLIC_FIREBASE_PROJECT_ID=... \
 *        node scripts/<name>.mjs <args>
 *
 * The script aborts with a friendly error if any required var is missing.
 */

function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    console.error(
      `❌ Missing env var: ${name}\n` +
        `   Run with: node --env-file=.env.local scripts/<name>.mjs <args>\n` +
        `   (.env.local is in the project root, gitignored, with all your EXPO_PUBLIC_FIREBASE_* values)`,
    );
    process.exit(1);
  }
  return value;
}

export const firebaseConfig = {
  apiKey: required('EXPO_PUBLIC_FIREBASE_API_KEY'),
  authDomain: required('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: required('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: required('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: required('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId: required('EXPO_PUBLIC_FIREBASE_APP_ID'),
};
