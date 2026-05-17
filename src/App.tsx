import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BottomNav, type Tab } from "@/components/BottomNav";
import { Tracker } from "@/components/tracker/Tracker";
import { Growth } from "@/components/Growth";
import { Evolution } from "@/components/Evolution";
import { Toaster } from "@/components/ui/Toaster";
import { useAuth, signOut } from "@/hooks/useAuth";
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

function ComingSoon({ title }: { title: string }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: P.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: 28,
        textAlign: "center",
      }}
    >
      <div
        className="serif"
        style={{ fontSize: 38, color: P.ink, fontWeight: 400 }}
      >
        {title}
      </div>
      <div style={{ fontSize: 14, color: P.inkSoft, fontWeight: 500 }}>
        Écran à venir dans une prochaine phase.
      </div>
      <button
        onClick={() => void signOut()}
        style={{
          marginTop: 18,
          padding: "10px 18px",
          borderRadius: 999,
          background: P.surface,
          border: `1px solid ${P.line}`,
          color: P.inkSoft,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Se déconnecter
      </button>
    </div>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>("tracker");
  return (
    <>
      {tab === "tracker" && <Tracker />}
      {tab === "today" && <ComingSoon title="Aujourd'hui" />}
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
