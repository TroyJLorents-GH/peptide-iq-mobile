import { useMemo, useState } from 'react';
import { Pressable, Text, View } from '../../tw';
import { Card, Field, Input, SectionLabel, Banner } from '../ui';
import { useThemeMode } from '../../context/ThemeModeContext';
import { calculateDose } from '../../utils/calculator';

const INJECTION_COUNTS = [2, 3, 4, 5, 6, 7];

// Week rendered Mon-first: M T W T F S S
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Indices into the Mon-first week for each injection count,
// spreading doses as evenly as practical starting Monday.
const SCHEDULES: Record<number, number[]> = {
  2: [0, 3], // Mon, Thu
  3: [0, 2, 4], // Mon, Wed, Fri
  4: [0, 2, 4, 6], // Mon, Wed, Fri, Sun
  5: [0, 1, 2, 3, 4], // Mon–Fri
  6: [0, 1, 2, 3, 4, 5], // Mon–Sat
  7: [0, 1, 2, 3, 4, 5, 6], // daily
};

/** Format a mg value with up to 3 decimals, trailing zeros trimmed. */
function formatMg(mg: number): string {
  return parseFloat(mg.toFixed(3)).toString();
}

export default function SplitDoseCalculator() {
  const { colors } = useThemeMode();

  const [weeklyDose, setWeeklyDose] = useState('');
  const [injectionsPerWeek, setInjectionsPerWeek] = useState(2);
  const [vialStrength, setVialStrength] = useState('');
  const [bacWater, setBacWater] = useState('');

  const weeklyMg = parseFloat(weeklyDose);
  const perInjectionMg = weeklyMg > 0 ? weeklyMg / injectionsPerWeek : null;

  const vialResult = useMemo(() => {
    if (!perInjectionMg) return null;
    const strength = parseFloat(vialStrength);
    const water = parseFloat(bacWater);
    if (!strength || !water || strength <= 0 || water <= 0) return null;
    return calculateDose(perInjectionMg * 1000, strength, water);
  }, [perInjectionMg, vialStrength, bacWater]);

  const scheduledDays = SCHEDULES[injectionsPerWeek] ?? [];
  const scheduleLabel = scheduledDays.map(i => DAY_NAMES[i]).join(' · ');

  return (
    <View>
      <Card className="p-4 mb-4">
        <SectionLabel>Split dose calculator</SectionLabel>
        <Text className="text-[13px] mb-3" style={{ color: colors.muted }}>
          Divide a weekly dose (semaglutide, tirzepatide, retatrutide) into smaller, more frequent injections.
        </Text>

        <Field label="Weekly Dose (mg)">
          <Input
            value={weeklyDose}
            onChangeText={setWeeklyDose}
            keyboardType="decimal-pad"
            placeholder="e.g. 2.4"
          />
        </Field>

        <Field label="Injections Per Week">
          <View className="flex-row gap-2 flex-wrap">
            {INJECTION_COUNTS.map(count => {
              const active = injectionsPerWeek === count;
              return (
                <Pressable
                  key={count}
                  onPress={() => setInjectionsPerWeek(count)}
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
                    {count}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="Vial Info (optional — for syringe units)">
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Input
                value={vialStrength}
                onChangeText={setVialStrength}
                keyboardType="decimal-pad"
                placeholder="Vial strength (mg)"
              />
            </View>
            <View className="flex-1">
              <Input
                value={bacWater}
                onChangeText={setBacWater}
                keyboardType="decimal-pad"
                placeholder="BAC water (mL)"
              />
            </View>
          </View>
        </Field>
      </Card>

      {perInjectionMg ? (
        <Card className="p-4 mb-4">
          <SectionLabel>Your split</SectionLabel>

          <View className="flex-row flex-wrap gap-2.5 mb-4">
            <SplitStat
              label="Per Injection"
              value={formatMg(perInjectionMg)}
              unit="mg"
              highlight
            />
            <SplitStat
              label="Weekly Total"
              value={formatMg(weeklyMg)}
              unit="mg"
            />
            {vialResult ? (
              <>
                <SplitStat
                  label="Draw To"
                  value={`${vialResult.syringeUnits}`}
                  unit="units"
                  highlight
                />
                <SplitStat
                  label="Per Vial"
                  value={`${vialResult.dosesPerVial}`}
                  unit="doses"
                />
              </>
            ) : null}
          </View>

          {vialResult ? (
            <Text className="text-[12px] mb-4" style={{ color: colors.muted }}>
              {vialResult.concentrationMgPerMl} mg/mL concentration · draw {vialResult.drawVolumeMl} mL
              ({vialResult.syringeUnits} units on a U-100 syringe) per injection.
            </Text>
          ) : null}

          <SectionLabel>Suggested schedule</SectionLabel>
          <View className="flex-row justify-between mb-2">
            {DAY_LETTERS.map((letter, i) => {
              const active = scheduledDays.includes(i);
              return (
                <View
                  key={i}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1.5,
                    backgroundColor: active ? colors.primarySolid : colors.surface,
                    borderColor: active ? colors.primarySolid : colors.outline,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: active ? colors.onPrimary : colors.muted,
                    }}
                  >
                    {letter}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text className="text-[12px] mb-3" style={{ color: colors.muted }}>
            {injectionsPerWeek === 7
              ? `Daily — ${formatMg(perInjectionMg)} mg each day.`
              : `${scheduleLabel} — ${formatMg(perInjectionMg)} mg each.`}
          </Text>

          <Banner tone="info">
            Splitting doses is a common community practice for steadier levels — not an FDA dosing
            schedule. Consult your provider.
          </Banner>
        </Card>
      ) : null}
    </View>
  );
}

// Rounded stat box mirroring the calculator screen's ResultStat styling.
function SplitStat({ label, value, unit, highlight }: {
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
