import { type ReactNode, useEffect, useRef, useState } from 'react';
import { type StyleProp, type TextStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '../tw';

// Smooth ease-out count-up driven on the JS thread. Renders a normal <Text>
// so it inherits the exact same font/styling as the rest of the UI.
function useCountUp(target: number, duration = 1000) {
  const [val, setVal] = useState(target);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    let raf = 0;
    let startTs = 0;
    const step = (ts: number) => {
      if (!startTs) startTs = ts;
      const t = Math.min((ts - startTs) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(step);
      else { setVal(target); fromRef.current = target; }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

export function AnimatedCount({ value, decimals = 0, duration = 1000, className, style, prefix = '', suffix = '' }: {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
  style?: StyleProp<TextStyle>;
  prefix?: string;
  suffix?: string;
}) {
  const v = useCountUp(value, duration);
  return <Text className={className} style={style}>{prefix}{v.toFixed(decimals)}{suffix}</Text>;
}

// Staggered fade+rise entrance. Wrap a card/section; pass an incrementing delay.
export function Rise({ delay = 0, duration = 450, children }: {
  delay?: number;
  duration?: number;
  children: ReactNode;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(duration).delay(delay)}>
      {children}
    </Animated.View>
  );
}
