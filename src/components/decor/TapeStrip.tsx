import { View, type DimensionValue } from 'react-native';

/**
 * Masking tape strip — a translucent coloured rectangle, usually rotated a
 * few degrees, decorating corners of journal-style cards. Pairs with the
 * `Wash` atom to build the "Carnet d'aquarelle" identity.
 */
export function TapeStrip({
  color,
  width,
  height = 22,
  rotate = '-6deg',
  opacity = 0.55,
  top,
  left,
  right,
  bottom,
}: {
  color: string;
  width: number;
  height?: number;
  /** CSS rotate value, e.g. "-8deg" or "4deg". */
  rotate?: string;
  opacity?: number;
  top?: DimensionValue;
  left?: DimensionValue;
  right?: DimensionValue;
  bottom?: DimensionValue;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width,
        height,
        backgroundColor: color,
        opacity,
        transform: [{ rotate }],
        top,
        left,
        right,
        bottom,
      }}
    />
  );
}
