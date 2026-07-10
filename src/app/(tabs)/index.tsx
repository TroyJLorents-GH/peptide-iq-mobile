import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from '../../tw';
import { Banner, Button, Card, Chip, Field, Input, Screen } from '../../components/ui';
import LineChart, { type ChartSeries } from '../../components/LineChart';
import { useAppContext } from '../../context/AppContext';
import { useThemeMode } from '../../context/ThemeModeContext';
import { calculateSerumCurve, getCurrentConcentration, type GraphMode } from '../../utils/serumModel';
import { calculateDose, formatDose } from '../../utils/calculator';
import { getUpcomingPlannedDoses } from '../../utils/schedule';
import { vialRemainingMg } from '../../utils/tracking';
import { CHART_COLORS } from '../../theme/colors';
import type { UserCompound } from '../../types';

const RANGE_OPTIONS = [
  { label: 'Current', days: 1 },
  { label: '7D', days: 7 },
  { label: '14D', days: 14 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: 'All', days: 0 },
];

type QuickCalcMode = 'reconstitution' | 'units' | 'dose';

// Small mono-uppercase segmented toggle, mirrors the web ToggleButtonGroup
function Segmented<T extends string | number>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row rounded-md border border-outline overflow-hidden self-start">
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            className={`px-2.5 py-1.5 ${active ? 'bg-primary-tint' : ''} ${i > 0 ? 'border-l border-outline' : ''}`}
            onPress={() => onChange(opt.value)}
          >
            <Text className={`font-mono text-[10px] uppercase tracking-wider ${active ? 'text-teal-text font-medium' : 'text-muted'}`}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function DashboardScreen() {
  const { userCompounds, doseLogs, userVials, resolveCompound } = useAppContext();
  const { colors } = useThemeMode();
  const router = useRouter();

  const [rangeDays, setRangeDays] = useState(7);
  const [graphMode, setGraphMode] = useState<GraphMode>('bodyLoad');

  const activeCompounds = useMemo(() => userCompounds.filter(uc => uc.active), [userCompounds]);

  const chartSeries = useMemo<ChartSeries[]>(() => {
    if (activeCompounds.length === 0 || doseLogs.length === 0) return [];

    const now = Date.now();
    let rangeStart: number;
    if (rangeDays === 0) {
      const firstDoseTime = doseLogs
        .map(d => new Date(d.timestamp).getTime())
        .reduce((min, t) => Math.min(min, t), now);
      rangeStart = firstDoseTime - 24 * 60 * 60 * 1000;
    } else {
      rangeStart = now - rangeDays * 24 * 60 * 60 * 1000;
    }

    const totalDays = (now - rangeStart) / (24 * 60 * 60 * 1000);
    const pointsPerDay = rangeDays === 1 ? 24 : totalDays > 14 ? 2 : 4;
    const points = Math.max(Math.round(totalDays * pointsPerDay), 50);

    return activeCompounds
      .map((uc, idx) => {
        const compound = resolveCompound(uc.compoundId);
        if (!compound) return null;
        const compoundDoses = doseLogs.filter(d => d.compoundId === uc.compoundId);
        if (compoundDoses.length === 0) return null;
        const curve = calculateSerumCurve(compoundDoses, compound, rangeStart, now, points, graphMode);
        return {
          color: uc.color || CHART_COLORS[idx % CHART_COLORS.length],
          points: curve.map(p => ({ x: p.timestamp, y: p.concentration })),
        };
      })
      .filter(Boolean) as ChartSeries[];
  }, [activeCompounds, doseLogs, rangeDays, graphMode, resolveCompound]);

  const currentLevels = useMemo(() => {
    return activeCompounds
      .map((uc, idx) => {
        const compound = resolveCompound(uc.compoundId);
        if (!compound) return null;
        const compoundDoses = doseLogs.filter(d => d.compoundId === uc.compoundId);
        const level = compoundDoses.length > 0 ? getCurrentConcentration(compoundDoses, compound, graphMode) : 0;
        return {
          userCompound: uc,
          name: compound.genericName,
          level,
          color: uc.color || CHART_COLORS[idx % CHART_COLORS.length],
        };
      })
      .filter(Boolean) as { userCompound: UserCompound; name: string; level: number; color: string }[];
  }, [activeCompounds, doseLogs, graphMode, resolveCompound]);

  const totalDoses = doseLogs.length;
  const lastDose = doseLogs.length > 0
    ? doseLogs.reduce((latest, d) => (new Date(d.timestamp) > new Date(latest.timestamp) ? d : latest))
    : null;

  const upcomingDoses = useMemo(
    () => getUpcomingPlannedDoses(activeCompounds, doseLogs),
    [activeCompounds, doseLogs],
  );
  const nextDose = upcomingDoses[0] ?? null;
  const nextDoseCompound = nextDose ? resolveCompound(nextDose.compoundId) : null;
  const nextDoseUserCompound = nextDose
    ? activeCompounds.find(uc => uc.id === nextDose.userCompoundId) ?? null
    : null;
  const quickCompound = nextDoseUserCompound ?? activeCompounds[0] ?? null;
  const quickCalc = quickCompound && quickCompound.vialStrengthMg > 0 && quickCompound.waterVolumeMl > 0
    ? calculateDose(quickCompound.doseAmountMcg, quickCompound.vialStrengthMg, quickCompound.waterVolumeMl)
    : null;

  const isNewUser = userCompounds.length === 0 && doseLogs.length === 0;

  const xFormatter = (x: number) => {
    const d = new Date(x);
    return rangeDays === 1
      ? d.toLocaleString(undefined, { hour: 'numeric' })
      : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <Screen>
      <View className="flex-row items-center gap-1.5 mb-3 flex-wrap">
        <MaterialIcons name="science" size={15} color={colors.primary} />
        <Text className="text-xs text-muted">
          Estimated from population PK — <Text className="text-warn font-bold">not a measured lab value.</Text>
        </Text>
      </View>

      {isNewUser ? (
        <NewUserCard />
      ) : (
        <>
          {/* Stat cards */}
          <View className="flex-row flex-wrap gap-2 mb-3">
            <StatCard icon="science" label="Active Compounds" value={String(activeCompounds.length)} />
            <StatCard icon="trending-up" label="Doses Logged" value={String(totalDoses)} />
            <StatCard
              icon="event"
              label="Last Dose"
              value={lastDose ? resolveCompound(lastDose.compoundId)?.genericName ?? '?' : 'None'}
              detail={lastDose ? new Date(lastDose.timestamp).toLocaleDateString() : undefined}
            />
          </View>

          {/* Current levels */}
          {currentLevels.length > 0 ? (
            <View className="flex-row flex-wrap gap-2 mb-3">
              {currentLevels.map(c => (
                <View
                  key={c.userCompound.id}
                  className="basis-[47%] grow bg-surface border border-card-border rounded-lg px-3.5 py-3"
                  style={{ borderLeftWidth: 3, borderLeftColor: c.color }}
                >
                  <Text className="font-mono text-[10px] uppercase tracking-wider font-bold" style={{ color: c.color }} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text className="font-mono font-bold text-[24px] text-ink leading-7 mt-1.5">
                    {graphMode === 'bodyLoad' ? c.level.toFixed(3) : c.level.toFixed(1)}
                  </Text>
                  <Text className="font-mono text-[10px] uppercase tracking-wide text-muted mt-1 font-bold">
                    {graphMode === 'bodyLoad' ? 'mg · remaining' : 'mcg'}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Chart */}
          <Card className="p-4 mb-3">
            <View className="flex-row items-center gap-2 mb-2 flex-wrap">
              <Text className="text-base font-bold text-ink">
                {graphMode === 'bodyLoad' ? 'Body Load' : 'Serum Concentration'}
              </Text>
              <Chip label="Estimated" tone="warning" />
            </View>
            <View className="mb-2">
              <Segmented
                value={graphMode}
                options={[
                  { value: 'bodyLoad' as GraphMode, label: 'Body Load (mg)' },
                  { value: 'concentration' as GraphMode, label: 'Concentration (mcg)' },
                ]}
                onChange={setGraphMode}
              />
            </View>
            <View className="mb-3">
              <Segmented value={rangeDays} options={RANGE_OPTIONS.map(o => ({ value: o.days, label: o.label }))} onChange={setRangeDays} />
            </View>

            {chartSeries.length > 0 ? (
              <>
                <LineChart
                  series={chartSeries}
                  height={260}
                  xFormatter={xFormatter}
                  yFormatter={y => (graphMode === 'bodyLoad' ? y.toFixed(y >= 10 ? 0 : 1) : y.toFixed(0))}
                />
                {/* Legend */}
                <View className="flex-row flex-wrap gap-x-4 gap-y-1 mt-2">
                  {currentLevels.map(c => (
                    <View key={c.userCompound.id} className="flex-row items-center gap-1.5">
                      <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      <Text className="font-mono text-[10px] text-muted">{c.name}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View className="items-center py-12">
                <MaterialIcons name="science" size={56} color={colors.divider} />
                <Text className="text-base text-muted mt-3">No data yet</Text>
                <Text className="text-xs text-muted mt-1 text-center">
                  Add peptides and log doses to see your concentration graph
                </Text>
              </View>
            )}
          </Card>

          {/* Next dose */}
          <Card className="p-4 mb-3">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-bold text-ink">Next Dose</Text>
              <MaterialIcons name="calendar-month" size={20} color={colors.primary} />
            </View>
            {nextDose ? (
              <>
                <Text className="text-xs font-bold text-teal-text mb-1">Upcoming</Text>
                <Text className="text-[24px] font-extrabold text-ink leading-7">{relativeDayLabel(nextDose.scheduledAt)}</Text>
                <Text className="text-[13px] text-muted mt-1 mb-2">
                  {new Date(nextDose.scheduledAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                <RailRow label="Compound" value={nextDoseCompound?.genericName ?? 'Unknown'} />
                <RailRow label="Dose" value={formatDose(nextDose.doseMcg)} />
                <RailRow label="Week" value={`Week ${nextDose.weekNumber}`} />
                <Button title="View Full Schedule" onPress={() => router.push('/schedule')} className="mt-3" />
              </>
            ) : (
              <>
                <Text className="text-[13px] text-muted mb-3">No upcoming doses are currently scheduled.</Text>
                <Button title="Manage Peptides" variant="outlined" onPress={() => router.push('/my-peptides')} />
              </>
            )}
          </Card>

          {/* Active peptides */}
          {activeCompounds.length > 0 ? (
            <Card className="p-4 mb-3">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-bold text-ink">Active Peptides</Text>
                  <Chip label={String(activeCompounds.length)} tone="primary" />
                </View>
                <Pressable onPress={() => router.push('/my-peptides')}>
                  <Text className="text-xs text-primary font-medium">Manage</Text>
                </Pressable>
              </View>
              <View className="gap-2">
                {activeCompounds.map((uc, idx) => {
                  const compound = resolveCompound(uc.compoundId);
                  if (!compound) return null;
                  const color = uc.color || CHART_COLORS[idx % CHART_COLORS.length];
                  const recentDoses = doseLogs
                    .filter(d => d.compoundId === uc.compoundId)
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                  const lastCompoundDose = recentDoses[0];
                  const nextCompoundDose = upcomingDoses.find(d => d.userCompoundId === uc.id);
                  const vialStatus = vialRemainingMg(uc, recentDoses, userVials);

                  return (
                    <Pressable
                      key={uc.id}
                      className="bg-surface border border-card-border rounded-md p-3"
                      style={{ borderLeftWidth: 3, borderLeftColor: color }}
                      onPress={() => router.push(`/compound/${uc.id}`)}
                    >
                      <View className="flex-row items-center gap-2">
                        <View className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <Text className="font-extrabold text-ink flex-1" numberOfLines={1}>{compound.genericName}</Text>
                        <MaterialIcons name="arrow-forward" size={15} color={colors.muted} />
                      </View>
                      <Text className="text-xs text-muted mt-0.5">
                        {formatDose(uc.doseAmountMcg)} · {formatFrequency(uc.doseFrequencyHours)}
                      </Text>
                      <View className="flex-row gap-4 mt-2">
                        <DataCell label="Last" value={lastCompoundDose ? shortDateTime(lastCompoundDose.timestamp) : 'None'} />
                        <DataCell label="Next" value={nextCompoundDose ? shortDateTime(nextCompoundDose.scheduledAt) : 'None'} />
                        <DataCell label="Remaining" value={vialStatus.remainingMg !== null ? `${vialStatus.remainingMg.toFixed(2)} mg` : 'Not set'} />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          ) : (
            <View className="mb-3">
              <Banner tone="info">
                No active peptides. Toggle one back on, or add another from the My Peptides tab.
              </Banner>
            </View>
          )}

          <QuickCalculatorCard quickCompound={quickCompound} quickCalc={quickCalc} />
        </>
      )}
    </Screen>
  );
}

function NewUserCard() {
  const router = useRouter();
  return (
    <Card className="p-5 bg-primary-tint">
      <Text className="font-mono text-[10px] uppercase tracking-widest text-teal-text mb-2">Welcome to PeptideIQ</Text>
      <Text className="text-base font-bold text-ink mb-1">Let's get you set up.</Text>
      <Text className="text-[13px] text-muted mb-4 leading-5">
        Pick a peptide from the library, log your first dose, and set a goal — your dashboard will fill in as you go.
      </Text>
      <View className="gap-2">
        <Button title="Add your first peptide" onPress={() => router.push('/my-peptides')} />
        <Button title="Browse the library" variant="outlined" onPress={() => router.push('/library')} />
        <Button title="Set a weight goal" variant="outlined" onPress={() => router.push('/progress')} />
      </View>
    </Card>
  );
}

function StatCard({ icon, label, value, detail }: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
  detail?: string;
}) {
  const { colors } = useThemeMode();
  return (
    <View className="basis-[47%] grow bg-surface border border-card-border rounded-lg px-3.5 py-3 flex-row items-center justify-between gap-2">
      <View className="flex-1">
        <Text className="font-mono text-[10px] uppercase tracking-wider text-muted font-bold">{label}</Text>
        <Text className="font-mono font-bold text-base text-ink mt-1" numberOfLines={1}>{value}</Text>
        {detail ? <Text className="text-xs text-muted font-bold mt-0.5">{detail}</Text> : null}
      </View>
      <View className="w-10 h-10 rounded-full bg-primary-tint items-center justify-center">
        <MaterialIcons name={icon} size={18} color={colors.tealText} />
      </View>
    </View>
  );
}

function QuickCalculatorCard({ quickCompound, quickCalc }: {
  quickCompound: UserCompound | null;
  quickCalc: ReturnType<typeof calculateDose> | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<QuickCalcMode>('reconstitution');
  const [doseMg, setDoseMg] = useState('0.25');
  const [vialMg, setVialMg] = useState('5');
  const [waterMl, setWaterMl] = useState('2');
  const [units, setUnits] = useState('5');

  useEffect(() => {
    if (!quickCompound) return;
    setDoseMg(formatNumberInput(quickCompound.doseAmountMcg / 1000));
    setVialMg(formatNumberInput(quickCompound.vialStrengthMg));
    setWaterMl(formatNumberInput(quickCompound.waterVolumeMl));
    if (quickCalc) setUnits(formatNumberInput(quickCalc.syringeUnits));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickCompound?.id, quickCompound?.doseAmountMcg, quickCompound?.vialStrengthMg, quickCompound?.waterVolumeMl, quickCalc?.syringeUnits]);

  const numericDoseMg = parsePositiveNumber(doseMg);
  const numericVialMg = parsePositiveNumber(vialMg);
  const numericWaterMl = parsePositiveNumber(waterMl);
  const numericUnits = parsePositiveNumber(units);
  const liveCalc = numericDoseMg > 0 && numericVialMg > 0 && numericWaterMl > 0
    ? calculateDose(numericDoseMg * 1000, numericVialMg, numericWaterMl)
    : null;
  const concentrationMgPerMl = numericVialMg > 0 && numericWaterMl > 0 ? numericVialMg / numericWaterMl : 0;
  const doseFromUnitsMg = numericUnits > 0 && concentrationMgPerMl > 0 ? (numericUnits / 100) * concentrationMgPerMl : 0;
  const doseFromUnitsMcg = doseFromUnitsMg * 1000;

  const handleModeChange = (nextMode: QuickCalcMode) => {
    if (nextMode === 'dose' && liveCalc) setUnits(formatNumberInput(liveCalc.syringeUnits));
    setMode(nextMode);
  };

  return (
    <Card className="p-4">
      <Text className="text-base font-bold text-ink mb-3">Quick Calculator</Text>
      <View className="mb-3">
        <Segmented
          value={mode}
          options={[
            { value: 'reconstitution' as QuickCalcMode, label: 'Reconstitution' },
            { value: 'units' as QuickCalcMode, label: 'Units' },
            { value: 'dose' as QuickCalcMode, label: 'Dose' },
          ]}
          onChange={handleModeChange}
        />
      </View>
      {quickCompound ? (
        <>
          {mode === 'dose' ? (
            <Field label="Syringe units">
              <Input value={units} onChangeText={setUnits} keyboardType="decimal-pad" />
            </Field>
          ) : (
            <Field label="Dose (mg)">
              <Input value={doseMg} onChangeText={setDoseMg} keyboardType="decimal-pad" />
            </Field>
          )}
          <Field label="Vial strength (mg)">
            <Input value={vialMg} onChangeText={setVialMg} keyboardType="decimal-pad" />
          </Field>
          <Field label="Water volume (mL)">
            <Input value={waterMl} onChangeText={setWaterMl} keyboardType="decimal-pad" />
          </Field>
          <View className="flex-row rounded-md overflow-hidden bg-primary-tint mt-1">
            {mode === 'dose' ? (
              <>
                <CalcResult label="Dose" value={doseFromUnitsMg > 0 ? formatCompactNumber(doseFromUnitsMg) : '-'} unit="mg" />
                <CalcResult label="Dose" value={doseFromUnitsMcg > 0 ? formatCompactNumber(doseFromUnitsMcg) : '-'} unit="mcg" />
                <CalcResult label="Conc." value={concentrationMgPerMl > 0 ? formatCompactNumber(concentrationMgPerMl) : '-'} unit="mg/mL" />
              </>
            ) : (
              <>
                <CalcResult label="Conc." value={liveCalc ? formatCompactNumber(liveCalc.concentrationMgPerMl) : '-'} unit="mg/mL" />
                <CalcResult
                  label={mode === 'units' ? 'Draw' : 'Units/mg'}
                  value={liveCalc ? (mode === 'units' ? formatCompactNumber(liveCalc.syringeUnits) : formatCompactNumber(100 / liveCalc.concentrationMgPerMl)) : '-'}
                  unit="units"
                />
                <CalcResult
                  label={mode === 'units' ? 'Doses/vial' : 'Units'}
                  value={liveCalc ? (mode === 'units' ? String(liveCalc.dosesPerVial) : formatCompactNumber(liveCalc.syringeUnits)) : '-'}
                  unit={mode === 'units' ? 'doses' : 'units'}
                />
              </>
            )}
          </View>
          <Text className="text-[11px] text-muted mt-2 leading-4">
            {mode === 'dose'
              ? 'Enter drawn syringe units to estimate the delivered dose.'
              : 'Edit dose, vial strength, or water volume for a live U-100 syringe calculation.'}
          </Text>
        </>
      ) : (
        <Text className="text-[13px] text-muted mb-2">
          Add vial strength and water volume to enable quick calculations.
        </Text>
      )}
      <Button title="Open Full Calculator" variant="outlined" onPress={() => router.push('/calculator')} className="mt-3" />
    </Card>
  );
}

function CalcResult({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View className="flex-1 items-center py-3 px-1">
      <Text className="font-mono text-[8px] uppercase text-muted font-bold" numberOfLines={1}>{label}</Text>
      <Text className="font-mono text-violet-text text-lg font-extrabold mt-1" numberOfLines={1}>{value}</Text>
      <Text className="text-[11px] text-muted mt-0.5" numberOfLines={1}>{unit}</Text>
    </View>
  );
}

function RailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-3 py-2.5 border-t border-divider">
      <Text className="text-xs text-muted">{label}</Text>
      <Text className="text-[13px] font-extrabold text-ink text-right flex-1" numberOfLines={1}>{value}</Text>
    </View>
  );
}

function DataCell({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1">
      <Text className="text-[11px] text-muted">{label}</Text>
      <Text className="text-[11px] font-bold text-ink mt-0.5" numberOfLines={1}>{value}</Text>
    </View>
  );
}

function relativeDayLabel(timestamp: number): string {
  const target = new Date(timestamp);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDay = new Date(target);
  targetDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((targetDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  return target.toLocaleDateString(undefined, { weekday: 'long' });
}

function parsePositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatNumberInput(value: number) {
  if (!Number.isFinite(value)) return '';
  return Number.isInteger(value) ? value.toString() : Number(value.toFixed(3)).toString();
}

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return '-';
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return Number(value.toFixed(1)).toString();
  return Number(value.toFixed(3)).toString();
}

function shortDateTime(timestamp: string | number | Date): string {
  return new Date(timestamp).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatFrequency(hours: number): string {
  if (hours < 24) return `every ${hours}h`;
  if (hours === 24) return 'daily';
  if (hours === 48) return 'every other day';
  const days = hours / 24;
  if (days === 7) return 'weekly';
  if (days === 14) return 'every 2 weeks';
  if (days === 28) return 'monthly';
  if (Number.isInteger(days)) return `every ${days} days`;
  return `every ${hours}h`;
}
