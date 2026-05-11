import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { radii, spacing } from '@/src/constants/theme';
import { useAppTheme } from '@/src/providers/ThemeProvider';
import { triggerSelectionFeedback } from '@/src/lib/feedback';

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PAD = ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

interface WheelProps {
  items: number[];
  value: number;
  onChange: (next: number) => void;
  format?: (n: number) => string;
  ariaLabel?: string;
}

/**
 * Single vertical wheel. Uses a snapping ScrollView so the work happens
 * on the platform's scroll engine (smooth on iOS Safari + react-native).
 * The middle slot is the selected value; the centre row is highlighted by
 * the parent so a row of wheels reads as one unit.
 */
function Wheel({ items, value, onChange, format, ariaLabel }: WheelProps) {
  const { theme } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const lastIndexRef = useRef(items.indexOf(value));
  const [highlightIndex, setHighlightIndex] = useState<number>(items.indexOf(value));

  // When the parent's value changes (e.g. modal opens with a new
  // pre-selected time, or hours wraps midnight), snap to the new row
  // without animating — animation here would race the user's scroll.
  useEffect(() => {
    const idx = items.indexOf(value);
    if (idx < 0) return;
    if (idx !== lastIndexRef.current) {
      lastIndexRef.current = idx;
      setHighlightIndex(idx);
      scrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
    }
  }, [value, items]);

  // Initial position. Effect-only so the ScrollView has been laid out
  // (otherwise scrollTo is a no-op on first paint in react-native-web).
  useEffect(() => {
    const idx = Math.max(0, items.indexOf(value));
    scrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
    // We intentionally only run this once on mount — subsequent value
    // syncs are handled by the effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM_HEIGHT)));
    if (idx !== highlightIndex) {
      setHighlightIndex(idx);
      triggerSelectionFeedback();
    }
  };

  const commit = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM_HEIGHT)));
    const next = items[idx];
    if (next !== value) {
      lastIndexRef.current = idx;
      onChange(next);
    }
  };

  // Tapping a row scrolls to it — gives users a tap-to-pick alternative
  // to scrolling, which matters on desktop browsers where touch-scrolling
  // a 40px row is fiddly with a trackpad.
  const tap = (idx: number) => {
    triggerSelectionFeedback();
    scrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: true });
    setHighlightIndex(idx);
    const next = items[idx];
    if (next !== value) {
      lastIndexRef.current = idx;
      onChange(next);
    }
  };

  return (
    <View style={styles.wheel} accessibilityLabel={ariaLabel}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        // 16ms ~ 60fps; cheap because we only set state when the index
        // crosses a row boundary.
        scrollEventThrottle={16}
        onScroll={onScroll}
        onMomentumScrollEnd={commit}
        // On the web, onMomentumScrollEnd may not fire reliably for short
        // drags — fall back on onScrollEndDrag so the final value still
        // commits.
        onScrollEndDrag={commit}
        contentContainerStyle={styles.wheelContent}
      >
        {items.map((item, idx) => {
          const distance = Math.abs(idx - highlightIndex);
          const opacity = distance === 0 ? 1 : distance === 1 ? 0.5 : 0.25;
          const fontSize = distance === 0 ? 24 : distance === 1 ? 20 : 18;
          return (
            <Pressable
              key={item}
              style={styles.wheelRow}
              onPress={() => tap(idx)}
            >
              <Text
                style={[
                  styles.wheelText,
                  {
                    color: theme.text,
                    fontFamily: distance === 0 ? theme.fontDisplayItalic : theme.fontMedium,
                    opacity,
                    fontSize,
                  },
                ]}
              >
                {format ? format(item) : item}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

interface Props {
  value: Date;
  onChange: (next: Date) => void;
  minuteStep?: number;
  style?: StyleProp<ViewStyle>;
  /** Localised label for the modal title — defaults to French. */
  title?: string;
  /** Localised label for the confirm button — defaults to French. */
  confirmLabel?: string;
  /** Localised label for the cancel button. */
  cancelLabel?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

/**
 * iOS-style scrolling time picker.
 *
 * Renders a compact trigger pill showing the current `HH:MM`. Tapping it
 * opens a modal sheet with two vertical wheels (hours + minutes) you can
 * spin to set the time. The previous +/- stepper was painful for nudging
 * minutes far from the current value (50 taps to go from :05 to :55) —
 * this replaces it.
 *
 * The committed value is only pushed up on confirm, so casually opening
 * the modal and dismissing it won't change anything.
 */
export function WheelTimePicker({
  value,
  onChange,
  minuteStep = 1,
  style,
  title,
  confirmLabel,
  cancelLabel,
}: Props) {
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(false);

  // The wheels operate on a draft copy of the current value so the user
  // can cancel without mutating the parent. We seed it from `value` each
  // time the modal opens.
  const [draftHour, setDraftHour] = useState<number>(value.getHours());
  const [draftMinute, setDraftMinute] = useState<number>(value.getMinutes());

  const minutes = useMemo(() => {
    const step = Math.max(1, Math.min(30, minuteStep));
    const list: number[] = [];
    for (let m = 0; m < 60; m += step) list.push(m);
    return list;
  }, [minuteStep]);

  const snapMinuteToStep = (m: number): number => {
    // If minuteStep is e.g. 5 and the saved value is 03, the wheel can't
    // show 03 — snap to the nearest valid increment instead of falling
    // off the wheel.
    if (minutes.includes(m)) return m;
    let best = minutes[0];
    let bestDiff = Math.abs(best - m);
    for (const candidate of minutes) {
      const diff = Math.abs(candidate - m);
      if (diff < bestDiff) {
        best = candidate;
        bestDiff = diff;
      }
    }
    return best;
  };

  const openSheet = () => {
    setDraftHour(value.getHours());
    setDraftMinute(snapMinuteToStep(value.getMinutes()));
    setOpen(true);
  };

  const confirm = () => {
    const next = new Date(value);
    next.setHours(draftHour, draftMinute, 0, 0);
    onChange(next);
    setOpen(false);
  };

  const cancel = () => setOpen(false);

  return (
    <View style={style}>
      <Pressable
        onPress={openSheet}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: theme.surfaceContainerHigh,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text style={[styles.triggerText, { color: theme.text, fontFamily: theme.fontDisplayItalic }]}>
          {`${pad2(value.getHours())}:${pad2(value.getMinutes())}`}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={cancel}>
        <BlurView
          intensity={theme.isDark ? 28 : 36}
          tint={theme.isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <Pressable style={styles.backdrop} onPress={cancel}>
          <Pressable
            // Stop the inner card from triggering the backdrop's onPress.
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.sheet,
              {
                backgroundColor: theme.surfaceLowest,
                borderColor: theme.cardBorder,
                shadowColor: theme.shadow,
              },
            ]}
          >
            {title ? (
              <Text style={[styles.sheetTitle, { color: theme.text, fontFamily: theme.fontSemiBold }]}>
                {title}
              </Text>
            ) : null}

            <View style={styles.wheelsRow}>
              {/* Centre highlight band — spans behind both wheels so the
                  middle row of HH and MM reads as a single chip. */}
              <View
                pointerEvents="none"
                style={[
                  styles.highlight,
                  {
                    backgroundColor: `${theme.primary}14`,
                    borderColor: `${theme.primary}33`,
                  },
                ]}
              />
              <Wheel
                items={HOURS}
                value={draftHour}
                onChange={setDraftHour}
                format={pad2}
                ariaLabel="Heures"
              />
              <Text
                style={[styles.colon, { color: theme.textSoft, fontFamily: theme.fontDisplayItalic }]}
                pointerEvents="none"
              >
                :
              </Text>
              <Wheel
                items={minutes}
                value={draftMinute}
                onChange={setDraftMinute}
                format={pad2}
                ariaLabel="Minutes"
              />
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                onPress={cancel}
                style={({ pressed }) => [
                  styles.action,
                  styles.actionSecondary,
                  {
                    backgroundColor: theme.surfaceContainer,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={[styles.actionLabel, { color: theme.text, fontFamily: theme.fontSemiBold }]}>
                  {cancelLabel ?? 'Annuler'}
                </Text>
              </Pressable>
              <Pressable
                onPress={confirm}
                style={({ pressed }) => [
                  styles.action,
                  {
                    backgroundColor: theme.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={[styles.actionLabel, { color: theme.onPrimary, fontFamily: theme.fontSemiBold }]}>
                  {confirmLabel ?? 'Confirmer'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    alignSelf: 'flex-start',
  },
  triggerText: {
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.4,
    minWidth: 56,
    textAlign: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 14, 16, 0.32)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  sheet: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 360,
  },
  sheetTitle: {
    fontSize: 18,
    textAlign: 'center',
  },
  wheelsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    position: 'relative',
    height: WHEEL_HEIGHT,
  },
  wheel: {
    height: WHEEL_HEIGHT,
    width: 84,
    overflow: 'hidden',
    // The wheel only scrolls vertically — make that explicit so trackpad
    // users on desktop don't accidentally trigger the modal's parent
    // scroll.
    // @ts-expect-error web-only prop
    overscrollBehavior: 'contain',
  },
  wheelContent: {
    paddingVertical: PAD,
  },
  wheelRow: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelText: {
    lineHeight: 28,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  highlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: PAD,
    height: ITEM_HEIGHT,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  colon: {
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.4,
    paddingHorizontal: 2,
    // Pinned vertically with the wheels' centre row.
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  action: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  actionSecondary: {
    // Subtler than the primary CTA; keeps focus on Confirmer.
  },
  actionLabel: {
    fontSize: 15,
  },
});
