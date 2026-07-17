import { useEffect, useRef, useState } from 'react';
import { ScrollView as RNScrollView } from 'react-native';
import { ScrollView, Text, View } from '../tw';
import { useThemeMode } from '../context/ThemeModeContext';

const PX_PER_UNIT = 12; // 1 lb = 12px; 0.1 lb resolution from scroll offset

interface RulerSliderProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  unit?: string;
}

/**
 * Horizontal ruler picker (MeAgain-style weight slider): drag the tape,
 * the fixed center needle reads the value. Ticks every 1 unit, labels every 10.
 */
export default function RulerSlider({ value, onChange, min = 80, max = 400, unit = 'lbs' }: RulerSliderProps) {
  const { colors } = useThemeMode();
  const scrollRef = useRef<RNScrollView>(null);
  const draggingRef = useRef(false);
  const lastEmitted = useRef(value);
  const [width, setWidth] = useState(0);

  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const offsetFor = (v: number) => (clamp(v) - min) * PX_PER_UNIT;

  // Position the tape when the external value changes (typed input), but
  // never fight an in-progress drag.
  useEffect(() => {
    if (draggingRef.current || width === 0) return;
    if (Math.abs(value - lastEmitted.current) > 0.05 || lastEmitted.current === value) {
      scrollRef.current?.scrollTo({ x: offsetFor(value), animated: false });
    }
  }, [value, width]);

  const handleScroll = (offsetX: number) => {
    const v = Math.round((min + offsetX / PX_PER_UNIT) * 10) / 10;
    const clamped = clamp(v);
    if (clamped !== lastEmitted.current) {
      lastEmitted.current = clamped;
      onChange(clamped);
    }
  };

  const ticks = [];
  for (let u = min; u <= max; u++) ticks.push(u);

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} className="mt-2">
      {width > 0 ? (
        <View>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScrollBeginDrag={() => { draggingRef.current = true; }}
            onScroll={e => { if (draggingRef.current) handleScroll(e.nativeEvent.contentOffset.x); }}
            onMomentumScrollEnd={e => { handleScroll(e.nativeEvent.contentOffset.x); draggingRef.current = false; }}
            onScrollEndDrag={e => handleScroll(e.nativeEvent.contentOffset.x)}
            contentOffset={{ x: offsetFor(value), y: 0 }}
            contentContainerStyle={{ paddingHorizontal: width / 2 }}
          >
            <View className="flex-row items-end" style={{ height: 56 }}>
              {ticks.map(u => {
                const major = u % 10 === 0;
                const mid = u % 5 === 0 && !major;
                return (
                  <View key={u} style={{ width: PX_PER_UNIT }} className="items-center justify-end">
                    {major ? (
                      <Text
                        className="font-mono text-[9px] absolute top-0"
                        style={{ color: colors.muted, width: 40, textAlign: 'center' }}
                      >
                        {u}
                      </Text>
                    ) : null}
                    <View
                      style={{
                        width: major ? 2 : 1,
                        height: major ? 26 : mid ? 18 : 10,
                        backgroundColor: major ? colors.text : colors.outline,
                      }}
                    />
                  </View>
                );
              })}
            </View>
          </ScrollView>
          {/* fixed center needle */}
          <View
            pointerEvents="none"
            className="absolute items-center"
            style={{ left: width / 2 - 1, top: 8, bottom: 0 }}
          >
            <View style={{ width: 2, flex: 1, backgroundColor: colors.primary, borderRadius: 1 }} />
          </View>
        </View>
      ) : null}
      <Text className="text-center font-mono text-[10px] uppercase tracking-wider mt-1" style={{ color: colors.muted }}>
        drag to adjust · {unit}
      </Text>
    </View>
  );
}
