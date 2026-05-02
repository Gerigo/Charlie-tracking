/**
 * Logger structuré pour Charlie Mobile.
 *
 * Niveaux  : debug < info < warn < error
 * Outputs  : console (toujours) + buffer mémoire (tous niveaux, 300 entrées max)
 *            + Firestore collection `appLogs` (warn + error uniquement)
 *
 * Intégration Sentry optionnelle : appeler `logger.setSentryClient(Sentry)`
 * après initialisation de Sentry pour activer la capture automatique.
 *
 * ─── Conformité RGPD ──────────────────────────────────────────────────────────
 * • userId  : jamais stocké en clair dans Firestore. Remplacé par un hash
 *             djb2 tronqué à 12 caractères (pseudonymisation irréversible).
 *             Le buffer mémoire (in-app uniquement) conserve le hash.
 * • TTL     : chaque document Firestore porte un champ `expiresAt` (now + 30 j).
 *             Un TTL policy Firebase peut purger automatiquement ces docs.
 * • Données : `sanitizeData()` filtre les champs à caractère médical/personnel
 *             avant toute écriture Firestore.
 * • Effacement : `logger.deleteUserLogs(userId)` supprime tous les docs du
 *             compte (droit à l'effacement — article 17 RGPD).
 */

import { Platform } from 'react-native';
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { firestore } from '@/src/lib/firebase';
import Constants from 'expo-constants';

// ─── Types ───────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  level: LogLevel;
  /** Contexte métier : 'auth' | 'tracker' | 'firestore' | 'navigation' | ... */
  context: string;
  message: string;
  data?: Record<string, unknown>;
  /** Message + stack de l'erreur éventuelle */
  errorDetails?: string;
  timestamp: number;
  /** Hash pseudonymisé (djb2) — jamais l'UID Firebase en clair */
  userHash?: string;
}

interface SentryLike {
  addBreadcrumb: (opts: { message: string; level: string; data?: Record<string, unknown>; category?: string }) => void;
  captureException: (error: Error) => void;
}

// ─── Native console (captured before any monkey-patching) ────────────────────
// Using .bind() to preserve the original function references even if patched later.
const _nativeConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

// ─── Buffer mémoire ───────────────────────────────────────────────────────────

const BUFFER_MAX = 300;

/** Buffer accessible depuis n'importe où pour le viewer in-app */
export const logBuffer: LogEntry[] = [];

let _listeners: Array<() => void> = [];

export function subscribeToLogBuffer(listener: () => void): () => void {
  _listeners.push(listener);
  return () => { _listeners = _listeners.filter((l) => l !== listener); };
}

function notifyListeners() {
  _listeners.forEach((l) => l());
}

// ─── État interne ─────────────────────────────────────────────────────────────

let _userId: string | undefined;
let _userHash: string | undefined;
let _sentry: SentryLike | undefined;
let _interceptorInstalled = false;
let _emitting = false; // recursion guard for console interceptor
const _appVersion = (Constants.expoConfig?.version ?? '?');
const _platform = Platform.OS;

// ─── RGPD — Pseudonymisation ──────────────────────────────────────────────────

/**
 * Hash djb2 sur une chaîne → entier non signé → base36 → 12 caractères.
 * Irréversible, stable pour un même uid, sans dépendance crypto.
 */
function djb2Hash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0; // force uint32
  }
  return h.toString(36).padStart(7, '0').slice(0, 12);
}

// ─── RGPD — Sanitisation des données ─────────────────────────────────────────

/**
 * Champs à ne jamais persister dans Firestore (données de santé / personnelles).
 * Étendu selon les types du domaine (domain.ts).
 */
const SENSITIVE_KEYS = new Set([
  'temperature', 'temp',
  'stoolColor', 'stool_color',
  'diaperType', 'diaper_type',
  'feedAmount', 'feed_amount', 'amount',
  'weight', 'height', 'headCircumference',
  'medication', 'dose', 'medicationName',
  'notes', 'note', 'comment',
  'firstName', 'first_name', 'name',
  'email', 'phone',
  'birthDate', 'birth_date',
]);

function sanitizeData(
  data: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!data) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!SENSITIVE_KEYS.has(k)) {
      clean[k] = v;
    }
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function serializeError(error: unknown): string | undefined {
  if (!error) return undefined;
  if (error instanceof Error) {
    const stack = error.stack ? `\n${error.stack}` : '';
    return `${error.name}: ${error.message}${stack}`;
  }
  return String(error);
}

function levelWeight(level: LogLevel): number {
  return { debug: 0, info: 1, warn: 2, error: 3 }[level];
}

// ─── RGPD — TTL (30 jours) ────────────────────────────────────────────────────

const LOG_TTL_DAYS = 30;

function expiresAt(): Timestamp {
  const d = new Date();
  d.setDate(d.getDate() + LOG_TTL_DAYS);
  return Timestamp.fromDate(d);
}

// ─── Persistance Firestore ───────────────────────────────────────────────────

async function persistToFirestore(entry: LogEntry): Promise<void> {
  try {
    const db = firestore;
    if (!db) return;
    const sanitized = sanitizeData(entry.data);
    await addDoc(collection(db, 'appLogs'), {
      level: entry.level,
      context: entry.context,
      message: entry.message,
      ...(sanitized ? { data: sanitized } : {}),
      ...(entry.errorDetails ? { errorDetails: entry.errorDetails } : {}),
      timestamp: entry.timestamp,
      // userId pseudonymisé uniquement
      ...(entry.userHash ? { userHash: entry.userHash } : {}),
      appVersion: _appVersion,
      platform: _platform,
      // TTL RGPD : purge automatique après 30 jours
      expiresAt: expiresAt(),
    });
  } catch {
    // Ne jamais propager une erreur depuis le logger
  }
}

// ─── Core ─────────────────────────────────────────────────────────────────────

function emit(
  level: LogLevel,
  context: string,
  message: string,
  data?: Record<string, unknown>,
  error?: unknown,
): void {
  const entry: LogEntry = {
    id: makeId(),
    level,
    context,
    message,
    ...(data ? { data } : {}),
    ...(error ? { errorDetails: serializeError(error) } : {}),
    timestamp: Date.now(),
    ...(_userHash ? { userHash: _userHash } : {}),
  };

  // Buffer mémoire
  logBuffer.unshift(entry);
  if (logBuffer.length > BUFFER_MAX) logBuffer.splice(BUFFER_MAX);
  notifyListeners();

  // Console — use native methods to avoid recursion if interceptor is installed
  const prefix = `[${level.toUpperCase()}][${context}] ${message}`;
  if (level === 'error') {
    _nativeConsole.error(prefix, ...[data, error].filter(Boolean));
  } else if (level === 'warn') {
    _nativeConsole.warn(prefix, ...[data].filter(Boolean));
  } else {
    _nativeConsole.log(prefix, ...[data].filter(Boolean));
  }

  // Sentry (breadcrumb pour tous, captureException pour error)
  if (_sentry) {
    _sentry.addBreadcrumb({ message, level, data: sanitizeData(data), category: context });
    if (level === 'error' && error instanceof Error) {
      _sentry.captureException(error);
    }
  }

  // Firestore : uniquement warn + error (évite le bruit)
  if (levelWeight(level) >= levelWeight('warn')) {
    void persistToFirestore(entry);
  }
}

// ─── API publique ─────────────────────────────────────────────────────────────

export const logger = {
  debug: (context: string, message: string, data?: Record<string, unknown>) =>
    emit('debug', context, message, data),

  info: (context: string, message: string, data?: Record<string, unknown>) =>
    emit('info', context, message, data),

  warn: (context: string, message: string, data?: Record<string, unknown>, error?: unknown) =>
    emit('warn', context, message, data, error),

  error: (context: string, message: string, error?: unknown, data?: Record<string, unknown>) =>
    emit('error', context, message, data, error),

  /**
   * Intercepte console.error et console.warn pour capturer les messages des
   * librairies tierces (Firebase SDK, etc.) dans le buffer mémoire + Firestore.
   * Appeler une seule fois au démarrage de l'app (ex: dans _layout.tsx root).
   * Idempotent : plusieurs appels n'installent l'intercepteur qu'une fois.
   */
  installConsoleInterceptor: () => {
    if (_interceptorInstalled) return;
    _interceptorInstalled = true;

    const toStr = (a: unknown) =>
      typeof a === 'string' ? a : a instanceof Error ? `${a.name}: ${a.message}` : JSON.stringify(a);

    console.error = (...args: unknown[]) => {
      _nativeConsole.error(...args);
      if (!_emitting) {
        _emitting = true;
        emit('error', 'console', args.map(toStr).join(' '));
        _emitting = false;
      }
    };

    console.warn = (...args: unknown[]) => {
      _nativeConsole.warn(...args);
      if (!_emitting) {
        _emitting = true;
        emit('warn', 'console', args.map(toStr).join(' '));
        _emitting = false;
      }
    };
  },

  /** À appeler dès que l'auth est établie. L'UID n'est jamais stocké en clair. */
  setUserId: (userId: string | undefined) => {
    _userId = userId;
    _userHash = userId ? djb2Hash(userId) : undefined;
  },

  /** Injecter le client Sentry après son initialisation */
  setSentryClient: (sentry: SentryLike) => { _sentry = sentry; },

  /** Vider le buffer mémoire (ne supprime pas Firestore) */
  clearBuffer: () => { logBuffer.splice(0); notifyListeners(); },

  /**
   * RGPD — Droit à l'effacement (art. 17).
   * Supprime tous les documents `appLogs` liés à cet utilisateur.
   * À appeler lors de la suppression de compte.
   */
  deleteUserLogs: async (userId: string): Promise<void> => {
    try {
      const db = firestore;
      if (!db) return;
      const hash = djb2Hash(userId);
      const snap = await getDocs(
        query(collection(db, 'appLogs'), where('userHash', '==', hash)),
      );
      if (snap.empty) return;
      // writeBatch supporte jusqu'à 500 ops ; on boucle si nécessaire
      const BATCH_SIZE = 400;
      let batch = writeBatch(db);
      let count = 0;
      for (const doc of snap.docs) {
        batch.delete(doc.ref);
        count++;
        if (count % BATCH_SIZE === 0) {
          await batch.commit();
          batch = writeBatch(db);
        }
      }
      if (count % BATCH_SIZE !== 0) {
        await batch.commit();
      }
    } catch {
      // Ne jamais propager depuis le logger
    }
  },
};
