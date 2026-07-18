import { useState } from 'react';
import { Pressable, Text, View } from '../../tw';
import { Card, Field, Input, SectionLabel, Banner } from '../ui';
import { useThemeMode } from '../../context/ThemeModeContext';

type Sex = 'male' | 'female';

const SEXES: { key: Sex; label: string }[] = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
];

const EXAMPLE_FOODS: { food: string; fiber: string }[] = [
  { food: '1 cup raspberries', fiber: '8g' },
  { food: '1/2 cup black beans', fiber: '7.5g' },
  { food: '1 medium avocado', fiber: '10g' },
];

/** IOM daily fiber guidance by sex and age. */
function fiberTarget(sex: Sex, age: number): number {
  if (sex === 'male') return age <= 50 ? 38 : 30;
  return age <= 50 ? 25 : 21;
}

export default function FiberCalculator() {
  const { colors } = useThemeMode();

  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex>('female');

  const ageNum = parseFloat(age);
  const valid = ageNum > 0;
  const target = valid ? fiberTarget(sex, ageNum) : null;

  return (
    <View>
      <Card className="p-4 mb-4">
        <SectionLabel>Fiber calculator</SectionLabel>
        <Text className="text-[13px] mb-3" style={{ color: colors.muted }}>
          Daily fiber target based on IOM guidance for your age and sex.
        </Text>

        <Field label="Age">
          <Input
            value={age}
            onChangeText={setAge}
            keyboardType="number-pad"
            placeholder="e.g. 42"
          />
        </Field>

        <Field label="Sex">
          <View className="flex-row gap-2 flex-wrap">
            {SEXES.map(s => {
              const active = sex === s.key;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => setSex(s.key)}
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
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
      </Card>

      {target !== null ? (
        <Card className="p-4 mb-4">
          <SectionLabel>Your fiber target</SectionLabel>

          <View className="flex-row flex-wrap gap-2.5 mb-4">
            <FiberStat label="Daily Target" value={`${target}`} unit="g" highlight />
          </View>

          <SectionLabel>Fiber-rich examples</SectionLabel>
          <View className="mb-4">
            {EXAMPLE_FOODS.map((item, i) => (
              <View
                key={item.food}
                className="flex-row items-center justify-between py-2.5"
                style={i < EXAMPLE_FOODS.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.cardBorder } : undefined}
              >
                <Text className="text-[13px]" style={{ color: colors.text }}>{item.food}</Text>
                <Text className="font-mono text-[13px] font-semibold" style={{ color: colors.tealText }}>
                  {item.fiber}
                </Text>
              </View>
            ))}
          </View>

          <Banner tone="info">
            Fiber eases GLP-1 constipation. Increase gradually and pair with water.
          </Banner>
        </Card>
      ) : null}
    </View>
  );
}

// Rounded stat box mirroring the calculator screen's ResultStat styling.
function FiberStat({ label, value, unit, highlight }: {
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
