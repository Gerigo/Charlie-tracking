import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { subscribeAllEvents, type AppEvent } from "@/lib/events";
import { toast } from "@/lib/toast";

interface EventsCtx {
  events: AppEvent[];
  loaded: boolean;
}

const Ctx = createContext<EventsCtx>({ events: [], loaded: false });

/**
 * Single Firestore listener for the whole session. Mounted once (above
 * the tabs) so switching tabs never re-subscribes nor flashes a loader,
 * and another device's changes (Sarah) stream in live.
 */
export function EventsProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let first = true;
    return subscribeAllEvents((e) => {
      setEvents(e);
      if (first) {
        first = false;
        setLoaded(true);
        toast.info("Application à jour");
      }
    });
  }, []);

  return <Ctx.Provider value={{ events, loaded }}>{children}</Ctx.Provider>;
}

export function useEvents(): EventsCtx {
  return useContext(Ctx);
}
