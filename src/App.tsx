import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BottomNav, type Tab } from "@/components/BottomNav";
import { Tracker } from "@/components/tracker/Tracker";
import { Today } from "@/components/Today";
import { Growth } from "@/components/Growth";
import { Evolution } from "@/components/Evolution";
import { Toaster } from "@/components/ui/Toaster";
import { useAuth } from "@/hooks/useAuth";
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

function Shell() {
  const [tab, setTab] = useState<Tab>("tracker");
  return (
    <>
      {tab === "tracker" && <Tracker />}
      {tab === "today" && <Today />}
      {tab === "growth" && <Growth />}
      {tab === "evolution" && <Evolution />}
      <BottomNav active={tab} onChange={setTab} />
    </>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <AppShell>
      {loading ? <Loader /> : user ? <Shell /> : <Login />}
      <Toaster />
    </AppShell>
  );
}
