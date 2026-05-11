import { useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { radii } from '@/src/constants/theme';
import { useAppTheme } from '@/src/providers/ThemeProvider';
import { triggerSelectionFeedback } from '@/src/lib/feedback';

const ITEM_HEIGHT = 36;
const VISIBLE_ITEMS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PAD = ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);
// Web-only hint: prevent the document from scrolling when the user spins
// the wheel inside a modal/form. RN's `overscrollBehavior: 'contain'`
// translates to the CSS property on react-native-web.
const WEB_TOUCH_STYLE: StyleProp<ViewStyle> = Platform.OS === 'web'
  ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ overscrollBehavior: 'contain', touchAction: 'pan-y' } as any)
  : null;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

interface WheelProps {
  items: number[];
  value: number;
  onChange: (next: number) => void;
  ariaLabel?: string;
}

/**
 * Single vertical wheel. Mirrors iOS' UIDatePicker spinner column:
 *   - The middle row is always the selected value.
 *   - Scrolling snaps to row boundaries; releasing commits to the
 *     nearest row.
 *   - Above/below rows fade out so the wheel reads as a 3-D drum.
 *
 * The wheel is fully inline — no modal, no confirm step. The value is
 * pushed to the parent as soon as a row settles under the centre line,
 * which is the iOS-native feel the spinner is mimicking.
 */
function Wheel({ items, value, onChange, ariaLabel }: WheelProps) {
  const { theme } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const lastIndexRef = useRef(items.indexOf(value));
  const [highlightIndex, setHighlightIndex] = useState<number>(items.indexOf(value));

  // When the parent's `value` changes externally (e.g. hour wraps past
  // midnight, or the form is re-seeded from a Date prop), snap to that
  // row without animating so we don't fight the user mid-scroll.
  useEffect(() => {
    const idx = items.indexOf(value);
    if (idx < 0) return;
    if (idx !== lastIndexRef.current) {
      lastIndexRef.current = idx;
      setHighlightIndex(idx);
      scrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
    }
  }, [value, items]);

  // Initial position. Must be in an effect — on first render the
  // ScrollView hasn't been laid out yet, so scrollTo is a no-op.
  useEffect(() => {
    const idx = Math.max(0, items.indexOf(value));
    scrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
    // Run once on mount — subsequent syncs handled by the effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const indexFromOffset = (y: number) => {
    return Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM_HEIGHT)));
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = indexFromOffset(e.nativeEvent.contentOffset.y);
    if (idx === highlightIndex) return;
    setHighlightIndex(idx);
    triggerSelectionFeedback();
    // Commit immediately as soon as a new row crosses the centre line.
    // react-native-web's `onMomentumScrollEnd` is unreliable for short
    // flicks and never fires when the user reaches the target value
    // mid-scroll. Commit-on-scroll matches the iOS-native behaviour
    // ("the value under the centre is the value") and removes the need
    // for any confirm tap.
    const next = items[idx];
    if (next !== value) {
      lastIndexRef.current = idx;
      onChange(next);
    }
  };

  // Tap-to-pick — affordance for desktop users who can't easily scroll
  // a 36 px row with a trackpad. Animated so the wheel "rolls" into
  // place.
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
        // 16ms ≈ 60 fps; commit runs cheaply (one Date allocation +
        // setState) so this throttle is comfortable on any device.
        scrollEventThrottle={16}
        onScroll={onScroll}
        contentContainerStyle={styles.wheelContent}
        style={WEB_TOUCH_STYLE}
      >
        {items.map((item, idx) => {
          const distance = Math.abs(idx - highlightIndex);
          // 3-D drum effect: rows further from centre fade and shrink
          // slightly. Keeps the focal row visually dominant.
          const opacity = distance === 0 ? 1 : distance === 1 ? 0.55 : 0.3;
          const fontSize = distance === 0 ? 22 : distance === 1 ? 18 : 16;
          return (
            <Pressable key={item} style={styles.wheelRow} onPress={() => tap(idx)}>
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
                {pad2(item)}
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
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

/**
 * Inline iOS-style scrolling time picker.
 *
 * Replaces the previous +/- stepper, which was painful for nudging
 * minutes far from the current value (50 taps to go from :05 to :55).
 * Two wheels (hours + minutes) sit directly in the form — no modal, no
 * confirm step. Spinning a wheel commits the new value the moment it
 * settles under the centre line, mirroring iOS' UIDatePicker spinner.
 */
export function WheelTimePicker({ value, onChange, minuteStep = 1, style }: Props) {
  const { theme } = useAppTheme();

  const minutes = useMemo(() => {
    const step = Math.max(1, Math.min(30, minuteStep));
    const list: number[] = [];
    for (let m = 0; m < 60; m += step) list.push(m);
    return list;
  }, [minuteStep]);

  // Snap an arbitrary minute value to the nearest legal step. Without
  // this, a wheel with minuteStep=5 receiving a value of :03 would not
  // find :03 in its list and would default to :00.
  const snapMinute = (m: number): number => {
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

  const currentHour = value.getHours();
  const currentMinute = snapMinute(value.getMinutes());

  const handleHourChange = (next: number) => {
    const updated = new Date(value);
    updated.setHours(next, currentMinute, 0, 0);
    onChange(updated);
  };

  const handleMinuteChange = (next: number) => {
    const updated = new Date(value);
    updated.setHours(currentHour, next, 0, 0);
    onChange(updated);
  };

  return (
    <View style={[styles.row, style]}>
      {/* Centre highlight band — spans both wheels so the selected row
          reads as a single chip. Lives behind the wheels (no
          pointerEvents) so it doesn't intercept scroll gestures. */}
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
        value={currentHour}
        onChange={handleHourChange}
        ariaLabel="Heures"
      />
      <Text
        pointerEvents="none"
        style={[styles.colon, { color: theme.textSoft, fontFamily: theme.fontDisplayItalic }]}
      >
        :
      </Text>
      <Wheel
        items={minutes}
        value={currentMinute}
        onChange={handleMinuteChange}
        ariaLabel="Minutes"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: WHEEL_HEIGHT,
    gap: 4,
    position: 'relative',
    alignSelf: 'flex-start',
  },
  wheel: {
    height: WHEEL_HEIGHT,
    width: 64,
    overflow: 'hidden',
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
    lineHeight: 26,
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
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.4,
    paddingHorizontal: 2,
  },
});
