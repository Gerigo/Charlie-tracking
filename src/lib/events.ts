import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { durationMin, startOfDay } from "@/lib/dates";

// ─── Optimistic write notifications ──────────────────────────────────
// Firestore compound-query listeners don't always fire immediately for
// local pending writes (server round-trip required). We broadcast each
// write locally so the UI can update without waiting for the network.
type WriteListener = (event: AppEvent) => void;
const writeListeners: WriteListener[] = [];

export function subscribeToWrites(cb: WriteListener): () => void {
  writeListeners.push(cb);
  return () => {
    const i = writeListeners.indexOf(cb);
    if (i >= 0) writeListeners.splice(i, 1);
  };
}

function notifyWrite(event: AppEvent): void {
  for (const cb of writeListeners) cb(event);
}

// Rollback channel for optimistic writes that fail before the server
// confirms them (e.g. a sleep transaction that aborts). Lets the UI drop
// the phantom event instead of waiting for the next server snapshot.
type RemoveListener = (id: string) => void;
const removeListeners: RemoveListener[] = [];

export function subscribeToRemovals(cb: RemoveListener): () => void {
  removeListeners.push(cb);
  return () => {
    const i = removeListeners.indexOf(cb);
    if (i >= 0) removeListeners.splice(i, 1);
  };
}

function notifyRemove(id: string): void {
  for (const cb of removeListeners) cb(id);
}

// ─── Simplified model ────────────────────────────────────────────────
// Single user, single baby, private DB. We read the whole `events`
// collection and only keep what we need: type / startTime / endTime /
// details / notes. Everything else in old docs (familyId, babyId,
// createdByUserId, createdByLabel, photoUrl, trackerId, …) is ignored.
// New docs are written minimal & clean. "Sleep in progress" = a sleep
// event whose endTime is null — no activeSessions collection.

export type EventType =
  | "sleep"
  | "feed"
  | "pump"
  | "diaper"
  | "care"
  | "temp"
  | "growth";

export interface FeedData {
  kind: "sein" | "biberon";
  breast: "G" | "D" | null;
  ml: number | null;
  /** ml de complément au biberon donné en plus d'une tétée au sein. */
  supp?: number | null;
  note: string;
}
export interface PumpData {
  breast: "G" | "D" | "GD";
  ml: number;
  note: string;
}
export interface DiaperData {
  pipi: boolean;
  caca: boolean;
  color: string | null;
  note: string;
}
export interface CareData {
  /** One care event can group several soins (multi-select). */
  kinds: string[];
  custom: string | null;
  note: string;
}
export interface TempData {
  value: number;
  slot: "matin" | "soir";
  note: string;
}
export interface SleepData {
  note: string;
}
export interface GrowthData {
  weight: number | null; // kg
  height: number | null; // cm
  head: number | null; // cm
  note: string;
}
export type EventData =
  | FeedData
  | PumpData
  | DiaperData
  | CareData
  | TempData
  | GrowthData
  | SleepData;

export interface AppEvent {
  id: string;
  type: EventType;
  start: Date;
  end: Date | null;
  durMin: number;
  data: EventData;
}

export interface TimeOfDay {
  h: number;
  m: number;
}

// ─── Type mapping (DB `type` ↔ app type) ───
const TYPE_TO_DB: Record<EventType, string> = {
  sleep: "sleep",
  feed: "feed",
  pump: "pumping",
  diaper: "diaper",
  care: "care",
  temp: "temperature",
  growth: "growth",
};
function dbType(t: EventType): string {
  return TYPE_TO_DB[t];
}
function appType(raw: string): EventType {
  switch (raw) {
    case "sleep":
      return "sleep";
    case "feed":
      return "feed";
    case "pumping":
    case "pump":
      return "pump";
    case "diaper":
      return "diaper";
    case "temperature":
    case "temp":
      return "temp";
    case "growth":
      return "growth";
    // legacy data stored "soins"/"visites" as `medication`
    case "medication":
    case "visit":
    case "care":
      return "care";
    default:
      return "care";
  }
}

// Stool color values ARE the schema enum (no translation). Legacy
// values (old English / pre-v2 keys) are normalised to the new set.
export const STOOL_COLORS = {
  surveiller: [
    { v: "jaune_pale", l: "Jaune pâle", sw: "#EFE0A8" },
    { v: "beige", l: "Beige", sw: "#DECBA0" },
    { v: "blanc_mastic", l: "Blanc mastic", sw: "#E7E0CE" },
  ],
  habituelles: [
    { v: "jaune_or", l: "Jaune d'or", sw: "#E0A82E" },
    { v: "ocre_bronze", l: "Ocre bronze", sw: "#B0793A" },
    { v: "vert", l: "Vert", sw: "#6E8B4A" },
  ],
  autres: [
    { v: "marron", l: "Marron", sw: "#7A5236" },
    { v: "noir", l: "Noir", sw: "#2A2620" },
    { v: "blanc", l: "Blanc", sw: "#EDEAE0" },
    { v: "rouge", l: "Rouge", sw: "#A8483C" },
  ],
} as const;

const STOOL_NORMALIZE: Record<string, string> = {
  jaune: "jaune_or",
  yellow: "jaune_or",
  moutarde: "ocre_bronze",
  mustard: "ocre_bronze",
  green: "vert",
  brown: "marron",
  black: "noir",
  white: "blanc",
  red: "rouge",
};

/** design form data → Firestore `details`. */
function toDetails(type: EventType, data: EventData): Record<string, unknown> {
  switch (type) {
    case "feed": {
      const d = data as FeedData;
      if (d.kind === "biberon")
        return { feedSide: "bottle", feedAmountMl: d.ml ?? 0 };
      return {
        feedSide: d.breast === "D" ? "right" : "left",
        ...(d.supp ? { bottleSupplement: d.supp } : {}),
      };
    }
    case "pump": {
      const d = data as PumpData;
      const side =
        d.breast === "GD" ? "both" : d.breast === "D" ? "right" : "left";
      return { pumpingSide: side, pumpingVolumeMl: d.ml };
    }
    case "diaper": {
      const d = data as DiaperData;
      const diaperType = d.pipi && d.caca ? "both" : d.caca ? "dirty" : "wet";
      const out: Record<string, unknown> = { diaperType };
      if (d.caca && d.color) out.stoolColor = d.color;
      return out;
    }
    case "care": {
      const d = data as CareData;
      return {
        careKinds: d.kinds,
        ...(d.custom ? { careCustom: d.custom } : {}),
      };
    }
    case "temp": {
      const d = data as TempData;
      return {
        temperature: d.value,
        temperaturePeriod: d.slot === "soir" ? "evening" : "morning",
      };
    }
    case "growth": {
      const d = data as GrowthData;
      const out: Record<string, unknown> = {};
      if (d.weight != null) out.weight = d.weight;
      if (d.height != null) out.height = d.height;
      if (d.head != null) out.head = d.head;
      return out;
    }
    default:
      return {};
  }
}

/**
 * Robustly read a time field that may be epoch ms, epoch seconds, a
 * Firestore Timestamp, an ISO string or a Date. Returns epoch ms or null.
 */
function toMs(v: unknown): number | null {
  if (v == null) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v > 0 && v < 1e12 ? v * 1000 : v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  if (typeof v === "object") {
    const o = v as {
      seconds?: number;
      _seconds?: number;
      toMillis?: () => number;
    };
    if (typeof o.toMillis === "function") return o.toMillis();
    const s = o.seconds ?? o._seconds;
    if (typeof s === "number") return s * 1000;
  }
  return null;
}

/** Firestore doc → AppEvent. Handles both legacy & current shapes. */
function fromDoc(id: string, raw: Record<string, unknown>): AppEvent {
  const type = appType(String(raw.type));
  const startMs =
    toMs(raw.startTime) ??
    toMs(raw.start) ??
    toMs(raw.time) ??
    toMs(raw.createdAt) ??
    Date.now();
  const endMs = toMs(raw.endTime) ?? toMs(raw.end);
  const start = new Date(startMs);
  const end = endMs != null ? new Date(endMs) : null;
  const det = (raw.details ?? {}) as Record<string, unknown>;
  const note = typeof raw.notes === "string" ? raw.notes : "";

  let data: EventData;
  switch (type) {
    case "feed": {
      const side = det.feedSide as string | undefined;
      data = {
        kind: side === "bottle" ? "biberon" : "sein",
        breast: side === "right" ? "D" : side === "left" ? "G" : null,
        ml: typeof det.feedAmountMl === "number" ? det.feedAmountMl : null,
        supp:
          typeof det.bottleSupplement === "number"
            ? det.bottleSupplement
            : null,
        note,
      } satisfies FeedData;
      break;
    }
    case "pump": {
      const side = det.pumpingSide as string | undefined;
      data = {
        breast: side === "both" ? "GD" : side === "right" ? "D" : "G",
        ml: typeof det.pumpingVolumeMl === "number" ? det.pumpingVolumeMl : 0,
        note,
      } satisfies PumpData;
      break;
    }
    case "diaper": {
      const dt = det.diaperType as string | undefined;
      const sc = det.stoolColor as string | undefined;
      data = {
        pipi: dt === "wet" || dt === "both",
        caca: dt === "dirty" || dt === "both",
        color: sc ? (STOOL_NORMALIZE[sc] ?? sc) : null,
        note,
      } satisfies DiaperData;
      break;
    }
    case "care": {
      const arr = det.careKinds;
      const kinds = Array.isArray(arr)
        ? arr.filter((x): x is string => typeof x === "string")
        : typeof det.careKind === "string"
          ? [det.careKind]
          : typeof det.medicationName === "string"
            ? [det.medicationName]
            : ["custom"];
      data = {
        kinds: kinds.length ? kinds : ["custom"],
        custom: typeof det.careCustom === "string" ? det.careCustom : null,
        note,
      } satisfies CareData;
      break;
    }
    case "temp": {
      data = {
        value: typeof det.temperature === "number" ? det.temperature : 37,
        slot: det.temperaturePeriod === "evening" ? "soir" : "matin",
        note,
      } satisfies TempData;
      break;
    }
    case "growth": {
      data = {
        weight: typeof det.weight === "number" ? det.weight : null,
        height: typeof det.height === "number" ? det.height : null,
        head: typeof det.head === "number" ? det.head : null,
        note,
      } satisfies GrowthData;
      break;
    }
    default:
      data = { note } satisfies SleepData;
  }

  return {
    id,
    type,
    start,
    end,
    durMin: end ? durationMin(start, end) : 0,
    data,
  };
}

/**
 * Sleep minutes overlapping [fromMs, toMs). Splits at the window edges
 * (so a night split across midnight counts only its in-window part),
 * unclosed sleeps run to "now", absurd >20h sessions are ignored.
 * Shared by Tracker + Aujourd'hui so the two always agree.
 */
export function sleepMinutesIn(
  all: AppEvent[],
  fromMs: number,
  toMs: number,
): number {
  let total = 0;
  for (const e of all) {
    if (e.type !== "sleep") continue;
    const s = e.start.getTime();
    const end = e.end ? e.end.getTime() : Date.now();
    if (end <= s || end - s > 20 * 3600000) continue;
    const a = Math.max(s, fromMs);
    const b = Math.min(end, toMs);
    if (b > a) total += (b - a) / 60000;
  }
  return Math.round(total);
}

// ─── Derive the Tracker's day from the shared events list ───
export interface DaySnapshot {
  day: Date;
  events: AppEvent[];
  activeSleep: { id: string; start: Date } | null;
}

/** Always anchored on today. A cross-midnight sleep (started yesterday,
 *  still running) appears on today because its effective end is now. */
export function selectTrackerDay(all: AppEvent[]): DaySnapshot {
  const openSleep =
    [...all].reverse().find((e) => e.type === "sleep" && e.end === null) ??
    null;
  const activeSleep = openSleep
    ? { id: openSleep.id, start: openSleep.start }
    : null;

  const from = startOfDay(new Date()).getTime();
  const to = from + 86400000;

  const events = all.filter((e) => {
    const t = e.start.getTime();
    // Only the active (most-recent open) sleep is truly ongoing — treat
    // its end as now so it crosses midnight into today. Every other
    // null-end event (abandoned sleeps, legacy data) falls back to t.
    const isActiveSleep = openSleep !== null && e.id === openSleep.id;
    const endT = e.end ? e.end.getTime() : isActiveSleep ? Date.now() : t;
    return endT >= from && t < to;
  });

  return { day: new Date(from), events, activeSleep };
}

/** Live subscription to the whole history (sorted asc by start). */
// ─── Scope (current schema, same as the legacy/main app) ───
// The migration duplicated legacy events into the new schema with
// familyId + babyId. main reads/writes ONLY that scope, so v2 must too:
// otherwise we double-count legacy originals + migrated copies, and our
// writes (without familyId/babyId) are invisible to main.
export interface Scope {
  familyId: string;
  babyId: string;
  userId: string;
  role: "manager" | "viewer";
}

let _scope: Scope | null = null;
export function setScope(s: Scope | null) {
  _scope = s;
}
/**
 * Toujours une adresse valide : si le provider ne l'a pas (encore)
 * posée — démontage, HMR, StrictMode… — on retombe sur l'adresse fixe
 * de Charlie (DB privée, un seul bébé). Plus jamais "profil non chargé".
 */
function scope(): Scope {
  if (_scope) return _scope;
  return {
    familyId: CHARLIE_SCOPE.familyId,
    babyId: CHARLIE_SCOPE.babyId,
    userId: auth.currentUser?.uid ?? "unknown",
    role: "manager",
  };
}

/**
 * Adresse de Charlie figée (DB privée, un seul bébé). Utilisée tout de
 * suite au démarrage pour que ça marche sans dépendre du profil ; la
 * résolution profil reste un filet de sécurité si un jour ça change.
 */
export const CHARLIE_SCOPE = {
  familyId: "osWgSUAkUsuNv4SNrQzI",
  babyId: "yZBl10Ybdph9ooGbguoe",
} as const;

/** Resolve userProfiles/{uid} → familyId + defaultBabyId (like main). */
export function subscribeProfile(
  uid: string,
  cb: (p: { familyId: string | null; defaultBabyId: string | null }) => void,
): Unsubscribe {
  return onSnapshot(doc(db, "userProfiles", uid), (snap) => {
    const d = (snap.data() as Record<string, unknown>) ?? {};
    cb({
      familyId:
        (typeof d.familyId === "string" && d.familyId) ||
        (typeof d.defaultFamilyId === "string" && d.defaultFamilyId) ||
        null,
      defaultBabyId:
        typeof d.defaultBabyId === "string" ? d.defaultBabyId : null,
    });
  });
}

export interface Baby {
  id: string;
  familyId: string;
  createdAt: number;
}
export function subscribeBabies(
  familyId: string,
  cb: (babies: Baby[]) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "babies"), where("familyId", "==", familyId)),
    (snap) => {
      cb(
        snap.docs
          .map((b) => {
            const d = b.data() as Record<string, unknown>;
            return {
              id: b.id,
              familyId: String(d.familyId ?? familyId),
              createdAt:
                typeof d.createdAt === "number" ? d.createdAt : 0,
            };
          })
          .sort((a, b) => a.createdAt - b.createdAt),
      );
    },
  );
}

/** Live events for the resolved baby — exactly main's listenEvents. */
export function subscribeScopedEvents(
  familyId: string,
  babyId: string,
  cb: (events: AppEvent[], fromCache: boolean) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, "events"),
      where("babyId", "==", babyId),
      where("familyId", "==", familyId),
    ),
    (snap) => {
      cb(
        snap.docs
          .map((d) => fromDoc(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => a.start.getTime() - b.start.getTime()),
        snap.metadata.fromCache,
      );
    },
    (err) => onError?.(err as Error),
  );
}

export function subscribeActiveSession(
  babyId: string,
  cb: (active: { id: string; start: Date } | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, "activeSessions", babyId), (snap) => {
    const d = snap.data() as Record<string, unknown> | undefined;
    cb(
      snap.exists() && d && d.type === "sleep"
        ? {
            id: String(d.eventId ?? ""),
            start: new Date(
              typeof d.startTime === "number" ? d.startTime : Date.now(),
            ),
          }
        : null,
    );
  });
}

// ─── Writes — current schema (familyId/babyId), mirrors main ───
function startMsFor(when: TimeOfDay, day: Date): number {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    when.h,
    when.m,
    0,
    0,
  ).getTime();
}

export async function addInstantEvent(
  type: Exclude<EventType, "sleep">,
  when: TimeOfDay,
  data: EventData,
  note: string,
  day = new Date(),
): Promise<void> {
  const s = scope();
  const ts = startMsFor(when, day);
  notifyWrite({
    id: `__opt_${Date.now()}`,
    type,
    start: new Date(ts),
    end: new Date(ts),
    durMin: 0,
    data,
  });
  await addDoc(collection(db, "events"), {
    familyId: s.familyId,
    babyId: s.babyId,
    type: dbType(type),
    startTime: ts,
    endTime: ts,
    details: toDetails(type, data),
    notes: note.trim() || null,
    createdByUserId: s.userId,
    createdByRole: s.role,
    createdAt: ts,
    updatedAt: ts,
    serverCreatedAt: serverTimestamp(),
  });
}

export async function startSleep(): Promise<void> {
  const s = scope();
  const ts = Date.now();
  const sessionRef = doc(db, "activeSessions", s.babyId);
  const eventRef = doc(collection(db, "events"));
  // Optimistic: surface the in-progress sleep right away. Transactions go
  // straight to the server (no local pending write), so without this the
  // tile + history would stay empty until the round-trip lands — the
  // exact "I started a sleep but nothing showed up" bug. We reuse the
  // event's real id so the server snapshot dedupes instead of duplicating.
  notifyWrite({
    id: eventRef.id,
    type: "sleep",
    start: new Date(ts),
    end: null,
    durMin: 0,
    data: { note: "" } satisfies SleepData,
  });
  try {
    await runTransaction(db, async (tx) => {
      const active = await tx.get(sessionRef);
      if (active.exists()) throw new Error("Un sommeil est déjà en cours.");
      tx.set(eventRef, {
        familyId: s.familyId,
        babyId: s.babyId,
        type: "sleep",
        startTime: ts,
        endTime: null,
        notes: null,
        details: {},
        createdByUserId: s.userId,
        createdByRole: s.role,
        createdAt: ts,
        updatedAt: ts,
        serverCreatedAt: serverTimestamp(),
      });
      tx.set(sessionRef, {
        familyId: s.familyId,
        babyId: s.babyId,
        eventId: eventRef.id,
        type: "sleep",
        startTime: ts,
        details: {},
        createdByUserId: s.userId,
        createdByRole: s.role,
        updatedAt: ts,
      });
    });
  } catch (e) {
    // Transaction aborted (already in progress, offline, …): drop the
    // optimistic sleep so the UI doesn't show a phantom in-progress nap.
    notifyRemove(eventRef.id);
    throw e;
  }
}

export async function stopSleep(id: string): Promise<void> {
  const s = scope();
  const sessionRef = doc(db, "activeSessions", s.babyId);
  const ts = Date.now();
  await runTransaction(db, async (tx) => {
    const active = await tx.get(sessionRef);
    if (active.exists()) {
      const eid = String(active.data()?.eventId ?? id);
      const evRef = doc(db, "events", eid);
      const ev = await tx.get(evRef);
      if (ev.exists()) {
        tx.update(evRef, { endTime: ts, updatedAt: ts });
      }
      tx.delete(sessionRef);
    } else if (id) {
      // No active-session doc (e.g. started elsewhere) — just close it.
      tx.set(
        doc(db, "events", id),
        { endTime: ts, updatedAt: ts },
        { merge: true },
      );
    }
  });
}

/** Full update of an existing event (times + details + note). */
export async function updateEvent(
  id: string,
  patch: {
    startMs: number;
    endMs: number | null;
    type: EventType;
    data: EventData;
    note: string;
  },
): Promise<void> {
  await setDoc(
    doc(db, "events", id),
    {
      startTime: patch.startMs,
      endTime: patch.endMs,
      details: toDetails(patch.type, patch.data),
      notes: patch.note.trim() || null,
      updatedAt: Date.now(),
    },
    { merge: true },
  );
  // Sommeil en cours édité (endTime resté null) : refléter le nouveau
  // startTime sur activeSessions pour que le chrono (et main) suivent.
  if (patch.type === "sleep" && patch.endMs === null) {
    try {
      const s = scope();
      const sessionRef = doc(db, "activeSessions", s.babyId);
      const active = await getDoc(sessionRef);
      if (active.exists() && active.data()?.eventId === id) {
        await setDoc(
          sessionRef,
          { startTime: patch.startMs, updatedAt: Date.now() },
          { merge: true },
        );
      }
    } catch {
      /* scope absent — rien à synchroniser */
    }
  }
}

export async function deleteEvent(id: string): Promise<void> {
  await deleteDoc(doc(db, "events", id));
  // Clear the active-session pointer if it referenced this event (main).
  try {
    const s = scope();
    const sessionRef = doc(db, "activeSessions", s.babyId);
    const active = await getDoc(sessionRef);
    if (active.exists() && active.data()?.eventId === id) {
      await deleteDoc(sessionRef);
    }
  } catch {
    /* scope not ready — nothing to clean */
  }
}

// ─── Derived stats for the Tracker tiles ───
export interface DayStats {
  sleepMin: number;
  feedCount: number;
  bottleMl: number;
  pumpMl: number;
  pumpCount: number;
  diaperCount: number;
  pipiCount: number;
  cacaCount: number;
  careCount: number;
  lastTemp: number | null;
  lastFeed: AppEvent | null;
  lastBreast: "G" | "D" | null;
  lastSleep: AppEvent | null;
}

export function statsFor(events: AppEvent[]): DayStats {
  const feeds = events.filter((e) => e.type === "feed");
  const pumps = events.filter((e) => e.type === "pump");
  const diapers = events.filter((e) => e.type === "diaper");
  const temps = events.filter((e) => e.type === "temp");
  const sleeps = events.filter((e) => e.type === "sleep");
  const lastFeed = feeds.length ? feeds[feeds.length - 1] : null;
  const lastBreast =
    [...feeds]
      .reverse()
      .map((f) => (f.data as FeedData).breast)
      .find((b): b is "G" | "D" => b === "G" || b === "D") ?? null;
  return {
    sleepMin: sleeps.reduce((s, e) => s + e.durMin, 0),
    feedCount: feeds.length,
    bottleMl: feeds.reduce((s, e) => {
      const f = e.data as FeedData;
      return s + (f.kind === "biberon" ? f.ml || 0 : f.supp || 0);
    }, 0),
    pumpMl: pumps.reduce((s, e) => s + ((e.data as PumpData).ml || 0), 0),
    pumpCount: pumps.length,
    diaperCount: diapers.length,
    pipiCount: diapers.filter((e) => (e.data as DiaperData).pipi).length,
    cacaCount: diapers.filter((e) => (e.data as DiaperData).caca).length,
    careCount: events.filter((e) => e.type === "care").length,
    lastTemp: temps.length
      ? (temps[temps.length - 1].data as TempData).value
      : null,
    lastFeed,
    lastBreast,
    lastSleep: [...sleeps].reverse().find((e) => e.end) ?? null,
  };
}

export const CARE_OPTIONS: { v: string; l: string }[] = [
  { v: "bain", l: "Bain" },
  { v: "douche", l: "Douche" },
  { v: "vitamine_d", l: "Vitamine D" },
  { v: "calmosine", l: "Calmosine" },
  { v: "creme", l: "Crème / pommade" },
  { v: "osteo", l: "Ostéopathe" },
  { v: "medecin", l: "Pédiatre / médecin / ONE" },
  { v: "vaccin", l: "Vaccin" },
  { v: "medicament", l: "Médicament" },
  { v: "custom", l: "Autre" },
];

const CARE_LABELS: Record<string, string> = {
  ...Object.fromEntries(CARE_OPTIONS.map((o) => [o.v, o.l])),
  // legacy medicationName values seen in current-format data
  vitamin_d: "Vitamine D",
  bath: "Bain",
  pediatrician: "Pédiatre / médecin",
  midwife: "Sage-femme",
};

export function careLabel(kind: string): string {
  return CARE_LABELS[kind] ?? kind;
}

/** Human label for a (multi) care event: "Bain, Crème, Tire-lait". */
export function careText(data: CareData): string {
  const parts = data.kinds.map((k) =>
    k === "custom" ? (data.custom?.trim() || "Autre") : careLabel(k),
  );
  return parts.join(", ");
}
