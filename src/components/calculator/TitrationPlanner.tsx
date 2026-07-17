import { useMemo, useState } from 'react';
import { addDays, addWeeks, format } from 'date-fns';
import { Pressable, Text, View } from '../../tw';
import { Card, Field, Input, SectionLabel, Banner, Chip } from '../ui';
import { useThemeMode } from '../../context/ThemeModeContext';

// ---------- Protocol data ----------

type PresetKey = 'semaglutide' | 'tirzepatide' | 'retatrutide' | 'custom';

type Preset = {
  key: PresetKey;
  label: string;
  /** Escalation step doses in mg, in order. Last entry is the max maintenance dose. */
  steps: number[];
  weeksPerStep: number;
  investigational?: boolean;
};

const PRESETS: Preset[] = [
  { key: 'semaglutide', label: 'Semaglutide (FDA)', steps: [0.25, 0.5, 1.0, 1.7, 2.4], weeksPerStep: 4 },
  { key: 'tirzepatide', label: 'Tirzepatide (FDA)', steps: [2.5, 5, 7.5, 10, 12.5, 15], weeksPerStep: 4 },
  { key: 'retatrutide', label: 'Retatrutide (study)', steps: [2, 4, 8, 12], weeksPerStep: 4, investigational: true },
  { key: 'custom', label: 'Custom', steps: [], weeksPerStep: 4 },
];

type ScheduleStep = {
  dose: number;
  startWeek: number; // 1-based
  endWeek: number | null; // null = maintenance (open-ended)
  weeks: number | null;
  isMaintenance: boolean;
};

function formatMg(mg: number): string {
  return `${parseFloat(mg.toFixed(3))} mg`;
}

function buildSchedule(doses: number[], weeksPerStep: number): ScheduleStep[] {
  const steps: ScheduleStep[] = [];
  let week = 1;
  doses.forEach((dose, i) => {
    const isLast = i === doses.length - 1;
    if (isLast) {
      steps.push({ dose, startWeek: week, endWeek: null, weeks: null, isMaintenance: true });
    } else {
      steps.push({ dose, startWeek: week, endWeek: week + weeksPerStep - 1, weeks: weeksPerStep, isMaintenance: false });
      week += weeksPerStep;
    }
  });
  return steps;
}

// ---------- Component ----------

export default function TitrationPlanner() {
  const { colors } = useThemeMode();

  const [presetKey, setPresetKey] = useState<PresetKey>('semaglutide');
  const [targetByPreset, setTargetByPreset] = useState<Partial<Record<PresetKey, number>>>({});

  // Custom protocol inputs
  const [customStart, setCustomStart] = useState('0.25');
  const [customIncrement, setCustomIncrement] = useState('0.25');
  const [customWeeksPerStep, setCustomWeeksPerStep] = useState('4');
  const [customTarget, setCustomTarget] = useState('1');

  const preset = PRESETS.find(p => p.key === presetKey)!;
  const isCustom = presetKey === 'custom';

  // Doses available as maintenance targets for the active preset.
  const targetOptions = isCustom ? [] : preset.steps;
  const selectedTarget = targetByPreset[presetKey] ?? (targetOptions.length ? targetOptions[targetOptions.length - 1] : undefined);

  const { doses, weeksPerStep, customError } = useMemo(() => {
    if (!isCustom) {
      const targetIdx = preset.steps.indexOf(selectedTarget ?? preset.steps[preset.steps.length - 1]);
      const idx = targetIdx >= 0 ? targetIdx : preset.steps.length - 1;
      return { doses: preset.steps.slice(0, idx + 1), weeksPerStep: preset.weeksPerStep, customError: null as string | null };
    }
    const start = parseFloat(customStart);
    const inc = parseFloat(customIncrement);
    const weeks = parseInt(customWeeksPerStep, 10);
    const target = parseFloat(customTarget);
    if (!isFinite(start) || start <= 0) return { doses: [], weeksPerStep: 4, customError: 'Enter a start dose above 0 mg.' };
    if (!isFinite(target) || target < start) return { doses: [], weeksPerStep: 4, customError: 'Target dose must be at least the start dose.' };
    if (!isFinite(weeks) || weeks < 1) return { doses: [], weeksPerStep: 4, customError: 'Weeks per step must be at least 1.' };
    if (target > start && (!isFinite(inc) || inc <= 0)) {
      return { doses: [], weeksPerStep: 4, customError: 'Increase per step must be above 0 mg to reach the target.' };
    }
    const list: number[] = [];
    let d = start;
    while (d < target && list.length < 30) {
      list.push(parseFloat(d.toFixed(4)));
      d += inc;
    }
    list.push(parseFloat(target.toFixed(4))); // final step capped at target = maintenance
    return { doses: list, weeksPerStep: weeks, customError: null as string | null };
  }, [isCustom, preset, selectedTarget, customStart, customIncrement, customWeeksPerStep, customTarget]);

  const schedule = useMemo(() => buildSchedule(doses, weeksPerStep), [doses, weeksPerStep]);

  const startDate = useMemo(() => new Date(), []);
  const maintenanceStep = schedule.length ? schedule[schedule.length - 1] : null;
  const escalationWeeks = maintenanceStep ? maintenanceStep.startWeek - 1 : 0;
  const maintenanceDate = maintenanceStep ? addWeeks(startDate, maintenanceStep.startWeek - 1) : null;

  const stepDateRange = (step: ScheduleStep): string => {
    const from = addWeeks(startDate, step.startWeek - 1);
    if (step.endWeek == null) return `From ${format(from, 'MMM d')}`;
    const to = addDays(addWeeks(startDate, step.endWeek), -1);
    return `${format(from, 'MMM d')} – ${format(to, 'MMM d')}`;
  };

  const stepWeekRange = (step: ScheduleStep): string => {
    if (step.endWeek == null) return `Week ${step.startWeek}+`;
    if (step.startWeek === step.endWeek) return `Week ${step.startWeek}`;
    return `Weeks ${step.startWeek}–${step.endWeek}`;
  };

  return (
    <View>
      <Card className="mb-3">
        <SectionLabel>Titration Planner</SectionLabel>

        {/* Protocol preset pills */}
        <Field label="Protocol">
          <View className="flex-row flex-wrap gap-2">
            {PRESETS.map(p => {
              const active = presetKey === p.key;
              return (
                <Pressable
                  key={p.key}
                  className="rounded-full border px-3 py-1.5"
                  style={{
                    backgroundColor: active ? colors.primaryTint : 'transparent',
                    borderColor: active ? colors.primary : colors.outline,
                  }}
                  onPress={() => setPresetKey(p.key)}
                >
                  <Text
                    className={`font-mono text-[10px] uppercase tracking-wider ${active ? 'font-medium' : ''}`}
                    style={{ color: active ? colors.tealText : colors.muted }}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        {preset.investigational ? (
          <View className="mb-3">
            <Chip label="Investigational" tone="warning" />
            <Text className="text-xs mt-1" style={{ color: colors.muted }}>
              Retatrutide is not FDA approved. Schedule mirrors a phase-2 study protocol.
            </Text>
          </View>
        ) : null}

        {/* Custom protocol inputs */}
        {isCustom ? (
          <View>
            <View className="flex-row gap-3">
              <Field label="Start dose (mg)" className="flex-1">
                <Input value={customStart} onChangeText={setCustomStart} keyboardType="decimal-pad" placeholder="0.25" />
              </Field>
              <Field label="Increase per step (mg)" className="flex-1">
                <Input value={customIncrement} onChangeText={setCustomIncrement} keyboardType="decimal-pad" placeholder="0.25" />
              </Field>
            </View>
            <View className="flex-row gap-3">
              <Field label="Weeks per step" className="flex-1">
                <Input value={customWeeksPerStep} onChangeText={setCustomWeeksPerStep} keyboardType="number-pad" placeholder="4" />
              </Field>
              <Field label="Target dose (mg)" className="flex-1">
                <Input value={customTarget} onChangeText={setCustomTarget} keyboardType="decimal-pad" placeholder="1" />
              </Field>
            </View>
          </View>
        ) : (
          /* Target maintenance dose pills for presets */
          <Field label="Target maintenance dose">
            <View className="flex-row flex-wrap gap-2">
              {targetOptions.map(mg => {
                const active = selectedTarget === mg;
                return (
                  <Pressable
                    key={mg}
                    className="rounded-full border px-3 py-1.5"
                    style={{
                      backgroundColor: active ? colors.primaryTint : 'transparent',
                      borderColor: active ? colors.primary : colors.outline,
                    }}
                    onPress={() => setTargetByPreset(prev => ({ ...prev, [presetKey]: mg }))}
                  >
                    <Text
                      className={`font-mono text-[10px] uppercase tracking-wider ${active ? 'font-medium' : ''}`}
                      style={{ color: active ? colors.tealText : colors.muted }}
                    >
                      {formatMg(mg)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>
        )}

        <Text className="text-xs" style={{ color: colors.muted }}>
          Starting this week ({format(startDate, 'MMM d, yyyy')})
        </Text>
      </Card>

      {/* Results */}
      {customError ? (
        <Card className="mb-3">
          <Text className="text-sm" style={{ color: colors.warning }}>{customError}</Text>
        </Card>
      ) : schedule.length > 0 && maintenanceStep ? (
        <Card className="mb-3">
          <SectionLabel>Schedule</SectionLabel>

          <Text className="text-sm mb-4" style={{ color: colors.text }}>
            {escalationWeeks > 0 ? (
              <>
                Reaches <Text className="font-medium" style={{ color: colors.tealText }}>{formatMg(maintenanceStep.dose)}</Text> maintenance in{' '}
                <Text className="font-medium" style={{ color: colors.tealText }}>{escalationWeeks} weeks</Text>
                {maintenanceDate ? ` (${format(maintenanceDate, 'MMM d, yyyy')})` : ''}.
              </>
            ) : (
              <>
                Starts at the <Text className="font-medium" style={{ color: colors.tealText }}>{formatMg(maintenanceStep.dose)}</Text> maintenance dose this week.
              </>
            )}
          </Text>

          {/* Timeline */}
          <View>
            {schedule.map((step, i) => {
              const isLast = i === schedule.length - 1;
              return (
                <View key={`${step.dose}-${step.startWeek}`} className="flex-row">
                  {/* Dot + connecting line */}
                  <View className="items-center mr-3" style={{ width: 12 }}>
                    <View
                      className="rounded-full"
                      style={{ width: 12, height: 12, marginTop: 3, backgroundColor: colors.primary }}
                    />
                    {!isLast ? (
                      <View className="flex-1" style={{ width: 2, backgroundColor: colors.divider }} />
                    ) : null}
                  </View>

                  {/* Step content */}
                  <View className={`flex-1 ${isLast ? '' : 'pb-4'}`}>
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <Text className="text-sm font-medium" style={{ color: colors.text }}>
                        {formatMg(step.dose)}
                      </Text>
                      {step.isMaintenance ? <Chip label="Maintenance" tone="primary" /> : null}
                    </View>
                    <Text className="text-xs mt-0.5" style={{ color: colors.muted }}>
                      {stepWeekRange(step)}  ·  {stepDateRange(step)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}

      <Banner tone="info">
        Based on FDA labels / published study protocols. Your provider's plan takes precedence.
      </Banner>
    </View>
  );
}
