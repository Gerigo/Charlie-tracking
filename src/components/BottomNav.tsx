import { PALETTES } from "@/lib/theme";
import { NAV_EMOJI } from "@/components/ui/emoji";

const P = PALETTES.sage;

export type Tab = "tracker" | "today" | "growth" | "evolution";

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: "tracker", label: "Tracker", emoji: NAV_EMOJI.tracker },
  { id: "today", label: "Aujourd'hui", emoji: NAV_EMOJI.today },
  { id: "growth", label: "Croissance", emoji: NAV_EMOJI.growth },
  { id: "evolution", label: "Évolution", emoji: NAV_EMOJI.evolution },
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
                padding: "8px 4px 6px",
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
                gap: 2,
                transition: "all 220ms cubic-bezier(0.32,0.72,0.25,1)",
              }}
            >
              <span
                role="img"
                aria-label={t.label}
                style={{
                  fontSize: 22,
                  lineHeight: 1,
                  opacity: isActive ? 1 : 0.65,
                  filter: isActive ? "none" : "grayscale(0.35)",
                  transition: "all 220ms ease",
                }}
              >
                {t.emoji}
              </span>
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
