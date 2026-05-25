import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { auth } from "@/lib/firebase";
import {
  CHARLIE_SCOPE,
  setScope,
  subscribeActiveSession,
  subscribeBabies,
  subscribeProfile,
  subscribeScopedEvents,
  subscribeToWrites,
  type AppEvent,
} from "@/lib/events";
import { toast } from "@/lib/toast";

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
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [activeSleep, setActiveSleep] = useState<EventsCtx["activeSleep"]>(
    null,
  );
  const [loaded, setLoaded] = useState(false);
  const [synced, setSynced] = useState(false);

  // Fallback: if Firestore server doesn't confirm within 5 s (offline /
  // slow network), unblock the UI with whatever cached data we have.
  useEffect(() => {
    const t = setTimeout(() => setSynced(true), 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    return subscribeToWrites((event) => {
      setEvents((prev) => {
        if (prev.some((e) => e.id === event.id)) return prev;
        return [...prev, event].sort(
          (a, b) => a.start.getTime() - b.start.getTime(),
        );
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
          setEvents(e);
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
