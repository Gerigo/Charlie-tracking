import React, { useState } from 'react';
import { Modal, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { DayPicker } from 'react-day-picker';
import { fr as dateFnsFr } from 'date-fns/locale';
import { format } from 'date-fns';
import { useAppTheme } from '@/src/providers/ThemeProvider';
import { radii, spacing } from '@/src/constants/theme';
import { TimeStepper } from '@/src/components/ui/TimeStepper';
import 'react-day-picker/style.css';

type Mode = 'date' | 'time' | 'datetime';

interface Props {
  value: Date;
  mode?: Mode;
  minimumDate?: Date;
  maximumDate?: Date;
  onChange: (event: { type: string }, date?: Date) => void;
  style?: StyleProp<ViewStyle>;
  textColor?: string;
  accentColor?: string;
  // Accepted but ignored on web (kept for API compatibility with @react-native-community/datetimepicker)
  display?: string;
  themeVariant?: 'dark' | 'light';
  locale?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export default function PlatformDateTimePicker({
  value,
  mode = 'date',
  minimumDate,
  maximumDate,
  onChange,
  style,
  textColor,
  accentColor,
}: Props) {
  const { theme } = useAppTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  const resolvedColor = textColor ?? theme.text;
  const resolvedAccent = accentColor ?? theme.primary;

  // ── Time mode → editorial stepper ──
  if (mode === 'time') {
    return (
      <View style={style}>
        <TimeStepper
          value={value}
          onChange={(next) => onChange({ type: 'set' }, next)}
        />
      </View>
    );
  }

  // ── Date / Datetime → custom modal calendar ──
  const labelText = format(value, mode === 'datetime' ? "d MMMM yyyy 'à' HH:mm" : 'd MMMM yyyy', { locale: dateFnsFr });

  return (
    <View style={style}>
      <Pressable
        onPress={() => setPickerOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: theme.surfaceContainerHigh,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text style={[styles.triggerLabel, { color: resolvedColor, fontFamily: theme.fontMedium }]}>
          {labelText}
        </Text>
      </Pressable>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <BlurView
          intensity={theme.isDark ? 28 : 36}
          tint={theme.isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.calendarCard,
              {
                backgroundColor: theme.surfaceLowest,
                borderColor: theme.cardBorder,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <DayPicker
              mode="single"
              selected={value}
              onSelect={(d) => {
                if (!d) return;
                const next = new Date(value);
                next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                onChange({ type: 'set' }, next);
                setPickerOpen(false);
              }}
              startMonth={minimumDate}
              endMonth={maximumDate}
              disabled={[
                ...(minimumDate ? [{ before: minimumDate }] : []),
                ...(maximumDate ? [{ after: maximumDate }] : []),
              ]}
              locale={dateFnsFr}
              showOutsideDays
              styles={{
                root: {
                  '--rdp-accent-color': resolvedAccent,
                  '--rdp-accent-background-color': `${resolvedAccent}26`,
                  '--rdp-background-color': theme.surfaceLowest,
                  fontFamily: theme.fontMedium,
                  color: resolvedColor,
                  margin: 0,
                  padding: spacing.sm,
                } as React.CSSProperties,
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  triggerLabel: {
    fontSize: 15,
    letterSpacing: -0.1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 14, 16, 0.32)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  calendarCard: {
    borderRadius: radii.xl,
    padding: spacing.sm,
    borderWidth: 1,
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
});
