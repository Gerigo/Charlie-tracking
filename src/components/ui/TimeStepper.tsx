import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon } from '@/src/components/ui/Icon';
import { useAppTheme } from '@/src/providers/ThemeProvider';
import { triggerSelectionFeedback } from '@/src/lib/feedback';

interface Props {
  value: Date;
  onChange: (next: Date) => void;
  style?: StyleProp<ViewStyle>;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function bumpHour(date: Date, delta: number): Date {
  const next = new Date(date);
  next.setHours((next.getHours() + delta + 24) % 24, next.getMinutes(), 0, 0);
  return next;
}

function bumpMinute(date: Date, delta: number): Date {
  const next = new Date(date);
  // Round to the nearest 5-minute step for ergonomics, then bump
  const baseMinutes = Math.round(next.getMinutes() / 5) * 5;
  const totalMinutes = baseMinutes + delta * 5;
  next.setHours(next.getHours() + Math.floor(totalMinutes / 60));
  next.setMinutes(((totalMinutes % 60) + 60) % 60, 0, 0);
  return next;
}

/**
 * Editorial time stepper — replaces the native HTML `<input type="time">` which
 * looks alien on the web. Two columns (HH and MM) each with up/down chevrons.
 * Minutes step in 5-minute increments by default for fast input.
 */
export function TimeStepper({ value, onChange, style }: Props) {
  const { theme } = useAppTheme();

  const stepperBtn = (
    direction: 'up' | 'down',
    onPress: () => void,
  ) => (
    <Pressable
      onPress={() => {
        triggerSelectionFeedback();
        onPress();
      }}
      style={({ pressed }) => [
        styles.bump,
        {
          backgroundColor: pressed ? `${theme.primary}1F` : 'transparent',
        },
      ]}
    >
      <Icon
        name={direction === 'up' ? 'add' : 'remove-circle-outline'}
        size={14}
        color={theme.textSoft}
      />
    </Pressable>
  );

  return (
    <View style={[styles.wrap, { backgroundColor: theme.surfaceContainerHigh }, style]}>
      <View style={styles.column}>
        {stepperBtn('up', () => onChange(bumpHour(value, 1)))}
        <Text style={[styles.value, { color: theme.text, fontFamily: theme.fontDisplayItalic }]}>
          {pad(value.getHours())}
        </Text>
        {stepperBtn('down', () => onChange(bumpHour(value, -1)))}
      </View>
      <Text style={[styles.colon, { color: theme.textSoft, fontFamily: theme.fontDisplayItalic }]}>
        :
      </Text>
      <View style={styles.column}>
        {stepperBtn('up', () => onChange(bumpMinute(value, 1)))}
        <Text style={[styles.value, { color: theme.text, fontFamily: theme.fontDisplayItalic }]}>
          {pad(value.getMinutes())}
        </Text>
        {stepperBtn('down', () => onChange(bumpMinute(value, -1)))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    alignSelf: 'flex-start',
    gap: 4,
  },
  column: {
    alignItems: 'center',
    gap: 0,
  },
  bump: {
    width: 28,
    height: 22,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.4,
    minWidth: 32,
    textAlign: 'center',
  },
  colon: {
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.4,
    paddingHorizontal: 4,
  },
});
