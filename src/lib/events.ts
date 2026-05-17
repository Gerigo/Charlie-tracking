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
  | "temp";

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
  kind: string;
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
export type EventData =
  | FeedData
  | PumpData
  | DiaperData
  | CareData
  | TempData
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
    // legacy data stored "soins"/"visites" as `medication`
    case "medication":
    case "visit":
    case "care":
      return "care";
    default:
      return "care";
  }
}

const STOOL_TO_DB: Record<string, string> = {
  jaune: "jaune_or",
  moutarde: "ocre_bronze",
  vert: "vert",
  marron: "marron",
};
const STOOL_FROM_DB: Record<string, string> = {
  jaune_or: "jaune",
  jaune_pale: "jaune",
  ocre_bronze: "moutarde",
  vert: "vert",
  marron: "marron",
  noir: "marron",
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
      if (d.caca && d.color) out.stoolColor = STOOL_TO_DB[d.color] ?? "jaune_or";
      return out;
    }
    case "care": {
      const d = data as CareData;
      return {
        careKind: d.kind,
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
        color: sc ? (STOOL_FROM_DB[sc] ?? "jaune") : null,
        note,
      } satisfies DiaperData;
      break;
    }
    case "care": {
      const kind =
        (typeof det.careKind === "string" && det.careKind) ||
        (typeof det.medicationName === "string" && det.medicationName) ||
        "custom";
      data = {
        kind,
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

// ─── Live subscription: whole `events` collection, anchored on the
//     latest day with data (today if it has events) ───
export interface DaySnapshot {
  day: Date;
  events: AppEvent[];
  activeSleep: { id: string; start: Date } | null;
}

export function subscribeTracker(
  cb: (snap: DaySnapshot) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, "events"),
    (snap) => {
      const all = snap.docs
        .map((d) => fromDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      // Sleep in progress = a sleep event with no endTime.
      const openSleep =
        [...all].reverse().find((e) => e.type === "sleep" && e.end === null) ??
        null;
      const activeSleep = openSleep
        ? { id: openSleep.id, start: openSleep.start }
        : null;

      // Anchor on today if it has events, otherwise the most recent
      // event's day (like the legacy app: always show the latest state).
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

      if (all.length) {
        const max = all[all.length - 1].start;
        console.info(
          `[events] ${all.length} docs · dernier ${max.toLocaleString("fr")} · jour affiché ${new Date(from).toLocaleDateString("fr")} · dans le jour=${events.length}`,
        );
      } else {
        console.info("[events] 0 doc dans la collection");
      }
      cb({ day: new Date(from), events, activeSleep });
    },
    (err) => {
      const code =
        typeof err === "object" && err && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      console.warn(`[events] snapshot error: ${code || err}`);
      onError?.(err as Error);
    },
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

export async function deleteEvent(id: string): Promise<void> {
  await deleteDoc(doc(db, "events", id));
}

// ─── Derived stats for the Tracker tiles ───
export interface DayStats {
  sleepMin: number;
  feedCount: number;
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
  { v: "nettoyage_nez", l: "Nez (mouche-bébé)" },
  { v: "vitamine_d", l: "Vitamine D" },
  { v: "cordon", l: "Soin du cordon" },
  { v: "creme", l: "Crème / pommade" },
  { v: "massage", l: "Massage" },
  { v: "ongles", l: "Ongles" },
  { v: "yeux", l: "Soin des yeux" },
  { v: "change", l: "Habillage" },
  { v: "osteo", l: "Ostéopathe" },
  { v: "medecin", l: "Pédiatre / médecin" },
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
