import { PALETTES } from "@/lib/theme";
import {
  IconCalendar,
  IconEvolution,
  IconGrowth,
  IconHome,
} from "@/components/ui/icons";

const P = PALETTES.sage;

export type Tab = "tracker" | "today" | "growth" | "evolution";

const TABS: { id: Tab; label: string; Icon: typeof IconHome }[] = [
  { id: "tracker", label: "Tracker", Icon: IconHome },
  { id: "today", label: "Aujourd'hui", Icon: IconCalendar },
  { id: "growth", label: "Croissance", Icon: IconGrowth },
  { id: "evolution", label: "Évolution", Icon: IconEvolution },
];

export function BottomNav({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "8px 12px 28px",
        background:
          "linear-gradient(180deg, rgba(239,237,232,0) 0%, rgba(239,237,232,0.85) 30%, rgba(239,237,232,1) 100%)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        zIndex: 70,
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.85)",
          border: `0.5px solid ${P.line}`,
          borderRadius: 22,
          padding: 6,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 2,
          boxShadow: "0 6px 24px rgba(40,38,32,0.06)",
        }}
      >
        {TABS.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              style={{
                padding: "10px 4px 8px",
                borderRadius: 16,
                background: isActive ? P.bg : "transparent",
                color: isActive ? P.ink : P.inkSoft,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                transition: "all 220ms ease",
              }}
            >
              <t.Icon size={20} sw={isActive ? 1.8 : 1.5} />
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "-0.005em",
                }}
              >
                {t.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
