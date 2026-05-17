import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { auth } from "@/lib/firebase";
import {
  setScope,
  subscribeActiveSession,
  subscribeBabies,
  subscribeProfile,
  subscribeScopedEvents,
  type AppEvent,
} from "@/lib/events";
import { toast } from "@/lib/toast";

interface EventsCtx {
  events: AppEvent[];
  activeSleep: { id: string; start: Date } | null;
  loaded: boolean;
  /** Set when the profile has no linked baby (wrong account, etc.). */
  noScope: boolean;
}

const Ctx = createContext<EventsCtx>({
  events: [],
  activeSleep: null,
  loaded: false,
  noScope: false,
});

/**
 * Resolves the same scope as main (userProfiles → familyId →
 * babies → baby), then keeps ONE live listener on that baby's events
 * (+ active sleep session). `loaded` only turns true once the scope is
 * resolved AND the first events snapshot arrived, so the UI never lets
 * you encode before writes can be scoped.
 */
export function EventsProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [activeSleep, setActiveSleep] = useState<EventsCtx["activeSleep"]>(
    null,
  );
  const [loaded, setLoaded] = useState(false);
  const [noScope, setNoScope] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    let unsubBabies: (() => void) | null = null;
    let unsubEvents: (() => void) | null = null;
    let unsubActive: (() => void) | null = null;
    let familyId: string | null = null;
    let defaultBabyId: string | null = null;
    let scopeOpened = false;
    let first = true;

    // If nothing resolved after a while, surface a clear message
    // instead of a broken-but-usable screen.
    const noScopeTimer = setTimeout(() => {
      if (!scopeOpened) setNoScope(true);
    }, 9000);

    const openForBaby = (babyId: string, fam: string) => {
      scopeOpened = true;
      setNoScope(false);
      setScope({ familyId: fam, babyId, userId: uid, role: "manager" });
      console.info(
        `[scope] famille=${fam} bébé=${babyId} (uid=${uid})`,
      );
      unsubEvents?.();
      unsubActive?.();
      unsubEvents = subscribeScopedEvents(
        fam,
        babyId,
        (e) => {
          setEvents(e);
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

    const resolveBaby = () => {
      if (!familyId) return;
      unsubBabies?.();
      unsubBabies = subscribeBabies(familyId, (babies) => {
        if (!familyId) return;
        const baby =
          (defaultBabyId && babies.find((b) => b.id === defaultBabyId)) ||
          babies[0];
        console.info(
          `[scope] babies=${babies.length} defaultBabyId=${defaultBabyId ?? "—"}`,
        );
        if (baby) openForBaby(baby.id, familyId);
      });
    };

    const unsubProfile = subscribeProfile(uid, (p) => {
      console.info(
        `[scope] profil familyId=${p.familyId ?? "—"} defaultBabyId=${p.defaultBabyId ?? "—"}`,
      );
      defaultBabyId = p.defaultBabyId;
      if (p.familyId && p.familyId !== familyId) {
        familyId = p.familyId;
        resolveBaby();
      } else if (p.familyId) {
        resolveBaby();
      }
      // No familyId yet → keep waiting (could be the first cache
      // snapshot); the timeout handles the truly-unlinked case.
    });

    return () => {
      clearTimeout(noScopeTimer);
      unsubProfile();
      unsubBabies?.();
      unsubEvents?.();
      unsubActive?.();
      setScope(null);
    };
  }, []);

  return (
    <Ctx.Provider value={{ events, activeSleep, loaded, noScope }}>
      {children}
    </Ctx.Provider>
  );
}

export function useEvents(): EventsCtx {
  return useContext(Ctx);
}
