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
import { EVENT_EMOJI } from "@/components/ui/emoji";
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

function TileIcon({ kind, asleep }: { kind: string; asleep: boolean }) {
  const emoji =
    kind === "sleep"
      ? asleep
        ? EVENT_EMOJI.sleepActive
        : EVENT_EMOJI.sleep
      : EVENT_EMOJI[kind as keyof typeof EVENT_EMOJI];
  return (
    <span
      style={{ fontSize: 21, lineHeight: 1, filter: "saturate(1.05)" }}
      role="img"
      aria-label={kind}
    >
      {emoji}
    </span>
  );
}

function EventTile({
  kind,
  tone,
  label,
  primary,
  hint,
  badge,
  live = false,
  sideBadge = null,
  asleep = false,
  onClick,
}: {
  kind: string;
  tone: Tone;
  label: string;
  primary?: ReactNode;
  hint?: string;
  badge?: string | null;
  live?: boolean;
  sideBadge?: "G" | "D" | null;
  asleep?: boolean;
  onClick: () => void;
}) {
  const ink = asleep ? "#F0EEE7" : tone.ink;
  const chipBg = asleep ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.6)";
  return (
    <button
      onClick={onClick}
      style={{
        position: "relative",
        textAlign: "left",
        padding: "16px 16px 15px",
        width: "100%",
        minHeight: 124,
        borderRadius: 24,
        background: asleep
          ? "linear-gradient(180deg, #2F3450 0%, #1F2238 100%)"
          : `linear-gradient(165deg, ${tone.bg} 0%, ${tone.soft} 100%)`,
        color: ink,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        overflow: "hidden",
        boxShadow: asleep
          ? "0 10px 26px rgba(20,20,40,0.24)"
          : "0 1px 0 rgba(255,255,255,0.6) inset, 0 3px 10px rgba(40,38,32,0.05)",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 13,
            background: chipBg,
            display: "grid",
            placeItems: "center",
            color: ink,
            boxShadow: asleep ? "none" : "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <TileIcon kind={kind} asleep={asleep} />
        </div>
        {sideBadge ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 34,
              padding: "0 6px 0 12px",
              borderRadius: 999,
              background: ink,
              color: tone.soft,
              boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                opacity: 0.7,
              }}
            >
              Dernier
            </span>
            <span
              style={{
                minWidth: 22,
                height: 22,
                borderRadius: 999,
                background: tone.soft,
                color: ink,
                fontWeight: 800,
                fontSize: 13,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {sideBadge}
            </span>
          </span>
        ) : badge ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.07em",
              padding: "5px 9px",
              borderRadius: 999,
              background: asleep
                ? "rgba(255,255,255,0.16)"
                : "rgba(255,255,255,0.55)",
              color: ink,
            }}
          >
            {live && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: "currentColor",
                  animation: "pulse 1.6s ease-in-out infinite",
                }}
              />
            )}
            {badge}
          </span>
        ) : null}
      </div>
      <div style={{ marginTop: 12 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            opacity: asleep ? 0.6 : 0.55,
          }}
        >
          {label}
        </div>
        {primary != null && (
          <div
            className="num"
            style={{
              fontSize: 21,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginTop: 4,
              lineHeight: 1.1,
            }}
          >
            {primary}
          </div>
        )}
        {hint && (
          <div
            style={{
              fontSize: 12,
              opacity: asleep ? 0.6 : 0.6,
              marginTop: 3,
              fontWeight: 600,
            }}
          >
            {hint}
          </div>
        )}
      </div>
    </button>
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
              <span role="img" aria-label="sommeil">
                {EVENT_EMOJI.sleepActive}
              </span>{" "}
              dort
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
            live={sleeping}
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
                ? `Depuis ${fmtTime(sleepStart)}`
                : stats.lastSleep
                  ? `Dernier à ${fmtTime(stats.lastSleep.start)}`
                  : "Rien aujourd'hui"
            }
            onClick={() => {
              void (activeSleep ? stopSleep(activeSleep.id) : startSleep());
            }}
          />
          <EventTile
            kind="feed"
            tone={TONES.sand}
            label="Nourriture"
            sideBadge={
              lastFeed && (lastFeed.data as FeedData).kind === "sein"
                ? lastBreast
                : null
            }
            primary={lastFeed ? fmtTime(lastFeed.start) : "—"}
            hint={
              lastFeed
                ? (lastFeed.data as FeedData).kind === "sein"
                  ? `Prochain → sein ${lastBreast === "G" ? "droit" : "gauche"}`
                  : `Biberon · ${(lastFeed.data as FeedData).ml ?? "?"} ml`
                : "Rien aujourd'hui"
            }
            onClick={() => setSheet({ type: "feed" })}
          />
          <EventTile
            kind="pump"
            tone={TONES.rose}
            label="Tirage"
            primary={stats.pumpCount ? `${stats.pumpMl} ml` : "—"}
            hint={
              stats.pumpCount
                ? `${stats.pumpCount} séance${stats.pumpCount > 1 ? "s" : ""}`
                : "Rien aujourd'hui"
            }
            onClick={() => setSheet({ type: "pump" })}
          />
          <EventTile
            kind="diaper"
            tone={TONES.olive}
            label="Couches"
            primary={stats.diaperCount ? stats.diaperCount : "—"}
            hint={
              stats.diaperCount
                ? `${stats.pipiCount} pipi · ${stats.cacaCount} caca`
                : "Rien aujourd'hui"
            }
            onClick={() => setSheet({ type: "diaper" })}
          />
          <EventTile
            kind="care"
            tone={TONES.sky}
            label="Soins"
            primary={stats.careCount ? stats.careCount : "—"}
            hint={(() => {
              const c = events.filter((e) => e.type === "care");
              if (!c.length) return "Rien aujourd'hui";
              const last = c[c.length - 1];
              return `Dernier · ${careLabel(
                (last.data as { kind: string }).kind,
              )}`;
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
              if (!t.length) return "Rien aujourd'hui";
              const last = t[t.length - 1] as AppEvent;
              const slot = (last.data as { slot: string }).slot;
              return `${slot[0].toUpperCase()}${slot.slice(1)} · à ${fmtTime(
                last.start,
              )}`;
            })()}
            onClick={() => setSheet({ type: "temp" })}
          />
        </div>
      </div>

      <EncodeSheet
        sheet={sheet}
        onClose={() => setSheet(null)}
        suggestBreast={lastBreast === "G" ? "D" : "G"}
        bottleMlToday={stats.bottleMl}
      />
    </div>
  );
}
