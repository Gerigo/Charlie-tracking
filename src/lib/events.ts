import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { durationMin, startOfDay } from "@/lib/dates";

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
} as const;

const STOOL_NORMALIZE: Record<string, string> = {
  jaune: "jaune_or",
  yellow: "jaune_or",
  moutarde: "ocre_bronze",
  mustard: "ocre_bronze",
  green: "vert",
  marron: "ocre_bronze",
  brown: "ocre_bronze",
  noir: "ocre_bronze",
};

/** design form data → Firestore `details`. */
function toDetails(type: EventType, data: EventData): Record<string, unknown> {
  switch (type) {
    case "feed": {
      const d = data as FeedData;
      if (d.kind === "biberon")
        return { feedSide: "bottle", feedAmountMl: d.ml ?? 0 };
      return { feedSide: d.breast === "D" ? "right" : "left" };
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

// ─── Derive the Tracker's day from the shared events list ───
export interface DaySnapshot {
  day: Date;
  events: AppEvent[];
  activeSleep: { id: string; start: Date } | null;
}

/** Pure selector — anchors on today if it has events, else the most
 *  recent event's day (like the legacy app: always show latest state). */
export function selectTrackerDay(all: AppEvent[]): DaySnapshot {
  const openSleep =
    [...all].reverse().find((e) => e.type === "sleep" && e.end === null) ??
    null;
  const activeSleep = openSleep
    ? { id: openSleep.id, start: openSleep.start }
    : null;

  const todayFrom = startOfDay(new Date()).getTime();
  const hasToday = all.some((e) => e.start.getTime() >= todayFrom);
  const anchor =
    hasToday || all.length === 0 ? new Date() : all[all.length - 1].start;
  const from = startOfDay(anchor).getTime();
  const to = from + 86400000;

  const events = all.filter((e) => {
    const t = e.start.getTime();
    const endT = e.end ? e.end.getTime() : t;
    return endT >= from && t < to;
  });

  return { day: new Date(from), events, activeSleep };
}

/** Live subscription to the whole history (sorted asc by start). */
export function subscribeAllEvents(
  cb: (events: AppEvent[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, "events"),
    (snap) => {
      const all = snap.docs
        .map((d) => fromDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => a.start.getTime() - b.start.getTime());
      cb(all);
    },
    (err) => onError?.(err as Error),
  );
}

// ─── Writes — minimal clean docs ───
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
  const ts = startMsFor(when, day);
  await addDoc(collection(db, "events"), {
    type: dbType(type),
    startTime: ts,
    endTime: ts,
    details: toDetails(type, data),
    notes: note.trim() || null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function startSleep(): Promise<void> {
  const ts = Date.now();
  await addDoc(collection(db, "events"), {
    type: "sleep",
    startTime: ts,
    endTime: null,
    details: {},
    notes: null,
    createdAt: ts,
    updatedAt: ts,
  });
}

export async function stopSleep(id: string): Promise<void> {
  await setDoc(
    doc(db, "events", id),
    { endTime: Date.now(), updatedAt: Date.now() },
    { merge: true },
  );
}

export async function editEvent(
  id: string,
  patch: { start?: TimeOfDay; end?: TimeOfDay | null; note?: string },
  day = new Date(),
): Promise<void> {
  const out: Record<string, unknown> = { updatedAt: Date.now() };
  if (patch.start) out.startTime = startMsFor(patch.start, day);
  if (patch.end === null) out.endTime = null;
  else if (patch.end) out.endTime = startMsFor(patch.end, day);
  if (patch.note !== undefined) out.notes = patch.note.trim() || null;
  await setDoc(doc(db, "events", id), out, { merge: true });
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
}

export async function deleteEvent(id: string): Promise<void> {
  await deleteDoc(doc(db, "events", id));
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
      return s + (f.kind === "biberon" ? f.ml || 0 : 0);
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
