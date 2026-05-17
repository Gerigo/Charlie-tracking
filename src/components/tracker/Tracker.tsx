import {
  useEffect,
  useMemo,
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
  startOfDay,
  timeAgo,
} from "@/lib/dates";
import {
  careText,
  selectTrackerDay,
  sleepMinutesIn,
  startSleep,
  statsFor,
  stopSleep,
  type AppEvent,
  type CareData,
  type FeedData,
} from "@/lib/events";
import { useEvents } from "@/lib/eventsContext";
import { EVENT_EMOJI } from "@/components/ui/emoji";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { withToast } from "@/lib/toast";
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
          "inset 0 0 0 2px rgba(255,255,255,0.5), 0 1px 3px var(--hairline)",
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
      style={{ fontSize: 28, lineHeight: 1, filter: "saturate(1.05)" }}
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
  meta,
  badge,
  corner,
  live = false,
  sideBadge = null,
  asleep = false,
  footer = null,
  onClick,
}: {
  kind: string;
  tone: Tone;
  label: string;
  primary?: ReactNode;
  hint?: string;
  meta?: string;
  badge?: string | null;
  corner?: string;
  live?: boolean;
  sideBadge?: string | null;
  asleep?: boolean;
  footer?: ReactNode;
  onClick: () => void;
}) {
  const ink = asleep ? "#F0EEE7" : tone.ink;
  const chipBg = asleep ? "rgba(255,255,255,0.08)" : "var(--chip-on-tone)";
  return (
    <button
      onClick={onClick}
      style={{
        position: "relative",
        textAlign: "left",
        padding: "16px 16px 15px",
        width: "100%",
        minHeight: 150,
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
          : "0 1px 0 var(--tile-sheen) inset, 0 3px 10px rgba(40,38,32,0.05)",
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
            width: 50,
            height: 50,
            borderRadius: 16,
            background: chipBg,
            display: "grid",
            placeItems: "center",
            color: ink,
            boxShadow: asleep ? "none" : "0 1px 2px var(--hairline)",
          }}
        >
          <TileIcon kind={kind} asleep={asleep} />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 6,
          }}
        >
          {corner && (
            <span
              className="num"
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                opacity: asleep ? 0.6 : 0.5,
              }}
            >
              {corner}
            </span>
          )}
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
                : "var(--chip-on-tone)",
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
      </div>
      <div>
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              color: ink,
            }}
          >
            {label}
          </div>
        {primary != null && (
          <div
            className="num"
            style={{
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              marginTop: 5,
              lineHeight: 1.15,
              opacity: 0.92,
            }}
          >
            {primary}
          </div>
        )}
        {hint && (
          <div
            style={{
              fontSize: 12,
              opacity: 0.6,
              marginTop: 3,
              fontWeight: 600,
            }}
          >
            {hint}
          </div>
        )}
          {meta && (
            <div
              style={{
                fontSize: 11.5,
                opacity: 0.5,
                marginTop: 2,
                fontWeight: 700,
              }}
            >
              {meta}
            </div>
          )}
        </div>
        {footer && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 14,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </button>
  );
}

export function Tracker() {
  const { events: allEvents } = useEvents();
  const snap = useMemo(() => selectTrackerDay(allEvents), [allEvents]);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [, forceTick] = useState(0);

  const today = snap.day;

  // live ticking for the in-progress sleep duration
  useEffect(() => {
    if (!snap.activeSleep) return;
    const i = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(i);
  }, [snap.activeSleep]);

  const { events, activeSleep } = snap;
  const stats = statsFor(events);
  // Sleep total for the displayed day — same windowed split as
  // Aujourd'hui (midnight-split, up to now) so the two screens agree.
  const dayFrom = startOfDay(today).getTime();
  const dayTo = Math.min(
    dayFrom + 86400000,
    Math.max(Date.now(), dayFrom + 1),
  );
  const sleepDayMin = sleepMinutesIn(allEvents, dayFrom, dayTo);
  const sleeping = !!activeSleep;
  const sleepStart = activeSleep?.start ?? stats.lastSleep?.start ?? null;
  const lastFeed = stats.lastFeed;
  const lastBreast = stats.lastBreast;
  const lastOf = (t: AppEvent["type"]) =>
    [...events].reverse().find((e) => e.type === t) ?? null;
  const lastPump = lastOf("pump");
  const lastDiaper = lastOf("diaper");
  const lastCare = lastOf("care");
  const lastTempEv = lastOf("temp");

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
          <div
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
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
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div
        className="scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px 16px calc(120px + env(safe-area-inset-bottom))",
        }}
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
            corner={
              !sleeping && stats.lastSleep?.end
                ? timeAgo(stats.lastSleep.end)
                : undefined
            }
            primary={
              sleeping && sleepStart
                ? fmtDur(durationMin(sleepStart, new Date()))
                : undefined
            }
            hint={
              sleeping && sleepStart
                ? `Depuis ${fmtTime(sleepStart)}`
                : !stats.lastSleep
                  ? "Rien aujourd'hui"
                  : undefined
            }
            meta={
              sleepDayMin
                ? `Total ${fmtDur(sleepDayMin)} aujourd'hui`
                : undefined
            }
            footer={
              activeSleep ? (
                <span
                  role="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    void withToast(
                      () => stopSleep(activeSleep.id),
                      "Réveil enregistré",
                    );
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    borderRadius: 999,
                    background: "#F0EEE7",
                    color: "#1F2238",
                    fontSize: 12,
                    fontWeight: 800,
                    border: "none",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
                  }}
                >
                  <span style={{ fontSize: 9 }}>■</span> Arrêter
                </span>
              ) : null
            }
            onClick={() => {
              void (activeSleep
                ? withToast(
                    () => stopSleep(activeSleep.id),
                    "Réveil enregistré",
                  )
                : withToast(() => startSleep(), "Sommeil démarré"));
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
            corner={lastFeed ? timeAgo(lastFeed.start) : undefined}
            primary={
              lastFeed && (lastFeed.data as FeedData).kind === "biberon"
                ? `Biberon ${(lastFeed.data as FeedData).ml ?? "?"} ml`
                : undefined
            }
            hint={lastFeed ? undefined : "Rien aujourd'hui"}
            meta={
              stats.feedCount
                ? `${stats.feedCount} tétée${
                    stats.feedCount > 1 ? "s" : ""
                  } aujourd'hui`
                : undefined
            }
            onClick={() => setSheet({ type: "feed" })}
          />
          <EventTile
            kind="pump"
            tone={TONES.rose}
            label="Tirage"
            sideBadge={
              lastPump
                ? (() => {
                    const b = (lastPump.data as { breast?: string }).breast;
                    return b === "GD" ? "G+D" : b === "D" ? "D" : "G";
                  })()
                : null
            }
            corner={lastPump ? timeAgo(lastPump.start) : undefined}
            primary={stats.pumpCount ? `${stats.pumpMl} ml` : undefined}
            hint={stats.pumpCount ? undefined : "Rien aujourd'hui"}
            meta={
              stats.pumpCount
                ? `${stats.pumpCount} séance${
                    stats.pumpCount > 1 ? "s" : ""
                  } aujourd'hui`
                : undefined
            }
            onClick={() => setSheet({ type: "pump" })}
          />
          <EventTile
            kind="diaper"
            tone={TONES.olive}
            label="Couches"
            corner={lastDiaper ? timeAgo(lastDiaper.start) : undefined}
            primary={stats.diaperCount ? `${stats.diaperCount}` : "—"}
            hint={stats.diaperCount ? undefined : "Rien aujourd'hui"}
            meta={
              stats.diaperCount
                ? `${stats.pipiCount} pipi · ${stats.cacaCount} caca`
                : undefined
            }
            onClick={() => setSheet({ type: "diaper" })}
          />
          <EventTile
            kind="care"
            tone={TONES.sky}
            label="Soins"
            corner={lastCare ? timeAgo(lastCare.start) : undefined}
            primary={
              lastCare ? careText(lastCare.data as CareData) : "—"
            }
            hint={lastCare ? undefined : "Rien aujourd'hui"}
            meta={
              stats.careCount
                ? `${stats.careCount} aujourd'hui`
                : undefined
            }
            onClick={() => setSheet({ type: "care" })}
          />
          <EventTile
            kind="temp"
            tone={TONES.clay}
            label="Température"
            corner={lastTempEv ? timeAgo(lastTempEv.start) : undefined}
            primary={stats.lastTemp ? `${stats.lastTemp.toFixed(1)}°` : "—"}
            hint={
              lastTempEv
                ? (() => {
                    const s = (lastTempEv.data as { slot: string }).slot;
                    return s[0].toUpperCase() + s.slice(1);
                  })()
                : "Rien aujourd'hui"
            }
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
