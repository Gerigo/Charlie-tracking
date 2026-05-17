import {
  WHO_GROWTH_STANDARDS,
  type GrowthReferenceMetric,
  type GrowthReferenceRow,
  type GrowthReferenceSex,
} from "./whoGrowthStandards";

// Charlie — garçon (cf. design).
const SEX: GrowthReferenceSex = "boy";

function interp(
  lo: GrowthReferenceRow,
  hi: GrowthReferenceRow,
  day: number,
): GrowthReferenceRow {
  if (lo[0] === hi[0]) return lo;
  const r = (day - lo[0]) / (hi[0] - lo[0]);
  return [
    day,
    lo[1] + (hi[1] - lo[1]) * r,
    lo[2] + (hi[2] - lo[2]) * r,
    lo[3] + (hi[3] - lo[3]) * r,
  ];
}

function lms(
  metric: GrowthReferenceMetric,
  ageDays: number,
): GrowthReferenceRow | null {
  const rows = WHO_GROWTH_STANDARDS[SEX][metric];
  if (ageDays < rows[0][0] || ageDays > rows[rows.length - 1][0]) return null;
  const i = Math.floor(ageDays);
  return interp(rows[i], rows[Math.min(i + 1, rows.length - 1)], ageDays);
}

function zScore(value: number, l: number, m: number, s: number): number | null {
  if (value <= 0 || m <= 0 || s <= 0) return null;
  return l === 0
    ? Math.log(value / m) / s
    : (Math.pow(value / m, l) - 1) / (l * s);
}

function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t -
      0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-a * a);
  return sign * y;
}

function zToPercentile(z: number): number {
  return Math.round((0.5 * (1 + erf(z / Math.SQRT2))) * 100);
}

export type Metric = GrowthReferenceMetric;

/** Percentile (1–99) of a measured value for Charlie at a given age. */
export function percentileFor(
  metric: Metric,
  ageDays: number,
  value: number,
): number | null {
  const row = lms(metric, ageDays);
  if (!row) return null;
  const z = zScore(value, row[1], row[2], row[3]);
  if (z == null || !isFinite(z)) return null;
  return Math.min(99, Math.max(1, zToPercentile(z)));
}

/** WHO reference value at a percentile z-score for a given age. */
export function valueAtZ(
  metric: Metric,
  ageDays: number,
  z: number,
): number | null {
  const row = lms(metric, ageDays);
  if (!row) return null;
  const [, l, m, s] = row;
  const v = l === 0 ? m * Math.exp(s * z) : m * Math.pow(1 + l * s * z, 1 / l);
  return isFinite(v) ? v : null;
}

// z-scores for P3 / P15 / P50 / P85 / P97
export const PCT_Z: { p: number; z: number }[] = [
  { p: 3, z: -1.88079 },
  { p: 50, z: 0 },
  { p: 97, z: 1.88079 },
];

export function pctLabel(p: number): string {
  return `P${p}`;
}
