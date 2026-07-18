import { useState } from 'react';
import { Pressable, Text, View } from '../../tw';
import { Card, Field, Input, SectionLabel, Banner } from '../ui';
import { useThemeMode } from '../../context/ThemeModeContext';

type ActivityLevel = 'sedentary' | 'active' | 'lifting';

const ACTIVITY_LEVELS: { key: ActivityLevel; label: string; gramsPerLb: number }[] = [
  { key: 'sedentary', label: 'Sedentary', gramsPerLb: 0.55 },
  { key: 'active', label: 'Active', gramsPerLb: 0.75 },
  { key: 'lifting', label: 'Lifting', gramsPerLb: 1.0 },
];

export default function ProteinCalculator() {
  const { colors } = useThemeMode();

  const [currentWeight, setCurrentWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [activity, setActivity] = useState<ActivityLevel>('active');

  const currentLbs = parseFloat(currentWeight);
  const goalLbs = parseFloat(goalWeight);
  const referenceLbs = goalLbs > 0 ? goalLbs : currentLbs;

  const gramsPerLb = ACTIVITY_LEVELS.find(a => a.key === activity)?.gramsPerLb ?? 0.75;
  const valid = referenceLbs > 0;
  const target = valid ? Math.round(referenceLbs * gramsPerLb) : null;
  const rangeLow = target !== null ? Math.round(target * 0.9) : null;
  const rangeHigh = target !== null ? Math.round(target * 1.1) : null;
  const perMeal = target !== null ? Math.round(target / 4) : null;

  return (
    <View>
      <Card className="p-4 mb-4">
        <SectionLabel>Protein calculator</SectionLabel>
        <Text className="text-[13px] mb-3" style={{ color: colors.muted }}>
          Daily protein target to help preserve muscle while losing weight on a GLP-1.
        </Text>

        <Field label="Current Weight (lbs)">
          <Input
            value={currentWeight}
            onChangeText={setCurrentWeight}
            keyboardType="decimal-pad"
            placeholder="e.g. 210"
          />
        </Field>

        <Field label="Goal Weight (lbs, optional)">
          <Input
            value={goalWeight}
            onChangeText={setGoalWeight}
            keyboardType="decimal-pad"
            placeholder="e.g. 170"
          />
        </Field>

        <Field label="Activity Level">
          <View className="flex-row gap-2 flex-wrap">
            {ACTIVITY_LEVELS.map(level => {
              const active = activity === level.key;
              return (
                <Pressable
                  key={level.key}
                  onPress={() => setActivity(level.key)}
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
                    {level.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
      </Card>

      {target !== null ? (
        <Card className="p-4 mb-4">
          <SectionLabel>Your protein target</SectionLabel>

          <View className="flex-row flex-wrap gap-2.5 mb-4">
            <ProteinStat label="Daily Target" value={`${target}`} unit="g" highlight />
            <ProteinStat label="Range" value={`${rangeLow}–${rangeHigh}`} unit="g" />
            <ProteinStat label="Per Meal" value={`${perMeal}`} unit="g · 4 meals" />
          </View>

          <Banner tone="info">
            Protein preserves lean mass during GLP-1 weight loss. Ranges follow common clinical
            guidance — individual needs vary.
          </Banner>
        </Card>
      ) : null}
    </View>
  );
}

// Rounded stat box mirroring the calculator screen's ResultStat styling.
function ProteinStat({ label, value, unit, highlight }: {
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
