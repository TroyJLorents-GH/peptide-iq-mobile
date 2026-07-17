import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert as RNAlert } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { AnimatedCount } from '../components/Anim';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, TouchableOpacity, View } from '../tw';
import { Banner, Button, Card, Divider, Field, FormModal, Input, Screen, SectionLabel } from '../components/ui';
import DateTimeField from '../components/DateTimeField';
import LineChart from '../components/LineChart';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeModeContext';
import { supabase } from '../lib/supabase';

interface WeightLog {
  id: string;
  weight_lbs: number;
  body_fat_pct: number | null;
  notes: string;
  recorded_at: string;
}

interface UserGoal {
  start_weight_lbs: number | null;
  goal_weight_lbs: number | null;
  target_date: string | null;
  height_inches: number | null;
}

type TrendRange = '7d' | '30d' | '90d' | '6m' | '1y' | 'all';

const TREND_RANGES: { value: TrendRange; label: string; days: number | null }[] = [
  { value: '7d', label: '7D', days: 7 },
  { value: '30d', label: '30D', days: 30 },
  { value: '90d', label: '90D', days: 90 },
  { value: '6m', label: '6M', days: 183 },
  { value: '1y', label: '1Y', days: 365 },
  { value: 'all', label: 'All', days: null },
];

export default function ProgressScreen() {
  const { user } = useAuth();
  const { colors } = useThemeMode();

  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [goal, setGoal] = useState<UserGoal>({
    start_weight_lbs: null,
    goal_weight_lbs: null,
    target_date: null,
    height_inches: null,
  });
  const [loading, setLoading] = useState(true);
  const [trendRange, setTrendRange] = useState<TrendRange>('all');

  // add / edit entry modal
  const [addOpen, setAddOpen] = useState(false);
  const [addWeight, setAddWeight] = useState('');
  const [addBodyFat, setAddBodyFat] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [addDate, setAddDate] = useState(new Date());
  const [addSaving, setAddSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // goal modal
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalStart, setGoalStart] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalHeight, setGoalHeight] = useState('');
  const [goalSaving, setGoalSaving] = useState(false);

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [logsRes, goalRes] = await Promise.all([
      supabase.from('weight_logs').select('*').eq('user_id', user.id).order('recorded_at', { ascending: true }),
      supabase.from('user_goals').select('*').eq('user_id', user.id).maybeSingle(),
    ]);
    if (logsRes.data) setLogs(logsRes.data);
    if (goalRes.data) {
      setGoal({
        start_weight_lbs: goalRes.data.start_weight_lbs,
        goal_weight_lbs: goalRes.data.goal_weight_lbs,
        target_date: goalRes.data.target_date,
        height_inches: goalRes.data.height_inches,
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const sortedLogs = useMemo(
    () => [...logs].sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()),
    [logs],
  );

  const currentWeight = sortedLogs[0]?.weight_lbs ?? null;
  const startWeight = goal.start_weight_lbs ?? logs[0]?.weight_lbs ?? null;
  const goalWeight = goal.goal_weight_lbs ?? null;

  const progressPct = useMemo(() => {
    if (!startWeight || !goalWeight || !currentWeight) return 0;
    const totalDelta = startWeight - goalWeight;
    const currentDelta = startWeight - currentWeight;
    return totalDelta !== 0 ? Math.max(0, Math.min(100, (currentDelta / totalDelta) * 100)) : 0;
  }, [startWeight, goalWeight, currentWeight]);

  const bmi = useMemo(() => {
    if (!currentWeight || !goal.height_inches) return null;
    return (currentWeight / (goal.height_inches * goal.height_inches)) * 703;
  }, [currentWeight, goal.height_inches]);

  const currentBodyFat = sortedLogs.find(l => l.body_fat_pct !== null)?.body_fat_pct ?? null;
  const firstBodyFat = logs.find(l => l.body_fat_pct !== null)?.body_fat_pct ?? null;
  const currentLeanMass = currentWeight && currentBodyFat !== null ? currentWeight * (1 - currentBodyFat / 100) : null;
  const firstWithBodyFat = logs.find(l => l.body_fat_pct !== null);
  const firstLeanMass = firstWithBodyFat && firstWithBodyFat.body_fat_pct !== null
    ? firstWithBodyFat.weight_lbs * (1 - firstWithBodyFat.body_fat_pct / 100)
    : null;
  const toGo = currentWeight && goalWeight ? goalWeight - currentWeight : null;

  const chartPoints = useMemo(() => {
    if (logs.length === 0) return [];
    const range = TREND_RANGES.find(r => r.value === trendRange);
    const cutoff = range?.days ? Date.now() - range.days * 24 * 60 * 60 * 1000 : null;
    const ascending = [...logs].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
    const visible = ascending.filter(l => cutoff === null || new Date(l.recorded_at).getTime() >= cutoff);
    const chartLogs = visible.length > 0 ? visible : ascending.slice(-1);
    return chartLogs.map(l => ({ x: new Date(l.recorded_at).getTime(), y: l.weight_lbs }));
  }, [logs, trendRange]);

  const resetAddForm = () => {
    setEditId(null);
    setAddWeight('');
    setAddBodyFat('');
    setAddNotes('');
    setAddDate(new Date());
  };

  const handleAddOrEdit = async () => {
    if (!user || !addWeight) return;
    setAddSaving(true);

    const payload = {
      weight_lbs: parseFloat(addWeight),
      body_fat_pct: addBodyFat ? parseFloat(addBodyFat) : null,
      notes: addNotes,
      recorded_at: addDate.toISOString(),
    };

    if (editId) {
      await supabase.from('weight_logs').update(payload).eq('id', editId);
    } else {
      await supabase.from('weight_logs').insert({ ...payload, user_id: user.id });
    }

    await loadAll();
    setAddSaving(false);
    setAddOpen(false);
    resetAddForm();
  };

  const handleDelete = (id: string) => {
    RNAlert.alert('Delete entry', 'Delete this weight entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('weight_logs').delete().eq('id', id);
          await loadAll();
        },
      },
    ]);
  };

  const handleEdit = (log: WeightLog) => {
    setEditId(log.id);
    setAddWeight(log.weight_lbs.toString());
    setAddBodyFat(log.body_fat_pct?.toString() ?? '');
    setAddNotes(log.notes);
    setAddDate(new Date(log.recorded_at));
    setAddOpen(true);
  };

  const openGoalDialog = () => {
    setGoalStart(goal.start_weight_lbs?.toString() ?? '');
    setGoalTarget(goal.goal_weight_lbs?.toString() ?? '');
    setGoalHeight(goal.height_inches?.toString() ?? '');
    setGoalOpen(true);
  };

  const handleSaveGoal = async () => {
    if (!user) return;
    setGoalSaving(true);
    const payload = {
      user_id: user.id,
      start_weight_lbs: goalStart ? parseFloat(goalStart) : null,
      goal_weight_lbs: goalTarget ? parseFloat(goalTarget) : null,
      target_date: goal.target_date,
      height_inches: goalHeight ? parseFloat(goalHeight) : null,
      updated_at: new Date().toISOString(),
    };
    await supabase.from('user_goals').upsert(payload, { onConflict: 'user_id' });
    await loadAll();
    setGoalSaving(false);
    setGoalOpen(false);
  };

  return (
    <Screen>
      <Text className="text-[13px] mb-3" style={{ color: colors.muted }}>
        Track weight, body composition, and goals over time.
      </Text>

      <View className="flex-row gap-2 mb-4">
        <Button
          title={goal.goal_weight_lbs ? 'Edit Goal' : 'Set Goal'}
          variant="outlined"
          onPress={openGoalDialog}
          className="flex-1"
          icon={<MaterialIcons name="flag" size={16} color={colors.primary} />}
        />
        <Button
          title="Log Weight"
          onPress={() => { resetAddForm(); setAddOpen(true); }}
          className="flex-1"
          icon={<MaterialIcons name="add" size={16} color={colors.onPrimary} />}
        />
      </View>

      {/* Summary cards */}
      <View className="flex-row flex-wrap gap-2 mb-4">
        <SummaryCard label="Start" value={startWeight ? startWeight.toFixed(1) : '-'} unit="lbs"
          detail={logs[0] ? new Date(logs[0].recorded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Set goal'} />
        <SummaryCard label="Current" value={currentWeight ? currentWeight.toFixed(1) : '-'} unit="lbs" detail="Today" accent />
        <SummaryCard label="Goal" value={goalWeight ? goalWeight.toFixed(1) : '-'} unit="lbs" detail="Target" />
        <SummaryCard
          label="To Go"
          value={toGo !== null ? `${toGo >= 0 ? '+' : ''}${toGo.toFixed(1)}` : '-'}
          unit="lbs"
          detail={`${progressPct.toFixed(0)}% to goal`}
          trend={toGo !== null ? (toGo < 0 ? 'down' : 'up') : null}
        />
      </View>

      {/* Weight trend */}
      <Card className="p-4 mb-4">
        <SectionLabel>Weight Trend</SectionLabel>
        {chartPoints.length > 0 ? (
          <LineChart
            series={[{ color: colors.primaryLight, points: chartPoints }]}
            height={240}
            xFormatter={x => new Date(x).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            yFormatter={y => y.toFixed(0)}
            xTickCount={3}
          />
        ) : (
          <View className="items-center py-10">
            <MaterialIcons name="monitor-weight" size={44} color={colors.divider} />
            <Text className="text-[13px] mt-2" style={{ color: colors.muted }}>Log your first weight to see your trend</Text>
          </View>
        )}
        <View className="flex-row gap-1.5 mt-2 flex-wrap">
          {TREND_RANGES.map(range => {
            const active = trendRange === range.value;
            return (
              <Pressable
                key={range.value}
                className="rounded-md px-2.5 py-1.5"
                style={{ backgroundColor: active ? colors.primarySolid : 'transparent' }}
                onPress={() => setTrendRange(range.value)}
              >
                <Text
                  className={`font-mono text-[11px] ${active ? 'font-semibold' : ''}`}
                  style={{ color: active ? colors.onPrimary : colors.muted }}
                >
                  {range.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* Goal progress */}
      <Card className="p-4 mb-4 items-center">
        <View className="self-stretch">
          <SectionLabel>Goal Progress</SectionLabel>
        </View>
        {startWeight && goalWeight && currentWeight ? (
          <>
            <GoalRing value={progressPct} />
            <Text className="text-xs mt-3" style={{ color: colors.muted }}>
              Goal: <Text className="text-xs font-bold" style={{ color: colors.text }}>{goalWeight.toFixed(1)} lbs</Text>
              {'   '}Start: <Text className="text-xs font-bold" style={{ color: colors.text }}>{startWeight.toFixed(1)} lbs</Text>
            </Text>
            {goal.target_date ? (
              <Text className="text-[11px] mt-1" style={{ color: colors.muted }}>
                Target: {new Date(goal.target_date).toLocaleDateString()}
              </Text>
            ) : null}
          </>
        ) : (
          <View className="self-stretch">
            <Banner tone="info">Set a goal to track progress.</Banner>
          </View>
        )}
      </Card>

      {/* Body metrics */}
      <Card className="p-4 mb-4">
        <SectionLabel>Body Metrics</SectionLabel>
        <MetricRow
          label="Body Fat"
          value={currentBodyFat !== null ? `${currentBodyFat}%` : '-'}
          delta={currentBodyFat !== null && firstBodyFat !== null ? currentBodyFat - firstBodyFat : null}
          unit="%"
        />
        <Divider />
        <MetricRow
          label="Lean Mass"
          value={currentLeanMass !== null ? `${currentLeanMass.toFixed(1)} lbs` : '-'}
          delta={currentLeanMass !== null && firstLeanMass !== null ? currentLeanMass - firstLeanMass : null}
          unit="lbs"
        />
        <Divider />
        <MetricRow label="BMI" value={bmi !== null ? bmi.toFixed(1) : '-'} delta={null} />
      </Card>

      {/* Recent entries */}
      <Card className="p-4">
        <SectionLabel>Recent Entries · {logs.length}</SectionLabel>
        {loading ? (
          <Text className="text-[13px]" style={{ color: colors.muted }}>Loading…</Text>
        ) : sortedLogs.length === 0 ? (
          <Banner tone="info">No entries yet. Tap "Log Weight" to add your first.</Banner>
        ) : (
          <View className="gap-1.5">
            {sortedLogs.slice(0, 8).map(log => {
              const lean = log.body_fat_pct !== null ? log.weight_lbs * (1 - log.body_fat_pct / 100) : null;
              return (
                <View key={log.id} className="flex-row items-center gap-2 rounded-md px-3 py-2" style={{ borderWidth: 1, borderColor: colors.divider }}>
                  <View className="flex-1">
                    <Text className="text-xs font-bold" style={{ color: colors.muted }}>
                      {new Date(log.recorded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                    <View className="flex-row gap-3 mt-0.5">
                      <Text className="font-mono text-xs font-bold" style={{ color: colors.text }}>{log.weight_lbs.toFixed(1)} lbs</Text>
                      {log.body_fat_pct !== null ? (
                        <Text className="font-mono text-xs" style={{ color: colors.muted }}>{log.body_fat_pct}% BF</Text>
                      ) : null}
                      {lean !== null ? (
                        <Text className="font-mono text-xs" style={{ color: colors.muted }}>{lean.toFixed(1)} lean</Text>
                      ) : null}
                    </View>
                    {log.notes ? (
                      <Text className="text-[11px] mt-0.5" style={{ color: colors.muted }} numberOfLines={1}>{log.notes}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity onPress={() => handleEdit(log)} hitSlop={6}>
                    <MaterialIcons name="edit" size={17} color={colors.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(log.id)} hitSlop={6}>
                    <MaterialIcons name="delete-outline" size={18} color={colors.muted} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </Card>

      {/* Add / edit entry */}
      <FormModal
        visible={addOpen}
        onClose={() => { setAddOpen(false); resetAddForm(); }}
        title={editId ? 'Edit Entry' : 'Log Weight'}
        footer={
          <Button
            title={addSaving ? 'Saving…' : editId ? 'Update' : 'Save'}
            onPress={handleAddOrEdit}
            disabled={!addWeight || addSaving}
          />
        }
      >
        <Field label="Weight (lbs)">
          <Input value={addWeight} onChangeText={setAddWeight} keyboardType="decimal-pad" placeholder="185.0" />
        </Field>
        <Field label="Body Fat % (optional)">
          <Input value={addBodyFat} onChangeText={setAddBodyFat} keyboardType="decimal-pad" placeholder="22.5" />
        </Field>
        <DateTimeField label="Date / Time" value={addDate} onChange={setAddDate} />
        <Field label="Notes (optional)">
          <Input value={addNotes} onChangeText={setAddNotes} placeholder="Check-in" multiline numberOfLines={2} />
        </Field>
      </FormModal>

      {/* Goal */}
      <FormModal
        visible={goalOpen}
        onClose={() => setGoalOpen(false)}
        title="Set Your Goal"
        footer={
          <Button title={goalSaving ? 'Saving…' : 'Save'} onPress={handleSaveGoal} disabled={goalSaving} />
        }
      >
        <Field label="Starting Weight (lbs) — weight when you started this protocol">
          <Input value={goalStart} onChangeText={setGoalStart} keyboardType="decimal-pad" />
        </Field>
        <Field label="Goal Weight (lbs)">
          <Input value={goalTarget} onChangeText={setGoalTarget} keyboardType="decimal-pad" />
        </Field>
        <Field label={heightHelper(goalHeight)}>
          <Input value={goalHeight} onChangeText={setGoalHeight} keyboardType="decimal-pad" />
        </Field>
      </FormModal>
    </Screen>
  );
}

function heightHelper(goalHeight: string): string {
  const n = parseFloat(goalHeight);
  if (Number.isFinite(n) && n >= 12) {
    const ft = Math.floor(n / 12);
    const inch = +(n - ft * 12).toFixed(1);
    return `Height (inches) — ${ft}'${inch ? ` ${inch}"` : ''}, used for BMI`;
  }
  return 'Height (inches, optional) — used for BMI';
}

function SummaryCard({ label, value, unit, detail, accent, trend }: {
  label: string;
  value: string;
  unit: string;
  detail: string;
  accent?: boolean;
  trend?: 'up' | 'down' | null;
}) {
  const { colors } = useThemeMode();
  return (
    <Card
      className="p-3 w-[48.5%]"
      style={accent ? { borderTopWidth: 2, borderTopColor: colors.primary } : undefined}
    >
      <View className="flex-row items-center justify-between mb-1.5">
        <Text className="font-mono text-[9px] uppercase tracking-widest" style={{ color: colors.muted }}>{label}</Text>
        {trend === 'down' ? <MaterialIcons name="trending-down" size={14} color={colors.success} /> : null}
        {trend === 'up' ? <MaterialIcons name="trending-up" size={14} color={colors.warning} /> : null}
      </View>
      <Text className="font-mono text-2xl font-bold" style={{ color: accent ? colors.primary : colors.text }}>
        {value} <Text className="font-mono text-xs" style={{ color: colors.muted }}>{unit}</Text>
      </Text>
      <Text className="text-[11px] mt-1" style={{ color: colors.muted }}>{detail}</Text>
    </Card>
  );
}

function MetricRow({ label, value, delta, unit }: { label: string; value: string; delta: number | null; unit?: string }) {
  const { colors } = useThemeMode();
  const isGood = delta !== null && delta < 0;
  return (
    <View className="flex-row items-center justify-between py-3">
      <View>
        <Text className="text-[11px] font-bold" style={{ color: colors.muted }}>{label}</Text>
        <Text className="font-mono text-base font-bold mt-0.5" style={{ color: colors.text }}>{value}</Text>
      </View>
      <Text className="text-[11px] font-bold" style={{ color: delta === null ? colors.muted : isGood ? colors.success : colors.primary }}>
        {delta === null ? 'vs start' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}${unit ?? ''} vs start`}
      </Text>
    </View>
  );
}

function GoalRing({ value }: { value: number }) {
  const { colors } = useThemeMode();
  const pct = Math.max(0, Math.min(100, value));
  const size = 150;
  const c = size / 2;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const target = (pct / 100) * circumference;

  const offset = useSharedValue(circumference);
  useEffect(() => {
    offset.value = withTiming(circumference - target, { duration: 1100, easing: Easing.out(Easing.cubic) });
  }, [target, circumference]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.primary} />
            <Stop offset="1" stopColor={colors.secondary} />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={c} cy={c} r={radius} fill="none" stroke={colors.primaryTint} strokeWidth="14" />
        <AnimatedCircle
          cx={c}
          cy={c}
          r={radius}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </Svg>
      <View className="absolute items-center">
        <AnimatedCount value={pct} decimals={0} suffix="%" className="font-mono text-[30px] font-extrabold" style={{ color: colors.text }} />
        <Text className="text-[11px]" style={{ color: colors.muted }}>Complete</Text>
      </View>
    </View>
  );
}
