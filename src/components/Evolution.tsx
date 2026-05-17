import { useEffect, useMemo, useState } from "react";
import { PALETTES, TONES, type Tone } from "@/lib/theme";
import { dayKey, fmtDur, startOfDay } from "@/lib/dates";
import { statsFor, subscribeAllEvents, type AppEvent } from "@/lib/events";
import { Segmented } from "@/components/ui/primitives";
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

  useEffect(() => subscribeAllEvents(setEvents), []);

  const { avg, daysCount, sleepS, feedS, pumpS, tempS } = useMemo(() => {
    const ref = events.length
      ? startOfDay(events[events.length - 1].start)
      : startOfDay(new Date());
    const count = range === "7j" ? 7 : range === "14j" ? 14 : 45;

    const byDay = new Map<string, AppEvent[]>();
    events.forEach((e) => {
      const k = dayKey(e.start);
      const arr = byDay.get(k) ?? [];
      arr.push(e);
      byDay.set(k, arr);
    });

    const days = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(
        ref.getFullYear(),
        ref.getMonth(),
        ref.getDate() - i,
      );
      const evs = byDay.get(dayKey(d)) ?? [];
      days.push({ date: d, stats: statsFor(evs), has: evs.length > 0 });
    }

    const valid = days.filter((d) => d.has);
    const n = valid.length || 1;
    const avgComputed = {
      sleepMin: Math.round(
        valid.reduce((s, d) => s + d.stats.sleepMin, 0) / n,
      ),
      feeds: +(
        valid.reduce((s, d) => s + d.stats.feedCount, 0) / n
      ).toFixed(1),
      pumpMl: Math.round(
        valid.reduce((s, d) => s + d.stats.pumpMl, 0) / n,
      ),
      diaper: +(
        valid.reduce((s, d) => s + d.stats.diaperCount, 0) / n
      ).toFixed(1),
    };

    const lbl = (d: Date, i: number): string | undefined => {
      if (i === 0 || i === days.length - 1)
        return `${d.getDate()}/${d.getMonth() + 1}`;
      if (days.length > 14 && i % 5 !== 0) return undefined;
      if (days.length > 7 && i % 2 !== 0) return undefined;
      return `${d.getDate()}/${d.getMonth() + 1}`;
    };

    return {
      avg: avgComputed,
      daysCount: count,
      sleepS: days.map((d, i) => ({
        y: Math.round((d.stats.sleepMin / 60) * 10) / 10,
        label: lbl(d.date, i),
      })) as Point[],
      feedS: days.map((d, i) => ({
        y: d.stats.feedCount,
        label: lbl(d.date, i),
      })) as Point[],
      pumpS: days.map((d, i) => ({
        y: d.stats.pumpMl,
        label: lbl(d.date, i),
      })) as Point[],
      tempS: days
        .map((d, i) => ({
          y: d.stats.lastTemp,
          label: lbl(d.date, i),
        }))
        .filter((p) => p.y != null)
        .map((p) => ({ y: p.y as number, label: p.label })) as Point[],
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
            sub={`moyenne · ${daysCount} j`}
          />
          <AvgCard
            tone={TONES.sand}
            label="Tétées / jour"
            value={avg.feeds.toFixed(1)}
            sub={`moyenne · ${daysCount} j`}
          />
          <AvgCard
            tone={TONES.rose}
            label="Lait tiré / jour"
            value={`${avg.pumpMl} ml`}
            sub={`moyenne · ${daysCount} j`}
          />
          <AvgCard
            tone={TONES.olive}
            label="Couches / jour"
            value={avg.diaper.toFixed(1)}
            sub={`moyenne · ${daysCount} j`}
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
