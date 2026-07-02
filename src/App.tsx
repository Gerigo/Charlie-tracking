import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BottomNav, type Tab } from "@/components/BottomNav";
import { Tracker } from "@/components/tracker/Tracker";
import { Today } from "@/components/Today";
import { FoodJournal } from "@/components/FoodJournal";
import { Growth } from "@/components/Growth";
import { Evolution } from "@/components/Evolution";
import { Toaster } from "@/components/ui/Toaster";
import { ScreenLoader } from "@/components/ui/Loader";
import { useAuth } from "@/hooks/useAuth";
import { EventsProvider, useEvents } from "@/lib/eventsContext";
import { PALETTES } from "@/lib/theme";
import Login from "@/pages/Login";

const P = PALETTES.sage;

function Loader() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: P.bg,
        display: "grid",
        placeItems: "center",
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          border: `2px solid ${P.line}`,
          borderTopColor: P.olive,
          animation: "spin 700ms linear infinite",
        }}
      />
    </div>
  );
}

function Tabs() {
  const { loaded, synced } = useEvents();
  const [tab, setTab] = useState<Tab>("tracker");
  if (!loaded || !synced) return <ScreenLoader label="Chargement de Charlie…" />;
  return (
    <>
      <div style={{ display: tab === "tracker" ? "contents" : "none" }}>
        <Tracker />
      </div>
      <div style={{ display: tab === "today" ? "contents" : "none" }}>
        <Today />
      </div>
      <div style={{ display: tab === "food" ? "contents" : "none" }}>
        <FoodJournal />
      </div>
      <div style={{ display: tab === "growth" ? "contents" : "none" }}>
        <Growth />
      </div>
      <div style={{ display: tab === "evolution" ? "contents" : "none" }}>
        <Evolution />
      </div>
      <BottomNav active={tab} onChange={setTab} />
    </>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <AppShell>
      {loading ? (
        <Loader />
      ) : user ? (
        <EventsProvider>
          <Tabs />
        </EventsProvider>
      ) : (
        <Login />
      )}
      <Toaster />
    </AppShell>
  );
}
