import { useMemo, useState } from "react";
import { PALETTES, TONES, type Tone } from "@/lib/theme";
import {
  ageInDays,
  dayKey,
  fmtDateFull,
  startOfDay,
} from "@/lib/dates";
import {
  type GrowthData,
  type PumpData,
} from "@/lib/events";
import { useEvents } from "@/lib/eventsContext";
import {
  percentileFor,
  valueAtZ,
  type Metric,
} from "@/lib/growth/percentile";
import { Segmented } from "@/components/ui/primitives";
import { LineChart, type Point } from "@/components/ui/Chart";
import { EncodeSheet, type SheetState } from "@/components/tracker/forms";

const P = PALETTES.sage;
type Range = "7j" | "14j" | "total";

interface Measure {
  day: number;
  date: Date;
  y: number;
}

function GrowthStat({
  label,
  value,
  unit,
  delta,
  dec,
}: {
  label: string;
  value: number;
  unit: string;
  delta: number;
  dec: number;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          color: P.inkSoft,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        className="num serif"
        style={{ fontSize: 27, marginTop: 2, color: P.ink }}
      >
        {value.toFixed(dec)}
        <span style={{ fontSize: 13, opacity: 0.5, marginLeft: 2 }}>
          {unit}
        </span>
      </div>
      {delta > 0 && (
        <div
          style={{
            fontSize: 10.5,
            color: "#5A7A4F",
            fontWeight: 600,
            marginTop: 2,
          }}
        >
          +{delta.toFixed(dec)} {unit} depuis naissance
        </div>
      )}
    </div>
  );
}

function GrowthChart({
  title,
  unit,
  data,
  tone,
  metric,
}: {
  title: string;
  unit: string;
  data: Measure[];
  tone: Tone;
  metric?: Metric;
}) {
  const [sel, setSel] = useState<number | null>(null);
  if (!data.length) {
    return (
      <div
        style={{
          marginBottom: 14,
          padding: 22,
          background: P.surface,
          borderRadius: 18,
          border: `0.5px solid ${P.line}`,
          textAlign: "center",
          color: P.inkSoft,
          fontSize: 12.5,
        }}
      >
        Pas encore de mesure pour {title.toLowerCase()}.
      </div>
    );
  }
  const fmtShort = (dt: Date) => `${dt.getDate()}/${dt.getMonth() + 1}`;
  const points: Point[] = data.map((d, i) => ({
    y: d.y,
    label:
      i === 0 || i === data.length - 1
        ? fmtShort(d.date)
        : data.length > 5 && i % 2 !== 0
          ? undefined
          : fmtShort(d.date),
  }));
  const s = sel != null ? data[sel] : null;
  const last = data[data.length - 1];
  const lastPct = metric ? percentileFor(metric, last.day, last.y) : null;
  const ref = (z: number) => {
    if (!metric) return "—";
    const v = valueAtZ(metric, last.day, z);
    return v == null ? "—" : v.toFixed(metric === "weight" ? 1 : 0);
  };
  const selPct =
    s && metric ? percentileFor(metric, s.day, s.y) : null;
  return (
    <div
      style={{
        marginBottom: 14,
        padding: 16,
        background: P.surface,
        borderRadius: 18,
        border: `0.5px solid ${P.line}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>
          {title}
        </div>
        {lastPct != null && (
          <div
            className="num"
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: tone.ink,
              background: tone.bg,
              padding: "3px 8px",
              borderRadius: 999,
            }}
          >
            P{lastPct} OMS
          </div>
        )}
      </div>
      {metric && (
        <div
          className="num"
          style={{
            fontSize: 10.5,
            color: P.inkSoft,
            opacity: 0.7,
            marginBottom: 6,
            fontWeight: 600,
          }}
        >
          Repères OMS à J{last.day} · P3 {ref(-1.88079)} · P50 {ref(0)} ·
          P97 {ref(1.88079)}
          {unit}
        </div>
      )}
      <div
        style={{
          minHeight: 38,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: s ? "6px 10px" : "6px 0",
          background: s ? tone.soft : "transparent",
          borderRadius: 10,
          marginBottom: 4,
        }}
      >
        {s ? (
          <>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: tone.ink,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="num"
                style={{ fontSize: 13, fontWeight: 700, color: tone.ink }}
              >
                {s.y}
                {unit} · {fmtDateFull(s.date)}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: tone.ink,
                  opacity: 0.7,
                  marginTop: 1,
                }}
              >
                Charlie avait {s.day} jours
                {selPct != null ? ` · P${selPct} OMS` : ""}
              </div>
            </div>
          </>
        ) : (
          <div
            style={{
              fontSize: 11.5,
              color: P.inkSoft,
              opacity: 0.65,
              fontStyle: "italic",
              paddingLeft: 4,
            }}
          >
            Touchez un point pour voir la mesure
          </div>
        )}
      </div>
      <LineChart
        series={points}
        tone={tone}
        unit={unit}
        width={330}
        height={150}
        selectedIndex={sel}
        onSelectPoint={(i) => setSel((c) => (c === i ? null : i))}
        refs={
          metric
            ? [
                {
                  label: "P3",
                  color: "#B5705C",
                  values: data.map((d) => valueAtZ(metric, d.day, -1.88079)),
                },
                {
                  label: "P50",
                  color: "#7C9A6B",
                  values: data.map((d) => valueAtZ(metric, d.day, 0)),
                },
                {
                  label: "P97",
                  color: "#B5705C",
                  values: data.map((d) => valueAtZ(metric, d.day, 1.88079)),
                },
              ]
            : []
        }
      />
    </div>
  );
}

export function Growth() {
  const { events } = useEvents();
  const [range, setRange] = useState<Range>("7j");
  const [sheet, setSheet] = useState<SheetState>(null);

  const { poids, taille, pc, pump, last, first } = useMemo(() => {
    const growth = events
      .filter((e) => e.type === "growth")
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    const refDay = growth.length
      ? growth[growth.length - 1].start
      : new Date();
    const cutoff =
      range === "total"
        ? -Infinity
        : startOfDay(refDay).getTime() -
          (range === "7j" ? 7 : 14) * 86400000;

    const series = (pick: (g: GrowthData) => number | null): Measure[] =>
      growth
        .map((e) => ({
          day: ageInDays(e.start),
          date: e.start,
          y: pick(e.data as GrowthData),
        }))
        .filter(
          (m): m is Measure =>
            m.y != null && m.date.getTime() >= cutoff,
        );

    // pump total per day
    const byDay = new Map<string, { date: Date; ml: number }>();
    events
      .filter((e) => e.type === "pump")
      .forEach((e) => {
        const k = dayKey(e.start);
        const cur = byDay.get(k) ?? {
          date: startOfDay(e.start),
          ml: 0,
        };
        cur.ml += (e.data as PumpData).ml || 0;
        byDay.set(k, cur);
      });
    const pumpSeries: Measure[] = [...byDay.values()]
      .filter((d) => d.ml > 0 && d.date.getTime() >= cutoff)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((d) => ({ day: ageInDays(d.date), date: d.date, y: d.ml }));

    return {
      poids: series((g) => g.weight),
      taille: series((g) => g.height),
      pc: series((g) => g.head),
      pump: pumpSeries,
      last: growth[growth.length - 1]?.data as GrowthData | undefined,
      first: growth[0]?.data as GrowthData | undefined,
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
          Croissance
        </div>
        <div
          className="serif"
          style={{ fontSize: 30, lineHeight: 1.15, marginTop: 4, color: P.ink }}
        >
          Suivre l'évolution
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
        {last && first && (
          <div
            style={{
              padding: "18px",
              borderRadius: 20,
              background: P.surface,
              border: `0.5px solid ${P.line}`,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: P.inkSoft,
                opacity: 0.65,
                marginBottom: 14,
              }}
            >
              Dernière mesure
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 14,
              }}
            >
              {last.weight != null && (
                <GrowthStat
                  label="Poids"
                  value={last.weight}
                  unit="kg"
                  delta={last.weight - (first.weight ?? last.weight)}
                  dec={2}
                />
              )}
              {last.height != null && (
                <GrowthStat
                  label="Taille"
                  value={last.height}
                  unit="cm"
                  delta={last.height - (first.height ?? last.height)}
                  dec={1}
                />
              )}
              {last.head != null && (
                <GrowthStat
                  label="P.C."
                  value={last.head}
                  unit="cm"
                  delta={last.head - (first.head ?? last.head)}
                  dec={1}
                />
              )}
            </div>
          </div>
        )}

        <button
          onClick={() => setSheet({ type: "growth" })}
          style={{
            width: "100%",
            height: 50,
            borderRadius: 16,
            background: P.ink,
            color: "#FAF9F5",
            fontWeight: 700,
            fontSize: 14,
            marginBottom: 18,
          }}
        >
          + Encoder une mesure
        </button>

        <GrowthChart
          title="Poids"
          unit=" kg"
          data={poids}
          tone={TONES.sand}
          metric="weight"
        />
        <GrowthChart
          title="Taille"
          unit=" cm"
          data={taille}
          tone={TONES.olive}
          metric="height"
        />
        <GrowthChart
          title="Périmètre crânien"
          unit=" cm"
          data={pc}
          tone={TONES.sky}
          metric="head"
        />
        {pump.length > 0 && (
          <GrowthChart
            title="Lait tiré"
            unit=" ml"
            data={pump}
            tone={TONES.rose}
          />
        )}
      </div>

      <EncodeSheet
        sheet={sheet}
        onClose={() => setSheet(null)}
        suggestBreast="G"
        bottleMlToday={0}
        growthInitial={
          last
            ? {
                weight: last.weight ?? 4.5,
                height: last.height ?? 56,
                head: last.head ?? 38,
              }
            : undefined
        }
      />
    </div>
  );
}
