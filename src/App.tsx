import { AppShell } from "@/components/AppShell";
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

function Home() {
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
        style={{ fontSize: 40, color: P.ink, fontWeight: 400 }}
      >
        Bonjour
      </div>
      <div style={{ fontSize: 14, color: P.inkSoft, fontWeight: 500 }}>
        Connecté. Le Tracker arrive à la prochaine phase.
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

export default function App() {
  const { user, loading } = useAuth();

  return (
    <AppShell>
      {loading ? <Loader /> : user ? <Home /> : <Login />}
    </AppShell>
  );
}
