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

// Legacy single-tracker scope — same data as the original Charlie app.
const SCOPE = "charlie-shared";

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

// ─── Mapping: design type ↔ Firestore `type` (EVENTS_SCHEMA) ───
const TYPE_TO_DB: Record<EventType, string> = {
  sleep: "sleep",
  feed: "feed",
  pump: "pumping",
  diaper: "diaper",
  care: "care", // new v2 type (legacy app had no dedicated care type)
  temp: "temperature",
};
const DB_TO_TYPE: Record<string, EventType> = {
  sleep: "sleep",
  feed: "feed",
  diaper: "diaper",
  care: "care",
};

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

function dbType(t: EventType): string {
  return TYPE_TO_DB[t];
}
function appType(raw: string): EventType {
  if (raw === "pumping") return "pump";
  if (raw === "temperature") return "temp";
  return (DB_TO_TYPE[raw] as EventType) ?? "care";
}

/** design form data → Firestore `details` object (EVENTS_SCHEMA shape). */
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
      const diaperType =
        d.pipi && d.caca ? "both" : d.caca ? "dirty" : "wet";
      const out: Record<string, unknown> = { diaperType };
      if (d.caca && d.color) out.stoolColor = STOOL_TO_DB[d.color] ?? "jaune_or";
      return out;
    }
    case "care": {
      const d = data as CareData;
      return {
        careCategory: "care",
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

/** Firestore doc → AppEvent (design shape). */
function fromDoc(id: string, raw: Record<string, unknown>): AppEvent {
  const type = appType(String(raw.type));
  const startMs =
    typeof raw.startTime === "number" ? raw.startTime : Date.now();
  const endMs = typeof raw.endTime === "number" ? raw.endTime : null;
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
      data = {
        kind: typeof det.careKind === "string" ? det.careKind : "custom",
        custom:
          typeof det.careCustom === "string" ? det.careCustom : null,
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

function uid(): string {
  const u = auth.currentUser;
  if (!u) throw new Error("Non connecté.");
  return u.uid;
}

// ─── Live subscription: a given day's events + active sleep ───
export interface DaySnapshot {
  events: AppEvent[];
  activeSleep: { id: string; start: Date } | null;
}

export function subscribeDay(
  day: Date,
  cb: (snap: DaySnapshot) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const from = startOfDay(day).getTime();
  const to = from + 86400000;

  let events: AppEvent[] = [];
  let activeSleep: DaySnapshot["activeSleep"] = null;
  const emit = () => cb({ events, activeSleep });

  const evQuery = query(
    collection(db, "events"),
    where("trackerId", "==", SCOPE),
  );
  const unsubEvents = onSnapshot(
    evQuery,
    (snap) => {
      events = snap.docs
        .map((d) => fromDoc(d.id, d.data() as Record<string, unknown>))
        .filter((e) => {
          const t = e.start.getTime();
          // keep events that touch this day (sleeps can span midnight)
          const endT = e.end ? e.end.getTime() : t;
          return endT >= from && t < to;
        })
        .sort((a, b) => a.start.getTime() - b.start.getTime());
      emit();
    },
    (err) => onError?.(err),
  );

  const unsubActive = onSnapshot(
    doc(db, "activeSessions", SCOPE),
    (snap) => {
      const d = snap.data() as Record<string, unknown> | undefined;
      activeSleep =
        snap.exists() && d && d.type === "sleep"
          ? {
              id: String(d.eventId ?? ""),
              start: new Date(
                typeof d.startTime === "number" ? d.startTime : Date.now(),
              ),
            }
          : null;
      emit();
    },
    (err) => onError?.(err),
  );

  return () => {
    unsubEvents();
    unsubActive();
  };
}

// ─── Writes (legacy `charlie-shared` format) ───
function baseDoc(type: EventType, note: string) {
  return {
    type: dbType(type),
    userId: uid(),
    trackerId: SCOPE,
    actorRole: "manager",
    notes: note.trim() || null,
  };
}

export async function addInstantEvent(
  type: Exclude<EventType, "sleep">,
  when: TimeOfDay,
  data: EventData,
  note: string,
  day = new Date(),
): Promise<void> {
  const start = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    when.h,
    when.m,
    0,
    0,
  ).getTime();
  await addDoc(collection(db, "events"), {
    ...baseDoc(type, note),
    startTime: start,
    endTime: start,
    details: toDetails(type, data),
    serverCreatedAt: serverTimestamp(),
  });
}

export async function startSleep(): Promise<void> {
  const sessionRef = doc(db, "activeSessions", SCOPE);
  const eventRef = doc(collection(db, "events"));
  const ts = Date.now();
  await runTransaction(db, async (tx) => {
    const active = await tx.get(sessionRef);
    if (active.exists()) throw new Error("Un sommeil est déjà en cours.");
    tx.set(eventRef, {
      ...baseDoc("sleep", ""),
      startTime: ts,
      endTime: null,
      details: {},
    });
    tx.set(sessionRef, {
      eventId: eventRef.id,
      type: "sleep",
      startTime: ts,
      userId: uid(),
      trackerId: SCOPE,
      actorRole: "manager",
      details: {},
      updatedAt: ts,
    });
  });
}

export async function stopSleep(): Promise<void> {
  const sessionRef = doc(db, "activeSessions", SCOPE);
  const ts = Date.now();
  await runTransaction(db, async (tx) => {
    const active = await tx.get(sessionRef);
    if (!active.exists()) throw new Error("Aucun sommeil en cours.");
    const eventId = String(active.data()?.eventId ?? "");
    if (eventId) {
      const eventRef = doc(db, "events", eventId);
      const ev = await tx.get(eventRef);
      if (ev.exists() && ev.data()?.endTime == null) {
        tx.update(eventRef, { endTime: ts });
      }
    }
    tx.delete(sessionRef);
  });
}

export async function editEvent(
  id: string,
  patch: { start?: TimeOfDay; end?: TimeOfDay | null; note?: string },
  day = new Date(),
): Promise<void> {
  const out: Record<string, unknown> = { trackerId: SCOPE };
  if (patch.start) {
    out.startTime = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      patch.start.h,
      patch.start.m,
    ).getTime();
  }
  if (patch.end === null) out.endTime = null;
  else if (patch.end) {
    out.endTime = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      patch.end.h,
      patch.end.m,
    ).getTime();
  }
  if (patch.note !== undefined) out.notes = patch.note.trim() || null;
  await setDoc(doc(db, "events", id), out, { merge: true });
}

export async function deleteEvent(id: string): Promise<void> {
  await deleteDoc(doc(db, "events", id));
  const sessionRef = doc(db, "activeSessions", SCOPE);
  const active = await getDoc(sessionRef);
  if (active.exists() && active.data()?.eventId === id) {
    await deleteDoc(sessionRef);
  }
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
    pumpMl: pumps.reduce(
      (s, e) => s + ((e.data as PumpData).ml || 0),
      0,
    ),
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
    lastSleep:
      [...sleeps].reverse().find((e) => e.end) ?? null,
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

export function careLabel(kind: string): string {
  return CARE_OPTIONS.find((o) => o.v === kind)?.l ?? kind;
}
