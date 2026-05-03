import { Icon } from '@/src/components/ui/Icon';
import { useRouter } from 'expo-router';
import { parseISO } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { EditorialTopBar } from '@/src/components/editorial/TopBar';
import { AppBadge, AppButton, AppInput, Card, Screen } from '@/src/components/ui';
import { radii, spacing } from '@/src/constants/theme';
import { useI18n } from '@/src/hooks/useI18n';
import {
  estimateGrowthPercentile,
  measurementForAge,
  type GrowthMetric,
} from '@/src/lib/growth/growthPercentiles';
import { triggerSelectionFeedback } from '@/src/lib/feedback';
import { useAppContext } from '@/src/providers/AppProvider';
import { useAppTheme } from '@/src/providers/ThemeProvider';
import type { TrackedEvent } from '@/src/types/domain';
import { formatDateTime } from '@/src/utils/date';
import { getGrowthEntries } from '@/src/utils/eventSummaries';

// ─── Chart constants ──────────────────────────────────────────────────────────

const WHO_STANDARDS_URL = 'https://www.who.int/tools/child-growth-standards';
const VBOX_W = 320;
const VBOX_H = 250;
const PAD = { top: 28, right: 16, bottom: 54, left: 40 };
const BUBBLE_H = 20;
const BUBBLE_R = 10;
const OMS_LOW_Z = -1.880794;
const OMS_HIGH_Z = 1.880794;

// ─── Types ────────────────────────────────────────────────────────────────────

type ChartWindow = '7' | '14' | 'all';

type ChartPoint = {
  timestamp: number;
  label: string;
  value: number;
  percentileLabel?: string | null;
  interpretation?: string | null;
  omsLow?: number | null;
  omsMedian?: number | null;
  omsHigh?: number | null;
};

// ─── Chart helpers ────────────────────────────────────────────────────────────

function formatChartLabel(timestamp: number, language: 'fr' | 'en') {
  return new Intl.DateTimeFormat(language === 'fr' ? 'fr-BE' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
  }).format(timestamp);
}

function createLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

function createBandPath(
  highPoints: Array<{ x: number; y: number }>,
  lowPoints: Array<{ x: number; y: number }>,
): string {
  if (highPoints.length === 0 || lowPoints.length === 0) return '';
  const fwd = highPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const back = [...lowPoints]
    .reverse()
    .map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  return `${fwd} ${back} Z`;
}

function projectSeries(values: number[], min: number, max: number) {
  const chartW = VBOX_W - PAD.left - PAD.right;
  const chartH = VBOX_H - PAD.top - PAD.bottom;
  const range = Math.max(max - min, 0.01);
  return values.map((value, index) => {
    const x =
      PAD.left +
      (values.length === 1 ? chartW / 2 : (index / (values.length - 1)) * chartW);
    const ratio = (value - min) / range;
    const y = PAD.top + chartH - ratio * chartH;
    return { x, y };
  });
}

function formatChartValue(value: number, unit: string) {
  const d = unit === 'kg' ? 2 : 1;
  return `${value.toFixed(d)} ${unit}`;
}

function formatYLabel(value: number, unit: string): string {
  if (unit === 'kg') return value.toFixed(1);
  if (unit === '°C') return value.toFixed(1);
  return Math.round(value).toString();
}

function filterRecentEvents(events: TrackedEvent[], window: ChartWindow) {
  if (window === 'all') return events;
  const days = window === '7' ? 7 : 14;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return events.filter((event) => event.startTime >= cutoff);
}

// ─── SummaryCard ──────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.summaryCard, { backgroundColor: theme.surfaceRaised }]}>
      <Text style={[styles.summaryLabel, { color: theme.textSoft, fontFamily: theme.fontBold }]}>
        {label}
      </Text>
      <Text style={[styles.summaryValue, { color: accent, fontFamily: theme.fontBold }]}>
        {value}
      </Text>
    </View>
  );
}

// ─── MeasurementChart ─────────────────────────────────────────────────────────

function MeasurementChart({
  title,
  unit,
  color,
  data,
  showOms,
  emptyMessage,
}: {
  title: string;
  unit: string;
  color: string;
  data: ChartPoint[];
  showOms: boolean;
  emptyMessage: string;
}) {
  const { theme } = useAppTheme();
  const [selectedIndex, setSelectedIndex] = useState<number>(Math.max(data.length - 1, 0));

  useEffect(() => {
    setSelectedIndex(Math.max(data.length - 1, 0));
  }, [data]);

  if (data.length === 0) {
    return (
      <Card>
        <Text style={[styles.chartTitle, { color: theme.text, fontFamily: theme.fontDisplayItalic }]}>
          {title}
        </Text>
        <Text style={[styles.emptyText, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
          {emptyMessage}
        </Text>
      </Card>
    );
  }

  const selected = data[selectedIndex] ?? data[data.length - 1];

  // Value range (include OMS bands if present)
  const allValues = data.flatMap((pt) => [
    pt.value,
    ...(showOms
      ? [pt.omsLow ?? pt.value, pt.omsMedian ?? pt.value, pt.omsHigh ?? pt.value]
      : []),
  ]);
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const padFrac = Math.max((maxValue - minValue) * 0.12, unit === 'kg' ? 0.18 : unit === '°C' ? 0.2 : 0.6);
  const min = Math.max(unit === '°C' ? 34 : 0, minValue - padFrac);
  const max = maxValue + padFrac;

  // Project all series
  const valuePoints = projectSeries(data.map((pt) => pt.value), min, max);
  const lowPoints   = showOms ? projectSeries(data.map((pt) => pt.omsLow   ?? pt.value), min, max) : [];
  const medPoints   = showOms ? projectSeries(data.map((pt) => pt.omsMedian ?? pt.value), min, max) : [];
  const highPoints  = showOms ? projectSeries(data.map((pt) => pt.omsHigh  ?? pt.value), min, max) : [];

  const selectedPoint = valuePoints[selectedIndex] ?? valuePoints[valuePoints.length - 1];

  // Grid
  const chartH = VBOX_H - PAD.top - PAD.bottom;
  const gridCount = 4;
  const gridYs = Array.from({ length: gridCount }, (_, i) =>
    PAD.top + (i / (gridCount - 1)) * chartH,
  );
  const gridVals = Array.from({ length: gridCount }, (_, i) =>
    max - (i / (gridCount - 1)) * (max - min),
  );

  // X labels: show at most 5, spaced evenly
  const stride = Math.max(1, Math.ceil(data.length / 5));

  // Value bubble
  const bubbleText = formatChartValue(selected.value, unit);
  const bubbleW = Math.max(52, bubbleText.length * 6.8 + 16);
  const bubbleX = Math.min(
    VBOX_W - PAD.right - bubbleW / 2,
    Math.max(PAD.left + bubbleW / 2, selectedPoint.x),
  );
  const bubbleY = Math.max(PAD.top + BUBBLE_R + 2, selectedPoint.y - 26);

  return (
    <Card>
      {/* Header */}
      <View style={styles.chartHeader}>
        <View style={styles.chartHeaderLeft}>
          <Text style={[styles.chartTitle, { color: theme.text, fontFamily: theme.fontDisplayItalic }]}>
            {title}
          </Text>
          <Text style={[styles.chartMeta, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
            {selected
              ? `${formatChartValue(selected.value, unit)} · ${formatDateTime(selected.timestamp)}`
              : '—'}
          </Text>
        </View>
        <View style={[styles.chartBadge, { backgroundColor: `${color}18` }]}>
          <Text style={[styles.chartBadgeText, { color, fontFamily: theme.fontBold }]}>{unit}</Text>
        </View>
      </View>

      {/* SVG chart */}
      <Svg width="100%" height={270} viewBox={`0 0 ${VBOX_W} ${VBOX_H}`}>
        {/* ── Background ── */}
        <Rect x={0} y={0} width={VBOX_W} height={VBOX_H} fill="transparent" />

        {/* ── OMS band fill ── */}
        {showOms && highPoints.length > 0 ? (
          <Path
            d={createBandPath(highPoints, lowPoints)}
            fill={`${theme.textSoft}12`}
            strokeWidth={0}
          />
        ) : null}

        {/* ── Grid lines ── */}
        {gridYs.map((y, i) => (
          <Line
            key={`grid-${i}`}
            x1={PAD.left}
            y1={y}
            x2={VBOX_W - PAD.right}
            y2={y}
            stroke={`${theme.primary}18`}
            strokeWidth={1}
          />
        ))}

        {/* ── Y-axis labels ── */}
        {gridYs.map((y, i) => (
          <SvgText
            key={`ylabel-${i}`}
            x={PAD.left - 4}
            y={y + 3.5}
            fill={theme.textMuted}
            fontSize="9"
            textAnchor="end"
          >
            {formatYLabel(gridVals[i], unit)}
          </SvgText>
        ))}

        {/* ── Vertical rule on selected point ── */}
        {selectedPoint ? (
          <Line
            x1={selectedPoint.x}
            y1={PAD.top}
            x2={selectedPoint.x}
            y2={VBOX_H - PAD.bottom}
            stroke={`${color}30`}
            strokeWidth={1.5}
          />
        ) : null}

        {/* ── OMS low / high dashed borders ── */}
        {showOms ? (
          <>
            <Path d={createLinePath(lowPoints)}  stroke={theme.outline} strokeWidth={1} strokeDasharray="3 4" fill="none" opacity={0.32} />
            <Path d={createLinePath(highPoints)} stroke={theme.outline} strokeWidth={1} strokeDasharray="3 4" fill="none" opacity={0.32} />
          </>
        ) : null}

        {/* ── OMS median ── */}
        {showOms ? (
          <Path d={createLinePath(medPoints)} stroke={theme.outline} strokeWidth={1.2} fill="none" opacity={0.45} />
        ) : null}

        {/* ── Data line ── */}
        <Path d={createLinePath(valuePoints)} stroke={color} strokeWidth={2.5} fill="none" />

        {/* ── Data dots (visual only — no onPress) ── */}
        {valuePoints.map((pt, i) => (
          <Circle
            key={`dot-${data[i]?.timestamp ?? i}`}
            cx={pt.x}
            cy={pt.y}
            r={i === selectedIndex ? 5.5 : 3.5}
            fill={i === selectedIndex ? color : `${color}BB`}
            stroke={theme.surfaceLowest}
            strokeWidth={i === selectedIndex ? 2.5 : 1.5}
          />
        ))}

        {/* ── Value bubble ── */}
        {selectedPoint ? (
          <>
            <Rect
              x={bubbleX - bubbleW / 2}
              y={bubbleY - BUBBLE_R}
              width={bubbleW}
              height={BUBBLE_H}
              rx={BUBBLE_R}
              fill={color}
            />
            <SvgText
              x={bubbleX}
              y={bubbleY + 4.5}
              fill="#FFFFFF"
              fontSize="10"
              fontWeight="bold"
              textAnchor="middle"
            >
              {bubbleText}
            </SvgText>
          </>
        ) : null}

        {/* ── X-axis labels (rotated) ── */}
        {data.map((pt, i) => {
          const show = i === 0 || i === data.length - 1 || i % stride === 0;
          if (!show) return null;
          const x = valuePoints[i]?.x ?? PAD.left;
          const y = VBOX_H - PAD.bottom + 14;
          return (
            <SvgText
              key={`lbl-${pt.timestamp}`}
              x={x}
              y={y}
              fill={theme.textSoft}
              fontSize="9.5"
              textAnchor="end"
              transform={`rotate(-40, ${x}, ${y})`}
            >
              {pt.label}
            </SvgText>
          );
        })}

        {/* ── Hit circles (rendered last — on top) ── */}
        {valuePoints.map((pt, i) => (
          <Circle
            key={`hit-${data[i]?.timestamp ?? i}`}
            cx={pt.x}
            cy={pt.y}
            r={18}
            fill="transparent"
            onPress={() => {
              triggerSelectionFeedback();
              setSelectedIndex(i);
            }}
          />
        ))}
      </Svg>

      {/* Selected point insight */}
      {selected ? (
        <View style={[styles.pointInsight, { backgroundColor: theme.surfaceRaised }]}>
          <View style={styles.pointInsightHeader}>
            <Text style={[styles.pointInsightValue, { color, fontFamily: theme.fontBold }]}>
              {formatChartValue(selected.value, unit)}
            </Text>
            {selected.percentileLabel ? (
              <AppBadge label={selected.percentileLabel} tone="neutral" />
            ) : null}
          </View>
          <Text style={[styles.pointInsightDate, { color: theme.textSoft, fontFamily: theme.fontMedium }]}>
            {formatDateTime(selected.timestamp)}
          </Text>
          {selected.interpretation ? (
            <Text style={[styles.pointInsightBody, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
              {selected.interpretation}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

// ─── Data mappers ─────────────────────────────────────────────────────────────

function toGrowthChartData(params: {
  events: TrackedEvent[];
  metric: GrowthMetric;
  sex: 'boy' | 'girl';
  birthDate: Date | null;
  language: 'fr' | 'en';
}) {
  return params.events
    .filter((event) => typeof event.details?.[params.metric] === 'number')
    .map((event) => {
      const value = event.details?.[params.metric] as number;
      const insight = params.birthDate
        ? estimateGrowthPercentile({
            metric: params.metric,
            sex: params.sex,
            value,
            timestamp: event.startTime,
            birthDate: params.birthDate,
            language: params.language,
          })
        : null;

      return {
        timestamp: event.startTime,
        label: formatChartLabel(event.startTime, params.language),
        value,
        percentileLabel: insight?.percentileLabel ?? null,
        interpretation: insight?.interpretation ?? null,
        omsLow: insight
          ? measurementForAge({ metric: params.metric, sex: params.sex, ageDays: insight.ageDays, zScore: OMS_LOW_Z })
          : null,
        omsMedian: insight
          ? measurementForAge({ metric: params.metric, sex: params.sex, ageDays: insight.ageDays, zScore: 0 })
          : null,
        omsHigh: insight
          ? measurementForAge({ metric: params.metric, sex: params.sex, ageDays: insight.ageDays, zScore: OMS_HIGH_Z })
          : null,
      } satisfies ChartPoint;
    });
}

function toTemperatureChartData(events: TrackedEvent[], language: 'fr' | 'en') {
  return events
    .filter((event) => event.type === 'temperature' && typeof event.details?.temperature === 'number')
    .sort((a, b) => a.startTime - b.startTime)
    .map((event) => ({
      timestamp: event.startTime,
      label: formatChartLabel(event.startTime, language),
      value: event.details?.temperature as number,
      interpretation:
        event.details?.temperaturePeriod === 'evening'
          ? language === 'fr' ? 'Mesure du soir.' : 'Evening reading.'
          : language === 'fr' ? 'Mesure du matin.' : 'Morning reading.',
    }));
}

// ─── GrowthScreen ─────────────────────────────────────────────────────────────

export function GrowthScreen() {
  const { theme } = useAppTheme();
  const { t, language } = useI18n();
  const router = useRouter();
  const { currentBaby, events, saving, recordGrowth, isViewer } = useAppContext();
  const [window, setWindow] = useState<ChartWindow>('all');
  const [measureModalVisible, setMeasureModalVisible] = useState(false);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [head, setHead] = useState('');

  const windowOptions: Array<{ value: ChartWindow; label: string }> = [
    { value: '7', label: '7j' },
    { value: '14', label: '14j' },
    { value: 'all', label: t('common.since_start') },
  ];

  const growthEntries = useMemo(
    () => filterRecentEvents(getGrowthEntries(events), window),
    [events, window],
  );
  const temperatureEntries = useMemo(
    () =>
      filterRecentEvents(
        events.filter((e) => e.type === 'temperature').sort((a, b) => a.startTime - b.startTime),
        window,
      ),
    [events, window],
  );

  const birthDate = currentBaby ? parseISO(currentBaby.birthDate) : null;
  const sex = currentBaby?.sex ?? 'boy';

  const weightChart = useMemo(
    () => toGrowthChartData({ events: growthEntries, metric: 'weight', sex, birthDate, language }),
    [birthDate, growthEntries, language, sex],
  );
  const heightChart = useMemo(
    () => toGrowthChartData({ events: growthEntries, metric: 'height', sex, birthDate, language }),
    [birthDate, growthEntries, language, sex],
  );
  const headChart = useMemo(
    () => toGrowthChartData({ events: growthEntries, metric: 'head', sex, birthDate, language }),
    [birthDate, growthEntries, language, sex],
  );
  const temperatureChart = useMemo(
    () => toTemperatureChartData(temperatureEntries, language),
    [language, temperatureEntries],
  );

  const latestWeight      = weightChart.at(-1)?.value;
  const latestHeight      = heightChart.at(-1)?.value;
  const latestHead        = headChart.at(-1)?.value;
  const latestTemperature = temperatureChart.at(-1)?.value;
  const latestGrowthEntry = growthEntries[growthEntries.length - 1];

  const recentMeasurements = useMemo(
    () =>
      [...events]
        .filter((e) => e.type === 'growth' || e.type === 'temperature')
        .sort((a, b) => b.startTime - a.startTime)
        .slice(0, 5),
    [events],
  );

  function closeModal() {
    Keyboard.dismiss();
    setMeasureModalVisible(false);
  }

  const saveMeasure = async () => {
    Keyboard.dismiss();
    const nextWeight = weight ? Number.parseFloat(weight.replace(',', '.')) : undefined;
    const nextHeight = height ? Number.parseFloat(height.replace(',', '.')) : undefined;
    const nextHead   = head   ? Number.parseFloat(head.replace(',', '.'))   : undefined;
    const payload = {
      ...(Number.isFinite(nextWeight) ? { weight: nextWeight } : {}),
      ...(Number.isFinite(nextHeight) ? { height: nextHeight } : {}),
      ...(Number.isFinite(nextHead)   ? { head: nextHead }     : {}),
    };
    if (Object.keys(payload).length === 0) return;
    await recordGrowth(payload);
    setWeight('');
    setHeight('');
    setHead('');
    setMeasureModalVisible(false);
  };

  return (
    <Screen contentContainerStyle={styles.screenContent}>
      <EditorialTopBar />

      {/* Hero */}
      <View style={styles.hero}>
        <Text style={[styles.title, { color: theme.text, fontFamily: theme.fontDisplayItalic }]}>
          {t('growth.title')}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
          {t('growth.subtitle')}
        </Text>
      </View>

      {/* Add measurement CTA */}
      <Card>
        <View style={styles.measureHero}>
          <View style={styles.measureHeroCopy}>
            <Text style={[styles.secondaryTitle, { color: theme.text, fontFamily: theme.fontDisplayItalic }]}>
              {t('growth.new_measure')}
            </Text>
            <Text style={[styles.secondaryBody, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
              {t('growth.measure_modal_body')}
            </Text>
            {latestGrowthEntry ? (
              <Text style={[styles.secondaryMeta, { color: theme.textSoft, fontFamily: theme.fontMedium }]}>
                {t('growth.last_measure', { value: formatDateTime(latestGrowthEntry.startTime) })}
              </Text>
            ) : null}
          </View>
          <AppButton disabled={isViewer} onPress={() => setMeasureModalVisible(true)}>
            {t('growth.add_measure_button')}
          </AppButton>
        </View>
      </Card>

      {/* Summary grid */}
      <View style={styles.summaryGrid}>
        <SummaryCard
          label={t('growth.current_weight')}
          value={typeof latestWeight === 'number' ? `${latestWeight.toFixed(2)} kg` : '—'}
          accent={theme.primary}
        />
        <SummaryCard
          label={t('growth.height')}
          value={typeof latestHeight === 'number' ? `${latestHeight.toFixed(1)} cm` : '—'}
          accent={theme.success}
        />
        <SummaryCard
          label={t('growth.head')}
          value={typeof latestHead === 'number' ? `${latestHead.toFixed(1)} cm` : '—'}
          accent={theme.growth}
        />
        <SummaryCard
          label={t('tracker.temperature')}
          value={typeof latestTemperature === 'number' ? `${latestTemperature.toFixed(1)} °C` : '—'}
          accent={theme.temperature}
        />
      </View>

      {/* Disclaimer card */}
      <Card>
        {/* Non-medical banner */}
        <View style={[styles.disclaimerBanner, { backgroundColor: `${theme.primary}12` }]}>
          <Icon name="information-circle-outline" size={18} color={theme.primary} />
          <Text style={[styles.disclaimerBannerText, { color: theme.primary, fontFamily: theme.fontSemiBold }]}>
            {t('growth.oms')}
          </Text>
        </View>
        <Text style={[styles.secondaryBody, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
          {t('growth.not_medical')}
        </Text>
        <Text style={[styles.secondaryBody, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
          {t('growth.oms_context')}
        </Text>
        <Text style={[styles.secondaryBody, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
          {t('growth.disclaimer_body')}
        </Text>
        <Pressable
          onPress={() => {
            triggerSelectionFeedback();
            void Linking.openURL(WHO_STANDARDS_URL);
          }}
        >
          <Text style={[styles.linkText, { color: theme.primary, fontFamily: theme.fontBold }]}>
            {t('growth.disclaimer_link')} →
          </Text>
        </Pressable>
      </Card>

      {/* Window selector */}
      <View style={styles.selectorRow}>
        {windowOptions.map((opt) => {
          const active = window === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                triggerSelectionFeedback();
                setWindow(opt.value);
              }}
              style={[
                styles.selectorChip,
                { backgroundColor: active ? theme.secondaryContainer : theme.surfaceRaised },
              ]}
            >
              <Text
                style={[
                  styles.selectorLabel,
                  { color: theme.text, fontFamily: active ? theme.fontBold : theme.fontMedium },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Charts */}
      <MeasurementChart
        title={t('growth.weight_curve')}
        unit="kg"
        color={theme.primary}
        data={weightChart}
        showOms
        emptyMessage={t('growth.empty_chart')}
      />
      <MeasurementChart
        title={t('growth.height_curve')}
        unit="cm"
        color={theme.success}
        data={heightChart}
        showOms
        emptyMessage={t('growth.empty_chart')}
      />
      <MeasurementChart
        title={t('growth.head_curve')}
        unit="cm"
        color={theme.growth}
        data={headChart}
        showOms
        emptyMessage={t('growth.empty_chart')}
      />
      <MeasurementChart
        title={t('growth.temperature_curve')}
        unit="°C"
        color={theme.temperature}
        data={temperatureChart}
        showOms={false}
        emptyMessage={t('growth.empty_chart')}
      />

      {/* Recent measurements */}
      <View style={styles.historySection}>
        <View style={styles.historyHeader}>
          <Text style={[styles.historyHeading, { color: theme.text, fontFamily: theme.fontLight }]}>
            {t('growth.recent_measurements')}
          </Text>
          <Pressable
            onPress={() => {
              triggerSelectionFeedback();
              router.push('/(app)/(tabs)/history');
            }}
          >
            <Text style={[styles.historyLink, { color: theme.primary, fontFamily: theme.fontBold }]}>
              {t('common.view_all')}
            </Text>
          </Pressable>
        </View>

        <View style={styles.historyList}>
          {recentMeasurements.map((entry) => {
            const title =
              entry.type === 'temperature' ? t('tracker.temperature') : t('growth.new_measure');
            const body =
              entry.type === 'temperature'
                ? `${entry.details?.temperature?.toFixed(1) ?? '—'} °C`
                : [
                    typeof entry.details?.weight === 'number'
                      ? `${entry.details.weight.toFixed(2)} kg`
                      : null,
                    typeof entry.details?.height === 'number'
                      ? `${entry.details.height.toFixed(1)} cm`
                      : null,
                    typeof entry.details?.head === 'number'
                      ? `${entry.details.head.toFixed(1)} cm`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ');
            const icon =
              entry.type === 'temperature' ? 'thermometer-outline' : 'analytics-outline';

            return (
              <View key={entry.id} style={styles.historyRow}>
                <View
                  style={[
                    styles.historyDot,
                    { backgroundColor: theme.surfaceLowest, shadowColor: theme.shadow },
                  ]}
                >
                  <Icon
                    name={icon}
                    size={18}
                    color={entry.type === 'temperature' ? theme.temperature : theme.primary}
                  />
                </View>
                <View style={styles.historyCopy}>
                  <View style={styles.historyTitleRow}>
                    <Text
                      style={[styles.historyTitle, { color: theme.text, fontFamily: theme.fontBold }]}
                    >
                      {title}
                    </Text>
                    <Text
                      style={[
                        styles.historyTime,
                        { color: theme.textSoft, fontFamily: theme.fontMedium },
                      ]}
                    >
                      {formatDateTime(entry.startTime)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.historyBody,
                      { color: theme.textMuted, fontFamily: theme.fontRegular },
                    ]}
                  >
                    {body || '—'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* ── Measure modal ── */}
      <Modal
        transparent
        animationType="fade"
        visible={measureModalVisible}
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalKeyboardWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalOverlay} onPress={closeModal}>
            <Pressable
              style={[
                styles.modalCard,
                { backgroundColor: theme.surfaceLowest, shadowColor: theme.shadow },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <Text
                style={[styles.secondaryTitle, { color: theme.text, fontFamily: theme.fontDisplayItalic }]}
              >
                {t('growth.new_measure')}
              </Text>
              <Text
                style={[
                  styles.secondaryBody,
                  { color: theme.textMuted, fontFamily: theme.fontRegular },
                ]}
              >
                {t('growth.measure_modal_body')}
              </Text>

              <AppInput
                label={t('growth.weight_label')}
                value={weight}
                onChangeText={setWeight}
                placeholder="4.62"
                keyboardType="decimal-pad"
                returnKeyType="done"
                blurOnSubmit
              />
              <AppInput
                label={t('growth.height_label')}
                value={height}
                onChangeText={setHeight}
                placeholder="56.3"
                keyboardType="decimal-pad"
                returnKeyType="done"
                blurOnSubmit
              />
              <AppInput
                label={t('growth.head_label')}
                value={head}
                onChangeText={setHead}
                placeholder="38.4"
                keyboardType="decimal-pad"
                returnKeyType="done"
                blurOnSubmit
              />

              <View style={styles.modalActions}>
                <AppButton style={styles.modalButton} variant="secondary" onPress={closeModal}>
                  {t('common.cancel')}
                </AppButton>
                <AppButton
                  style={styles.modalButton}
                  disabled={saving || (!weight && !height && !head)}
                  onPress={() => void saveMeasure()}
                >
                  {t('growth.save_measure')}
                </AppButton>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: spacing.xxl * 3,
  },
  hero: {
    gap: spacing.xs,
  },
  title: {
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  measureHero: {
    gap: spacing.md,
  },
  measureHeroCopy: {
    gap: spacing.sm,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryCard: {
    width: '47.5%',
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  summaryLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryValue: {
    fontSize: 22,
  },
  secondaryTitle: {
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.4,
  },
  secondaryBody: {
    fontSize: 14,
    lineHeight: 22,
  },
  secondaryMeta: {
    fontSize: 12,
  },
  linkText: {
    fontSize: 13,
  },
  disclaimerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  disclaimerBannerText: {
    fontSize: 13,
  },
  selectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  selectorChip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectorLabel: {
    fontSize: 12,
  },
  // ── Chart ──
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  chartHeaderLeft: {
    flex: 1,
    gap: 4,
  },
  chartTitle: {
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.4,
  },
  chartMeta: {
    fontSize: 12,
  },
  chartBadge: {
    minWidth: 44,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  chartBadgeText: {
    fontSize: 12,
  },
  pointInsight: {
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  pointInsightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pointInsightValue: {
    fontSize: 18,
  },
  pointInsightDate: {
    fontSize: 12,
  },
  pointInsightBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 22,
  },
  // ── History ──
  historySection: {
    gap: spacing.md,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyHeading: {
    fontSize: 20,
  },
  historyLink: {
    fontSize: 12,
  },
  historyList: {
    gap: spacing.lg,
  },
  historyRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  historyDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  historyCopy: {
    flex: 1,
    gap: 6,
  },
  historyTitleRow: {
    gap: spacing.sm,
  },
  historyTitle: {
    fontSize: 16,
  },
  historyTime: {
    fontSize: 12,
  },
  historyBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  // ── Modal ──
  modalKeyboardWrap: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
});
