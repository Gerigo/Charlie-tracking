import { useMemo, useState } from "react";
import { PALETTES, TONES, type Tone } from "@/lib/theme";
import {
  ageLabel,
  dayKey,
  fmtDateFull,
  fmtDur,
  fmtTime,
  startOfDay,
} from "@/lib/dates";
import {
  careText,
  sleepMinutesIn,
  type AppEvent,
  type CareData,
  type DiaperData,
  type FeedData,
  type GrowthData,
  type PumpData,
  type TempData,
} from "@/lib/events";
import { useEvents } from "@/lib/eventsContext";
import { EVENT_EMOJI } from "@/components/ui/emoji";
import { Sheet } from "@/components/ui/primitives";
import { EncodeSheet, type SheetState } from "@/components/tracker/forms";

const P = PALETTES.sage;

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


function emojiFor(e: AppEvent): string {
  if (e.type === "sleep")
    return e.end ? EVENT_EMOJI.sleep : EVENT_EMOJI.sleepActive;
  if (e.type === "growth") return "📏";
  return EVENT_EMOJI[e.type as keyof typeof EVENT_EMOJI] ?? "•";
}

/** Italic, non-bold trailing part (duration / state). */
function rowDur(e: AppEvent): string {
  if (e.type === "sleep") return e.end ? fmtDur(e.durMin) : "en cours";
  return "";
}

/** Side badge G / D / G+D for feeds & pumps (visual, like Tracker). */
function rowSide(e: AppEvent): string | null {
  if (e.type === "feed") {
    const d = e.data as FeedData;
    return d.kind === "sein" ? (d.breast === "D" ? "D" : "G") : null;
  }
  if (e.type === "pump") {
    const b = (e.data as PumpData).breast;
    return b === "GD" ? "G+D" : b === "D" ? "D" : "G";
  }
  return null;
}

function rowText(e: AppEvent): string {
  switch (e.type) {
    case "sleep":
      return e.end
        ? `Sommeil de ${hm(e.start)} à ${hm(e.end)}`
        : `Sommeil depuis ${hm(e.start)}`;
    case "feed": {
      const d = e.data as FeedData;
      return d.kind === "sein" ? "Tétée" : `Biberon ${d.ml ?? "?"} ml`;
    }
    case "pump":
      return `Tirage ${(e.data as PumpData).ml} ml`;
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
  const [limit, setLimit] = useState(10);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [add, setAdd] = useState(false);

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
            Le fil
          </div>
          <div
            className="num"
            style={{ fontSize: 11.5, color: P.inkSoft, opacity: 0.6 }}
          >
            {events.length} évén.
          </div>
        </div>

        <button
          onClick={() => setAdd(true)}
          style={{
            width: "100%",
            height: 46,
            borderRadius: 14,
            background: P.ink,
            color: "#FAF9F5",
            fontSize: 14,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          + Ajouter un événement
        </button>

        {events.length === 0 ? (
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
            Aucun événement.
          </div>
        ) : (
          (() => {
            // Fil CONTINU, le plus récent en haut. "Voir plus" remonte
            // dans le temps (sur plusieurs jours) sans changer la date.
            const ordered = [...events].reverse();
            const shown = ordered.slice(0, limit);
            const tKey = dayKey(new Date());
            const yKey = dayKey(new Date(Date.now() - 86400000));
            const dLabel = (d: Date) => {
              const k = dayKey(d);
              if (k === tKey) return "Aujourd'hui";
              if (k === yKey) return "Hier";
              return fmtDateFull(d).replace(/^./, (c) => c.toUpperCase());
            };
            let prevKey = "";
            return (
              <div>
                {shown.map((e) => {
                  const tone = TONE_BY_TYPE[e.type];
                  const live = e.type === "sleep" && !e.end;
                  const k = dayKey(e.start);
                  const showDay = k !== prevKey;
                  prevKey = k;
                  return (
                    <div key={e.id}>
                      {showDay && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            margin: "10px 0 6px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              letterSpacing: "0.1em",
                              textTransform: "uppercase",
                              color: P.inkSoft,
                            }}
                          >
                            {dLabel(e.start)}
                          </span>
                          <span
                            style={{
                              flex: 1,
                              height: 1,
                              background: P.line,
                            }}
                          />
                        </div>
                      )}
                    <div
                      style={{ display: "flex", minHeight: 56 }}
                    >
                      {/* hour gutter — heure de CHAQUE event */}
                      <div
                        className="num"
                        style={{
                          width: 46,
                          textAlign: "right",
                          paddingRight: 10,
                          paddingTop: 14,
                          fontSize: 12,
                          fontWeight: 800,
                          color: P.inkSoft,
                          opacity: 0.85,
                          flexShrink: 0,
                        }}
                      >
                        {fmtTime(e.start)}
                      </div>
                      {/* rail + emoji bubble (hors carte) */}
                      <div
                        style={{
                          width: 44,
                          position: "relative",
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            left: 21,
                            top: 0,
                            bottom: 0,
                            width: 2,
                            background: P.line,
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            left: 5,
                            top: 10,
                            width: 34,
                            height: 34,
                            borderRadius: 999,
                            display: "grid",
                            placeItems: "center",
                            fontSize: 18,
                            background: live ? "#2F3450" : tone.soft,
                            border: live
                              ? "1px solid rgba(255,255,255,0.25)"
                              : `1px solid ${tone.ink}33`,
                            boxShadow: `0 0 0 3px ${P.bg}`,
                            animation: live
                              ? "pulse 1.8s ease-in-out infinite"
                              : undefined,
                          }}
                        >
                          {emojiFor(e)}
                        </div>
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
                            : tone.soft,
                          color: live ? "#F0EEE7" : tone.ink,
                          border: live
                            ? "0.5px solid rgba(255,255,255,0.12)"
                            : `0.5px solid ${tone.ink}22`,
                          borderLeft: live
                            ? "3px solid rgba(255,255,255,0.3)"
                            : `3px solid ${tone.ink}`,
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span
                            style={{
                              display: "block",
                              fontSize: 13.5,
                              lineHeight: 1.3,
                            }}
                          >
                            <span style={{ fontWeight: 700 }}>
                              {rowText(e)}
                            </span>
                            {rowSide(e) && (
                              <span
                                style={{
                                  display: "inline-block",
                                  marginLeft: 7,
                                  padding: "1px 7px",
                                  borderRadius: 999,
                                  background: live
                                    ? "rgba(255,255,255,0.16)"
                                    : tone.ink,
                                  color: live ? "#F0EEE7" : tone.soft,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  verticalAlign: "1px",
                                }}
                              >
                                {rowSide(e)}
                              </span>
                            )}
                            {rowDur(e) && (
                              <span
                                style={{
                                  fontStyle: "italic",
                                  fontWeight: 400,
                                  opacity: 0.7,
                                }}
                              >
                                {" · "}
                                {rowDur(e)}
                              </span>
                            )}
                          </span>
                          {e.data.note?.trim() ? (
                            <span
                              style={{
                                display: "block",
                                fontSize: 12.5,
                                fontStyle: "italic",
                                opacity: 0.75,
                                marginTop: 3,
                                lineHeight: 1.35,
                              }}
                            >
                              « {e.data.note.trim()} »
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </div>
                    </div>
                  );
                })}
                {ordered.length > limit && (
                  <button
                    onClick={() => setLimit((l) => l + 20)}
                    style={{
                      marginLeft: 56,
                      marginTop: 8,
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

      <Sheet open={add} onClose={() => setAdd(false)}>
        <div style={{ padding: "6px 24px 28px" }}>
          <div
            className="serif"
            style={{ fontSize: 27, lineHeight: 1.1, marginBottom: 16 }}
          >
            Ajouter un événement
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 10,
            }}
          >
            {(
              [
                ["feed", "Tétée", EVENT_EMOJI.feed],
                ["pump", "Tirage", EVENT_EMOJI.pump],
                ["diaper", "Couche", EVENT_EMOJI.diaper],
                ["care", "Soins", EVENT_EMOJI.care],
                ["temp", "Température", EVENT_EMOJI.temp],
                ["growth", "Mesure", "📏"],
              ] as const
            ).map(([typ, lbl, emo]) => (
              <button
                key={typ}
                onClick={() => {
                  setAdd(false);
                  setSheet({ type: typ });
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "16px 14px",
                  borderRadius: 16,
                  background: "#fff",
                  border: "1px solid rgba(0,0,0,0.08)",
                  fontWeight: 700,
                  fontSize: 14,
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: 22 }}>{emo}</span> {lbl}
              </button>
            ))}
          </div>
        </div>
      </Sheet>

      <EncodeSheet
        sheet={sheet}
        onClose={() => setSheet(null)}
        suggestBreast="G"
        bottleMlToday={0}
      />
    </div>
  );
}
