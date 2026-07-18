import { useState } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
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
  /** Vertical marker (e.g. "now") in x units. Points beyond it render as a
   *  dashed projection with no fill. */
  markerX?: number;
  xFormatter?: (x: number) => string;
  yFormatter?: (y: number) => string;
  xTickCount?: number;
  yTickCount?: number;
  /** Soft gradient fill under each curve (up to markerX). Default on. */
  fillArea?: boolean;
  /** Dot on the last actual (non-projected) point. Default on. */
  endDot?: boolean;
  /** Monotone-cubic curve smoothing (no overshoot on dose spikes). Default on. */
  smooth?: boolean;
  /** 'zero' anchors the y-axis at 0 (PK charts). 'auto' zooms to the data
   *  range with padding (weight trends — a 20 lb change fills the chart). */
  yDomain?: 'zero' | 'auto';
  /** Small dot on every actual data point (sparse data like weigh-ins). */
  pointDots?: boolean;
}

let chartInstance = 0;

/**
 * Lightweight SVG line chart — replaces MUI X Charts on native.
 * Area fill + dashed projection + current-value dot, sized via onLayout.
 */
export default function LineChart({
  series,
  height = 220,
  markerX,
  xFormatter = x => String(x),
  yFormatter = y => String(y),
  xTickCount = 4,
  yTickCount = 4,
  fillArea = true,
  endDot = true,
  smooth = true,
  yDomain = 'zero',
  pointDots = false,
}: LineChartProps) {
  const [width, setWidth] = useState(0);
  const [uid] = useState(() => `lc${chartInstance++}`);
  const { colors } = useThemeMode();

  const pad = { top: 8, right: 12, bottom: 22, left: 40 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = Math.max(0, height - pad.top - pad.bottom);

  const allPoints = series.flatMap(s => s.points);
  let xMin = Math.min(...allPoints.map(p => p.x));
  let xMax = Math.max(...allPoints.map(p => p.x));
  if (!Number.isFinite(xMin) || xMin === xMax) { xMin = 0; xMax = 1; }

  let yMin: number;
  let yMax: number;
  if (yDomain === 'auto') {
    const dataMin = Math.min(...allPoints.map(p => p.y));
    const dataMax = Math.max(...allPoints.map(p => p.y), dataMin + 0.001);
    const span = Math.max(dataMax - dataMin, Math.abs(dataMax) * 0.02, 0.001);
    yMin = Math.max(0, dataMin - span * 0.18);
    yMax = dataMax + span * 0.18;
  } else {
    yMin = 0;
    yMax = Math.max(...allPoints.map(p => p.y), 0.001) * 1.08; // headroom
  }

  const sx = (x: number) => pad.left + ((x - xMin) / (xMax - xMin)) * innerW;
  const sy = (y: number) => pad.top + innerH - ((y - yMin) / (yMax - yMin)) * innerH;
  const baselineY = sy(yMin);

  // Monotone-cubic (Fritsch–Carlson) smoothing: curves flow like Apple
  // Fitness charts but never overshoot — dose spikes keep their true peak.
  const smoothPath = (pts: { x: number; y: number }[]) => {
    const P = pts.map(p => ({ x: sx(p.x), y: sy(p.y) }));
    const n = P.length;
    if (n < 3) return P.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    const dx: number[] = [], slope: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      dx.push(P[i + 1].x - P[i].x || 1e-6);
      slope.push((P[i + 1].y - P[i].y) / (dx[i] || 1e-6));
    }
    const m: number[] = [slope[0]];
    for (let i = 1; i < n - 1; i++) {
      if (slope[i - 1] * slope[i] <= 0) m.push(0);
      else {
        const w1 = 2 * dx[i] + dx[i - 1];
        const w2 = dx[i] + 2 * dx[i - 1];
        m.push((w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]));
      }
    }
    m.push(slope[n - 2]);

    let d = `M${P[0].x.toFixed(1)},${P[0].y.toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += ` C${(P[i].x + h).toFixed(1)},${(P[i].y + m[i] * h).toFixed(1)} ${(P[i + 1].x - h).toFixed(1)},${(P[i + 1].y - m[i + 1] * h).toFixed(1)} ${P[i + 1].x.toFixed(1)},${P[i + 1].y.toFixed(1)}`;
    }
    return d;
  };

  const linePath = (pts: { x: number; y: number }[]) =>
    smooth
      ? smoothPath(pts)
      : pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');

  const areaPath = (pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return '';
    return `${linePath(pts)} L${sx(pts[pts.length - 1].x).toFixed(1)},${baselineY.toFixed(1)} L${sx(pts[0].x).toFixed(1)},${baselineY.toFixed(1)} Z`;
  };

  // Split a series at markerX: solid history vs dashed projection.
  const splitAtMarker = (pts: { x: number; y: number }[]) => {
    if (markerX === undefined || markerX >= xMax) return { solid: pts, proj: [] as typeof pts };
    if (markerX <= xMin) return { solid: [] as typeof pts, proj: pts };
    const solid = pts.filter(p => p.x <= markerX);
    const proj = pts.filter(p => p.x >= markerX);
    // Share the boundary point so the line is continuous.
    if (solid.length && proj.length && solid[solid.length - 1] !== proj[0]) proj.unshift(solid[solid.length - 1]);
    return { solid, proj };
  };

  const xTicks = Array.from({ length: xTickCount + 1 }, (_, i) => xMin + ((xMax - xMin) * i) / xTickCount);
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / yTickCount);

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 && allPoints.length > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            {series.map((s, i) => (
              <LinearGradient key={i} id={`${uid}-fill${i}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={s.color} stopOpacity="0.28" />
                <Stop offset="1" stopColor={s.color} stopOpacity="0.02" />
              </LinearGradient>
            ))}
          </Defs>
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
              opacity={0.6}
            />
          ) : null}
          {/* area fills (history only) */}
          {fillArea
            ? series.map((s, i) => {
                const { solid } = splitAtMarker(s.points);
                return solid.length > 1 ? (
                  <Path key={`a${i}`} d={areaPath(solid)} fill={`url(#${uid}-fill${i})`} />
                ) : null;
              })
            : null}
          {/* series strokes: solid history + dashed projection */}
          {series.map((s, i) => {
            const { solid, proj } = splitAtMarker(s.points);
            return (
              <G key={`s${i}`}>
                {solid.length > 1 ? (
                  <Path
                    d={linePath(solid)}
                    stroke={s.color}
                    strokeWidth={2}
                    fill="none"
                    strokeDasharray={s.dashed ? '5 4' : undefined}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ) : null}
                {proj.length > 1 ? (
                  <Path
                    d={linePath(proj)}
                    stroke={s.color}
                    strokeWidth={2}
                    fill="none"
                    strokeDasharray="4 4"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={0.7}
                  />
                ) : null}
                {/* dot on every actual data point (sparse series) */}
                {pointDots
                  ? solid.map((p, pi) => (
                      <Circle
                        key={`pd${pi}`}
                        cx={sx(p.x)}
                        cy={sy(p.y)}
                        r={3}
                        fill={s.color}
                        stroke={colors.surface}
                        strokeWidth={1.5}
                      />
                    ))
                  : null}
                {/* current-value dot at the last actual point */}
                {endDot && solid.length > 0 ? (
                  <Circle
                    cx={sx(solid[solid.length - 1].x)}
                    cy={sy(solid[solid.length - 1].y)}
                    r={4}
                    fill={s.color}
                    stroke={colors.surface}
                    strokeWidth={1.5}
                  />
                ) : null}
              </G>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}
