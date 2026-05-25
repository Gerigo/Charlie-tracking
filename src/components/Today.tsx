import { useMemo, useState } from "react";
import { PALETTES, TONES, type Tone } from "@/lib/theme";
import { ageLabel, dayKey, fmtDateFull, fmtDur, startOfDay } from "@/lib/dates";
import {
  sleepMinutesIn,
  type AppEvent,
  type FeedData,
  type PumpData,
  type TempData,
} from "@/lib/events";
import { useEvents } from "@/lib/eventsContext";
import { useThemeMode } from "@/lib/themeMode";
import { EVENT_EMOJI } from "@/components/ui/emoji";

const P = PALETTES.sage;

function minOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function DeltaPill({
  diff,
  fmt,
  noun,
  suffix,
}: {
  diff: number;
  fmt: (n: number) => string;
  noun: string;
  suffix?: string;
}) {
  const eq = Math.abs(diff) < 0.05;
  const more = diff > 0;
  const color = eq
    ? "var(--delta-eq-ink)"
    : more
      ? "var(--delta-pos-ink)"
      : "var(--delta-neg-ink)";
  const bg = eq
    ? "var(--hairline)"
    : more
      ? "var(--delta-pos-bg)"
      : "var(--delta-neg-bg)";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 9px",
        borderRadius: 999,
        background: bg,
        color,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {eq
        ? `comme hier${suffix ? ` ${suffix}` : ""}`
        : `${fmt(Math.abs(diff))} ${noun} ${
            more ? "de plus" : "de moins"
          } qu'hier${suffix ? ` ${suffix}` : ""}`}
    </span>
  );
}

function StatTile({
  emoji,
  tone,
  label,
  value,
  delta,
  dark = false,
}: {
  emoji: string;
  tone: Tone;
  label: string;
  value: string;
  delta: React.ReactNode;
  dark?: boolean;
}) {
  const themeDark = useThemeMode() === "dark";
  const ink = dark ? "#F0EEE7" : themeDark ? P.ink : tone.ink;
  return (
    <div
      style={{
        position: "relative",
        padding: "14px 16px 15px",
        borderRadius: 22,
        background: dark
          ? "linear-gradient(180deg, #2F3450 0%, #1F2238 100%)"
          : `linear-gradient(165deg, ${tone.bg} 0%, ${tone.soft} 100%)`,
        color: ink,
        minHeight: 116,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        overflow: "hidden",
      }}
    >
      <div style={{ fontSize: 28 }}>
        {emoji}
        {dark && (
          <span
            style={{
              marginLeft: 8,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.06em",
              opacity: 0.8,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: 999,
                background: "#FFF6D8",
                marginRight: 5,
                animation: "pulse 1.6s ease-in-out infinite",
              }}
            />
            EN COURS
          </span>
        )}
      </div>
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            opacity: 0.55,
          }}
        >
          {label}
        </div>
        <div
          className="num"
          style={{ fontSize: 21, fontWeight: 800, marginTop: 2 }}
        >
          {value}
        </div>
        <div style={{ marginTop: 5 }}>{delta}</div>
      </div>
    </div>
  );
}

export function Today() {
  const { events } = useEvents();
  const [offset, setOffset] = useState(0);

  const M = useMemo(() => {
    const latest = events.length
      ? startOfDay(events[events.length - 1].start)
      : startOfDay(new Date());
    const d = new Date(latest.getTime() - offset * 86400000);
    const dStart = startOfDay(d).getTime();
    const prevStart = dStart - 86400000;
    const isLatest = offset === 0;

    const dayEvents = events
      .filter((e) => dayKey(e.start) === dayKey(d))
      .slice()
      .sort((a, b) => b.start.getTime() - a.start.getTime());

    // "Same hour" reference = the day's last activity (or now if latest).
    const lastActivityMin = dayEvents.length
      ? Math.max(...dayEvents.map((e) => minOfDay(e.start)))
      : 0;
    const cutoffMin = isLatest
      ? Math.max(lastActivityMin, minOfDay(new Date()))
      : dayEvents.length
        ? 1440
        : 1440;
    const cutoffHourLabel = `${Math.floor(
      Math.min(cutoffMin, 1439) / 60,
    )}h`;

    const winEnd = dStart + (cutoffMin + 1) * 60000;
    const prevWinEnd = prevStart + (cutoffMin + 1) * 60000;

    const inWin = (e: AppEvent, s: number, end: number) =>
      e.start.getTime() >= s && e.start.getTime() < end;
    const dayWin = events.filter((e) => inWin(e, dStart, winEnd));
    const prevWin = events.filter((e) => inWin(e, prevStart, prevWinEnd));

    const agg = (list: AppEvent[]) => {
      const feeds = list.filter((e) => e.type === "feed");
      const temps = list.filter((e) => e.type === "temp");
      return {
        feeds: feeds.length,
        bottles: feeds.filter((e) => {
          const d = e.data as FeedData;
          return d.kind === "biberon" || (d.kind === "sein" && !!d.supp);
        }).length,
        bottleMl: feeds.reduce((s, e) => {
          const d = e.data as FeedData;
          return s + (d.kind === "biberon" ? d.ml || 0 : d.supp || 0);
        }, 0),
        pumpMl: list
          .filter((e) => e.type === "pump")
          .reduce((s, e) => s + ((e.data as PumpData).ml || 0), 0),
        diapers: list.filter((e) => e.type === "diaper").length,
        cares: list.filter((e) => e.type === "care").length,
        lastTemp: temps.length
          ? (temps[temps.length - 1].data as TempData).value
          : null,
      };
    };
    const cur = agg(dayWin);
    const prev = agg(prevWin);
    const sleepCur = sleepMinutesIn(events, dStart, winEnd);
    const sleepPrev = sleepMinutesIn(events, prevStart, prevWinEnd);
    const ongoing =
      isLatest && events.some((e) => e.type === "sleep" && !e.end);

    return {
      d,
      isLatest,
      dayEvents,
      cutoffHourLabel,
      cur,
      prev,
      sleepCur,
      sleepPrev,
      ongoing,
    };
  }, [events, offset]);

  const navBtn = (dir: -1 | 1, disabled: boolean) => (
    <button
      onClick={() => !disabled && setOffset((o) => o + (dir === -1 ? 1 : -1))}
      disabled={disabled}
      style={{
        width: 38,
        height: 38,
        borderRadius: 999,
        background: disabled ? "transparent" : P.surface,
        color: disabled ? "var(--hairline-strong)" : P.ink,
        boxShadow: disabled ? "none" : "0 1px 3px var(--hairline)",
        fontSize: 18,
        fontWeight: 700,
      }}
    >
      {dir === -1 ? "‹" : "›"}
    </button>
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: P.bg,
      }}
    >
      <div style={{ padding: "22px 22px 10px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: P.inkSoft,
              opacity: 0.7,
            }}
          >
            Aujourd'hui
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {!M.isLatest && (
              <button
                onClick={() => setOffset(0)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: P.surface,
                  border: `1px solid ${P.line}`,
                  color: P.inkSoft,
                  fontSize: 11.5,
                  fontWeight: 700,
                }}
              >
                Aujourd'hui
              </button>
            )}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 8,
          }}
        >
          {navBtn(-1, false)}
          <div style={{ textAlign: "center", flex: 1 }}>
            <div
              className="serif"
              style={{ fontSize: 26, lineHeight: 1.1, color: P.ink }}
            >
              {M.isLatest
                ? "Dernier jour"
                : fmtDateFull(M.d).replace(/^./, (c) => c.toUpperCase())}
            </div>
            <div style={{ fontSize: 11.5, color: P.inkSoft, marginTop: 2 }}>
              {fmtDateFull(M.d)} · {ageLabel(M.d)}
            </div>
          </div>
          {navBtn(1, M.isLatest)}
        </div>
      </div>

      <div
        className="scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 16px calc(120px + env(safe-area-inset-bottom))",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 10,
          }}
        >
          <StatTile
            emoji={M.ongoing ? EVENT_EMOJI.sleepActive : EVENT_EMOJI.sleep}
            tone={TONES.indigo}
            label="Sommeil"
            dark={M.ongoing}
            value={fmtDur(M.sleepCur)}
            delta={
              <DeltaPill
                diff={(M.sleepCur - M.sleepPrev) / 60}
                fmt={(n) => fmtDur(Math.round(n * 60))}
                noun=""
                suffix={`à ${M.cutoffHourLabel}`}
              />
            }
          />
          <StatTile
            emoji={EVENT_EMOJI.feed}
            tone={TONES.sand}
            label="Tétées"
            value={`${M.cur.feeds}`}
            delta={
              <DeltaPill
                diff={M.cur.feeds - M.prev.feeds}
                fmt={(n) => `${n}`}
                noun="tétée(s)"
              />
            }
          />
          <StatTile
            emoji="🍼"
            tone={TONES.sand}
            label="Biberons"
            value={`${M.cur.bottles} · ${M.cur.bottleMl} ml`}
            delta={
              <DeltaPill
                diff={M.cur.bottleMl - M.prev.bottleMl}
                fmt={(n) => `${Math.round(n)} ml`}
                noun=""
              />
            }
          />
          <StatTile
            emoji={EVENT_EMOJI.pump}
            tone={TONES.rose}
            label="Lait tiré"
            value={`${M.cur.pumpMl} ml`}
            delta={
              <DeltaPill
                diff={M.cur.pumpMl - M.prev.pumpMl}
                fmt={(n) => `${Math.round(n)} ml`}
                noun=""
              />
            }
          />
          <StatTile
            emoji={EVENT_EMOJI.diaper}
            tone={TONES.olive}
            label="Couches"
            value={`${M.cur.diapers}`}
            delta={
              <DeltaPill
                diff={M.cur.diapers - M.prev.diapers}
                fmt={(n) => `${n}`}
                noun="couche(s)"
              />
            }
          />
          <StatTile
            emoji={EVENT_EMOJI.care}
            tone={TONES.sky}
            label="Soins"
            value={`${M.cur.cares}`}
            delta={
              <DeltaPill
                diff={M.cur.cares - M.prev.cares}
                fmt={(n) => `${n}`}
                noun="soin(s)"
              />
            }
          />
          <StatTile
            emoji={EVENT_EMOJI.temp}
            tone={TONES.clay}
            label="Température"
            value={M.cur.lastTemp ? `${M.cur.lastTemp.toFixed(1)}°` : "—"}
            delta={
              M.cur.lastTemp != null && M.prev.lastTemp != null ? (
                <DeltaPill
                  diff={M.cur.lastTemp - M.prev.lastTemp}
                  fmt={(n) => `${n.toFixed(1)}°`}
                  noun=""
                />
              ) : (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--delta-eq-ink)",
                    fontWeight: 600,
                  }}
                >
                  {M.cur.lastTemp ? "1ʳᵉ mesure" : "non prise"}
                </span>
              )
            }
          />
        </div>

      </div>
    </div>
  );
}
