import type { Tone } from "@/lib/theme";

export interface Point {
  y: number;
  label?: string;
}

function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return pts.length ? `M ${pts[0][0]} ${pts[0][1]}` : "";
  let p = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    p += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
  }
  return p;
}

export interface RefLine {
  color: string;
  label: string;
  /** Aligned 1:1 with `series` indices; null = no value. */
  values: (number | null)[];
}

export function LineChart({
  series,
  tone,
  unit = "",
  width = 320,
  height = 150,
  minY,
  maxY,
  selectedIndex = null,
  onSelectPoint,
  refs = [],
}: {
  series: Point[];
  tone: Tone;
  unit?: string;
  width?: number;
  height?: number;
  minY?: number;
  maxY?: number;
  selectedIndex?: number | null;
  onSelectPoint?: (i: number) => void;
  refs?: RefLine[];
}) {
  const pad = { t: 16, r: 30, b: 26, l: 36 };
  if (!series.length) {
    return (
      <div
        style={{
          height,
          display: "grid",
          placeItems: "center",
          color: "rgba(0,0,0,0.4)",
          fontSize: 12,
        }}
      >
        Pas de données
      </div>
    );
  }
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const refVals = refs.flatMap((r) =>
    r.values.filter((v): v is number => typeof v === "number"),
  );
  const ys = series.map((d) => d.y);
  const yMin = minY != null ? minY : Math.min(...ys, ...refVals);
  const yMaxRaw = maxY != null ? maxY : Math.max(...ys, ...refVals);
  const yMax = yMaxRaw === yMin ? yMin + 1 : yMaxRaw;
  const stepX = series.length > 1 ? w / (series.length - 1) : w;
  const yOf = (v: number) => pad.t + h - ((v - yMin) / (yMax - yMin)) * h;
  const pts: [number, number][] = series.map((d, i) => [
    pad.l + i * stepX,
    yOf(d.y),
  ]);
  const path = smoothPath(pts);
  const area = `${path} L ${pts[pts.length - 1][0]} ${pad.t + h} L ${pts[0][0]} ${pad.t + h} Z`;

  const ticks: { v: number; y: number }[] = [];
  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const v = yMin + (yMax - yMin) * (i / yTicks);
    ticks.push({ v, y: pad.t + h - (i / yTicks) * h });
  }

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", overflow: "visible" }}
    >
      {ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={pad.l}
            y1={t.y}
            x2={width - pad.r}
            y2={t.y}
            stroke="rgba(0,0,0,0.06)"
            strokeWidth={0.6}
            strokeDasharray={i === 0 ? "0" : "2 3"}
          />
          <text
            x={pad.l - 8}
            y={t.y + 3}
            textAnchor="end"
            fontSize="9.5"
            fontWeight="500"
            fill="rgba(0,0,0,0.4)"
          >
            {t.v.toFixed(t.v % 1 === 0 ? 0 : 1)}
          </text>
        </g>
      ))}
      {refs.map((rf, ri) => {
        const rp: [number, number][] = [];
        rf.values.forEach((v, i) => {
          if (typeof v === "number") rp.push([pad.l + i * stepX, yOf(v)]);
        });
        if (rp.length < 2) return null;
        const last = rp[rp.length - 1];
        return (
          <g key={`ref${ri}`}>
            <path
              d={smoothPath(rp)}
              fill="none"
              stroke={rf.color}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.7}
            />
            <text
              x={Math.min(last[0] + 3, width - 2)}
              y={last[1] + 3}
              fontSize="8.5"
              fontWeight="700"
              fill={rf.color}
              opacity={0.85}
            >
              {rf.label}
            </text>
          </g>
        );
      })}
      <path d={area} fill={tone.bg} fillOpacity={0.18} />
      <path
        d={path}
        fill="none"
        stroke={tone.ink}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {selectedIndex != null && pts[selectedIndex] && (
        <line
          x1={pts[selectedIndex][0]}
          y1={pad.t}
          x2={pts[selectedIndex][0]}
          y2={pad.t + h}
          stroke={tone.ink}
          strokeWidth={0.8}
          strokeDasharray="3 2"
          opacity={0.5}
        />
      )}
      {pts.map(([x, y], i) => {
        const isSel = i === selectedIndex;
        const isLast = i === pts.length - 1;
        const r = isSel ? 5 : isLast ? 3.5 : 2.4;
        return (
          <g key={i}>
            {onSelectPoint && (
              <circle
                cx={x}
                cy={y}
                r={15}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onClick={() => onSelectPoint(i)}
              />
            )}
            <circle
              cx={x}
              cy={y}
              r={r}
              fill={isSel ? tone.ink : "#fff"}
              stroke={tone.ink}
              strokeWidth={isSel ? 2 : 1.5}
              style={{ pointerEvents: "none" }}
            />
          </g>
        );
      })}
      {series.map((d, i) =>
        d.label ? (
          <text
            key={i}
            x={pts[i][0]}
            y={height - pad.b + 15}
            textAnchor="middle"
            fontSize="9.5"
            fontWeight="500"
            fill="rgba(0,0,0,0.5)"
          >
            {d.label}
          </text>
        ) : null,
      )}
      {unit && (
        <text
          x={width - pad.r}
          y={11}
          textAnchor="end"
          fontSize="9.5"
          fontWeight="600"
          fill="rgba(0,0,0,0.35)"
        >
          {unit.trim()}
        </text>
      )}
    </svg>
  );
}
