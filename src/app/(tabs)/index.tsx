import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from '../../tw';
import GradientView from '../../components/Gradient';
import { AnimatedCount, Rise } from '../../components/Anim';
import TodaySection from '../../components/wellness/TodaySection';
import { Banner, Button, Card, Chip, Field, Input, Screen } from '../../components/ui';
import LineChart, { type ChartSeries } from '../../components/LineChart';
import DailyRangeChart, { type RangeDay } from '../../components/DailyRangeChart';
import { useAppContext } from '../../context/AppContext';
import { useThemeMode } from '../../context/ThemeModeContext';
import { calculateSerumCurve, getCurrentConcentration, type GraphMode } from '../../utils/serumModel';
import { calculateDose, formatDose } from '../../utils/calculator';
import { getUpcomingPlannedDoses } from '../../utils/schedule';
import { vialRemainingMg } from '../../utils/tracking';
import { CHART_COLORS, mixHex } from '../../theme/colors';
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
  const { colors } = useThemeMode();
  return (
    <View className="flex-row rounded-md border overflow-hidden self-start" style={{ borderColor: colors.outline }}>
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            className="px-2.5 py-1.5"
            style={{
              backgroundColor: active ? colors.primaryTint : 'transparent',
              borderLeftWidth: i > 0 ? 1 : 0,
              borderLeftColor: colors.outline,
            }}
            onPress={() => onChange(opt.value)}
          >
            <Text
              className={`font-mono text-[10px] uppercase tracking-wider ${active ? 'font-medium' : ''}`}
              style={{ color: active ? colors.tealText : colors.muted }}
            >
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
  const [chartType, setChartType] = useState<'line' | 'dailyRange'>('line');

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

    // Project the decay curve ~20% past "now" (capped at 7 days) — rendered
    // as a dashed segment by LineChart via markerX.
    const projectionMs = Math.min((now - rangeStart) * 0.2, 7 * 24 * 60 * 60 * 1000);
    const chartEnd = now + projectionMs;

    const totalDays = (chartEnd - rangeStart) / (24 * 60 * 60 * 1000);
    const pointsPerDay = rangeDays === 1 ? 24 : totalDays > 14 ? 2 : 4;
    const points = Math.max(Math.round(totalDays * pointsPerDay), 50);

    return activeCompounds
      .map((uc, idx) => {
        const compound = resolveCompound(uc.compoundId);
        if (!compound) return null;
        const compoundDoses = doseLogs.filter(d => d.compoundId === uc.compoundId);
        if (compoundDoses.length === 0) return null;
        const curve = calculateSerumCurve(compoundDoses, compound, rangeStart, chartEnd, points, graphMode);
        return {
          color: uc.color || CHART_COLORS[idx % CHART_COLORS.length],
          points: curve.map(p => ({ x: p.timestamp, y: p.concentration })),
        };
      })
      .filter(Boolean) as ChartSeries[];
  }, [activeCompounds, doseLogs, rangeDays, graphMode, resolveCompound]);

  // Daily min→max range per compound, derived from the same curve, for the
  // "Daily Range" bar view (mirrors the web toggle).
  const dailyRanges = useMemo<RangeDay[]>(() => {
    if (chartSeries.length === 0) return [];
    const now = Date.now();
    const startOfDay = (ts: number) => {
      const d = new Date(ts);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    };
    const dayStarts = new Set<number>();
    const seriesDayRanges = chartSeries.map(s => {
      const m = new Map<number, { min: number; max: number }>();
      // Exclude the dashed forward projection from daily-range bars.
      for (const p of s.points.filter(pt => pt.x <= now)) {
        const day = startOfDay(p.x);
        dayStarts.add(day);
        const cur = m.get(day);
        if (!cur) m.set(day, { min: p.y, max: p.y });
        else { cur.min = Math.min(cur.min, p.y); cur.max = Math.max(cur.max, p.y); }
      }
      return { color: s.color, m };
    });
    return [...dayStarts].sort((a, b) => a - b).map(day => ({
      ts: day,
      bars: seriesDayRanges.map(sd => {
        const r = sd.m.get(day) ?? { min: 0, max: 0 };
        return { color: sd.color, min: r.min, max: r.max };
      }),
    }));
  }, [chartSeries]);

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
      {/* Brand hero */}
      <GradientView
        colors={['#0E7490', '#0891A8', '#6D5AE6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        borderRadius={20}
        className="rounded-[20px] px-4 py-5 mb-3 overflow-hidden items-center"
      >
        <View className="absolute top-3 right-3 rounded-full px-2.5 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
          <Text className="font-mono text-[10px] uppercase tracking-wider text-white font-semibold">Beta</Text>
        </View>
        <View className="flex-row items-center gap-2.5">
          <Image
            source={require('../../../assets/images/icon.png')}
            style={{ width: 40, height: 40, borderRadius: 11 }}
            contentFit="contain"
          />
          <Text className="text-white text-2xl font-extrabold">PeptideIQ</Text>
        </View>
        <Text className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.8)' }}>Track. Dose. Optimize.</Text>
        <View className="flex-row items-center gap-1.5 mt-2.5">
          <MaterialIcons name="science" size={13} color="rgba(255,255,255,0.85)" />
          <Text className="text-[11px]" style={{ color: 'rgba(255,255,255,0.85)' }}>
            Estimated from population PK — <Text className="font-bold text-white">not a lab value.</Text>
          </Text>
        </View>
      </GradientView>

      {isNewUser ? (
        <NewUserCard />
      ) : (
        <>
          {/* Stat cards */}
          <Rise delay={60}>
            <View className="flex-row flex-wrap gap-2 mb-3">
              <StatCard icon="science" label="Active Compounds" value={String(activeCompounds.length)} detail="in your stack" accent="teal" />
              <StatCard icon="trending-up" label="Doses Logged" value={String(totalDoses)} detail="all time" accent="violet" />
              <StatCard
                icon="event"
                label="Last Dose"
                value={lastDose ? resolveCompound(lastDose.compoundId)?.genericName ?? '?' : 'None'}
                detail={lastDose ? new Date(lastDose.timestamp).toLocaleDateString() : undefined}
                accent="amber"
              />
            </View>
          </Rise>

          {/* Daily wellness */}
          <Rise delay={90}>
            <TodaySection />
          </Rise>

          {/* Current levels */}
          {currentLevels.length > 0 ? (
            <Rise delay={120}>
            <View className="flex-row flex-wrap gap-2 mb-3">
              {currentLevels.map(c => (
                <GradientView
                  key={c.userCompound.id}
                  colors={[mixHex(c.color, '#000000', 0.08), mixHex(c.color, '#0B1120', 0.52)]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1.1 }}
                  borderRadius={16}
                  className="basis-[47%] grow rounded-2xl px-3.5 py-3.5"
                  style={{
                    shadowColor: c.color,
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 5 },
                    elevation: 3,
                  }}
                >
                  <View className="flex-row items-center gap-1.5">
                    <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.9)' }} />
                    <Text className="font-mono text-[10px] uppercase tracking-wider font-bold flex-1 text-white" numberOfLines={1}>
                      {c.name}
                    </Text>
                  </View>
                  <AnimatedCount
                    value={c.level}
                    decimals={graphMode === 'bodyLoad' ? 3 : 1}
                    className="font-mono font-extrabold text-[26px] leading-8 mt-2 text-white"
                  />
                  <Text className="font-mono text-[10px] uppercase tracking-wide font-bold mt-0.5" style={{ color: 'rgba(255,255,255,0.82)' }}>
                    {graphMode === 'bodyLoad' ? 'mg · remaining' : 'mcg'}
                  </Text>
                </GradientView>
              ))}
            </View>
            </Rise>
          ) : null}

          {/* Chart */}
          <Card className="p-4 mb-3">
            <View className="flex-row items-center gap-2 mb-2 flex-wrap">
              <Text className="text-base font-bold" style={{ color: colors.text }}>
                {graphMode === 'bodyLoad' ? 'Body Load' : 'Serum Concentration'}
              </Text>
              <Chip label="Estimated" tone="warning" />
            </View>
            {/* Chart type: Line ↔ Daily Range */}
            <View className="mb-2">
              <Segmented
                value={chartType}
                options={[
                  { value: 'line' as const, label: 'Line' },
                  { value: 'dailyRange' as const, label: 'Daily Range' },
                ]}
                onChange={setChartType}
              />
            </View>
            {/* Metric: Body Load ↔ Concentration */}
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
                {chartType === 'line' ? (
                  <LineChart
                    series={chartSeries}
                    height={260}
                    markerX={Date.now()}
                    xFormatter={xFormatter}
                    yFormatter={y => (graphMode === 'bodyLoad' ? y.toFixed(y >= 10 ? 0 : 1) : y.toFixed(0))}
                  />
                ) : (
                  <DailyRangeChart
                    days={dailyRanges}
                    seriesCount={chartSeries.length}
                    height={260}
                    xFormatter={ts => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    yFormatter={y => (graphMode === 'bodyLoad' ? y.toFixed(y >= 10 ? 0 : 1) : y.toFixed(0))}
                  />
                )}
                {/* Legend */}
                <View className="flex-row flex-wrap gap-x-4 gap-y-1 mt-2">
                  {currentLevels.map(c => (
                    <View key={c.userCompound.id} className="flex-row items-center gap-1.5">
                      <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      <Text className="font-mono text-[10px]" style={{ color: colors.muted }}>{c.name}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View className="items-center py-12">
                <MaterialIcons name="science" size={56} color={colors.divider} />
                <Text className="text-base mt-3" style={{ color: colors.muted }}>No data yet</Text>
                <Text className="text-xs mt-1 text-center" style={{ color: colors.muted }}>
                  Add peptides and log doses to see your concentration graph
                </Text>
              </View>
            )}
          </Card>

          {/* Next dose */}
          <Card className="p-4 mb-3">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-bold" style={{ color: colors.text }}>Next Dose</Text>
              <MaterialIcons name="calendar-month" size={20} color={colors.primary} />
            </View>
            {nextDose ? (
              <>
                <Text className="text-xs font-bold mb-1" style={{ color: colors.tealText }}>Upcoming</Text>
                <Text className="text-[24px] font-extrabold leading-7" style={{ color: colors.text }}>{relativeDayLabel(nextDose.scheduledAt)}</Text>
                <Text className="text-[13px] mt-1 mb-2" style={{ color: colors.muted }}>
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
                  <Text className="text-base font-bold" style={{ color: colors.text }}>Active Peptides</Text>
                  <Chip label={String(activeCompounds.length)} tone="primary" />
                </View>
                <Pressable onPress={() => router.push('/my-peptides')}>
                  <Text className="text-xs font-medium" style={{ color: colors.primary }}>Manage</Text>
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
                      className="rounded-md p-3"
                      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder, borderLeftWidth: 3, borderLeftColor: color }}
                      onPress={() => router.push(`/compound/${uc.id}`)}
                    >
                      <View className="flex-row items-center gap-2">
                        <View className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <Text className="font-extrabold flex-1" style={{ color: colors.text }} numberOfLines={1}>{compound.genericName}</Text>
                        <MaterialIcons name="arrow-forward" size={15} color={colors.muted} />
                      </View>
                      <Text className="text-xs mt-0.5" style={{ color: colors.muted }}>
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
  const { colors } = useThemeMode();
  return (
    <Card className="p-5" style={{ backgroundColor: colors.primaryTint }}>
      <Text className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: colors.tealText }}>Welcome to PeptideIQ</Text>
      <Text className="text-base font-bold mb-1" style={{ color: colors.text }}>Let's get you set up.</Text>
      <Text className="text-[13px] mb-4 leading-5" style={{ color: colors.muted }}>
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

// Tinted analytics tile: big number, bold label, muted sublabel, ghosted icon.
function StatCard({ icon, label, value, detail, accent = 'teal' }: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
  detail?: string;
  accent?: 'teal' | 'violet' | 'amber' | 'neutral';
}) {
  const { colors, resolvedMode } = useThemeMode();
  const light = resolvedMode === 'light';
  const accents = {
    teal: { bg: light ? 'rgba(14,165,183,0.10)' : 'rgba(34,211,238,0.13)', fg: colors.tealText },
    violet: { bg: light ? 'rgba(124,58,237,0.09)' : 'rgba(167,139,250,0.14)', fg: colors.violetText },
    amber: { bg: light ? 'rgba(217,119,6,0.10)' : 'rgba(251,191,36,0.13)', fg: colors.warning },
    neutral: { bg: colors.surface, fg: colors.text },
  } as const;
  const a = accents[accent];
  return (
    <View
      className="basis-[47%] grow rounded-2xl px-3.5 py-3.5 overflow-hidden"
      style={{ backgroundColor: a.bg, borderWidth: 1, borderColor: accent === 'neutral' ? colors.cardBorder : 'transparent' }}
    >
      <MaterialIcons
        name={icon}
        size={34}
        color={a.fg}
        style={{ position: 'absolute', top: 10, right: 10, opacity: 0.28 }}
      />
      <Text className="font-mono font-extrabold text-[26px] leading-8" style={{ color: a.fg }} numberOfLines={1}>
        {value}
      </Text>
      <Text className="text-[13px] font-bold mt-0.5" style={{ color: colors.text }} numberOfLines={1}>{label}</Text>
      {detail ? <Text className="text-[11px] mt-0.5" style={{ color: colors.muted }} numberOfLines={1}>{detail}</Text> : null}
    </View>
  );
}

function QuickCalculatorCard({ quickCompound, quickCalc }: {
  quickCompound: UserCompound | null;
  quickCalc: ReturnType<typeof calculateDose> | null;
}) {
  const router = useRouter();
  const { colors } = useThemeMode();
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
      <Text className="text-base font-bold mb-3" style={{ color: colors.text }}>Quick Calculator</Text>
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
          <View className="flex-row rounded-md overflow-hidden mt-1" style={{ backgroundColor: colors.primaryTint }}>
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
        <Text className="text-[13px] mb-2" style={{ color: colors.muted }}>
          Add vial strength and water volume to enable quick calculations.
        </Text>
      )}
      <Button title="Open Full Calculator" variant="outlined" onPress={() => router.push('/calculator')} className="mt-3" />
    </Card>
  );
}

function CalcResult({ label, value, unit }: { label: string; value: string; unit: string }) {
  const { colors } = useThemeMode();
  return (
    <View className="flex-1 items-center py-3 px-1">
      <Text className="font-mono text-[8px] uppercase font-bold" style={{ color: colors.muted }} numberOfLines={1}>{label}</Text>
      <Text className="font-mono text-lg font-extrabold mt-1" style={{ color: colors.tealText }} numberOfLines={1}>{value}</Text>
      <Text className="text-[11px] mt-0.5" style={{ color: colors.muted }} numberOfLines={1}>{unit}</Text>
    </View>
  );
}

function RailRow({ label, value }: { label: string; value: string }) {
  const { colors } = useThemeMode();
  return (
    <View className="flex-row justify-between gap-3 py-2.5" style={{ borderTopWidth: 1, borderTopColor: colors.divider }}>
      <Text className="text-xs" style={{ color: colors.muted }}>{label}</Text>
      <Text className="text-[13px] font-extrabold text-right flex-1" style={{ color: colors.text }} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function DataCell({ label, value }: { label: string; value: string }) {
  const { colors } = useThemeMode();
  return (
    <View className="flex-1">
      <Text className="text-[11px]" style={{ color: colors.muted }}>{label}</Text>
      <Text className="text-[11px] font-bold mt-0.5" style={{ color: colors.text }} numberOfLines={1}>{value}</Text>
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
