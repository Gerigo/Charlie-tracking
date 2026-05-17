import type { ReactElement } from "react";
import { PALETTES } from "@/lib/theme";
import {
  IconCalendar,
  IconEvolution,
  IconGrowth,
  IconHome,
  type IconProps,
} from "@/components/ui/icons";

const P = PALETTES.sage;

export type Tab = "tracker" | "today" | "growth" | "evolution";

const TABS: {
  id: Tab;
  label: string;
  Icon: (p: IconProps) => ReactElement;
}[] = [
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
        padding: "0 16px max(18px, env(safe-area-inset-bottom))",
        zIndex: 70,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          pointerEvents: "auto",
          borderRadius: 26,
          padding: 6,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 2,
          overflow: "hidden",
          // liquid glass
          backdropFilter: "blur(22px) saturate(180%)",
          WebkitBackdropFilter: "blur(22px) saturate(180%)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.62) 100%)",
          boxShadow:
            "0 8px 30px rgba(40,38,32,0.16), 0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 0.5px rgba(255,255,255,0.6) inset",
          border: "0.5px solid rgba(255,255,255,0.55)",
        }}
      >
        {/* top sheen */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 26,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 38%)",
            pointerEvents: "none",
          }}
        />
        {TABS.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              style={{
                position: "relative",
                padding: "9px 4px 7px",
                borderRadius: 18,
                background: isActive
                  ? "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.7) 100%)"
                  : "transparent",
                boxShadow: isActive
                  ? "0 2px 8px rgba(40,38,32,0.12), 0 0 0 0.5px rgba(255,255,255,0.7) inset"
                  : "none",
                color: isActive ? P.ink : P.inkSoft,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                transition: "all 220ms cubic-bezier(0.32,0.72,0.25,1)",
              }}
            >
              <t.Icon
                size={22}
                sw={isActive ? 2 : 1.7}
                filled={isActive && (t.id === "tracker" || t.id === "evolution")}
              />
              <div
                style={{
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 600,
                  letterSpacing: "-0.005em",
                  opacity: isActive ? 1 : 0.75,
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
