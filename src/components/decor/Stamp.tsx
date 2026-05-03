import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/src/providers/ThemeProvider';

/**
 * Pill stamp in Fraunces italic, usually pinned to the top of a card and
 * rotated a few degrees to feel hand-applied. Use sparingly — stamps work
 * best as a single accent per card.
 */
export function Stamp({
  label,
  color,
  borderColor,
  background,
  rotate = '4deg',
}: {
  label: string;
  /** Text + border colour. Defaults to theme.primary. */
  color?: string;
  borderColor?: string;
  /** Surface behind the text. Defaults to theme.surfaceLowest. */
  background?: string;
  rotate?: string;
}) {
  const { theme } = useAppTheme();
  const tint = color ?? theme.primary;
  const bg = background ?? theme.surfaceLowest;
  return (
    <View
      style={[
        styles.stamp,
        {
          borderColor: borderColor ?? tint,
          backgroundColor: bg,
          transform: [{ rotate }],
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: tint, fontFamily: theme.fontDisplayItalic },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stamp: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1.5,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
});
