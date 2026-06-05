import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { auth } from "@/lib/firebase";
import { durationMin } from "@/lib/dates";
import {
  CHARLIE_SCOPE,
  setScope,
  subscribeActiveSession,
  subscribeBabies,
  subscribeOptimistic,
  subscribeProfile,
  subscribeScopedEvents,
  type AppEvent,
  type OptimisticMutation,
} from "@/lib/events";
import { toast } from "@/lib/toast";

/** Layer pending optimistic mutations over the server snapshot. */
function applyPending(
  server: AppEvent[],
  pending: Map<string, OptimisticMutation>,
): AppEvent[] {
  if (pending.size === 0) return server;
  const map = new Map(server.map((e) => [e.id, e]));
  for (const m of pending.values()) {
    if (m.kind === "upsert") {
      map.set(m.event.id, m.event);
    } else if (m.kind === "close") {
      const ev = map.get(m.id);
      if (ev && ev.end === null) {
        map.set(m.id, {
          ...ev,
          end: m.end,
          durMin: durationMin(ev.start, m.end),
        });
      }
    }
  }
  return [...map.values()].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
}

/** Has the server snapshot caught up with this optimistic mutation? */
function isConfirmed(m: OptimisticMutation, server: AppEvent | undefined): boolean {
  if (m.kind === "upsert") {
    // Open-sleep start: confirmed once the event exists server-side.
    // Closed/instant events: confirmed once present with an end time.
    return server != null && (m.event.end === null || server.end != null);
  }
  if (m.kind === "close") return server != null && server.end != null;
  return true;
}

interface EventsCtx {
  events: AppEvent[];
  activeSleep: { id: string; start: Date } | null;
  loaded: boolean;
  synced: boolean;
}

const Ctx = createContext<EventsCtx>({
  events: [],
  activeSleep: null,
  loaded: false,
  synced: false,
});

/**
 * Charlie's data lives at a fixed (familyId, babyId) address — the same
 * one main reads/writes. We open it immediately (no profile wait, no
 * "baby not linked"), and still listen to the profile as a safety net
 * in case a different baby is ever resolved.
 */
export function EventsProvider({ children }: { children: ReactNode }) {
  const [serverEvents, setServerEvents] = useState<AppEvent[]>([]);
  // Optimistic mutations not yet reflected by the server, keyed by event
  // id. Overlaid on every server snapshot so they survive intermediate
  // snapshots instead of being wiped by a full replace.
  const [pending, setPending] = useState<Map<string, OptimisticMutation>>(
    () => new Map(),
  );
  const [activeSleep, setActiveSleep] = useState<EventsCtx["activeSleep"]>(
    null,
  );
  const [loaded, setLoaded] = useState(false);
  const [synced, setSynced] = useState(false);

  const events = useMemo(
    () => applyPending(serverEvents, pending),
    [serverEvents, pending],
  );

  // Fallback: if Firestore server doesn't confirm within 5 s (offline /
  // slow network), unblock the UI with whatever cached data we have.
  useEffect(() => {
    const t = setTimeout(() => setSynced(true), 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    return subscribeOptimistic((m) => {
      setPending((prev) => {
        const next = new Map(prev);
        if (m.kind === "drop") {
          next.delete(m.id);
        } else if (m.kind === "upsert") {
          next.set(m.event.id, m);
        } else {
          // close: if the event is still optimistic-only (not on the
          // server yet), fold the end into its pending upsert so it
          // doesn't vanish; otherwise record the close on its own.
          const existing = next.get(m.id);
          if (existing && existing.kind === "upsert") {
            const ev = existing.event;
            next.set(m.id, {
              kind: "upsert",
              event: {
                ...ev,
                end: m.end,
                durMin: durationMin(ev.start, m.end),
              },
            });
          } else {
            next.set(m.id, m);
          }
        }
        return next;
      });
    });
  }, []);

  useEffect(() => {
    const uid = auth.currentUser?.uid ?? "unknown";

    let unsubEvents: (() => void) | null = null;
    let unsubActive: (() => void) | null = null;
    let curBaby = "";
    let first = true;

    const openForBaby = (babyId: string, familyId: string) => {
      if (babyId === curBaby) return;
      curBaby = babyId;
      setScope({ familyId, babyId, userId: uid, role: "manager" });
      console.info(`[scope] famille=${familyId} bébé=${babyId} (uid=${uid})`);
      unsubEvents?.();
      unsubActive?.();
      unsubEvents = subscribeScopedEvents(
        familyId,
        babyId,
        (e, fromCache) => {
          setServerEvents(e);
          // Drop optimistic mutations the server has now caught up with.
          setPending((prev) => {
            if (prev.size === 0) return prev;
            const byId = new Map(e.map((x) => [x.id, x]));
            let changed = false;
            const next = new Map(prev);
            for (const [id, m] of prev) {
              if (isConfirmed(m, byId.get(id))) {
                next.delete(id);
                changed = true;
              }
            }
            return changed ? next : prev;
          });
          if (!fromCache) setSynced(true);
          if (first) {
            first = false;
            setLoaded(true);
            toast.info("Application à jour");
          }
        },
        (err) => console.warn("[events]", err),
      );
      unsubActive = subscribeActiveSession(babyId, setActiveSleep);
    };

    // 1. Open Charlie's fixed address right away.
    openForBaby(CHARLIE_SCOPE.babyId, CHARLIE_SCOPE.familyId);

    // 2. Safety net: if the profile points to another baby, switch.
    let familyId: string | null = CHARLIE_SCOPE.familyId;
    let defaultBabyId: string | null = null;
    let unsubBabies: (() => void) | null = null;
    const resolveBaby = () => {
      if (!familyId) return;
      unsubBabies?.();
      unsubBabies = subscribeBabies(familyId, (babies) => {
        if (!familyId) return;
        const baby =
          (defaultBabyId && babies.find((b) => b.id === defaultBabyId)) ||
          babies[0];
        if (baby) openForBaby(baby.id, familyId);
      });
    };
    const unsubProfile = subscribeProfile(uid, (p) => {
      defaultBabyId = p.defaultBabyId;
      if (p.familyId) {
        familyId = p.familyId;
        resolveBaby();
      }
    });

    return () => {
      unsubProfile();
      unsubBabies?.();
      unsubEvents?.();
      unsubActive?.();
      setScope(null);
    };
  }, []);

  return (
    <Ctx.Provider value={{ events, activeSleep, loaded, synced }}>
      {children}
    </Ctx.Provider>
  );
}

export function useEvents(): EventsCtx {
  return useContext(Ctx);
}
