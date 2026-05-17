import { useEffect, useMemo, useState } from "react";
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
  careLabel,
  statsFor,
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

function emojiFor(e: AppEvent): string {
  if (e.type === "sleep") return e.end ? EVENT_EMOJI.sleep : EVENT_EMOJI.sleepActive;
  if (e.type === "growth") return "📏";
  return EVENT_EMOJI[e.type as keyof typeof EVENT_EMOJI] ?? "•";
}

function summarize(e: AppEvent): string {
  switch (e.type) {
    case "feed": {
      const d = e.data as FeedData;
      return d.kind === "sein"
        ? `Sein ${d.breast === "D" ? "droit" : "gauche"}`
        : `Biberon ${d.ml ?? "?"} ml`;
    }
    case "sleep":
      return e.end ? `Durée ${fmtDur(e.durMin)}` : "En cours";
    case "pump": {
      const d = e.data as PumpData;
      return `${d.ml} ml · ${
        d.breast === "GD" ? "2 seins" : d.breast === "D" ? "droit" : "gauche"
      }`;
    }
    case "diaper": {
      const d = e.data as DiaperData;
      return (
        [d.pipi && "pipi", d.caca && "caca"].filter(Boolean).join(" + ") ||
        "—"
      );
    }
    case "care":
      return careLabel((e.data as CareData).kind);
    case "temp": {
      const d = e.data as TempData;
      return `${d.value.toFixed(1)}° · ${d.slot}`;
    }
    case "growth": {
      const d = e.data as GrowthData;
      return [
        d.weight != null && `${d.weight} kg`,
        d.height != null && `${d.height} cm`,
        d.head != null && `PC ${d.head} cm`,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    default:
      return "";
  }
}

function Chip({ delta, unit }: { delta: number; unit: string }) {
  if (!isFinite(delta) || Math.round(delta * 10) === 0) {
    return (
      <span style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", fontWeight: 600 }}>
        = hier
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: 11,
        fontWeight: 700,
        color: up ? "#5A7A4F" : "#9A6B5D",
      }}
    >
      {up ? "↑" : "↓"}
      <span className="num">
        {Math.abs(delta) % 1 === 0
          ? Math.abs(delta)
          : Math.abs(delta).toFixed(1)}
        {unit}
      </span>
      <span style={{ color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>
        vs hier
      </span>
    </span>
  );
}

function StatTile({
  emoji,
  tone,
  label,
  value,
  chip,
}: {
  emoji: string;
  tone: Tone;
  label: string;
  value: string;
  chip: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "14px 16px 15px",
        borderRadius: 22,
        background: `linear-gradient(165deg, ${tone.bg} 0%, ${tone.soft} 100%)`,
        color: tone.ink,
        minHeight: 104,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div style={{ fontSize: 19 }}>{emoji}</div>
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
          style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}
        >
          {value}
        </div>
        <div style={{ marginTop: 3 }}>{chip}</div>
      </div>
    </div>
  );
}

export function Today() {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [offset, setOffset] = useState(0); // days back from the latest
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

  const { day, dayEvents, stats, prevStats, isLatest } = useMemo(() => {
    const latest = events.length
      ? startOfDay(events[events.length - 1].start)
      : startOfDay(new Date());
    const d = new Date(latest.getTime() - offset * 86400000);
    const prev = new Date(d.getTime() - 86400000);
    const byDay = new Map<string, AppEvent[]>();
    events.forEach((e) => {
      const k = dayKey(e.start);
      const a = byDay.get(k) ?? [];
      a.push(e);
      byDay.set(k, a);
    });
    const de = (byDay.get(dayKey(d)) ?? [])
      .slice()
      .sort((a, b) => b.start.getTime() - a.start.getTime());
    return {
      day: d,
      dayEvents: de,
      stats: statsFor(de),
      prevStats: statsFor(byDay.get(dayKey(prev)) ?? []),
      isLatest: offset === 0,
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 6,
          }}
        >
          {navBtn(-1, false)}
          <div style={{ textAlign: "center", flex: 1 }}>
            <div
              className="serif"
              style={{ fontSize: 26, lineHeight: 1.1, color: P.ink }}
            >
              {isLatest
                ? "Dernier jour"
                : fmtDateFull(day).replace(/^./, (c) => c.toUpperCase())}
            </div>
            <div
              style={{ fontSize: 11.5, color: P.inkSoft, marginTop: 2 }}
            >
              {fmtDateFull(day)} · {ageLabel(day)}
            </div>
          </div>
          {navBtn(1, isLatest)}
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
            emoji={EVENT_EMOJI.sleep}
            tone={TONES.indigo}
            label="Sommeil"
            value={fmtDur(stats.sleepMin)}
            chip={
              <Chip
                delta={
                  Math.round(
                    ((stats.sleepMin - prevStats.sleepMin) / 60) * 10,
                  ) / 10
                }
                unit="h"
              />
            }
          />
          <StatTile
            emoji={EVENT_EMOJI.feed}
            tone={TONES.sand}
            label="Tétées"
            value={`${stats.feedCount}`}
            chip={
              <Chip delta={stats.feedCount - prevStats.feedCount} unit="" />
            }
          />
          <StatTile
            emoji={EVENT_EMOJI.pump}
            tone={TONES.rose}
            label="Lait tiré"
            value={`${stats.pumpMl} ml`}
            chip={<Chip delta={stats.pumpMl - prevStats.pumpMl} unit="ml" />}
          />
          <StatTile
            emoji={EVENT_EMOJI.diaper}
            tone={TONES.olive}
            label="Couches"
            value={`${stats.diaperCount}`}
            chip={
              <Chip
                delta={stats.diaperCount - prevStats.diaperCount}
                unit=""
              />
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
            {dayEvents.length} évén.
          </div>
        </div>

        {dayEvents.length === 0 ? (
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
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dayEvents.slice(0, limit).map((e) => {
              const tone = TONE_BY_TYPE[e.type];
              return (
                <button
                  key={e.id}
                  onClick={() => setSheet({ type: "edit", event: e })}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 16,
                    background: P.surface,
                    border: `0.5px solid ${P.line}`,
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 11,
                      background: tone.soft,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 17,
                      flexShrink: 0,
                    }}
                  >
                    {emojiFor(e)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: P.ink,
                      }}
                    >
                      {LABEL_BY_TYPE[e.type]}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: P.inkSoft,
                        marginTop: 1,
                      }}
                    >
                      {summarize(e)}
                      {e.data.note ? ` · ${e.data.note}` : ""}
                    </div>
                  </div>
                  <span
                    className="num"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: P.inkSoft,
                      flexShrink: 0,
                    }}
                  >
                    {fmtTime(e.start)}
                  </span>
                </button>
              );
            })}
            {dayEvents.length > limit && (
              <button
                onClick={() => setLimit((l) => l + 10)}
                style={{
                  marginTop: 4,
                  height: 44,
                  borderRadius: 14,
                  background: "transparent",
                  border: `1px solid ${P.line}`,
                  color: P.inkSoft,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Voir plus · {dayEvents.length - limit} restants
              </button>
            )}
          </div>
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
