import { useEffect, useMemo, useState } from "react";
import { PALETTES, TONES, type Tone } from "@/lib/theme";
import { dayKey, fmtDur, startOfDay } from "@/lib/dates";
import { subscribeAllEvents, type AppEvent } from "@/lib/events";
import { Segmented } from "@/components/ui/primitives";
import { ScreenLoader } from "@/components/ui/Loader";
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
        <LineChart
          series={data}
          tone={tone}
          unit={unit}
          width={330}
          height={140}
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
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [range, setRange] = useState<Range>("7j");
  const [loaded, setLoaded] = useState(false);

  useEffect(
    () =>
      subscribeAllEvents((e) => {
        setEvents(e);
        setLoaded(true);
      }),
    [],
  );

  const { avg, usageDays, sleepS, feedS, pumpS, tempS } = useMemo(() => {
    const empty = {
      avg: { sleepMin: 0, feeds: 0, pumpMl: 0, diaper: 0 },
      usageDays: 0,
      sleepS: [] as Point[],
      feedS: [] as Point[],
      pumpS: [] as Point[],
      tempS: [] as Point[],
    };
    if (!events.length) return empty;

    const firstDay = startOfDay(events[0].start);
    const lastDay = startOfDay(events[events.length - 1].start);
    const spanDays =
      Math.round((lastDay.getTime() - firstDay.getTime()) / 86400000) + 1;

    // Per-calendar-day accumulators (sleep split across midnight, like main).
    const sleepMin = new Map<string, number>();
    const feedCount = new Map<string, number>();
    const pumpMl = new Map<string, number>();
    const tempLast = new Map<string, { v: number; ts: number }>();

    let totalSleepMin = 0;
    let totalFeed = 0;
    let totalPump = 0;
    let totalDiaper = 0;

    // A single sleep longer than 20h is almost certainly a session that
    // was never closed (stale data) — ignore it so it can't inflate the
    // average to impossible values like 37h/day.
    const MAX_SLEEP_MS = 20 * 3600000;
    const addSleep = (start: Date, end: Date) => {
      const e = end.getTime();
      let cur = start.getTime();
      if (e <= cur || e - cur > MAX_SLEEP_MS) return;
      totalSleepMin += (e - cur) / 60000;
      while (cur < e) {
        const dayEnd = startOfDay(new Date(cur)).getTime() + 86400000;
        const segEnd = Math.min(dayEnd, e);
        const k = dayKey(new Date(cur));
        sleepMin.set(k, (sleepMin.get(k) ?? 0) + (segEnd - cur) / 60000);
        cur = segEnd;
      }
    };

    for (const ev of events) {
      const k = dayKey(ev.start);
      if (ev.type === "sleep") {
        // Only completed sleeps count — an open (unclosed) sleep has no
        // reliable duration.
        if (ev.end) addSleep(ev.start, ev.end);
      } else if (ev.type === "feed") {
        totalFeed += 1;
        feedCount.set(k, (feedCount.get(k) ?? 0) + 1);
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

    const days = Math.max(1, spanDays);
    const avgComputed = {
      sleepMin: Math.round(totalSleepMin / days),
      feeds: +(totalFeed / days).toFixed(1),
      pumpMl: Math.round(totalPump / days),
      diaper: +(totalDiaper / days).toFixed(1),
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
    const feedS: Point[] = visible.map((d, i) => ({
      y: feedCount.get(dayKey(d)) ?? 0,
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

    return {
      avg: avgComputed,
      usageDays: spanDays,
      sleepS,
      feedS,
      pumpS,
      tempS,
    };
  }, [events, range]);

  if (!loaded) return <ScreenLoader label="Chargement…" />;

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

        <ChartCard
          title="Heures de sommeil"
          subtitle="par jour"
          unit=" h"
          tone={TONES.indigo}
          data={sleepS}
        />
        <ChartCard
          title="Nombre de tétées"
          subtitle="par jour"
          unit=""
          tone={TONES.sand}
          data={feedS}
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
