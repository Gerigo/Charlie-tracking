import {
  WHO_GROWTH_STANDARDS,
  type GrowthReferenceMetric,
  type GrowthReferenceRow,
  type GrowthReferenceSex,
} from './whoGrowthStandards';

const DAY_MS = 24 * 60 * 60 * 1000;

export type GrowthSex = GrowthReferenceSex;
export type GrowthMetric = GrowthReferenceMetric;

export interface GrowthPercentileResult {
  ageDays: number;
  zScore: number;
  percentile: number;
  percentileLabel: string;
  interpretation: string;
}

function interpolateRow(lower: GrowthReferenceRow, upper: GrowthReferenceRow, targetDay: number): GrowthReferenceRow {
  if (lower[0] === upper[0]) return lower;

  const ratio = (targetDay - lower[0]) / (upper[0] - lower[0]);
  return [
    targetDay,
    lower[1] + (upper[1] - lower[1]) * ratio,
    lower[2] + (upper[2] - lower[2]) * ratio,
    lower[3] + (upper[3] - lower[3]) * ratio,
  ];
}

export function getAgeInDays(timestamp: number, birthDate: Date) {
  return Math.floor((timestamp - birthDate.getTime()) / DAY_MS);
}

export function getReferenceRow(metric: GrowthMetric, sex: GrowthSex, ageDays: number): GrowthReferenceRow | null {
  const rows = WHO_GROWTH_STANDARDS[sex][metric];
  if (ageDays < rows[0][0] || ageDays > rows[rows.length - 1][0]) {
    return null;
  }

  const lowerIndex = Math.floor(ageDays);
  const lower = rows[lowerIndex];
  const upper = rows[Math.min(lowerIndex + 1, rows.length - 1)];
  return interpolateRow(lower, upper, ageDays);
}

export function calculateZScore(value: number, l: number, m: number, s: number) {
  if (value <= 0 || m <= 0 || s <= 0) return null;
  if (l === 0) {
    return Math.log(value / m) / s;
  }
  return (Math.pow(value / m, l) - 1) / (l * s);
}

function erf(value: number) {
  const sign = value >= 0 ? 1 : -1;
  const absolute = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * absolute);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absolute * absolute);
  return sign * y;
}

export function normalCdf(zScore: number) {
  return 0.5 * (1 + erf(zScore / Math.SQRT2));
}

export function formatPercentileLabel(percentile: number) {
  if (percentile < 1) return 'P<1';
  if (percentile > 99) return 'P>99';
  return `P${Math.round(percentile)}`;
}

export function describePercentile(percentile: number, language: 'fr' | 'en' = 'fr'): string {
  if (language === 'en') {
    if (percentile < 3)  return 'Outside the usual WHO range — worth bringing up at the next check-up';
    if (percentile < 15) return 'In the lower part of the WHO reference range — regular follow-ups are a good idea';
    if (percentile <= 85) return 'Within the WHO reference range — everything looks good!';
    if (percentile <= 97) return 'In the upper part of the WHO reference range';
    return 'Above the usual WHO range — worth bringing up at the next check-up';
  }
  if (percentile < 3)  return 'En dehors de la plage OMS habituelle — à évoquer lors du prochain rendez-vous pédiatrique';
  if (percentile < 15) return 'Dans la partie basse de la référence OMS — un suivi régulier est une bonne chose';
  if (percentile <= 85) return 'Dans la plage de référence OMS — tout se passe bien !';
  if (percentile <= 97) return 'Dans la partie haute de la référence OMS';
  return 'Au-dessus de la plage OMS habituelle — à évoquer lors du prochain rendez-vous pédiatrique';
}

export function measurementFromZScore(l: number, m: number, s: number, zScore: number) {
  if (m <= 0 || s <= 0) return null;
  if (l === 0) {
    return m * Math.exp(s * zScore);
  }
  return m * Math.pow(1 + l * s * zScore, 1 / l);
}

export function measurementForAge(params: {
  metric: GrowthMetric;
  sex: GrowthSex;
  ageDays: number;
  zScore: number;
}) {
  const reference = getReferenceRow(params.metric, params.sex, params.ageDays);
  if (!reference) return null;
  const [, l, m, s] = reference;
  return measurementFromZScore(l, m, s, params.zScore);
}

export function estimateGrowthPercentile(params: {
  metric: GrowthMetric;
  sex: GrowthSex;
  value: number;
  timestamp: number;
  birthDate: Date;
  language?: 'fr' | 'en';
}): GrowthPercentileResult | null {
  const ageDays = getAgeInDays(params.timestamp, params.birthDate);
  const reference = getReferenceRow(params.metric, params.sex, ageDays);
  if (!reference) return null;

  const [, l, m, s] = reference;
  const zScore = calculateZScore(params.value, l, m, s);
  if (zScore === null || Number.isNaN(zScore)) return null;

  const percentile = Math.max(0.1, Math.min(99.9, normalCdf(zScore) * 100));
  return {
    ageDays,
    zScore,
    percentile,
    percentileLabel: formatPercentileLabel(percentile),
    interpretation: describePercentile(percentile, params.language),
  };
}
