import { useEffect, useMemo, useState } from "react";
import { PALETTES, TONES, type Tone } from "@/lib/theme";
import {
  ageLabel,
  dayKey,
  fmtDateFull,
  fmtDur,
  startOfDay,
} from "@/lib/dates";
import {
  careText,
  subscribeAllEvents,
  type AppEvent,
  type CareData,
  type DiaperData,
  type FeedData,
  type GrowthData,
  type PumpData,
  type TempData,
} from "@/lib/events";
import { EVENT_EMOJI } from "@/components/ui/emoji";
import { ScreenLoader } from "@/components/ui/Loader";
import { EncodeSheet, type SheetState } from "@/components/tracker/forms";

const P = PALETTES.sage;
const MAX_SLEEP_MS = 20 * 3600000;

const TONE_BY_TYPE: Record<AppEvent["type"], Tone> = {
  sleep: TONES.indigo,
  feed: TONES.sand,
  pump: TONES.rose,
  diaper: TONES.olive,
  care: TONES.sky,
  temp: TONES.clay,
  growth: TONES.sand,
};
const LABEL_BY_TYPE: Record<AppEvent["type"], string> = {
  sleep: "Sommeil",
  feed: "Tétée",
  pump: "Tirage",
  diaper: "Couche",
  care: "Soins",
  temp: "Température",
  growth: "Mesure",
};

/** "13h" or "13h05". */
function hm(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}
function minOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function sleepMinutes(
  events: AppEvent[],
  winStart: number,
  winEnd: number,
): number {
  let total = 0;
  for (const e of events) {
    if (e.type !== "sleep") continue;
    const s = e.start.getTime();
    const end = e.end ? e.end.getTime() : Date.now();
    if (end <= s || end - s > MAX_SLEEP_MS) continue;
    const a = Math.max(s, winStart);
    const b = Math.min(end, winEnd);
    if (b > a) total += (b - a) / 60000;
  }
  return Math.round(total);
}

function emojiFor(e: AppEvent): string {
  if (e.type === "sleep")
    return e.end ? EVENT_EMOJI.sleep : EVENT_EMOJI.sleepActive;
  if (e.type === "growth") return "📏";
  return EVENT_EMOJI[e.type as keyof typeof EVENT_EMOJI] ?? "•";
}

function rowText(e: AppEvent): string {
  switch (e.type) {
    case "sleep":
      return e.end
        ? `Sommeil de ${hm(e.start)} à ${hm(e.end)} · ${fmtDur(e.durMin)}`
        : `Sommeil depuis ${hm(e.start)} · en cours`;
    case "feed": {
      const d = e.data as FeedData;
      return d.kind === "sein"
        ? `Tétée — sein ${d.breast === "D" ? "droit" : "gauche"}`
        : `Biberon ${d.ml ?? "?"} ml`;
    }
    case "pump": {
      const d = e.data as PumpData;
      return `Tirage ${d.ml} ml · ${
        d.breast === "GD" ? "2 seins" : d.breast === "D" ? "droit" : "gauche"
      }`;
    }
    case "diaper": {
      const d = e.data as DiaperData;
      const t =
        [d.pipi && "pipi", d.caca && "caca"].filter(Boolean).join(" + ") ||
        "—";
      return `Couche · ${t}`;
    }
    case "care":
      return `Soin · ${careText(e.data as CareData)}`;
    case "temp": {
      const d = e.data as TempData;
      return `Température ${d.value.toFixed(1)}° · ${d.slot}`;
    }
    case "growth": {
      const d = e.data as GrowthData;
      return `Mesure · ${[
        d.weight != null && `${d.weight} kg`,
        d.height != null && `${d.height} cm`,
        d.head != null && `PC ${d.head}`,
      ]
        .filter(Boolean)
        .join(" · ")}`;
    }
    default:
      return LABEL_BY_TYPE[e.type];
  }
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
    ? "rgba(0,0,0,0.4)"
    : more
      ? "#4F6B45"
      : "#9A6B5D";
  const bg = eq
    ? "rgba(0,0,0,0.05)"
    : more
      ? "rgba(79,107,69,0.12)"
      : "rgba(154,107,93,0.12)";
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
  const ink = dark ? "#F0EEE7" : tone.ink;
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
      <div style={{ fontSize: 19 }}>
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
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(10);
  const [sheet, setSheet] = useState<SheetState>(null);

  useEffect(
    () =>
      subscribeAllEvents((e) => {
        setEvents(e);
        setLoaded(true);
      }),
    [],
  );

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

    const winEnd = dStart + cutoffMin * 60000;
    const prevWinEnd = prevStart + cutoffMin * 60000;

    const inWin = (e: AppEvent, s: number, end: number) =>
      e.start.getTime() >= s && e.start.getTime() < end;
    const dayWin = events.filter((e) => inWin(e, dStart, winEnd));
    const prevWin = events.filter((e) => inWin(e, prevStart, prevWinEnd));

    const agg = (list: AppEvent[]) => {
      const feeds = list.filter((e) => e.type === "feed");
      const temps = list.filter((e) => e.type === "temp");
      return {
        feeds: feeds.length,
        bottles: feeds.filter((e) => (e.data as FeedData).kind === "biberon")
          .length,
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
    const sleepCur = sleepMinutes(events, dStart, winEnd);
    const sleepPrev = sleepMinutes(events, prevStart, prevWinEnd);
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

  if (!loaded) return <ScreenLoader label="Chargement…" />;

  const navBtn = (dir: -1 | 1, disabled: boolean) => (
    <button
      onClick={() => !disabled && setOffset((o) => o + (dir === -1 ? 1 : -1))}
      disabled={disabled}
      style={{
        width: 38,
        height: 38,
        borderRadius: 999,
        background: disabled ? "transparent" : P.surface,
        color: disabled ? "rgba(0,0,0,0.2)" : P.ink,
        boxShadow: disabled ? "none" : "0 1px 3px rgba(0,0,0,0.06)",
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
          {!M.isLatest && (
            <button
              onClick={() => setOffset(0)}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                background: P.ink,
                color: "#FAF9F5",
                fontSize: 11.5,
                fontWeight: 700,
              }}
            >
              Revenir à aujourd'hui
            </button>
          )}
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
            value={`${M.cur.bottles}`}
            delta={
              <DeltaPill
                diff={M.cur.bottles - M.prev.bottles}
                fmt={(n) => `${n}`}
                noun="biberon(s)"
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
                    color: "rgba(0,0,0,0.4)",
                    fontWeight: 600,
                  }}
                >
                  {M.cur.lastTemp ? "1ʳᵉ mesure" : "non prise"}
                </span>
              )
            }
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            padding: "24px 4px 12px",
          }}
        >
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: P.inkSoft,
              opacity: 0.65,
            }}
          >
            Le fil de la journée
          </div>
          <div
            className="num"
            style={{ fontSize: 11.5, color: P.inkSoft, opacity: 0.6 }}
          >
            {M.dayEvents.length} évén.
          </div>
        </div>

        {M.dayEvents.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: P.inkSoft,
              fontSize: 12.5,
              background: P.surface,
              borderRadius: 18,
              border: `0.5px solid ${P.line}`,
            }}
          >
            Aucun événement ce jour.
          </div>
        ) : (
          (() => {
            // Chronological rail, most recent first. Uniform fixed-height
            // rows; one node per event (no proportional sleep block).
            const ordered = M.dayEvents; // already desc (recent → old)
            const shown = ordered.slice(0, limit);
            let lastHour = -1;
            return (
              <div>
                {shown.map((e) => {
                  const tone = TONE_BY_TYPE[e.type];
                  const live = e.type === "sleep" && !e.end;
                  const showHour = e.start.getHours() !== lastHour;
                  lastHour = e.start.getHours();
                  return (
                    <div
                      key={e.id}
                      style={{ display: "flex", minHeight: 56 }}
                    >
                      {/* hour gutter */}
                      <div
                        className="num"
                        style={{
                          width: 44,
                          textAlign: "right",
                          paddingRight: 10,
                          paddingTop: 14,
                          fontSize: 12,
                          fontWeight: 800,
                          color: P.inkSoft,
                          opacity: showHour ? 0.85 : 0,
                          flexShrink: 0,
                        }}
                      >
                        {hm(e.start)}
                      </div>
                      {/* rail */}
                      <div
                        style={{
                          width: 26,
                          position: "relative",
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            left: 12,
                            top: 0,
                            bottom: 0,
                            width: 2,
                            background: P.line,
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            left: 6,
                            top: 16,
                            width: 14,
                            height: 14,
                            borderRadius: 999,
                            background: live ? "#2F3450" : tone.bg,
                            border: `2px solid ${P.bg}`,
                            boxShadow: live
                              ? "0 0 0 1px rgba(255,255,255,0.25)"
                              : `0 0 0 1px ${tone.ink}40`,
                            animation: live
                              ? "pulse 1.6s ease-in-out infinite"
                              : undefined,
                          }}
                        />
                      </div>
                      {/* content */}
                      <button
                        onClick={() =>
                          setSheet({ type: "edit", event: e })
                        }
                        style={{
                          flex: 1,
                          minWidth: 0,
                          margin: "8px 0 8px",
                          padding: "10px 14px",
                          borderRadius: 14,
                          textAlign: "left",
                          background: live
                            ? "linear-gradient(180deg,#2F3450,#1F2238)"
                            : P.surface,
                          color: live ? "#F0EEE7" : P.ink,
                          border: live
                            ? "0.5px solid rgba(255,255,255,0.12)"
                            : `0.5px solid ${P.line}`,
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <span style={{ fontSize: 16, flexShrink: 0 }}>
                          {emojiFor(e)}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span
                            style={{
                              display: "block",
                              fontSize: 13.5,
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {rowText(e)}
                          </span>
                          {e.data.note ? (
                            <span
                              style={{
                                display: "block",
                                fontSize: 12,
                                opacity: 0.6,
                                marginTop: 1,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {e.data.note}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </div>
                  );
                })}
                {ordered.length > limit && (
                  <button
                    onClick={() => setLimit((l) => l + 10)}
                    style={{
                      marginLeft: 70,
                      height: 42,
                      padding: "0 16px",
                      borderRadius: 14,
                      background: "transparent",
                      border: `1px solid ${P.line}`,
                      color: P.inkSoft,
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    Voir plus · {ordered.length - limit} restants
                  </button>
                )}
              </div>
            );
          })()
        )}
      </div>

      <EncodeSheet
        sheet={sheet}
        onClose={() => setSheet(null)}
        suggestBreast="G"
        bottleMlToday={0}
      />
    </div>
  );
}
