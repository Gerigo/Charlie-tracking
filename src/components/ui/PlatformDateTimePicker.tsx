import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

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

function dateToInputValue(d: Date, mode: Mode): string {
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  if (mode === 'date') return `${y}-${m}-${dd}`;
  if (mode === 'time') return `${hh}:${mm}`;
  return `${y}-${m}-${dd}T${hh}:${mm}`;
}

function inputValueToDate(value: string, mode: Mode, base: Date): Date | null {
  if (!value) return null;
  if (mode === 'time') {
    const [hh, mm] = value.split(':').map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    const d = new Date(base);
    d.setHours(hh, mm, 0, 0);
    return d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function PlatformDateTimePicker({
  value,
  mode = 'date',
  minimumDate,
  maximumDate,
  onChange,
  style,
  textColor,
  themeVariant,
}: Props) {
  const inputType = mode === 'date' ? 'date' : mode === 'time' ? 'time' : 'datetime-local';

  const inputElement = React.createElement('input', {
    type: inputType,
    value: dateToInputValue(value, mode),
    min: minimumDate ? dateToInputValue(minimumDate, mode) : undefined,
    max: maximumDate ? dateToInputValue(maximumDate, mode) : undefined,
    onChange: (event: { target: { value: string } }) => {
      const next = inputValueToDate(event.target.value, mode, value);
      onChange({ type: 'set' }, next ?? undefined);
    },
    style: {
      fontFamily: 'inherit',
      fontSize: 16,
      padding: '6px 8px',
      borderRadius: 8,
      border: '1px solid rgba(127,127,127,0.3)',
      backgroundColor: 'transparent',
      color: textColor ?? 'inherit',
      colorScheme: themeVariant ?? 'normal',
      outline: 'none',
    },
  });

  return <View style={style}>{inputElement}</View>;
}
