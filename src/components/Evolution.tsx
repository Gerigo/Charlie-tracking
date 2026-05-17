import { useMemo, useState } from "react";
import { PALETTES, TONES, type Tone } from "@/lib/theme";
import { dayKey, fmtDur, startOfDay } from "@/lib/dates";
import { useEvents } from "@/lib/eventsContext";
import { Segmented, Sheet } from "@/components/ui/primitives";
import { LineChart, type Point } from "@/components/ui/Chart";

const P = PALETTES.sage;
type Range = "7j" | "14j" | "total";

function AvgCard({
  tone,
  label,
  value,
  sub,
}: {
  tone: Tone;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div
      style={{
        padding: "14px 16px 16px",
        borderRadius: 16,
        background: tone.soft,
        color: tone.ink,
        border: "0.5px solid rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          opacity: 0.75,
        }}
      >
        {label}
      </div>
      <div
        className="num serif"
        style={{ fontSize: 30, marginTop: 8, lineHeight: 1 }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 500, marginTop: 6 }}>
        {sub}
      </div>
    </div>
  );
}

function ClickableChart({
  data,
  tone,
  unit,
  minY,
  maxY,
}: {
  data: Point[];
  tone: Tone;
  unit: string;
  minY?: number;
  maxY?: number;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const s = sel != null ? data[sel] : null;
  return (
    <div>
      <div
        style={{
          minHeight: 30,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: s ? "5px 10px" : "5px 0",
          background: s ? tone.soft : "transparent",
          borderRadius: 10,
          marginBottom: 4,
        }}
      >
        {s ? (
          <span
            className="num"
            style={{ fontSize: 12.5, fontWeight: 700, color: tone.ink }}
          >
            {s.y}
            {unit} · {s.label ?? `point ${(sel ?? 0) + 1}`}
          </span>
        ) : (
          <span
            style={{
              fontSize: 11,
              color: P.inkSoft,
              opacity: 0.6,
              fontStyle: "italic",
              paddingLeft: 2,
            }}
          >
            Touchez un point pour le détail
          </span>
        )}
      </div>
      <LineChart
        series={data}
        tone={tone}
        unit={unit}
        width={330}
        height={140}
        minY={minY}
        maxY={maxY}
        selectedIndex={sel}
        onSelectPoint={(i) => setSel((c) => (c === i ? null : i))}
      />
    </div>
  );
}

function smooth(v: number[]): number[] {
  return v.map((_, i) => {
    const p = v[(i - 1 + v.length) % v.length];
    const c = v[i];
    const n = v[(i + 1) % v.length];
    return p * 0.25 + c * 0.5 + n * 0.25;
  });
}

type Scope = "24h" | "jour" | "nuit";
function scopeHours(scope: Scope): number[] {
  if (scope === "jour") return Array.from({ length: 12 }, (_, i) => i + 6);
  if (scope === "nuit") return [18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5];
  return Array.from({ length: 24 }, (_, i) => i);
}

const C_SLEEP = TONES.indigo.ink;
const C_WAKE = "#7C9A6B";
const C_MEAL = "#B5705C";

function useTrend(sleepHour: number[], feedHour: number[]) {
  const sleep = smooth(sleepHour);
  const wake = sleep.map((v) => 1 - v);
  const meal = smooth(feedHour);
  return { sleep, wake, meal };
}

/** Compact view — 3 rows of pills (sommeil / éveil / tétée) × hours. */
function HourPills({
  sleepHour,
  feedHour,
  scope,
}: {
  sleepHour: number[];
  feedHour: number[];
  scope: Scope;
}) {
  const hours = scopeHours(scope);
  const { sleep, wake, meal } = useTrend(sleepHour, feedHour);
  const rows = [
    { icon: "🌙", color: C_SLEEP, vals: sleep },
    { icon: "☀️", color: C_WAKE, vals: wake },
    { icon: "🍼", color: C_MEAL, vals: meal },
  ];
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((r) => (
          <div
            key={r.icon}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <span style={{ width: 18, fontSize: 13 }}>{r.icon}</span>
            <div style={{ flex: 1, display: "flex", gap: 2 }}>
              {hours.map((h) => (
                <div
                  key={h}
                  title={`${h}h · ${Math.round(r.vals[h] * 100)}%`}
                  style={{
                    flex: 1,
                    height: 22,
                    borderRadius: 5,
                    background: r.color,
                    opacity: 0.12 + r.vals[h] * 0.88,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div
        className="num"
        style={{
          display: "flex",
          gap: 2,
          marginLeft: 26,
          marginTop: 5,
          fontSize: 9,
          color: P.inkSoft,
          opacity: 0.6,
        }}
      >
        {hours.map((h, i) => (
          <span
            key={h}
            style={{ flex: 1, textAlign: "center" }}
          >
            {i % 3 === 0 ? `${String(h).padStart(2, "0")}h` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Detailed view — per hour, 3 bars with %, dominant emphasised. */
function HourDetail({
  sleepHour,
  feedHour,
  scope,
}: {
  sleepHour: number[];
  feedHour: number[];
  scope: Scope;
}) {
  const hours = scopeHours(scope);
  const { sleep, wake, meal } = useTrend(sleepHour, feedHour);
  return (
    <div
      style={{
        padding: "0 22px 28px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "20px 16px",
      }}
    >
      {hours.map((h) => {
        const lines = [
          { icon: "🌙", color: C_SLEEP, v: sleep[h] },
          { icon: "☀️", color: C_WAKE, v: wake[h] },
          { icon: "🍴", color: C_MEAL, v: meal[h] },
        ];
        const dom = Math.max(...lines.map((l) => l.v));
        return (
          <div key={h}>
            <div
              className="num"
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: P.ink,
                marginBottom: 8,
              }}
            >
              {String(h).padStart(2, "0")}h
            </div>
            {lines.map((l) => {
              const isDom = l.v === dom && l.v > 0;
              const pct = Math.round(l.v * 100);
              return (
                <div
                  key={l.icon}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                    opacity: isDom ? 1 : 0.6,
                  }}
                >
                  <span style={{ fontSize: 12, width: 16 }}>{l.icon}</span>
                  <div
                    style={{
                      flex: 1,
                      height: 9,
                      borderRadius: 999,
                      background: "rgba(0,0,0,0.06)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: l.color,
                        borderRadius: 999,
                      }}
                    />
                  </div>
                  <span
                    className="num"
                    style={{
                      width: 34,
                      textAlign: "right",
                      fontSize: 11.5,
                      fontWeight: isDom ? 800 : 600,
                      color: isDom ? l.color : P.inkSoft,
                    }}
                  >
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  unit,
  tone,
  data,
  minY,
  maxY,
}: {
  title: string;
  subtitle: string;
  unit: string;
  tone: Tone;
  data: Point[];
  minY?: number;
  maxY?: number;
}) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 18,
        background: P.surface,
        border: `0.5px solid ${P.line}`,
        marginBottom: 14,
      }}
    >
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>
          {title}
        </div>
        <div style={{ fontSize: 11.5, color: P.inkSoft, marginTop: 2 }}>
          {subtitle}
        </div>
      </div>
      {data.length ? (
        <ClickableChart
          data={data}
          tone={tone}
          unit={unit}
          minY={minY}
          maxY={maxY}
        />
      ) : (
        <div
          style={{
            height: 90,
            display: "grid",
            placeItems: "center",
            color: P.inkSoft,
            fontSize: 12,
          }}
        >
          Pas encore de données
        </div>
      )}
    </div>
  );
}

export function Evolution() {
  const { events } = useEvents();
  const [range, setRange] = useState<Range>("7j");

  const [hourScope, setHourScope] = useState<Scope>("24h");
  const [trendDetail, setTrendDetail] = useState(false);
  const {
    avg,
    usageDays,
    sleepS,
    seinS,
    bottleS,
    pumpS,
    tempS,
    sleepHour,
    feedHour,
    summary,
  } = useMemo(() => {
    const empty = {
      avg: { sleepMin: 0, feeds: 0, pumpMl: 0, diaper: 0 },
      usageDays: 0,
      sleepS: [] as Point[],
      seinS: [] as Point[],
      bottleS: [] as Point[],
      pumpS: [] as Point[],
      tempS: [] as Point[],
      sleepHour: new Array(24).fill(0) as number[],
      feedHour: new Array(24).fill(0) as number[],
      summary: "",
    };
    if (!events.length) return empty;

    // main exclut growth & temperature pour borner la période ("trackerEvents").
    const tracker = events.filter(
      (e) => e.type !== "growth" && e.type !== "temp",
    );
    const firstDay = startOfDay((tracker[0] ?? events[0]).start);
    const lastDay = startOfDay(events[events.length - 1].start);
    const spanDays =
      Math.round((lastDay.getTime() - firstDay.getTime()) / 86400000) + 1;
    // Like main: usageDays = jours calendaires du 1er event à AUJOURD'HUI.
    const usageDays = Math.max(
      1,
      Math.round(
        (startOfDay(new Date()).getTime() - firstDay.getTime()) / 86400000,
      ) + 1,
    );

    // Per-calendar-day accumulators (sleep split across midnight, like main).
    const sleepMin = new Map<string, number>();
    const seinCount = new Map<string, number>();
    const bottleCount = new Map<string, number>();
    const pumpMl = new Map<string, number>();
    const tempLast = new Map<string, { v: number; ts: number }>();

    // Hourly "typical day" — fraction of observed days asleep / fed at h.
    const daysWithData = new Set<string>();
    const sleepDayHour = new Set<string>(); // `${dayKey}|${h}`
    const feedDayHour = new Set<string>();

    let totalSleepMin = 0;
    let totalFeed = 0;
    let totalPump = 0;
    let totalDiaper = 0;

    // Mirrors main's buildDashboardData: observedEnd = endTime ?? now,
    // no duration cap, unclosed sleeps included. Per-day split for the
    // chart; hourly grid capped to 16h just for the typical-day viz.
    const addSleep = (start: Date, end: Date) => {
      const e = end.getTime();
      let cur = start.getTime();
      if (e <= cur) return;
      totalSleepMin += (e - cur) / 60000;
      while (cur < e) {
        const dayEnd = startOfDay(new Date(cur)).getTime() + 86400000;
        const segEnd = Math.min(dayEnd, e);
        const k = dayKey(new Date(cur));
        sleepMin.set(k, (sleepMin.get(k) ?? 0) + (segEnd - cur) / 60000);
        cur = segEnd;
      }
      let hc = start.getTime();
      const hEnd = Math.min(e, start.getTime() + 16 * 3600000);
      while (hc < hEnd) {
        const dt = new Date(hc);
        sleepDayHour.add(`${dayKey(dt)}|${dt.getHours()}`);
        hc += 3600000;
      }
    };

    for (const ev of events) {
      const k = dayKey(ev.start);
      daysWithData.add(k);
      if (ev.type === "sleep") {
        addSleep(ev.start, ev.end ?? new Date());
      } else if (ev.type === "feed") {
        totalFeed += 1;
        const isBottle = (ev.data as { kind?: string }).kind === "biberon";
        if (isBottle) bottleCount.set(k, (bottleCount.get(k) ?? 0) + 1);
        else seinCount.set(k, (seinCount.get(k) ?? 0) + 1);
        feedDayHour.add(`${k}|${ev.start.getHours()}`);
      } else if (ev.type === "pump") {
        const ml = (ev.data as { ml?: number }).ml ?? 0;
        totalPump += ml;
        pumpMl.set(k, (pumpMl.get(k) ?? 0) + ml);
      } else if (ev.type === "diaper") {
        totalDiaper += 1;
      } else if (ev.type === "temp") {
        const v = (ev.data as { value?: number }).value;
        if (typeof v === "number") {
          const prev = tempLast.get(k);
          if (!prev || ev.start.getTime() >= prev.ts) {
            tempLast.set(k, { v, ts: ev.start.getTime() });
          }
        }
      }
    }

    const avgComputed = {
      sleepMin: Math.round(totalSleepMin / usageDays),
      feeds: +(totalFeed / usageDays).toFixed(1),
      pumpMl: Math.round(totalPump / usageDays),
      diaper: +(totalDiaper / usageDays).toFixed(1),
    };

    // Buckets across the whole span; the range only limits visibility.
    const buckets: Date[] = [];
    for (let i = 0; i < spanDays; i++) {
      buckets.push(new Date(firstDay.getTime() + i * 86400000));
    }
    const visibleCount =
      range === "7j" ? 7 : range === "14j" ? 14 : buckets.length;
    const visible = buckets.slice(-visibleCount);

    const lbl = (d: Date, i: number): string | undefined => {
      const txt = `${d.getDate()}/${d.getMonth() + 1}`;
      if (i === 0 || i === visible.length - 1) return txt;
      if (visible.length > 14 && i % 5 !== 0) return undefined;
      if (visible.length > 7 && i % 2 !== 0) return undefined;
      return txt;
    };

    const sleepS: Point[] = visible.map((d, i) => ({
      y: Math.round(((sleepMin.get(dayKey(d)) ?? 0) / 60) * 10) / 10,
      label: lbl(d, i),
    }));
    const seinS: Point[] = visible.map((d, i) => ({
      y: seinCount.get(dayKey(d)) ?? 0,
      label: lbl(d, i),
    }));
    const bottleS: Point[] = visible.map((d, i) => ({
      y: bottleCount.get(dayKey(d)) ?? 0,
      label: lbl(d, i),
    }));
    const pumpS: Point[] = visible.map((d, i) => ({
      y: pumpMl.get(dayKey(d)) ?? 0,
      label: lbl(d, i),
    }));
    const tempS: Point[] = visible
      .map((d, i) => ({ v: tempLast.get(dayKey(d))?.v, label: lbl(d, i) }))
      .filter((p) => p.v != null)
      .map((p) => ({ y: p.v as number, label: p.label }));

    const nDays = Math.max(1, daysWithData.size);
    const sleepHour = new Array(24).fill(0) as number[];
    const feedHour = new Array(24).fill(0) as number[];
    sleepDayHour.forEach((s) => {
      sleepHour[Number(s.split("|")[1])] += 1;
    });
    feedDayHour.forEach((s) => {
      feedHour[Number(s.split("|")[1])] += 1;
    });
    for (let h = 0; h < 24; h++) {
      sleepHour[h] = sleepHour[h] / nDays;
      feedHour[h] = feedHour[h] / nDays;
    }
    // Short summary: dominant sleep window + top feed hours.
    const sleepyHours = sleepHour
      .map((v, h) => ({ v, h }))
      .filter((x) => x.v >= 0.5)
      .map((x) => x.h);
    let sleepWindow = "—";
    if (sleepyHours.length) {
      const lo = Math.min(...sleepyHours);
      const hi = Math.max(...sleepyHours);
      sleepWindow = `${lo}h–${(hi + 1) % 24}h`;
    }
    const topFeeds = feedHour
      .map((v, h) => ({ v, h }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 3)
      .filter((x) => x.v > 0.2)
      .sort((a, b) => a.h - b.h)
      .map((x) => `${x.h}h`);
    const summary =
      `Dort surtout ${sleepWindow}` +
      (topFeeds.length ? ` · tète vers ${topFeeds.join(", ")}` : "");

    return {
      avg: avgComputed,
      usageDays,
      sleepS,
      seinS,
      bottleS,
      pumpS,
      tempS,
      sleepHour,
      feedHour,
      summary,
    };
  }, [events, range]);

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
      <div style={{ padding: "22px 22px 12px" }}>
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
          Évolution
        </div>
        <div
          className="serif"
          style={{ fontSize: 30, lineHeight: 1.15, marginTop: 4, color: P.ink }}
        >
          Tendances de Charlie
        </div>
        <div style={{ marginTop: 14 }}>
          <Segmented
            value={range}
            onChange={setRange}
            options={[
              { value: "7j", label: "7 j" },
              { value: "14j", label: "14 j" },
              { value: "total", label: "Total" },
            ]}
          />
        </div>
      </div>

      <div
        className="scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 16px calc(120px + env(safe-area-inset-bottom))",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 10,
            marginBottom: 18,
          }}
        >
          <AvgCard
            tone={TONES.indigo}
            label="Sommeil / jour"
            value={fmtDur(avg.sleepMin)}
            sub={`moyenne · ${usageDays} j`}
          />
          <AvgCard
            tone={TONES.sand}
            label="Tétées / jour"
            value={avg.feeds.toFixed(1)}
            sub={`moyenne · ${usageDays} j`}
          />
          <AvgCard
            tone={TONES.rose}
            label="Lait tiré / jour"
            value={`${avg.pumpMl} ml`}
            sub={`moyenne · ${usageDays} j`}
          />
          <AvgCard
            tone={TONES.olive}
            label="Couches / jour"
            value={avg.diaper.toFixed(1)}
            sub={`moyenne · ${usageDays} j`}
          />
        </div>

        <div
          style={{
            padding: 16,
            borderRadius: 18,
            background: P.surface,
            border: `0.5px solid ${P.line}`,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>
              Tendances horaires
            </div>
            <Segmented
              value={hourScope}
              onChange={setHourScope}
              options={[
                { value: "24h", label: "24 h" },
                { value: "jour", label: "Jour" },
                { value: "nuit", label: "Nuit" },
              ]}
            />
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: P.inkSoft,
              marginBottom: 12,
              fontWeight: 600,
            }}
          >
            {summary}
          </div>
          <HourPills
            sleepHour={sleepHour}
            feedHour={feedHour}
            scope={hourScope}
          />
          <div
            style={{
              display: "flex",
              gap: 14,
              marginTop: 12,
              fontSize: 11,
              color: P.inkSoft,
              flexWrap: "wrap",
            }}
          >
            {(
              [
                ["🌙", "sommeil"],
                ["☀️", "éveil"],
                ["🍼", "tétée"],
              ] as const
            ).map(([e, l]) => (
              <span
                key={l}
                style={{ display: "inline-flex", gap: 5, alignItems: "center" }}
              >
                {e} {l}
              </span>
            ))}
          </div>
          <button
            onClick={() => setTrendDetail(true)}
            style={{
              marginTop: 14,
              width: "100%",
              height: 42,
              borderRadius: 14,
              background: "transparent",
              border: `1px solid ${P.line}`,
              color: P.ink,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Vue détaillée
          </button>
        </div>

        <Sheet open={trendDetail} onClose={() => setTrendDetail(false)}>
          <div
            style={{
              padding: "6px 22px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              className="serif"
              style={{ fontSize: 27, color: P.ink }}
            >
              Tendances horaires
            </div>
            <Segmented
              value={hourScope}
              onChange={setHourScope}
              options={[
                { value: "24h", label: "24 h" },
                { value: "jour", label: "Jour" },
                { value: "nuit", label: "Nuit" },
              ]}
            />
          </div>
          <HourDetail
            sleepHour={sleepHour}
            feedHour={feedHour}
            scope={hourScope}
          />
        </Sheet>

        <ChartCard
          title="Heures de sommeil"
          subtitle="par jour"
          unit=" h"
          tone={TONES.indigo}
          data={sleepS}
        />
        <ChartCard
          title="Tétées au sein"
          subtitle="par jour"
          unit=""
          tone={TONES.sand}
          data={seinS}
        />
        <ChartCard
          title="Biberons"
          subtitle="par jour"
          unit=""
          tone={TONES.clay}
          data={bottleS}
        />
        <ChartCard
          title="Lait tiré"
          subtitle="par jour"
          unit=" ml"
          tone={TONES.rose}
          data={pumpS}
        />
        {tempS.length > 1 && (
          <ChartCard
            title="Température"
            subtitle="dernière du jour"
            unit=" °"
            tone={TONES.clay}
            data={tempS}
            minY={36}
            maxY={38}
          />
        )}
      </div>
    </div>
  );
}
