import { useMemo, useState } from "react";
import { PALETTES, TONES, type Tone } from "@/lib/theme";
import { dayKey, fmtDateFull, fmtDur, fmtTime } from "@/lib/dates";
import {
  careText,
  type AppEvent,
  type CareData,
  type DiaperData,
  type FeedData,
  type GrowthData,
  type PumpData,
  type TempData,
} from "@/lib/events";
import { useEvents } from "@/lib/eventsContext";
import { useThemeMode } from "@/lib/themeMode";
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
      if (d.kind === "biberon") return `Biberon ${d.ml ?? "?"} ml`;
      return d.supp ? `Tétée + biberon ${d.supp} ml` : "Tétée";
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

/**
 * Le fil continu de la journée + ses actions (ajout / édition).
 * Affiché dans Tracker pour éviter les aller/retours.
 */
export function DayFeed() {
  const { events } = useEvents();
  const themeDark = useThemeMode() === "dark";
  const [limit, setLimit] = useState(10);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [add, setAdd] = useState(false);

  const bottleMlToday = useMemo(() => {
    const tKey = dayKey(new Date());
    return events
      .filter((e) => e.type === "feed" && dayKey(e.start) === tKey)
      .reduce((s, e) => {
        const d = e.data as FeedData;
        return s + (d.kind === "biberon" ? d.ml || 0 : d.supp || 0);
      }, 0);
  }, [events]);

  return (
    <>
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
          color: "var(--p-surface)",
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
                    <div style={{ display: "flex", minHeight: 56 }}>
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
                            background: live
                              ? "#2F3450"
                              : themeDark
                                ? tone.bg
                                : tone.soft,
                            border: live
                              ? "1px solid rgba(255,255,255,0.25)"
                              : `1px solid color-mix(in srgb, ${tone.ink} ${
                                  themeDark ? 45 : 20
                                }%, transparent)`,
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
                        onClick={() => setSheet({ type: "edit", event: e })}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          margin: "8px 0 8px",
                          padding: "10px 14px",
                          borderRadius: 14,
                          textAlign: "left",
                          background: live
                            ? "linear-gradient(180deg,#2F3450,#1F2238)"
                            : themeDark
                              ? tone.bg
                              : tone.soft,
                          color: live
                            ? "#F0EEE7"
                            : themeDark
                              ? P.ink
                              : tone.ink,
                          border: live
                            ? "0.5px solid rgba(255,255,255,0.12)"
                            : `0.5px solid color-mix(in srgb, ${tone.ink} ${
                                themeDark ? 35 : 14
                              }%, transparent)`,
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
                  background: "var(--p-surface)",
                  border: "1px solid var(--hairline)",
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
        bottleMlToday={bottleMlToday}
      />
    </>
  );
}
