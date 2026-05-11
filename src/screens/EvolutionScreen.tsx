import { Icon } from '@/src/components/ui/Icon';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { EditorialTopBar } from '@/src/components/editorial/TopBar';
import { AppButton, Card, EmptyState, Screen } from '@/src/components/ui';
import { radii, spacing } from '@/src/constants/theme';
import { useI18n } from '@/src/hooks/useI18n';
import { triggerSelectionFeedback } from '@/src/lib/feedback';
import { useAppContext } from '@/src/providers/AppProvider';
import { useAppTheme } from '@/src/providers/ThemeProvider';
import { formatDateTime } from '@/src/utils/date';
import { buildDashboardData } from '@/src/utils/dashboardAnalytics';
import { buildTrendLabData, selectTrendHours, type TrendRange } from '@/src/utils/trendLabAnalytics';

type DailyWindow = '7' | '14' | 'all';

const CHART_HEIGHT = 250;
const PADDING = { left: 36, right: 16, top: 28, bottom: 54 };
const BUBBLE_H = 20;
const BUBBLE_R = 10;

function formatAverageSleep(minutesPerDay: number) {
  const roundedMinutes = Math.round(minutesPerDay);
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${String(minutes).padStart(2, '0')}`;
}

function formatAverageMeals(mealsPerDay: number) {
  const rounded = Number(mealsPerDay.toFixed(1));
  return Number.isInteger(rounded) ? `${rounded}` : `${String(rounded).replace('.', ',')}`;
}

function sliceRecentDays<T extends { date: string }>(items: T[], window: DailyWindow) {
  if (window === 'all') return items;
  return items.slice(-(window === '7' ? 7 : 14));
}

function buildLinePoints(values: number[], width: number, maxValue: number, minValue = 0) {
  const domain = maxValue - minValue || 1;
  return values.map((value, index) => {
    const x = PADDING.left + (index / Math.max(values.length - 1, 1)) * (width - PADDING.left - PADDING.right);
    const y = PADDING.top + (1 - (value - minValue) / domain) * (CHART_HEIGHT - PADDING.top - PADDING.bottom);
    return { x, y };
  });
}

function createPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function SummaryInsightCard({
  icon,
  title,
  value,
  caption,
  accent,
}: {
  icon: string;
  title: string;
  value: string;
  caption: string;
  accent: string;
}) {
  const { theme } = useAppTheme();
  return (
    <Card>
      <View style={styles.summaryInsightHeader}>
        <View style={[styles.summaryInsightIcon, { backgroundColor: `${accent}14` }]}>
          <Icon name={icon} size={18} color={accent} />
        </View>
        <View style={styles.summaryInsightCopy}>
          <Text style={[styles.summaryInsightTitle, { color: theme.textSoft, fontFamily: theme.fontBold }]}>{title}</Text>
          <Text style={[styles.summaryInsightValue, { color: theme.text, fontFamily: theme.fontBold }]}>{value}</Text>
          <Text style={[styles.summaryInsightCaption, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>{caption}</Text>
        </View>
      </View>
    </Card>
  );
}

function LineChartCard({
  title,
  color,
  data,
  suffix = '',
}: {
  title: string;
  color: string;
  data: Array<{ date: string; value: number }>;
  suffix?: string;
}) {
  const { theme } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  // Lazy init only — once the user has clicked a point we never want
  // to reset that choice from a parent re-render. We just clamp the
  // selection to the current range below so the chart never reads
  // out-of-bounds when the data set shrinks.
  const [rawSelectedIndex, setSelectedIndex] = useState(() => Math.max(data.length - 1, 0));

  const width = Math.max(280, screenWidth - 84);
  const values = data.map((entry) => entry.value);
  const maxValue = Math.max(...values, 1);
  const points = buildLinePoints(values, width, maxValue, 0);
  const selectedIndex = Math.min(Math.max(rawSelectedIndex, 0), Math.max(data.length - 1, 0));
  const selected = data[selectedIndex] ?? data[data.length - 1];
  const selectedPoint = points[selectedIndex] ?? points[points.length - 1];

  // Per-point hit zones rendered as real React Native Pressables
  // overlaid on the SVG via absolute positioning. SVG-level onPress
  // (via react-native-svg <Rect>) proved unreliable on react-native-web
  // — even with a non-zero fill opacity, taps sometimes never reached
  // the Rect because a sibling visual element above it captured the
  // pointer. A real Pressable on a real View can't lose the click.
  const hitZones = points.map((point, index) => {
    const prevMid = index === 0 ? PADDING.left : (points[index - 1].x + point.x) / 2;
    const nextMid =
      index === points.length - 1 ? width - PADDING.right : (point.x + points[index + 1].x) / 2;
    return { x: prevMid, width: Math.max(1, nextMid - prevMid) };
  });

  // value bubble position — clamp so it stays inside chart
  const bubbleW = Math.max(46, `${selected?.value.toFixed(1)}${suffix}`.length * 8 + 16);
  const bubbleX = selectedPoint
    ? Math.min(Math.max(selectedPoint.x, PADDING.left + bubbleW / 2), width - PADDING.right - bubbleW / 2)
    : PADDING.left + bubbleW / 2;
  const bubbleY = selectedPoint ? Math.max(PADDING.top, selectedPoint.y - BUBBLE_H - 8) : PADDING.top;

  return (
    <Card>
      <Text style={[styles.cardTitle, { color: theme.text, fontFamily: theme.fontDisplayItalic, marginBottom: spacing.sm }]}>{title}</Text>
      <View style={{ width, height: CHART_HEIGHT, position: 'relative' }}>
      <Svg width={width} height={CHART_HEIGHT}>
        {/* Y-axis grid lines + labels */}
        {[0, 1, 2, 3].map((step) => {
          const value = Number((maxValue * (step / 3)).toFixed(1));
          const y = PADDING.top + (1 - step / 3) * (CHART_HEIGHT - PADDING.top - PADDING.bottom);
          return (
            <Fragment key={value}>
              <Line x1={PADDING.left} y1={y} x2={width - PADDING.right} y2={y} stroke={theme.hairline} strokeDasharray="4 4" />
              <SvgText x={PADDING.left - 4} y={y + 4} fill={theme.textMuted} fontSize="10" textAnchor="end">
                {`${value}${suffix}`}
              </SvgText>
            </Fragment>
          );
        })}

        {/* Selected vertical ruler */}
        {selectedPoint ? (
          <Line
            x1={selectedPoint.x} y1={PADDING.top}
            x2={selectedPoint.x} y2={CHART_HEIGHT - PADDING.bottom}
            stroke={`${color}28`} strokeWidth={2}
          />
        ) : null}

        {/* Line */}
        <Path d={createPath(points)} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />

        {/* Dots — visual only */}
        {points.map((point, index) => (
          <Circle
            key={`dot-${data[index]?.date}-${index}`}
            cx={point.x} cy={point.y}
            r={index === selectedIndex ? 6 : 3.5}
            fill={index === selectedIndex ? color : `${color}99`}
            stroke={theme.surfaceLowest}
            strokeWidth={index === selectedIndex ? 2.5 : 1.5}
          />
        ))}

        {/* Value bubble on selected point */}
        {selectedPoint && selected ? (
          <>
            <Rect
              x={bubbleX - bubbleW / 2} y={bubbleY}
              width={bubbleW} height={BUBBLE_H}
              rx={BUBBLE_R} fill={color}
            />
            <SvgText
              x={bubbleX} y={bubbleY + BUBBLE_H - 6}
              fill="#ffffff" fontSize="11" textAnchor="middle" fontWeight="bold"
            >
              {`${selected.value.toFixed(1)}${suffix}`}
            </SvgText>
          </>
        ) : null}

        {/* X-axis labels — all shown, rotated */}
        {data.map((entry, index) => {
          const x = points[index]?.x ?? PADDING.left;
          const yLabel = CHART_HEIGHT - PADDING.bottom + 14;
          return (
            <SvgText
              key={`${entry.date}-label`}
              x={x} y={yLabel}
              fill={index === selectedIndex ? color : theme.textSoft}
              fontSize="10"
              textAnchor="end"
              fontWeight={index === selectedIndex ? 'bold' : 'normal'}
              transform={`rotate(-40, ${x}, ${yLabel})`}
            >
              {entry.date}
            </SvgText>
          );
        })}

      </Svg>
      {/* Per-point Pressable overlays — see comment near `hitZones`
          above. */}
      {hitZones.map((zone, index) => (
        <Pressable
          key={`hit-${index}`}
          onPress={() => setSelectedIndex(index)}
          style={{
            position: 'absolute',
            left: zone.x,
            top: PADDING.top,
            width: zone.width,
            height: CHART_HEIGHT - PADDING.top - PADDING.bottom,
          }}
        />
      ))}
      </View>
    </Card>
  );
}

function BarChartCard({
  title,
  color,
  data,
}: {
  title: string;
  color: string;
  data: Array<{ date: string; value: number }>;
}) {
  const { theme } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  // Lazy init only — keep the user's choice across parent re-renders.
  const [rawSelectedIndex, setSelectedIndex] = useState(() => Math.max(data.length - 1, 0));

  const width = Math.max(280, screenWidth - 84);
  const innerWidth = width - PADDING.left - PADDING.right;
  const maxValue = Math.max(...data.map((entry) => entry.value), 1);
  const availableHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  // Dynamic bar width: generous for few bars, narrower for many
  const gap = innerWidth / Math.max(data.length, 1);
  const barWidth = Math.min(28, Math.max(10, gap * 0.58));
  const selectedIndex = Math.min(Math.max(rawSelectedIndex, 0), Math.max(data.length - 1, 0));

  return (
    <Card>
      <Text style={[styles.cardTitle, { color: theme.text, fontFamily: theme.fontDisplayItalic, marginBottom: spacing.sm }]}>{title}</Text>
      <View style={{ width, height: CHART_HEIGHT, position: 'relative' }}>
      <Svg width={width} height={CHART_HEIGHT}>
        {/* Y-axis grid lines (3 levels) */}
        {[0, 1, 2, 3].map((step) => {
          const value = Math.round(maxValue * (step / 3));
          const y = PADDING.top + (1 - step / 3) * availableHeight;
          return (
            <Fragment key={`grid-${step}`}>
              <Line x1={PADDING.left} y1={y} x2={width - PADDING.right} y2={y} stroke={theme.hairline} strokeDasharray="4 3" />
              <SvgText x={PADDING.left - 4} y={y + 4} fill={theme.textMuted} fontSize="10" textAnchor="end">
                {String(value)}
              </SvgText>
            </Fragment>
          );
        })}

        {/* Pass 1 — visual elements (bars + labels) */}
        {data.map((entry, index) => {
          const xCenter = PADDING.left + index * gap + gap / 2;
          const xBar = xCenter - barWidth / 2;
          const barH = Math.max(4, (entry.value / maxValue) * availableHeight);
          const yBar = CHART_HEIGHT - PADDING.bottom - barH;
          const active = index === selectedIndex;
          const yLabel = CHART_HEIGHT - PADDING.bottom + 14;

          return (
            <Fragment key={`vis-${entry.date}-${index}`}>
              {/* Bar */}
              <Rect
                x={xBar} y={yBar}
                width={barWidth} height={barH}
                rx={Math.min(8, barWidth / 2)}
                fill={active ? color : `${color}66`}
              />
              {/* Value label above bar */}
              <SvgText
                x={xCenter} y={yBar - 5}
                fill={active ? color : theme.textSoft}
                fontSize={active ? '12' : '10'}
                textAnchor="middle"
                fontWeight={active ? 'bold' : 'normal'}
              >
                {String(entry.value)}
              </SvgText>
              {/* X-axis date label — rotated */}
              <SvgText
                x={xCenter} y={yLabel}
                fill={active ? color : theme.textSoft}
                fontSize="10"
                textAnchor="end"
                fontWeight={active ? 'bold' : 'normal'}
                transform={`rotate(-40, ${xCenter}, ${yLabel})`}
              >
                {entry.date}
              </SvgText>
            </Fragment>
          );
        })}

      </Svg>
      {/* Per-bar Pressable overlays — see LineChartCard for the rationale. */}
      {data.map((_, index) => (
        <Pressable
          key={`hit-${index}`}
          onPress={() => setSelectedIndex(index)}
          style={{
            position: 'absolute',
            left: PADDING.left + index * gap,
            top: PADDING.top,
            width: Math.max(1, gap),
            height: CHART_HEIGHT - PADDING.top - PADDING.bottom,
          }}
        />
      ))}
      </View>
    </Card>
  );
}

function TemperatureChartCard({
  title,
  data,
}: {
  title: string;
  data: Array<{ date: string; morning: number | null; evening: number | null }>;
}) {
  const { theme } = useAppTheme();
  const { t } = useI18n();
  const { width: screenWidth } = useWindowDimensions();
  // Lazy init only — same rationale as the sister chart cards.
  const [rawSelectedIndex, setSelectedIndex] = useState(() => Math.max(data.length - 1, 0));

  const width = Math.max(280, screenWidth - 84);
  const allValues = data.flatMap((entry) => [entry.morning, entry.evening]).filter((value): value is number => typeof value === 'number');
  const maxValue = Math.max(...allValues, 38);
  const minValue = Math.min(...allValues, 35);
  const morningValues = data.map((entry) => entry.morning ?? minValue);
  const eveningValues = data.map((entry) => entry.evening ?? minValue);
  const morningPoints = buildLinePoints(morningValues, width, maxValue, minValue);
  const eveningPoints = buildLinePoints(eveningValues, width, maxValue, minValue);
  const selectedIndex = Math.min(Math.max(rawSelectedIndex, 0), Math.max(data.length - 1, 0));
  const selected = data[selectedIndex] ?? data[data.length - 1];
  const pathFor = (points: Array<{ x: number; y: number }>, key: 'morning' | 'evening') =>
    points.reduce((path, point, index) => {
      const value = data[index]?.[key];
      if (typeof value !== 'number') return path;
      return `${path} ${path ? 'L' : 'M'} ${point.x} ${point.y}`.trim();
    }, '');

  // For bubble positions — selected morning/evening
  const selMorningPt = morningPoints[selectedIndex];
  const selEveningPt = eveningPoints[selectedIndex];

  // Per-day hit zones (see LineChartCard). Morning and evening dots
  // share the same column → one Rect per day is enough.
  const hitZones = morningPoints.map((point, index) => {
    const prevMid = index === 0 ? PADDING.left : (morningPoints[index - 1].x + point.x) / 2;
    const nextMid =
      index === morningPoints.length - 1
        ? width - PADDING.right
        : (point.x + morningPoints[index + 1].x) / 2;
    return { x: prevMid, width: Math.max(1, nextMid - prevMid) };
  });

  return (
    <Card>
      <Text style={[styles.cardTitle, { color: theme.text, fontFamily: theme.fontDisplayItalic, marginBottom: spacing.sm }]}>{title}</Text>
      <View style={{ width, height: CHART_HEIGHT, position: 'relative' }}>
      <Svg width={width} height={CHART_HEIGHT}>
          {[0, 1, 2, 3].map((step) => {
            const value = Number((minValue + ((maxValue - minValue) * step) / 3).toFixed(1));
            const y = PADDING.top + (1 - step / 3) * (CHART_HEIGHT - PADDING.top - PADDING.bottom);
            return (
              <Fragment key={value}>
                <Line x1={PADDING.left} y1={y} x2={width - PADDING.right} y2={y} stroke={theme.hairline} strokeDasharray="4 4" />
                <SvgText x={PADDING.left - 4} y={y + 4} fill={theme.textMuted} fontSize="10" textAnchor="end">
                  {`${value}°`}
                </SvgText>
              </Fragment>
            );
          })}

          {/* Selected vertical ruler */}
          {selMorningPt ? (
            <Line
              x1={selMorningPt.x} y1={PADDING.top}
              x2={selMorningPt.x} y2={CHART_HEIGHT - PADDING.bottom}
              stroke={`${theme.temperature}28`} strokeWidth={2}
            />
          ) : null}

          <Path d={pathFor(morningPoints, 'morning')} stroke={theme.warning} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d={pathFor(eveningPoints, 'evening')} stroke={theme.danger} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />

          {/* Value bubbles on selected points */}
          {selMorningPt && typeof selected?.morning === 'number' ? (
            <>
              <Rect
                x={Math.min(Math.max(selMorningPt.x - 22, PADDING.left), width - PADDING.right - 44)}
                y={Math.max(PADDING.top, selMorningPt.y - BUBBLE_H - 8)}
                width={44} height={BUBBLE_H} rx={BUBBLE_R} fill={theme.warning}
              />
              <SvgText
                x={Math.min(Math.max(selMorningPt.x, PADDING.left + 22), width - PADDING.right - 22)}
                y={Math.max(PADDING.top, selMorningPt.y - BUBBLE_H - 8) + BUBBLE_H - 6}
                fill="#ffffff" fontSize="11" textAnchor="middle" fontWeight="bold"
              >{`${selected.morning.toFixed(1)}°`}</SvgText>
            </>
          ) : null}
          {selEveningPt && typeof selected?.evening === 'number' ? (
            <>
              <Rect
                x={Math.min(Math.max(selEveningPt.x - 22, PADDING.left), width - PADDING.right - 44)}
                y={Math.max(PADDING.top, selEveningPt.y - BUBBLE_H - 8)}
                width={44} height={BUBBLE_H} rx={BUBBLE_R} fill={theme.danger}
              />
              <SvgText
                x={Math.min(Math.max(selEveningPt.x, PADDING.left + 22), width - PADDING.right - 22)}
                y={Math.max(PADDING.top, selEveningPt.y - BUBBLE_H - 8) + BUBBLE_H - 6}
                fill="#ffffff" fontSize="11" textAnchor="middle" fontWeight="bold"
              >{`${selected.evening.toFixed(1)}°`}</SvgText>
            </>
          ) : null}

          {/* X-axis labels — all shown, rotated */}
          {data.map((entry, index) => {
            const x = morningPoints[index]?.x ?? PADDING.left;
            const yLabel = CHART_HEIGHT - PADDING.bottom + 14;
            return (
              <SvgText
                key={`${entry.date}-label`}
                x={x} y={yLabel}
                fill={index === selectedIndex ? theme.temperature : theme.textSoft}
                fontSize="10"
                textAnchor="end"
                fontWeight={index === selectedIndex ? 'bold' : 'normal'}
                transform={`rotate(-40, ${x}, ${yLabel})`}
              >
                {entry.date}
              </SvgText>
            );
          })}

          {/* Visual dots — morning */}
          {data.map((entry, index) =>
            typeof entry.morning === 'number' ? (
              <Circle
                key={`morning-dot-${index}`}
                cx={morningPoints[index]?.x ?? 0}
                cy={morningPoints[index]?.y ?? 0}
                r={selectedIndex === index ? 6 : 3.5}
                fill={selectedIndex === index ? theme.warning : `${theme.warning}99`}
                stroke={theme.surfaceLowest}
                strokeWidth={selectedIndex === index ? 2.5 : 1.5}
              />
            ) : null
          )}

          {/* Visual dots — evening */}
          {data.map((entry, index) =>
            typeof entry.evening === 'number' ? (
              <Circle
                key={`evening-dot-${index}`}
                cx={eveningPoints[index]?.x ?? 0}
                cy={eveningPoints[index]?.y ?? 0}
                r={selectedIndex === index ? 6 : 3.5}
                fill={selectedIndex === index ? theme.danger : `${theme.danger}99`}
                stroke={theme.surfaceLowest}
                strokeWidth={selectedIndex === index ? 2.5 : 1.5}
              />
            ) : null
          )}

      </Svg>
      {/* Per-day Pressable overlays (see LineChartCard). */}
      {hitZones.map((zone, index) => (
        <Pressable
          key={`hit-${index}`}
          onPress={() => setSelectedIndex(index)}
          style={{
            position: 'absolute',
            left: zone.x,
            top: PADDING.top,
            width: zone.width,
            height: CHART_HEIGHT - PADDING.top - PADDING.bottom,
          }}
        />
      ))}
      </View>
      {selected ? (
        <View style={styles.temperatureLegendRow}>
          <Text style={[styles.temperatureLegendText, { color: theme.textMuted, fontFamily: theme.fontMedium }]}>
            {selected.date}
          </Text>
          <Text style={[styles.temperatureLegendText, { color: theme.warning, fontFamily: theme.fontBold }]}>
            {languageLabel('morning', selected.morning)}
          </Text>
          <Text style={[styles.temperatureLegendText, { color: theme.danger, fontFamily: theme.fontBold }]}>
            {languageLabel('evening', selected.evening)}
          </Text>
        </View>
      ) : null}
    </Card>
  );

  function languageLabel(period: 'morning' | 'evening', value: number | null) {
    const periodLabel = period === 'morning' ? t('common.morning') : t('common.evening');
    return `${periodLabel} · ${typeof value === 'number' ? `${value.toFixed(1)}°C` : '—'}`;
  }
}

function HourlyTrendCard({ hour, sleep, awake, meal }: { hour: string; sleep: number; awake: number; meal: number }) {
  const { theme } = useAppTheme();
  const lines = [
    { key: 'sleep', value: sleep, color: theme.sleep, icon: 'moon-outline' as const },
    { key: 'awake', value: awake, color: theme.today, icon: 'sunny-outline' as const },
    { key: 'meal',  value: meal,  color: theme.feed,  icon: 'restaurant-outline' as const },
  ];
  const dominantValue = Math.max(sleep, awake, meal);
  return (
    <View style={[styles.trendCard, { backgroundColor: theme.surfaceLowest }]}>
      <Text style={[styles.trendHour, { color: theme.text, fontFamily: theme.fontBold }]}>{hour}</Text>
      {lines.map((line) => (
        <View key={line.key} style={[styles.trendLine, { opacity: line.value === dominantValue ? 1 : 0.62 }]}>
          <Icon name={line.icon} size={13} color={line.color} />
          <View style={[styles.trendTrack, { backgroundColor: theme.surfaceContainerHigh }]}>
            <View style={[styles.trendFill, { width: `${line.value}%`, backgroundColor: line.color, height: line.value === dominantValue ? 10 : 8 }]} />
          </View>
          <Text style={[styles.trendValue, { color: line.value === dominantValue ? line.color : theme.textMuted, fontFamily: line.value === dominantValue ? theme.fontBold : theme.fontMedium }]}>
            {line.value}%
          </Text>
        </View>
      ))}
    </View>
  );
}

const HMAP_ROW_H = 28;
const HMAP_ROW_GAP = 5;
const HMAP_LABEL_H = 18;
const HMAP_ICON_W = 26;

type TrendPoint = {
  label: string;
  smoothedSleepProbability: number;
  smoothedAwakeProbability: number;
  mealProbability: number;
};

/** Each row has its own threshold — multiple can be active simultaneously. */
const THRESHOLDS: Record<string, number> = { sleep: 50, awake: 30, meal: 35 };

function isRowActive(rowKey: string, val: number): boolean {
  return val >= (THRESHOLDS[rowKey] ?? 50);
}

/** Active = vivid; below threshold = faint but not invisible. */
function cellOpacity(active: boolean, val: number): number {
  if (active) return Math.max(0.70, val / 100);
  return Math.max(0.08, (val / 100) * 0.30);
}

function TrendHeatmap({
  points,
  trendRange,
  onRangeChange,
  rangeOptions,
}: {
  points: TrendPoint[];
  trendRange: TrendRange;
  onRangeChange: (r: TrendRange) => void;
  rangeOptions: Array<{ label: string; value: TrendRange }>;
}) {
  const { theme } = useAppTheme();
  const { t } = useI18n();
  const { width: screenWidth } = useWindowDimensions();
  const [detailVisible, setDetailVisible] = useState(false);

  const totalW = Math.max(280, screenWidth - 84);
  const hmapW = totalW - HMAP_ICON_W;
  const numPoints = Math.max(points.length, 1);
  const cellW = hmapW / numPoints;
  const totalRowH = HMAP_ROW_H + HMAP_ROW_GAP;
  const svgHeight = 3 * totalRowH - HMAP_ROW_GAP + HMAP_LABEL_H;
  const labelStride = Math.max(1, Math.ceil(numPoints / 8));

  const rows = [
    { key: 'sleep', color: theme.sleep, icon: 'moon-outline' as const, get: (p: TrendPoint) => p.smoothedSleepProbability },
    { key: 'awake', color: theme.today, icon: 'sunny-outline' as const, get: (p: TrendPoint) => p.smoothedAwakeProbability },
    { key: 'meal',  color: theme.feed,  icon: 'restaurant-outline' as const, get: (p: TrendPoint) => p.mealProbability },
  ];

  return (
    <Card>
      {/* Title */}
      <Text style={[styles.cardTitle, { color: theme.text, fontFamily: theme.fontDisplayItalic, marginBottom: 6 }]}>
        {t('evolution.trend_title')}
      </Text>
      {/* Range chips — below title, smaller */}
      <View style={styles.trendRangeRow}>
        {rangeOptions.map((opt) => {
          const active = trendRange === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => { triggerSelectionFeedback(); onRangeChange(opt.value); }}
              style={[styles.trendRangeChip, { backgroundColor: active ? theme.secondaryContainer : theme.surfaceRaised }]}
            >
              <Text style={[styles.trendRangeLabel, { color: theme.text, fontFamily: active ? theme.fontBold : theme.fontMedium }]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Icon column (pixel-aligned with SVG rows) + heatmap */}
      <View style={styles.hmapRow}>
        <View style={styles.hmapIconCol}>
          {rows.map((row, i) => (
            <View
              key={row.key}
              style={[styles.hmapIconCell, { height: HMAP_ROW_H, marginBottom: i < rows.length - 1 ? HMAP_ROW_GAP : 0 }]}
            >
              <Icon name={row.icon} size={15} color={row.color} />
            </View>
          ))}
        </View>

        <Svg width={hmapW} height={svgHeight}>
          {rows.map((row, rowIndex) => {
            const y = rowIndex * totalRowH;
            return (
              <Fragment key={row.key}>
                {points.map((pt, colIndex) => {
                  const val = row.get(pt);
                  const active = isRowActive(row.key, val);
                  const opacity = cellOpacity(active, val);
                  const cx = colIndex * cellW + 1;
                  const cw = Math.max(cellW - 2, 1);

                  return (
                    <Fragment key={`${row.key}-${colIndex}`}>
                      {/* Background track — grid always readable */}
                      <Rect x={cx} y={y} width={cw} height={HMAP_ROW_H} rx={4}
                        fill={row.color} fillOpacity={0.10} />
                      {/* Data layer */}
                      <Rect x={cx} y={y} width={cw} height={HMAP_ROW_H} rx={4}
                        fill={row.color} fillOpacity={opacity}
                        stroke={active ? 'rgba(255,255,255,0.30)' : 'none'}
                        strokeWidth={active ? 1.5 : 0}
                      />
                    </Fragment>
                  );
                })}
              </Fragment>
            );
          })}

          {/* Hour labels */}
          {points.map((pt, index) => {
            if (index % labelStride !== 0 && index !== points.length - 1) return null;
            const x = (index + 0.5) * cellW;
            return (
              <SvgText key={`hl-${index}`} x={x} y={svgHeight - 3} fill={theme.textMuted} fontSize="9" textAnchor="middle">
                {pt.label}
              </SvgText>
            );
          })}
        </Svg>
      </View>

      {/* Vue détaillée button */}
      <AppButton
        variant="secondary"
        style={styles.detailButton}
        onPress={() => setDetailVisible(true)}
      >
        {t('evolution.detail_view')}
      </AppButton>

      {/* Modal — full detailed hourly grid */}
      <Modal
        visible={detailVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailVisible(false)}
      >
        <View style={[styles.detailModal, { backgroundColor: theme.surfaceLowest }]}>
          {/* Header */}
          <View style={[styles.detailModalHeader, { borderBottomColor: theme.hairline }]}>
            <Text style={[styles.detailModalTitle, { color: theme.text, fontFamily: theme.fontSemiBold }]}>
              {t('evolution.trend_title')}
            </Text>
            <Pressable onPress={() => setDetailVisible(false)} style={styles.detailModalClose}>
              <Icon name="close" size={22} color={theme.textSoft} />
            </Pressable>
          </View>
          {/* Scrollable grid */}
          <ScrollView contentContainerStyle={styles.detailGrid}>
            {points.map((point) => (
              <HourlyTrendCard
                key={point.label}
                hour={point.label}
                sleep={point.smoothedSleepProbability}
                awake={point.smoothedAwakeProbability}
                meal={point.mealProbability}
              />
            ))}
          </ScrollView>
        </View>
      </Modal>
    </Card>
  );
}

export function EvolutionScreen() {
  const { theme } = useAppTheme();
  const { t } = useI18n();
  const { events, loadFullHistory } = useAppContext();
  const [dailyWindow, setDailyWindow] = useState<DailyWindow>('7');
  const [trendRange, setTrendRange] = useState<TrendRange>('all');

  // Évolution computes lifetime aggregates → pull older events on mount.
  useEffect(() => {
    void loadFullHistory();
  }, [loadFullHistory]);

  const dailyWindowOptions: Array<{ label: string; value: DailyWindow }> = [
    { label: '7j', value: '7' },
    { label: '14j', value: '14' },
    { label: t('evolution.window_all'), value: 'all' },
  ];

  const trendRangeOptions: Array<{ label: string; value: TrendRange }> = [
    { label: t('evolution.all_day'), value: 'all' },
    { label: t('evolution.day'), value: 'day' },
    { label: t('evolution.night'), value: 'night' },
  ];

  const dashboardData = useMemo(() => buildDashboardData(events), [events]);
  const trendData = useMemo(() => buildTrendLabData(events), [events]);

  const visibleSleepByDay = sliceRecentDays(dashboardData.sleepByDay, dailyWindow);
  const visibleMealsByDay = sliceRecentDays(dashboardData.mealsByDay, dailyWindow);
  const visiblePumpingByDay = sliceRecentDays(dashboardData.pumpingByDay, dailyWindow);
  const visibleTemperatureByDay = sliceRecentDays(dashboardData.temperatureByDay, dailyWindow);
  const visibleTrendPoints = trendData.overview ? selectTrendHours(trendData.overview.points, trendRange) : [];

  if (!dashboardData.overview && !trendData.overview && visibleTemperatureByDay.length === 0) {
    return (
      <Screen topBar={<EditorialTopBar />}>
        <EmptyState title={t('evolution.title')} body={t('evolution.no_data')} />
      </Screen>
    );
  }

  return (
    <Screen topBar={<EditorialTopBar />}>
      <View style={styles.hero}>
        <Text style={[styles.title, { color: theme.text, fontFamily: theme.fontDisplayItalic }]}>{t('evolution.title')}</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>{t('evolution.subtitle')}</Text>
      </View>

      {/* Period selector — controls all daily charts */}
      <View style={styles.selectorBar}>
        {dailyWindowOptions.map((option) => {
          const selected = dailyWindow === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => { triggerSelectionFeedback(); setDailyWindow(option.value); }}
              style={[styles.selectorChip, { backgroundColor: selected ? theme.secondaryContainer : theme.surfaceRaised }]}
            >
              <Text style={[styles.selectorLabel, { color: theme.text, fontFamily: selected ? theme.fontBold : theme.fontMedium }]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {dashboardData.overview ? (
        <View style={styles.summaryStack}>
          <SummaryInsightCard
            icon="moon-outline"
            title={t('evolution.avg_sleep')}
            value={`${formatAverageSleep(dashboardData.overview.averageSleepMinutesPerDay)}/j`}
            caption={t('evolution.avg_sleep_body')}
            accent={theme.sleep}
          />
          <SummaryInsightCard
            icon="water-outline"
            title={t('evolution.avg_meals')}
            value={`${formatAverageMeals(dashboardData.overview.averageMealsPerDay)}/j`}
            caption={t('evolution.avg_meals_body')}
            accent={theme.feed}
          />
        </View>
      ) : null}

      {trendData.overview && visibleTrendPoints.length > 0 ? (
        <TrendHeatmap
          points={visibleTrendPoints}
          trendRange={trendRange}
          onRangeChange={setTrendRange}
          rangeOptions={trendRangeOptions}
        />
      ) : null}

      {visibleSleepByDay.length > 0 ? (
        <LineChartCard
          title={t('evolution.sleep_day')}
          color={theme.sleep}
          data={visibleSleepByDay.map((entry) => ({ date: entry.date, value: entry.sleepHours }))}
          suffix="h"
        />
      ) : null}

      {visibleMealsByDay.length > 0 ? (
        <BarChartCard
          title={t('evolution.meals_day')}
          color={theme.feed}
          data={visibleMealsByDay.map((entry) => ({ date: entry.date, value: entry.mealCount }))}
        />
      ) : null}

      {visiblePumpingByDay.some((entry) => entry.volumeMl > 0) ? (
        <BarChartCard
          title={t('evolution.pumping_day')}
          color={theme.primary}
          data={visiblePumpingByDay.map((entry) => ({ date: entry.date, value: entry.volumeMl }))}
        />
      ) : null}

      {visibleTemperatureByDay.length > 0 ? (
        <TemperatureChartCard title={t('evolution.temperature_day')} data={visibleTemperatureByDay} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.xs,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  summaryStack: {
    gap: spacing.sm,
  },
  summaryInsightHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  summaryInsightIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryInsightCopy: {
    flex: 1,
    gap: 4,
  },
  summaryInsightTitle: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryInsightValue: {
    fontSize: 24,
  },
  summaryInsightCaption: {
    fontSize: 13,
    lineHeight: 20,
  },
  cardTitle: {
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.4,
  },
  trendRangeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  trendRangeChip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  trendRangeLabel: {
    fontSize: 11,
  },
  selectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectorDivider: {
    width: 1,
    height: 18,
    borderRadius: 1,
    marginHorizontal: 2,
  },
  selectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  detailButton: {
    marginTop: spacing.sm,
  },
  detailModal: {
    flex: 1,
  },
  detailModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailModalTitle: {
    fontSize: 17,
  },
  detailModalClose: {
    padding: spacing.sm,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.lg,
    alignItems: 'stretch',
  },
  trendCard: {
    width: '48%',
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  trendHour: {
    fontSize: 15,
  },
  trendLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  trendTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  trendFill: {
    height: '100%',
    borderRadius: 999,
  },
  trendValue: {
    width: 34,
    textAlign: 'right',
    fontSize: 11,
  },
  hmapRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  hmapIconCol: {
    width: HMAP_ICON_W,
    alignItems: 'center',
  },
  hmapIconCell: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectorChip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectorLabel: {
    fontSize: 12,
  },
  temperatureLegendRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  temperatureLegendText: {
    fontSize: 13,
  },
});
