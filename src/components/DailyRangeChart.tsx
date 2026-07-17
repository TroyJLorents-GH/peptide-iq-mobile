import { useState } from 'react';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { View } from '../tw';
import { useThemeMode } from '../context/ThemeModeContext';

export interface RangeDay {
  ts: number; // start-of-day timestamp
  bars: { color: string; min: number; max: number }[]; // one per series, in series order
}

interface DailyRangeChartProps {
  days: RangeDay[];
  seriesCount: number;
  height?: number;
  xFormatter?: (ts: number) => string;
  yFormatter?: (y: number) => string;
  yTickCount?: number;
}

/**
 * Floating bar chart — each day shows each compound's min→max range for the
 * selected metric. Mirrors the web app's "Daily Range" view.
 */
export default function DailyRangeChart({
  days,
  seriesCount,
  height = 220,
  xFormatter = ts => String(ts),
  yFormatter = y => String(y),
  yTickCount = 4,
}: DailyRangeChartProps) {
  const [width, setWidth] = useState(0);
  const { colors } = useThemeMode();

  const pad = { top: 8, right: 12, bottom: 22, left: 40 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = Math.max(0, height - pad.top - pad.bottom);

  const allVals = days.flatMap(d => d.bars.flatMap(b => [b.min, b.max]));
  const yMin = 0;
  const yMax = Math.max(...allVals, 0.001) * 1.08;

  const sy = (y: number) => pad.top + innerH - ((y - yMin) / (yMax - yMin)) * innerH;

  const dayCount = days.length;
  const slotW = dayCount > 0 ? innerW / dayCount : 0;
  // Bars for a day are centered in the day's slot, capped so they never get huge.
  const barW = seriesCount > 0 ? Math.min((slotW * 0.7) / seriesCount, 16) : 0;
  const groupW = barW * seriesCount;

  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / yTickCount);
  // Thin out x labels when there are many days so they don't overlap.
  const xLabelStep = Math.ceil(dayCount / 7);

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 && dayCount > 0 ? (
        <Svg width={width} height={height}>
          {/* horizontal grid + y labels */}
          {yTicks.map((t, i) => (
            <G key={`y${i}`}>
              <Line x1={pad.left} y1={sy(t)} x2={width - pad.right} y2={sy(t)} stroke={colors.divider} strokeWidth={1} />
              <SvgText x={pad.left - 6} y={sy(t) + 3} fontSize={9} fill={colors.muted} textAnchor="end">
                {yFormatter(t)}
              </SvgText>
            </G>
          ))}
          {/* floating bars per day + x labels */}
          {days.map((day, di) => {
            const slotX = pad.left + di * slotW;
            const startX = slotX + (slotW - groupW) / 2;
            return (
              <G key={di}>
                {day.bars.map((b, bi) => {
                  const x = startX + bi * barW;
                  const yTop = sy(b.max);
                  const yBot = sy(b.min);
                  const h = Math.max(yBot - yTop, 2);
                  return (
                    <Rect
                      key={bi}
                      x={x + 1}
                      y={yTop}
                      width={Math.max(barW - 2, 1)}
                      height={h}
                      rx={2}
                      fill={b.color}
                    />
                  );
                })}
                {di % xLabelStep === 0 ? (
                  <SvgText x={slotX + slotW / 2} y={height - 6} fontSize={9} fill={colors.muted} textAnchor="middle">
                    {xFormatter(day.ts)}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}
