import { View, type DimensionValue } from 'react-native';

/**
 * Watercolour wash — a soft pigmented circle with low opacity, intended to
 * sit absolutely positioned behind content as decorative atmosphere.
 *
 * Use multiple Washes layered (rose · sage · ochre) to mimic wet pigment
 * blooming on cream paper. Keep them outside content flow with `pointerEvents`.
 */
export function Wash({
  color,
  size,
  top,
  left,
  right,
  bottom,
  opacity = 0.30,
}: {
  color: string;
  size: number;
  top?: DimensionValue;
  left?: DimensionValue;
  right?: DimensionValue;
  bottom?: DimensionValue;
  opacity?: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        top,
        left,
        right,
        bottom,
      }}
    />
  );
}
