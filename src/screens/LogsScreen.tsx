import { Icon } from '@/src/components/ui/Icon';
import { useEffect, useReducer, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { spacing, radii } from '@/src/constants/theme';
import { useAppTheme } from '@/src/providers/ThemeProvider';
import { logger, logBuffer, subscribeToLogBuffer, type LogEntry, type LogLevel } from '@/src/utils/logger';

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<LogLevel, { color: string; bg: string; label: string; icon: string }> = {
  debug: { color: '#8B9CB6', bg: '#8B9CB615', label: 'DEBUG', icon: 'bug-outline' },
  info:  { color: '#4A90D9', bg: '#4A90D915', label: 'INFO',  icon: 'information-circle-outline' },
  warn:  { color: '#E0A040', bg: '#E0A04015', label: 'WARN',  icon: 'warning-outline' },
  error: { color: '#D95B5B', bg: '#D95B5B15', label: 'ERROR', icon: 'alert-circle-outline' },
};

const FILTERS: Array<{ key: LogLevel | 'all'; label: string }> = [
  { key: 'all',   label: 'Tous' },
  { key: 'error', label: 'Erreur' },
  { key: 'warn',  label: 'Avert.' },
  { key: 'info',  label: 'Info' },
  { key: 'debug', label: 'Debug' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  const d = new Date(ts);
  const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  return `${date} ${time}`;
}

function entryToText(e: LogEntry): string {
  const lines = [
    `[${e.level.toUpperCase()}][${e.context}] ${formatTime(e.timestamp)}`,
    e.message,
    e.data ? `Data: ${JSON.stringify(e.data, null, 2)}` : null,
    e.errorDetails ? `Error: ${e.errorDetails}` : null,
  ];
  return lines.filter(Boolean).join('\n');
}

// ─── LogRow ───────────────────────────────────────────────────────────────────

function LogRow({ entry }: { entry: LogEntry }) {
  const { theme } = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const cfg = LEVEL_CONFIG[entry.level];
  const hasExtra = !!(entry.data || entry.errorDetails);

  return (
    <Pressable
      onPress={() => hasExtra && setExpanded((v) => !v)}
      style={[styles.row, { backgroundColor: cfg.bg, borderLeftColor: cfg.color }]}
    >
      <View style={styles.rowHeader}>
        {/* Level badge */}
        <View style={[styles.badge, { backgroundColor: `${cfg.color}22` }]}>
          <Text style={[styles.badgeText, { color: cfg.color, fontFamily: theme.fontBold }]}>
            {cfg.label}
          </Text>
        </View>
        {/* Context */}
        <Text style={[styles.context, { color: theme.textMuted, fontFamily: theme.fontMedium }]}>
          {entry.context}
        </Text>
        {/* Time */}
        <Text style={[styles.time, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
          {formatTime(entry.timestamp)}
        </Text>
        {/* Expand indicator */}
        {hasExtra ? (
          <Icon
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={theme.textMuted}
          />
        ) : null}
      </View>

      {/* Message */}
      <Text style={[styles.message, { color: theme.text, fontFamily: theme.fontRegular }]}>
        {entry.message}
      </Text>

      {/* Expanded details */}
      {expanded ? (
        <View style={styles.expandedBlock}>
          {entry.data ? (
            <Text style={[styles.code, { color: theme.textSoft, fontFamily: 'monospace' }]}>
              {JSON.stringify(entry.data, null, 2)}
            </Text>
          ) : null}
          {entry.errorDetails ? (
            <Text style={[styles.code, { color: LEVEL_CONFIG.error.color, fontFamily: 'monospace' }]}>
              {entry.errorDetails}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

// ─── LogsScreen ───────────────────────────────────────────────────────────────

export function LogsScreen() {
  const { theme } = useAppTheme();
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  // Force re-render when buffer updates
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);

  useEffect(() => subscribeToLogBuffer(forceUpdate), []);

  const entries = filter === 'all'
    ? logBuffer
    : logBuffer.filter((e) => e.level === filter);

  const counts = logBuffer.reduce(
    (acc, e) => { acc[e.level] = (acc[e.level] ?? 0) + 1; return acc; },
    {} as Record<LogLevel, number>,
  );

  async function shareAll() {
    const text = entries.map(entryToText).join('\n\n---\n\n');
    await Share.share({ message: text, title: 'Luna — Logs' });
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surfaceLowest }]}>
      {/* Stats bar */}
      <View style={[styles.statsBar, { backgroundColor: theme.surfaceRaised }]}>
        {(['error', 'warn', 'info', 'debug'] as LogLevel[]).map((level) => {
          const cfg = LEVEL_CONFIG[level];
          const count = counts[level] ?? 0;
          return (
            <View key={level} style={styles.statItem}>
              <Text style={[styles.statCount, { color: count > 0 ? cfg.color : theme.textMuted, fontFamily: theme.fontBold }]}>
                {count}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
                {cfg.label}
              </Text>
            </View>
          );
        })}
        <View style={styles.statSpacer} />
        <Pressable onPress={shareAll} style={styles.actionBtn}>
          <Icon name="share-outline" size={18} color={theme.textSoft} />
        </Pressable>
        <Pressable
          onPress={() => { logger.clearBuffer(); }}
          style={styles.actionBtn}
        >
          <Icon name="trash-outline" size={18} color={LEVEL_CONFIG.error.color} />
        </Pressable>
      </View>

      {/* Filter chips */}
      <View style={[styles.filterBar, { borderBottomColor: theme.hairline }]}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const cfg = f.key !== 'all' ? LEVEL_CONFIG[f.key as LogLevel] : null;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active
                    ? (cfg ? `${cfg.color}22` : theme.secondaryContainer)
                    : theme.surfaceRaised,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterLabel,
                  {
                    color: active ? (cfg?.color ?? theme.text) : theme.textSoft,
                    fontFamily: active ? theme.fontBold : theme.fontMedium,
                  },
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Entries */}
      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="document-text-outline" size={32} color={theme.textMuted} />
          <Text style={[styles.emptyText, { color: theme.textMuted, fontFamily: theme.fontRegular }]}>
            Aucun log pour ce filtre
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {entries.map((entry) => (
            <LogRow key={entry.id} entry={entry} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statCount: {
    fontSize: 16,
  },
  statLabel: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statSpacer: {
    flex: 1,
  },
  actionBtn: {
    padding: spacing.sm,
  },
  filterBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterChip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  filterLabel: {
    fontSize: 11,
  },
  list: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  row: {
    borderLeftWidth: 3,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badge: {
    borderRadius: radii.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 9,
    letterSpacing: 0.5,
  },
  context: {
    fontSize: 11,
    flex: 1,
  },
  time: {
    fontSize: 10,
  },
  message: {
    fontSize: 12,
    lineHeight: 17,
  },
  expandedBlock: {
    marginTop: 4,
    gap: 4,
  },
  code: {
    fontSize: 10,
    lineHeight: 15,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
  },
});
