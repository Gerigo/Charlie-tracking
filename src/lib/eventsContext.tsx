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
}

const Ctx = createContext<EventsCtx>({
  events: [],
  activeSleep: null,
  loaded: false,
});

/**
 * Resolves the same scope as main (userProfiles → familyId →
 * babies → baby), then keeps ONE live listener on that baby's events
 * (+ active sleep session). Reading/writing the exact main scope keeps
 * both apps perfectly in sync (no legacy double-count, writes visible
 * on main).
 */
export function EventsProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [activeSleep, setActiveSleep] = useState<EventsCtx["activeSleep"]>(
    null,
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    let unsubBabies: (() => void) | null = null;
    let unsubEvents: (() => void) | null = null;
    let unsubActive: (() => void) | null = null;
    let familyId: string | null = null;
    let defaultBabyId: string | null = null;
    let first = true;

    const openForBaby = (babyId: string, fam: string) => {
      setScope({ familyId: fam, babyId, userId: uid, role: "manager" });
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
          (defaultBabyId &&
            babies.find((b) => b.id === defaultBabyId)) ||
          babies[0];
        if (baby) {
          openForBaby(baby.id, familyId);
        } else {
          // Profil sans bébé — rien à afficher mais on ne bloque pas.
          setLoaded(true);
        }
      });
    };

    const unsubProfile = subscribeProfile(uid, (p) => {
      defaultBabyId = p.defaultBabyId;
      if (p.familyId && p.familyId !== familyId) {
        familyId = p.familyId;
        resolveBaby();
      } else if (!p.familyId) {
        setLoaded(true);
      } else {
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
    <Ctx.Provider value={{ events, activeSleep, loaded }}>
      {children}
    </Ctx.Provider>
  );
}

export function useEvents(): EventsCtx {
  return useContext(Ctx);
}
