import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { PALETTES, TONES, FONT_SERIF, type Tone } from "@/lib/theme";
import {
  ageLabel,
  fmtDateFull,
  fmtDur,
  fmtTime,
  durationMin,
} from "@/lib/dates";
import {
  careLabel,
  startSleep,
  statsFor,
  stopSleep,
  subscribeTracker,
  type AppEvent,
  type DaySnapshot,
  type FeedData,
} from "@/lib/events";
import {
  IconCare,
  IconDiaper,
  IconFeed,
  IconMoonFilled,
  IconPump,
  IconSleep,
  IconTemp,
} from "@/components/ui/icons";
import { EncodeSheet, type SheetState } from "@/components/tracker/forms";

const P = PALETTES.sage;

function Avatar({ size = 50 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${TONES.sand.bg} 0%, ${TONES.clay.bg} 100%)`,
        display: "grid",
        placeItems: "center",
        color: TONES.clay.ink,
        fontWeight: 700,
        fontSize: size * 0.36,
        fontFamily: FONT_SERIF,
        boxShadow:
          "inset 0 0 0 2px rgba(255,255,255,0.5), 0 1px 3px rgba(0,0,0,0.06)",
        flexShrink: 0,
      }}
    >
      C
    </div>
  );
}

function TileIcon({
  kind,
  asleep,
}: {
  kind: string;
  asleep: boolean;
}) {
  const s = 20;
  if (kind === "sleep")
    return asleep ? <IconMoonFilled size={s} /> : <IconSleep size={s} />;
  if (kind === "feed") return <IconFeed size={s} />;
  if (kind === "pump") return <IconPump size={s} />;
  if (kind === "diaper") return <IconDiaper size={s} />;
  if (kind === "care") return <IconCare size={s} />;
  return <IconTemp size={s} />;
}

function EventTile({
  kind,
  tone,
  label,
  primary,
  hint,
  badge,
  asleep = false,
  onClick,
}: {
  kind: string;
  tone: Tone;
  label: string;
  primary?: ReactNode;
  hint?: string;
  badge?: string | null;
  asleep?: boolean;
  onClick: () => void;
}) {
  const ink = asleep ? "#F0EEE7" : tone.ink;
  return (
    <button
      onClick={onClick}
      style={{
        position: "relative",
        textAlign: "left",
        padding: "15px 16px 14px",
        width: "100%",
        minHeight: 112,
        borderRadius: 22,
        background: asleep
          ? "linear-gradient(180deg, #2F3450 0%, #1F2238 100%)"
          : `linear-gradient(180deg, ${tone.bg} 0%, ${tone.soft} 100%)`,
        color: ink,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        overflow: "hidden",
        boxShadow: asleep
          ? "0 8px 22px rgba(20,20,40,0.22)"
          : "0 1px 0 rgba(255,255,255,0.55) inset, 0 2px 6px rgba(40,38,32,0.04)",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: asleep
              ? "rgba(255,255,255,0.08)"
              : "rgba(255,255,255,0.55)",
            display: "grid",
            placeItems: "center",
            color: ink,
          }}
        >
          <TileIcon kind={kind} asleep={asleep} />
        </div>
        {badge && (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.04em",
              padding: "3px 7px",
              borderRadius: 999,
              background: asleep
                ? "rgba(255,255,255,0.15)"
                : "rgba(0,0,0,0.06)",
              color: ink,
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <div style={{ marginTop: 14 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            opacity: asleep ? 0.7 : 0.75,
          }}
        >
          {label}
        </div>
        {primary != null && (
          <div
            className="num"
            style={{
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              marginTop: 2,
            }}
          >
            {primary}
          </div>
        )}
        {hint && (
          <div
            style={{
              fontSize: 11,
              opacity: 0.55,
              marginTop: 1,
              fontWeight: 500,
            }}
          >
            {hint}
          </div>
        )}
      </div>
    </button>
  );
}

function QuickStat({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          color: P.inkSoft,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          opacity: 0.7,
        }}
      >
        {label}
      </div>
      <div
        className="num"
        style={{
          fontSize: 18,
          fontWeight: 700,
          marginTop: 2,
          color: P.ink,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function Tracker() {
  const [snap, setSnap] = useState<DaySnapshot>({
    day: new Date(),
    events: [],
    activeSleep: null,
  });
  const [sheet, setSheet] = useState<SheetState>(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    return subscribeTracker(setSnap);
  }, []);

  const today = snap.day;

  // live ticking for the in-progress sleep duration
  useEffect(() => {
    if (!snap.activeSleep) return;
    const i = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(i);
  }, [snap.activeSleep]);

  const { events, activeSleep } = snap;
  const stats = statsFor(events);
  const sleeping = !!activeSleep;
  const sleepStart = activeSleep?.start ?? stats.lastSleep?.start ?? null;
  const lastFeed = stats.lastFeed;
  const lastBreast = stats.lastBreast;

  const containerStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    background: P.bg,
  };

  return (
    <div style={containerStyle}>
      <div style={{ padding: "22px 22px 8px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <Avatar size={50} />
            <div>
              <div
                className="serif"
                style={{
                  fontSize: 30,
                  lineHeight: 1.05,
                  color: P.ink,
                }}
              >
                Charlie
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: P.inkSoft,
                  marginTop: 3,
                  fontWeight: 500,
                }}
              >
                {ageLabel(today)} · {fmtDateFull(today)}
              </div>
            </div>
          </div>
          {sleeping && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 12px",
                borderRadius: 999,
                background: "#3A3650",
                color: "#E8E6F3",
                fontSize: 11.5,
                fontWeight: 600,
                boxShadow: "0 6px 18px rgba(58,54,80,0.3)",
              }}
            >
              <IconMoonFilled size={12} /> dort
            </div>
          )}
        </div>
      </div>

      <div
        className="scroll"
        style={{ flex: 1, overflowY: "auto", padding: "14px 16px 110px" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 10,
          }}
        >
          <EventTile
            kind="sleep"
            tone={TONES.indigo}
            label="Sommeil"
            asleep={sleeping}
            badge={sleeping ? "EN COURS" : null}
            primary={
              sleeping && sleepStart
                ? fmtDur(durationMin(sleepStart, new Date()))
                : stats.lastSleep
                  ? fmtDur(stats.lastSleep.durMin)
                  : "—"
            }
            hint={
              sleeping && sleepStart
                ? `endormi à ${fmtTime(sleepStart)}`
                : stats.lastSleep
                  ? `dernier ${fmtTime(stats.lastSleep.start)}`
                  : "aucun aujourd'hui"
            }
            onClick={() => {
              void (sleeping ? stopSleep() : startSleep());
            }}
          />
          <EventTile
            kind="feed"
            tone={TONES.sand}
            label="Nourriture"
            primary={lastFeed ? fmtTime(lastFeed.start) : "—"}
            badge={lastBreast ? `→ ${lastBreast === "G" ? "D" : "G"}` : null}
            hint={
              lastFeed
                ? (lastFeed.data as FeedData).kind === "sein"
                  ? `sein ${lastBreast === "G" ? "gauche" : "droit"}`
                  : `biberon ${(lastFeed.data as FeedData).ml}ml`
                : "rien encore"
            }
            onClick={() => setSheet({ type: "feed" })}
          />
          <EventTile
            kind="pump"
            tone={TONES.rose}
            label="Tirage"
            primary={`${stats.pumpMl} ml`}
            hint={`${stats.pumpCount} séance${stats.pumpCount > 1 ? "s" : ""}`}
            onClick={() => setSheet({ type: "pump" })}
          />
          <EventTile
            kind="diaper"
            tone={TONES.olive}
            label="Couches"
            primary={stats.diaperCount}
            hint={`${stats.pipiCount} pipi · ${stats.cacaCount} caca`}
            onClick={() => setSheet({ type: "diaper" })}
          />
          <EventTile
            kind="care"
            tone={TONES.sky}
            label="Soins"
            primary={stats.careCount}
            hint={(() => {
              const c = events.filter((e) => e.type === "care");
              if (!c.length) return "rien encore";
              const last = c[c.length - 1];
              return `dernier · ${careLabel(
                (last.data as { kind: string }).kind,
              ).toLowerCase()}`;
            })()}
            onClick={() => setSheet({ type: "care" })}
          />
          <EventTile
            kind="temp"
            tone={TONES.clay}
            label="Température"
            primary={stats.lastTemp ? `${stats.lastTemp.toFixed(1)}°` : "—"}
            hint={(() => {
              const t = events.filter((e) => e.type === "temp");
              if (!t.length) return "pas encore prise";
              const last = t[t.length - 1] as AppEvent;
              return `${(last.data as { slot: string }).slot} · ${fmtTime(
                last.start,
              )}`;
            })()}
            onClick={() => setSheet({ type: "temp" })}
          />
        </div>

        <div
          style={{
            marginTop: 22,
            padding: "14px 16px",
            background: P.surface,
            borderRadius: 18,
            border: `0.5px solid ${P.line}`,
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: P.inkSoft,
              opacity: 0.65,
              marginBottom: 10,
            }}
          >
            Aperçu rapide
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
            }}
          >
            <QuickStat label="Sommeil" value={fmtDur(stats.sleepMin)} />
            <QuickStat label="Tétées" value={stats.feedCount} />
            <QuickStat label="Lait tiré" value={`${stats.pumpMl}ml`} />
          </div>
        </div>
      </div>

      <EncodeSheet
        sheet={sheet}
        onClose={() => setSheet(null)}
        suggestBreast={lastBreast === "G" ? "D" : "G"}
      />
    </div>
  );
}
