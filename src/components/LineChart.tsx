import { useState } from 'react';
import Svg, { G, Line, Path, Text as SvgText } from 'react-native-svg';
import { View } from '../tw';
import { useThemeMode } from '../context/ThemeModeContext';

export interface ChartSeries {
  color: string;
  points: { x: number; y: number }[];
  dashed?: boolean;
}

interface LineChartProps {
  series: ChartSeries[];
  height?: number;
  /** Vertical marker (e.g. "now") in x units */
  markerX?: number;
  xFormatter?: (x: number) => string;
  yFormatter?: (y: number) => string;
  xTickCount?: number;
  yTickCount?: number;
}

/**
 * Lightweight SVG line chart — replaces MUI X Charts on native.
 * Sizes to its container width via onLayout.
 */
export default function LineChart({
  series,
  height = 220,
  markerX,
  xFormatter = x => String(x),
  yFormatter = y => String(y),
  xTickCount = 4,
  yTickCount = 4,
}: LineChartProps) {
  const [width, setWidth] = useState(0);
  const { colors } = useThemeMode();

  const pad = { top: 8, right: 12, bottom: 22, left: 40 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = Math.max(0, height - pad.top - pad.bottom);

  const allPoints = series.flatMap(s => s.points);
  let xMin = Math.min(...allPoints.map(p => p.x));
  let xMax = Math.max(...allPoints.map(p => p.x));
  let yMin = 0;
  let yMax = Math.max(...allPoints.map(p => p.y), 0.001);
  if (!Number.isFinite(xMin) || xMin === xMax) { xMin = 0; xMax = 1; }
  yMax *= 1.08; // headroom

  const sx = (x: number) => pad.left + ((x - xMin) / (xMax - xMin)) * innerW;
  const sy = (y: number) => pad.top + innerH - ((y - yMin) / (yMax - yMin)) * innerH;

  const linePath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');

  const xTicks = Array.from({ length: xTickCount + 1 }, (_, i) => xMin + ((xMax - xMin) * i) / xTickCount);
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / yTickCount);

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 && allPoints.length > 0 ? (
        <Svg width={width} height={height}>
          {/* horizontal grid + y labels */}
          {yTicks.map((t, i) => (
            <G key={`y${i}`}>
              <Line
                x1={pad.left}
                y1={sy(t)}
                x2={width - pad.right}
                y2={sy(t)}
                stroke={colors.divider}
                strokeWidth={1}
              />
              <SvgText
                x={pad.left - 6}
                y={sy(t) + 3}
                fontSize={9}
                fill={colors.muted}
                textAnchor="end"
              >
                {yFormatter(t)}
              </SvgText>
            </G>
          ))}
          {/* x labels */}
          {xTicks.map((t, i) => (
            <SvgText
              key={`x${i}`}
              x={sx(t)}
              y={height - 6}
              fontSize={9}
              fill={colors.muted}
              textAnchor={i === 0 ? 'start' : i === xTickCount ? 'end' : 'middle'}
            >
              {xFormatter(t)}
            </SvgText>
          ))}
          {/* marker (e.g. now) */}
          {markerX !== undefined && markerX >= xMin && markerX <= xMax ? (
            <Line
              x1={sx(markerX)}
              y1={pad.top}
              x2={sx(markerX)}
              y2={pad.top + innerH}
              stroke={colors.muted}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          ) : null}
          {/* series */}
          {series.map((s, i) =>
            s.points.length > 1 ? (
              <Path
                key={i}
                d={linePath(s.points)}
                stroke={s.color}
                strokeWidth={2}
                fill="none"
                strokeDasharray={s.dashed ? '5 4' : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null,
          )}
        </Svg>
      ) : null}
    </View>
  );
}
