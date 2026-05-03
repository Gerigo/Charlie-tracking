import { useEffect, useRef } from 'react';
import { Animated, Easing, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '@/src/providers/ThemeProvider';

interface Props {
  width?: DimensionValue;
  height?: number | DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Pulsing placeholder block — use to compose loading skeletons.
 * Pulses opacity 0.45 ↔ 0.85 over 1.6s, sinusoidal so it feels alive,
 * not robotic.
 */
export function Skeleton({ width = '100%', height = 14, borderRadius = 8, style }: Props) {
  const { theme } = useAppTheme();
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.surfaceContainerHigh,
          opacity,
        },
        style,
      ]}
    />
  );
}
