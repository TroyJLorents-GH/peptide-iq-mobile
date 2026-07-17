import { type ReactNode, useState } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { View } from '../tw';

let gradientId = 0;

interface GradientViewProps {
  colors: string[];
  /** Gradient direction, 0–1 coordinate space. Default: top-left → bottom-right. */
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  className?: string;
  children?: ReactNode;
}

/**
 * Linear-gradient background using react-native-svg (no native gradient module
 * needed). Fills its own bounds; children render on top.
 */
export default function GradientView({
  colors,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
  borderRadius = 0,
  style,
  className,
  children,
}: GradientViewProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [id] = useState(() => `grad${gradientId++}`);

  return (
    <View
      className={className}
      style={style}
      onLayout={e => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size.w > 0 && size.h > 0 ? (
        <Svg width={size.w} height={size.h} style={{ position: 'absolute', top: 0, left: 0 }}>
          <Defs>
            <LinearGradient id={id} x1={start.x} y1={start.y} x2={end.x} y2={end.y}>
              {colors.map((c, i) => (
                <Stop key={i} offset={colors.length === 1 ? 0 : i / (colors.length - 1)} stopColor={c} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect width={size.w} height={size.h} rx={borderRadius} fill={`url(#${id})`} />
        </Svg>
      ) : null}
      {children}
    </View>
  );
}
