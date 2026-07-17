import Svg, { Defs, G, Line, LinearGradient, Polygon, Rect, Stop, Text as SvgText } from 'react-native-svg';
import type { CalculatorResult } from '../types';
import { Text, View } from '../tw';
import { useThemeMode } from '../context/ThemeModeContext';

interface SyringeVisualProps {
  result: CalculatorResult | null;
}

/**
 * Pharmaceutical-grade U-100 insulin syringe, vertical orientation.
 * Needle up, plunger down. Fluid fills downward as plunger is drawn back.
 * Port of the web app's SyringeVisual SVG to react-native-svg.
 */
export default function SyringeVisual({ result }: SyringeVisualProps) {
  const { colors } = useThemeMode();
  const width = 130;
  const height = result ? 380 : 300;

  const centerX = width / 2;
  const needleTopY = 8;
  const needleBottomY = 44;
  const hubTopY = needleBottomY;
  const hubHeight = 14;
  const hubBottomY = hubTopY + hubHeight;

  const barrelTopY = hubBottomY + 4;
  const barrelHeight = result ? 210 : 160;
  const barrelBottomY = barrelTopY + barrelHeight;
  const barrelWidth = 50;
  const barrelLeftX = centerX - barrelWidth / 2;
  const barrelRightX = centerX + barrelWidth / 2;

  const plungerWidth = barrelWidth - 4;
  const plungerHeight = 14;
  const plungerLeftX = centerX - plungerWidth / 2;

  const rodWidth = 7;
  const rodHeight = result ? 60 : 48;
  const rodLeftX = centerX - rodWidth / 2;

  const flangeWidth = barrelWidth + 24;
  const flangeHeight = 8;
  const flangeLeftX = centerX - flangeWidth / 2;

  const maxUnits = 100;
  const fillUnits = result ? Math.min(result.syringeUnits, maxUnits) : 0;
  const fluidHeight = barrelHeight * (fillUnits / maxUnits);
  const plungerTopY = barrelTopY + fluidHeight;

  const ticks = Array.from({ length: 11 }, (_, i) => i * 10);
  const halfTicks = Array.from({ length: 10 }, (_, i) => i * 10 + 5);

  return (
    <View className="items-center">
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="glass-bg-v" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#F8FBFD" />
            <Stop offset="0.44" stopColor="#FFFFFF" />
            <Stop offset="1" stopColor="#DDEAF0" />
          </LinearGradient>
          <LinearGradient id="liquid-v" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#0D8999" stopOpacity="0.96" />
            <Stop offset="0.48" stopColor="#14B8C4" stopOpacity="1" />
            <Stop offset="1" stopColor="#67E8F9" stopOpacity="0.92" />
          </LinearGradient>
          <LinearGradient id="plunger-v" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#0F172A" />
            <Stop offset="0.52" stopColor="#334155" />
            <Stop offset="1" stopColor="#64748B" />
          </LinearGradient>
          <LinearGradient id="hub-v" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#A7B7C6" />
            <Stop offset="0.5" stopColor="#EEF6FA" />
            <Stop offset="1" stopColor="#CBDDE7" />
          </LinearGradient>
        </Defs>

        {/* Needle */}
        <Line x1={centerX} y1={needleTopY} x2={centerX} y2={needleBottomY} stroke="#8EA3B5" strokeWidth={1.4} strokeLinecap="round" />
        <Polygon
          points={`${centerX - 2},${needleTopY + 4} ${centerX + 2},${needleTopY + 4} ${centerX},${needleTopY - 2}`}
          fill="#D8E4EA"
        />

        {/* Hub */}
        <Rect x={centerX - 8} y={hubTopY} width={16} height={hubHeight} rx={5} fill="url(#hub-v)" stroke={colors.divider} strokeWidth={0.8} />

        {/* Barrel */}
        <Rect
          x={barrelLeftX}
          y={barrelTopY}
          width={barrelWidth}
          height={barrelHeight}
          rx={12}
          fill="url(#glass-bg-v)"
          stroke={colors.outline}
          strokeWidth={1}
        />

        {/* Liquid fill */}
        {fluidHeight > 2 ? (
          <Rect
            x={barrelLeftX + 3}
            y={barrelTopY + 3}
            width={barrelWidth - 6}
            height={Math.max(0, fluidHeight - 4)}
            rx={9}
            fill="url(#liquid-v)"
          />
        ) : null}

        {/* Ticks */}
        {ticks.map(unit => {
          const y = barrelTopY + (unit / maxUnits) * barrelHeight;
          return (
            <G key={`t-${unit}`}>
              <Line x1={barrelRightX + 2} y1={y} x2={barrelRightX + 10} y2={y} stroke={colors.muted} strokeWidth={0.9} strokeLinecap="round" />
              {unit % 20 === 0 ? (
                <SvgText x={barrelRightX + 12} y={y + 3.5} fill={colors.muted} fontSize={9}>
                  {unit}
                </SvgText>
              ) : null}
            </G>
          );
        })}
        {halfTicks.map(unit => {
          const y = barrelTopY + (unit / maxUnits) * barrelHeight;
          return (
            <Line key={`h-${unit}`} x1={barrelRightX + 2} y1={y} x2={barrelRightX + 6} y2={y} stroke={colors.divider} strokeWidth={0.6} strokeLinecap="round" />
          );
        })}

        {/* Draw line indicator */}
        {result && fillUnits > 0 ? (
          <G>
            <Line
              x1={barrelLeftX - 8}
              y1={plungerTopY}
              x2={barrelRightX + 32}
              y2={plungerTopY}
              stroke={colors.primary}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              opacity={0.9}
            />
            <Rect x={barrelLeftX - 44} y={plungerTopY - 11} width={36} height={22} rx={8} fill={colors.surface} stroke={colors.primary} strokeWidth={1} />
            <SvgText
              x={barrelLeftX - 26}
              y={plungerTopY + 4}
              textAnchor="middle"
              fill={colors.tealText}
              fontSize={10}
              fontWeight="700"
            >
              {`${fillUnits}U`}
            </SvgText>
          </G>
        ) : null}

        {/* Plunger stopper */}
        <Rect x={plungerLeftX} y={plungerTopY} width={plungerWidth} height={plungerHeight} rx={7} fill="url(#plunger-v)" />

        {/* Plunger rod */}
        <Rect
          x={rodLeftX}
          y={plungerTopY + plungerHeight}
          width={rodWidth}
          height={Math.max(rodHeight, barrelBottomY - plungerTopY - plungerHeight + 12)}
          rx={3.5}
          fill="#334155"
        />

        {/* Flange */}
        <Rect
          x={flangeLeftX}
          y={Math.max(barrelBottomY + 6, plungerTopY + plungerHeight + rodHeight)}
          width={flangeWidth}
          height={flangeHeight}
          rx={4}
          fill="url(#plunger-v)"
        />

        {/* Bottom label */}
        <SvgText x={centerX} y={height - 4} textAnchor="middle" fill={colors.muted} fontSize={9} fontWeight="600">
          U-100 · 1 mL
        </SvgText>
      </Svg>
      {!result ? (
        <Text className="text-xs text-center mt-2 px-6" style={{ color: colors.muted }}>
          Add vial strength, water volume, and desired dose to calculate U-100 syringe units.
        </Text>
      ) : null}
    </View>
  );
}
