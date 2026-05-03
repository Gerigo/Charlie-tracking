import { View } from 'react-native';
import { useAppTheme } from '@/src/providers/ThemeProvider';

/**
 * Dashed horizontal rule — replaces solid `Divider()` when we want the
 * hand-drawn-feel of a notebook page break. Falls back to the theme's
 * `cardBorder` colour by default.
 */
export function DashedDivider({
  color,
  marginVertical = 4,
}: {
  color?: string;
  marginVertical?: number;
}) {
  const { theme } = useAppTheme();
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderStyle: 'dashed',
        borderColor: color ?? theme.cardBorder,
        marginVertical,
      }}
    />
  );
}
