import { useState } from 'react';
import { Pressable, Text, View } from '../../tw';
import { Card, Field, Input, SectionLabel, Banner } from '../ui';
import { useThemeMode } from '../../context/ThemeModeContext';

type Climate = 'temperate' | 'hot';

const CLIMATES: { key: Climate; label: string }[] = [
  { key: 'temperate', label: 'Temperate' },
  { key: 'hot', label: 'Hot' },
];

export default function WaterCalculator() {
  const { colors } = useThemeMode();

  const [weight, setWeight] = useState('');
  const [exerciseMinutes, setExerciseMinutes] = useState('0');
  const [climate, setClimate] = useState<Climate>('temperate');

  const weightLbs = parseFloat(weight);
  const exerciseMin = parseFloat(exerciseMinutes) || 0;

  const valid = weightLbs > 0 && exerciseMin >= 0;
  let totalOz: number | null = null;
  if (valid) {
    totalOz = weightLbs * 0.5 + (exerciseMin / 30) * 12;
    if (climate === 'hot') totalOz *= 1.1;
  }

  const ozRounded = totalOz !== null ? Math.round(totalOz) : null;
  const liters = totalOz !== null ? (totalOz * 0.0295735).toFixed(1) : null;
  const cups = totalOz !== null ? Math.round(totalOz / 8) : null;

  return (
    <View>
      <Card className="p-4 mb-4">
        <SectionLabel>Water calculator</SectionLabel>
        <Text className="text-[13px] mb-3" style={{ color: colors.muted }}>
          Daily hydration target based on your weight, activity, and climate.
        </Text>

        <Field label="Weight (lbs)">
          <Input
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholder="e.g. 180"
          />
        </Field>

        <Field label="Exercise (minutes/day)">
          <Input
            value={exerciseMinutes}
            onChangeText={setExerciseMinutes}
            keyboardType="number-pad"
            placeholder="e.g. 30"
          />
        </Field>

        <Field label="Climate">
          <View className="flex-row gap-2 flex-wrap">
            {CLIMATES.map(c => {
              const active = climate === c.key;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => setClimate(c.key)}
                  className="rounded-full px-4 py-2"
                  style={{
                    borderWidth: 1.5,
                    backgroundColor: active ? colors.primarySolid : colors.surface,
                    borderColor: active ? colors.primarySolid : colors.outline,
                  }}
                >
                  <Text
                    className="text-[13px] font-semibold"
                    style={{ color: active ? colors.onPrimary : colors.muted }}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
      </Card>

      {ozRounded !== null ? (
        <Card className="p-4 mb-4">
          <SectionLabel>Your hydration target</SectionLabel>

          <View className="flex-row flex-wrap gap-2.5 mb-4">
            <WaterStat label="Daily Target" value={`${ozRounded}`} unit="oz" highlight />
            <WaterStat label="In Liters" value={`${liters}`} unit="L" />
            <WaterStat label="In Cups" value={`${cups}`} unit="8 oz cups" />
          </View>

          <Banner tone="info">
            Hydration helps manage GLP-1 side effects like constipation and fatigue. Spread intake
            through the day.
          </Banner>
        </Card>
      ) : null}
    </View>
  );
}

// Rounded stat box mirroring the calculator screen's ResultStat styling.
function WaterStat({ label, value, unit, highlight }: {
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
}) {
  const { colors } = useThemeMode();
  return (
    <View
      className="basis-[47%] grow rounded-md border px-3.5 py-3.5 min-h-[90px] justify-between"
      style={
        highlight
          ? { backgroundColor: colors.primaryTint, borderColor: colors.outline, borderTopWidth: 2, borderTopColor: colors.primary }
          : { backgroundColor: colors.surface, borderColor: colors.cardBorder }
      }
    >
      <Text className="font-mono text-[9px] uppercase tracking-widest" style={{ color: colors.muted }}>{label}</Text>
      <View className="flex-row items-baseline gap-1 mt-1 flex-wrap">
        <Text className="font-mono font-semibold text-[26px] leading-7" style={{ color: highlight ? colors.tealText : colors.text }}>
          {value}
        </Text>
        <Text className="font-mono text-[10px] uppercase tracking-wide" style={{ color: colors.muted }}>{unit}</Text>
      </View>
    </View>
  );
}
