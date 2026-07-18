import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from '../tw';
import { Banner, Button, Card, Chip, Divider, EmptyState, Field, FormModal, Input, Screen, SectionLabel, Select } from '../components/ui';
import LineChart, { type ChartSeries } from '../components/LineChart';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeModeContext';
import { supabase } from '../lib/supabase';
import { calculateDose, formatDose } from '../utils/calculator';
import { calculateSerumCurve } from '../utils/serumModel';
import { generateAllPlannedDoses, getUpcomingDoses } from '../utils/schedule';
import type { Route } from '../types';

type EventType = 'dose' | 'weight' | 'planned';
type Filter = 'all' | EventType;

interface WeightLog {
  id: string;
  weight_lbs: number;
  body_fat_pct: number | null;
  notes: string;
  recorded_at: string;
}

interface SideEffectLog {
  id: string;
  effect: string;
  severity: number; // 1-10
  notes: string;
  recorded_at: string;
}

const EFFECT_OPTIONS = [
  'Nausea', 'Heartburn', 'Constipation', 'Diarrhea', 'Fatigue',
  'Headache', 'Food Noise', 'Appetite Loss', 'Injection Site', 'Dizziness',
];

interface ActivityEvent {
  id: string;
  type: EventType;
  timestamp: number;
  title: string;
  subtitle: string;
  detail: string;
  color: string;
  peptide: string;
  route: string;
  site: string;
  notes: string;
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'dose', label: 'Doses' },
  { key: 'planned', label: 'Planned' },
  { key: 'weight', label: 'Weight' },
];

const ROUTE_OPTIONS: { value: Route; label: string }[] = [
  { value: 'subcutaneous', label: 'Subcutaneous' },
  { value: 'intramuscular', label: 'Intramuscular' },
  { value: 'intravenous', label: 'Intravenous' },
  { value: 'intranasal', label: 'Intranasal' },
  { value: 'topical', label: 'Topical' },
  { value: 'oral', label: 'Oral' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export default function LogbookScreen() {
  const { user } = useAuth();
  const { userCompounds, doseLogs, addDoseLog, updateDoseLog, removeDoseLog, resolveCompound } = useAppContext();
  const { colors } = useThemeMode();

  const [filter, setFilter] = useState<Filter>('all');
  const [peptideFilter, setPeptideFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);

  // Add / edit dose modal state
  const [doseModalOpen, setDoseModalOpen] = useState(false);
  const [editingDoseId, setEditingDoseId] = useState<string | null>(null); // null = adding
  const [doseCompoundId, setDoseCompoundId] = useState<string | null>(null); // userCompound id
  const [doseMg, setDoseMg] = useState('');
  const [doseUnits, setDoseUnits] = useState('');
  const [doseDate, setDoseDate] = useState(new Date());
  const [doseRoute, setDoseRoute] = useState<Route>('subcutaneous');
  const [doseSite, setDoseSite] = useState('');
  const [doseNotes, setDoseNotes] = useState('');
  const [doseError, setDoseError] = useState('');

  // Side effect log state
  const [sideEffects, setSideEffects] = useState<SideEffectLog[]>([]);
  const [effectModalOpen, setEffectModalOpen] = useState(false);
  const [effectName, setEffectName] = useState<string>(EFFECT_OPTIONS[0]);
  const [effectSeverity, setEffectSeverity] = useState(5);
  const [effectNotes, setEffectNotes] = useState('');
  const [effectDate, setEffectDate] = useState(new Date());
  const [effectSaving, setEffectSaving] = useState(false);

  // Edit weight modal state
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [editingWeightId, setEditingWeightId] = useState<string | null>(null);
  const [weightLbs, setWeightLbs] = useState('');
  const [weightBodyFat, setWeightBodyFat] = useState('');
  const [weightDate, setWeightDate] = useState(new Date());
  const [weightNotes, setWeightNotes] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('weight_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: false })
      .then(({ data }) => {
        if (data) setWeightLogs(data);
      });
    supabase
      .from('side_effect_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (data) setSideEffects(data);
      });
  }, [user]);

  const saveSideEffect = async () => {
    if (!user || effectSaving) return;
    setEffectSaving(true);
    const payload = {
      user_id: user.id,
      effect: effectName,
      severity: effectSeverity,
      notes: effectNotes,
      recorded_at: effectDate.toISOString(),
    };
    const { data, error } = await supabase.from('side_effect_logs').insert(payload).select().single();
    if (!error && data) setSideEffects(prev => [data, ...prev]);
    setEffectSaving(false);
    setEffectModalOpen(false);
    setEffectNotes('');
    setEffectSeverity(5);
  };

  const deleteSideEffect = (id: string) => {
    if (!user) return;
    Alert.alert('Delete this side-effect entry?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSideEffects(prev => prev.filter(s => s.id !== id));
          await supabase.from('side_effect_logs').delete().eq('id', id).eq('user_id', user.id);
        },
      },
    ]);
  };

  // Peak severity per effect over the last 7 days (MeAgain-style bars).
  const effectSummary = useMemo(() => {
    const cutoff = Date.now() - 7 * DAY_MS;
    const m = new Map<string, number>();
    for (const s of sideEffects) {
      if (new Date(s.recorded_at).getTime() < cutoff) continue;
      m.set(s.effect, Math.max(m.get(s.effect) ?? 0, s.severity));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [sideEffects]);

  const activeCompounds = useMemo(() => userCompounds.filter(uc => uc.active), [userCompounds]);
  const plannedDoses = useMemo(() => generateAllPlannedDoses(activeCompounds, doseLogs), [activeCompounds, doseLogs]);
  const upcoming = useMemo(() => getUpcomingDoses(activeCompounds, doseLogs, Date.now())[0], [activeCompounds, doseLogs]);

  const events = useMemo<ActivityEvent[]>(() => {
    const out: ActivityEvent[] = [];

    doseLogs.forEach(d => {
      const uc = userCompounds.find(c => c.id === d.userCompoundId);
      const compound = resolveCompound(d.compoundId);
      out.push({
        id: `dose-${d.id}`,
        type: 'dose',
        timestamp: new Date(d.timestamp).getTime(),
        title: compound?.genericName ?? 'Unknown peptide',
        subtitle: `${formatDose(d.doseMcg)}${d.units ? ` · ${formatCompactNumber(d.units)} units` : ''}`,
        detail: [d.injectionSite, d.notes].filter(Boolean).join(' · '),
        color: uc?.color ?? '#0EA5B7',
        peptide: compound?.genericName ?? 'Unknown peptide',
        route: d.route,
        site: d.injectionSite || '',
        notes: d.notes,
      });
    });

    weightLogs.forEach(w => {
      out.push({
        id: `weight-${w.id}`,
        type: 'weight',
        timestamp: new Date(w.recorded_at).getTime(),
        title: 'Weight',
        subtitle: `${w.weight_lbs.toFixed(1)} lbs${w.body_fat_pct ? ` · ${w.body_fat_pct}% BF` : ''}`,
        detail: w.notes,
        color: '#7C3AED',
        peptide: '',
        route: '',
        site: '',
        notes: w.notes,
      });
    });

    plannedDoses.forEach(p => {
      if (p.isTaken) return;
      const uc = userCompounds.find(c => c.id === p.userCompoundId);
      const compound = resolveCompound(p.compoundId);
      out.push({
        id: `planned-${p.userCompoundId}-${p.doseNumber}`,
        type: 'planned',
        timestamp: p.scheduledAt,
        title: compound?.genericName ?? 'Unknown peptide',
        subtitle: `${formatDose(p.doseMcg)} · scheduled`,
        detail: p.isOverdue ? 'Overdue, not logged' : `Week ${p.weekNumber}`,
        color: uc?.color ?? '#F97316',
        peptide: compound?.genericName ?? 'Unknown peptide',
        route: uc?.route ?? '',
        site: 'Planned',
        notes: p.isOverdue ? 'Overdue, not logged' : `Week ${p.weekNumber}`,
      });
    });

    return out.sort((a, b) => b.timestamp - a.timestamp);
  }, [doseLogs, plannedDoses, resolveCompound, userCompounds, weightLogs]);

  // Same default window as web: last 30 days through end of today.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const start = Date.now() - 30 * DAY_MS;
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return events.filter(e => {
      if (filter !== 'all' && e.type !== filter) return false;
      if (peptideFilter !== 'all' && e.peptide !== peptideFilter) return false;
      if (e.timestamp < start || e.timestamp > end.getTime()) return false;
      if (!q) return true;
      return [e.title, e.subtitle, e.detail, e.peptide, e.site, e.notes].some(v => v.toLowerCase().includes(q));
    });
  }, [events, filter, peptideFilter, search]);

  const peptideOptions = useMemo(
    () => Array.from(new Set(events.map(e => e.peptide).filter(Boolean))).sort(),
    [events],
  );

  // Group filtered events by week (Sun–Sat, matching the web), cap for perf.
  const weekGroups = useMemo(() => {
    const capped = filtered.slice(0, 200);
    const groups: { key: string; start: Date; end: Date; events: ActivityEvent[] }[] = [];
    for (const e of capped) {
      const d = new Date(e.timestamp);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - d.getDay()); // back to Sunday
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      let g = groups.find(x => x.key === key);
      if (!g) {
        const end = new Date(d);
        end.setDate(end.getDate() + 6);
        g = { key, start: new Date(d), end, events: [] };
        groups.push(g);
      }
      g.events.push(e);
    }
    return { groups, truncated: filtered.length > capped.length };
  }, [filtered]);

  // Which weeks are expanded. Most-recent week starts open; the rest collapsed.
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const weekInitRef = useRef(false);
  useEffect(() => {
    if (!weekInitRef.current && weekGroups.groups.length > 0) {
      setExpandedWeeks(new Set([weekGroups.groups[0].key]));
      weekInitRef.current = true;
    }
  }, [weekGroups]);

  const toggleWeek = (key: string) =>
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const adherence = plannedDoses.length > 0
    ? Math.round((plannedDoses.filter(p => p.isTaken).length / plannedDoses.length) * 100)
    : 100;

  const nextLabel = upcoming ? relativeDoseLabel(upcoming.scheduledAt) : 'None';

  const chartSeries = useMemo<ChartSeries[]>(() => {
    const end = Date.now();
    const start = end - 30 * DAY_MS;
    return activeCompounds
      .map(uc => {
        const compound = resolveCompound(uc.compoundId);
        if (!compound) return null;
        const compoundDoses = doseLogs.filter(d => d.userCompoundId === uc.id);
        const curve = calculateSerumCurve(compoundDoses, compound, start, end, 120, 'bodyLoad');
        return {
          color: uc.color,
          points: curve.map(p => ({ x: p.timestamp, y: p.concentration })),
        };
      })
      .filter((s): s is ChartSeries => !!s);
  }, [activeCompounds, doseLogs, resolveCompound]);
  const hasChartData = chartSeries.some(s => s.points.some(p => p.y > 0));

  // ---------- dose modal ----------

  const prefillFromCompound = (ucId: string | null) => {
    const uc = userCompounds.find(c => c.id === ucId);
    if (!uc) {
      setDoseMg('');
      setDoseUnits('');
      return;
    }
    setDoseMg(formatCompactNumber(uc.doseAmountMcg / 1000));
    setDoseRoute(uc.route);
    if (uc.vialStrengthMg > 0 && uc.waterVolumeMl > 0 && uc.doseAmountMcg > 0) {
      setDoseUnits(formatCompactNumber(calculateDose(uc.doseAmountMcg, uc.vialStrengthMg, uc.waterVolumeMl).syringeUnits));
    } else {
      setDoseUnits('');
    }
  };

  const openAddDose = () => {
    const first = activeCompounds[0] ?? null;
    setEditingDoseId(null);
    setDoseCompoundId(first?.id ?? null);
    prefillFromCompound(first?.id ?? null);
    setDoseDate(new Date());
    setDoseSite('');
    setDoseNotes('');
    setDoseError('');
    setDoseModalOpen(true);
  };

  const openEditDose = (doseId: string) => {
    const dose = doseLogs.find(d => d.id === doseId);
    if (!dose) return;
    setEditingDoseId(dose.id);
    setDoseCompoundId(dose.userCompoundId);
    setDoseMg(formatCompactNumber(dose.doseMcg / 1000));
    setDoseUnits(dose.units ? formatCompactNumber(dose.units) : '');
    setDoseDate(new Date(dose.timestamp));
    setDoseRoute(dose.route);
    setDoseSite(dose.injectionSite ?? '');
    setDoseNotes(dose.notes ?? '');
    setDoseError('');
    setDoseModalOpen(true);
  };

  const saveDose = () => {
    const mg = parseFloat(doseMg);
    if (!doseMg || isNaN(mg) || mg <= 0) {
      setDoseError('Enter a valid dose in mg.');
      return;
    }
    if (editingDoseId) {
      updateDoseLog(editingDoseId, {
        timestamp: doseDate.toISOString(),
        doseMcg: mg * 1000,
        units: parseFloat(doseUnits) || 0,
        route: doseRoute,
        injectionSite: doseSite,
        notes: doseNotes,
      });
    } else {
      const uc = userCompounds.find(c => c.id === doseCompoundId);
      if (!uc) {
        setDoseError('Pick a peptide to log against.');
        return;
      }
      addDoseLog({
        compoundId: uc.compoundId,
        userCompoundId: uc.id,
        timestamp: doseDate.toISOString(),
        scheduledFor: null,
        doseMcg: mg * 1000,
        units: parseFloat(doseUnits) || 0,
        route: doseRoute,
        injectionSite: doseSite,
        notes: doseNotes,
      });
    }
    setDoseModalOpen(false);
  };

  const confirmDeleteDose = (doseId: string) => {
    Alert.alert('Delete dose log', 'Delete this dose log?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeDoseLog(doseId) },
    ]);
  };

  // ---------- weight modal ----------

  const openEditWeight = (weightId: string) => {
    const w = weightLogs.find(x => x.id === weightId);
    if (!w) return;
    setEditingWeightId(w.id);
    setWeightLbs(formatCompactNumber(w.weight_lbs));
    setWeightBodyFat(w.body_fat_pct ? formatCompactNumber(w.body_fat_pct) : '');
    setWeightDate(new Date(w.recorded_at));
    setWeightNotes(w.notes ?? '');
    setWeightModalOpen(true);
  };

  const saveWeight = async () => {
    if (!editingWeightId || !user || !weightLbs) return;
    const payload = {
      weight_lbs: parseFloat(weightLbs),
      body_fat_pct: weightBodyFat ? parseFloat(weightBodyFat) : null,
      notes: weightNotes,
      recorded_at: weightDate.toISOString(),
    };
    const { error } = await supabase
      .from('weight_logs')
      .update(payload)
      .eq('id', editingWeightId)
      .eq('user_id', user.id);
    if (!error) {
      setWeightLogs(prev => prev.map(w => (w.id === editingWeightId ? { ...w, ...payload } : w)));
    }
    setWeightModalOpen(false);
  };

  const confirmDeleteWeight = (weightId: string) => {
    if (!user) return;
    Alert.alert('Delete weight entry', 'Delete this weight entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setWeightLogs(prev => prev.filter(w => w.id !== weightId));
          await supabase.from('weight_logs').delete().eq('id', weightId).eq('user_id', user.id);
        },
      },
    ]);
  };

  const handleEventPress = (e: ActivityEvent) => {
    if (e.type === 'dose') openEditDose(e.id.slice('dose-'.length));
    else if (e.type === 'weight') openEditWeight(e.id.slice('weight-'.length));
    else Alert.alert('Planned dose', 'Planned doses are logged from the Schedule tab.');
  };

  const handleEventLongPress = (e: ActivityEvent) => {
    if (e.type === 'dose') confirmDeleteDose(e.id.slice('dose-'.length));
    else if (e.type === 'weight') confirmDeleteWeight(e.id.slice('weight-'.length));
  };

  return (
    <Screen>
      <Text className="text-xs mb-3" style={{ color: colors.muted }}>
        Every dose, weight log, and scheduled slot in one searchable view.
      </Text>

      {/* Stat cards */}
      <View className="flex-row flex-wrap gap-2 mb-4">
        <StatCard label="Doses logged" value={String(doseLogs.length)} detail="total dose logs" icon="vaccines" />
        <StatCard label="Adherence" value={`${adherence}%`} detail="completed scheduled" icon="calendar-month" accent />
        <StatCard
          label="Next dose"
          value={nextLabel}
          detail={upcoming ? resolveCompound(upcoming.compoundId)?.genericName ?? 'Scheduled' : 'No upcoming dose'}
          icon="schedule"
        />
        <StatCard label="Active peptides" value={String(activeCompounds.length)} detail="currently tracked" icon="water-drop" />
      </View>

      {/* Body load chart */}
      <SectionLabel>Body Load by Peptide</SectionLabel>
      <Card className="p-3 mb-4">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-xs" style={{ color: colors.muted }}>Estimated body load — last 30 days</Text>
          <Chip label="Population PK" tone="primary" />
        </View>
        {hasChartData ? (
          <LineChart
            series={chartSeries}
            height={220}
            markerX={Date.now()}
            xFormatter={x => new Date(x).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            yFormatter={y => `${y.toFixed(y >= 10 ? 0 : 1)}`}
          />
        ) : (
          <View className="h-[140px] items-center justify-center">
            <Text className="text-[13px]" style={{ color: colors.muted }}>Log doses to see body-load curves.</Text>
          </View>
        )}
        {chartSeries.length > 0 ? (
          <View className="flex-row flex-wrap gap-x-3 gap-y-1 mt-2">
            {activeCompounds.map(uc => {
              const compound = resolveCompound(uc.compoundId);
              if (!compound) return null;
              return (
                <View key={uc.id} className="flex-row items-center gap-1.5">
                  <View className="w-2 h-2 rounded-full" style={{ backgroundColor: uc.color }} />
                  <Text className="text-[10px]" style={{ color: colors.muted }}>{compound.genericName}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </Card>

      {/* Side effects */}
      <View className="flex-row items-center justify-between mb-1.5">
        <SectionLabel>Side Effects — last 7 days</SectionLabel>
        <Button
          title="Log Effect"
          variant="outlined"
          onPress={() => { setEffectDate(new Date()); setEffectModalOpen(true); }}
          className="py-1.5 px-3"
        />
      </View>
      <Card className="p-4 mb-4">
        {effectSummary.length === 0 ? (
          <Text className="text-[13px]" style={{ color: colors.muted }}>
            No side effects logged this week. Tap "Log Effect" after a dose to track how you feel.
          </Text>
        ) : (
          <View className="gap-2.5">
            {effectSummary.map(([name, sev]) => {
              const barColor = sev >= 7 ? colors.error : sev >= 4 ? colors.warning : colors.success;
              return (
                <View key={name}>
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-[13px] font-medium" style={{ color: colors.text }}>{name}</Text>
                    <Text className="font-mono text-[11px]" style={{ color: colors.muted }}>{sev}/10</Text>
                  </View>
                  <View className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: colors.divider }}>
                    <View className="h-full rounded-full" style={{ width: `${sev * 10}%`, backgroundColor: barColor }} />
                  </View>
                </View>
              );
            })}
          </View>
        )}
        {sideEffects.length > 0 ? (
          <View className="mt-3 pt-2" style={{ borderTopWidth: 1, borderTopColor: colors.divider }}>
            {sideEffects.slice(0, 4).map(s => (
              <Pressable key={s.id} className="flex-row items-center py-1" onLongPress={() => deleteSideEffect(s.id)}>
                <Text className="flex-1 text-[11px]" style={{ color: colors.muted }} numberOfLines={1}>
                  {new Date(s.recorded_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric' })}
                  {' — '}{s.effect} {s.severity}/10{s.notes ? ` — ${s.notes}` : ''}
                </Text>
              </Pressable>
            ))}
            <Text className="text-[10px] mt-1" style={{ color: colors.muted }}>Long-press an entry to delete</Text>
          </View>
        ) : null}
      </Card>

      {/* History */}
      <View className="flex-row items-center justify-between mb-1.5">
        <SectionLabel>Dose & Measurement History</SectionLabel>
        <Button
          title="Log Dose"
          onPress={openAddDose}
          className="py-1.5 px-3"
          icon={<MaterialIcons name="add" size={16} color={colors.onPrimary} />}
          disabled={activeCompounds.length === 0}
        />
      </View>

      {/* Filters */}
      <View className="flex-row gap-1.5 mb-2">
        {FILTERS.map(f => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              className="rounded-full border px-3 py-1.5"
              style={{
                backgroundColor: active ? colors.primaryTint : 'transparent',
                borderColor: active ? colors.primary : colors.outline,
              }}
              onPress={() => setFilter(f.key)}
            >
              <Text
                className={`font-mono text-[10px] uppercase tracking-wider ${active ? 'font-medium' : ''}`}
                style={{ color: active ? colors.tealText : colors.muted }}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {peptideOptions.length > 1 ? (
        <View className="mb-2">
          <Select
            value={peptideFilter}
            options={[{ value: 'all', label: 'All Peptides' }, ...peptideOptions.map(p => ({ value: p, label: p }))]}
            onChange={setPeptideFilter}
          />
        </View>
      ) : null}
      <Input value={search} onChangeText={setSearch} placeholder="Search peptide, site, notes…" className="mb-3" />

      {/* Event list grouped by week — collapsible accordion */}
      {weekGroups.groups.length === 0 ? (
        <Card>
          <EmptyState
            icon="history"
            title="No activity in the last 30 days"
            subtitle="Log a dose or adjust the filters to see history here."
          />
        </Card>
      ) : (
        weekGroups.groups.map(group => {
          const open = expandedWeeks.has(group.key);
          const label = `Week of ${group.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${group.end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
          return (
            <Card key={group.key} className="mb-2 overflow-hidden">
              <Pressable
                className="flex-row items-center gap-2 px-3 py-3.5"
                onPress={() => toggleWeek(group.key)}
              >
                <MaterialIcons name={open ? 'expand-more' : 'chevron-right'} size={20} color={colors.muted} />
                <Text className="text-[13px] font-semibold flex-1" style={{ color: colors.text }} numberOfLines={1}>
                  {label}
                </Text>
                <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: colors.primaryTint }}>
                  <Text className="font-mono text-[10px] font-medium" style={{ color: colors.tealText }}>
                    {group.events.length}
                  </Text>
                </View>
              </Pressable>
              {open
                ? group.events.map(e => (
                    <View key={e.id}>
                      <Divider />
                      <EventCard
                        event={e}
                        showDate
                        onPress={() => handleEventPress(e)}
                        onLongPress={() => handleEventLongPress(e)}
                      />
                    </View>
                  ))
                : null}
            </Card>
          );
        })
      )}
      {weekGroups.truncated ? (
        <Text className="text-[11px] text-center mb-2 mt-1" style={{ color: colors.muted }}>
          Showing the 200 most recent events. Use search or filters to narrow further.
        </Text>
      ) : null}
      {weekGroups.groups.length > 0 ? (
        <Text className="text-[11px] text-center mt-1" style={{ color: colors.muted }}>
          Tap a week to expand · tap an entry to edit · long-press to delete
        </Text>
      ) : null}

      {/* Add / edit dose modal */}
      <FormModal
        visible={doseModalOpen}
        onClose={() => setDoseModalOpen(false)}
        title={editingDoseId ? 'Edit Dose' : 'Log Dose'}
        footer={<Button title={editingDoseId ? 'Save Changes' : 'Log Dose'} onPress={saveDose} />}
      >
        {doseError ? <View className="mb-3"><Banner tone="error">{doseError}</Banner></View> : null}
        {!editingDoseId ? (
          <Select
            label="Peptide"
            value={doseCompoundId}
            options={activeCompounds.map(uc => ({
              value: uc.id,
              label: resolveCompound(uc.compoundId)?.genericName ?? 'Unknown peptide',
            }))}
            onChange={v => { setDoseCompoundId(v); prefillFromCompound(v); }}
          />
        ) : null}
        <View className="flex-row gap-3">
          <Field label="Dose (mg)" className="flex-1">
            <Input value={doseMg} onChangeText={setDoseMg} keyboardType="decimal-pad" placeholder="0.25" />
          </Field>
          <Field label="Syringe units" className="flex-1">
            <Input value={doseUnits} onChangeText={setDoseUnits} keyboardType="decimal-pad" placeholder="25" />
          </Field>
        </View>
        <DateTimeField label="Date / Time" value={doseDate} onChange={setDoseDate} />
        <Select label="Route" value={doseRoute} options={ROUTE_OPTIONS} onChange={setDoseRoute} />
        <Field label="Injection site (optional)">
          <Input value={doseSite} onChangeText={setDoseSite} placeholder="e.g. left abdomen" />
        </Field>
        <Field label="Notes (optional)">
          <Input value={doseNotes} onChangeText={setDoseNotes} placeholder="Notes" multiline numberOfLines={3} />
        </Field>
      </FormModal>

      {/* Log side effect modal */}
      <FormModal
        visible={effectModalOpen}
        onClose={() => setEffectModalOpen(false)}
        title="Log Side Effect"
        footer={<Button title={effectSaving ? 'Saving…' : 'Save'} onPress={saveSideEffect} disabled={effectSaving} />}
      >
        <Field label="Effect">
          <View className="flex-row flex-wrap gap-1.5">
            {EFFECT_OPTIONS.map(name => {
              const active = effectName === name;
              return (
                <Pressable
                  key={name}
                  className="rounded-full border px-3 py-1.5"
                  style={{
                    backgroundColor: active ? colors.primaryTint : 'transparent',
                    borderColor: active ? colors.primary : colors.outline,
                  }}
                  onPress={() => setEffectName(name)}
                >
                  <Text
                    className={`text-[12px] ${active ? 'font-semibold' : ''}`}
                    style={{ color: active ? colors.tealText : colors.muted }}
                  >
                    {name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
        <Field label={`Severity — ${effectSeverity}/10`}>
          <View className="flex-row gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
              const active = n <= effectSeverity;
              const color = effectSeverity >= 7 ? colors.error : effectSeverity >= 4 ? colors.warning : colors.success;
              return (
                <Pressable
                  key={n}
                  className="flex-1 h-8 rounded-md items-center justify-center"
                  style={{ backgroundColor: active ? color : colors.divider }}
                  onPress={() => setEffectSeverity(n)}
                >
                  <Text className="font-mono text-[10px] font-bold" style={{ color: active ? '#fff' : colors.muted }}>
                    {n}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
        <DateTimeField label="When" value={effectDate} onChange={setEffectDate} />
        <Field label="Notes (optional)">
          <Input value={effectNotes} onChangeText={setEffectNotes} placeholder="e.g. started ~2h after dose" multiline numberOfLines={2} />
        </Field>
      </FormModal>

      {/* Edit weight modal */}
      <FormModal
        visible={weightModalOpen}
        onClose={() => setWeightModalOpen(false)}
        title="Edit Weight Entry"
        footer={<Button title="Save Changes" onPress={saveWeight} />}
      >
        <View className="flex-row gap-3">
          <Field label="Weight (lbs)" className="flex-1">
            <Input value={weightLbs} onChangeText={setWeightLbs} keyboardType="decimal-pad" />
          </Field>
          <Field label="Body fat % (optional)" className="flex-1">
            <Input value={weightBodyFat} onChangeText={setWeightBodyFat} keyboardType="decimal-pad" />
          </Field>
        </View>
        <DateTimeField label="Date / Time" value={weightDate} onChange={setWeightDate} />
        <Field label="Notes (optional)">
          <Input value={weightNotes} onChangeText={setWeightNotes} placeholder="Notes" multiline numberOfLines={3} />
        </Field>
      </FormModal>
    </Screen>
  );
}

// ---------- components ----------

function StatCard({ label, value, detail, icon, accent }: {
  label: string;
  value: string;
  detail: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  accent?: boolean;
}) {
  const { colors } = useThemeMode();
  return (
    <Card className={`p-3 w-[48.5%] ${accent ? 'border-t-2 border-t-primary' : ''}`}>
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1">
          <Text className="font-mono text-[9px] uppercase tracking-widest" style={{ color: colors.muted }}>{label}</Text>
          <Text className="font-mono text-xl font-bold mt-1" style={{ color: colors.text }} numberOfLines={1}>{value}</Text>
          <Text className="text-[11px] mt-0.5" style={{ color: colors.muted }} numberOfLines={1}>{detail}</Text>
        </View>
        <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: colors.primaryTint }}>
          <MaterialIcons name={icon} size={18} color={colors.primary} />
        </View>
      </View>
    </Card>
  );
}

function EventCard({ event, onPress, onLongPress, showDate }: {
  event: ActivityEvent;
  onPress: () => void;
  onLongPress: () => void;
  showDate?: boolean;
}) {
  const { colors } = useThemeMode();
  const icon: keyof typeof MaterialIcons.glyphMap =
    event.type === 'weight' ? 'monitor-weight' : event.type === 'planned' ? 'schedule' : 'vaccines';
  const dt = new Date(event.timestamp);
  const time = dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const dayLabel = dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return (
    <Pressable className="flex-row items-center gap-3 px-3 py-3" onPress={onPress} onLongPress={onLongPress}>
      <View
        className="w-9 h-9 rounded-md items-center justify-center"
        style={{ backgroundColor: `${event.color}16` }}
      >
        <MaterialIcons name={icon} size={16} color={event.color} />
      </View>
      <View className="flex-1 min-w-0">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-[13px] font-semibold" style={{ color: colors.text }} numberOfLines={1}>{event.title}</Text>
          {event.type === 'planned' ? <Chip label="Planned" tone="warning" /> : null}
        </View>
        <Text className="text-xs mt-0.5" style={{ color: colors.muted }} numberOfLines={1}>
          {event.subtitle}{event.detail ? ` · ${event.detail}` : ''}
        </Text>
      </View>
      <View className="items-end">
        {showDate ? <Text className="font-mono text-[10px]" style={{ color: colors.muted }}>{dayLabel}</Text> : null}
        <Text className="font-mono text-[10px]" style={{ color: colors.muted }}>{time}</Text>
      </View>
    </Pressable>
  );
}

/** Cross-platform date+time field. iOS renders compact inline pickers; Android opens dialogs. */
function DateTimeField({ label, value, onChange }: { label: string; value: Date; onChange: (d: Date) => void }) {
  const { colors } = useThemeMode();
  const [show, setShow] = useState<'date' | 'time' | null>(null);

  if (Platform.OS === 'ios') {
    return (
      <Field label={label}>
        <View className="flex-row">
          <DateTimePicker
            value={value}
            mode="datetime"
            display="compact"
            onChange={(_e, d) => { if (d) onChange(d); }}
          />
        </View>
      </Field>
    );
  }

  return (
    <Field label={label}>
      <View className="flex-row gap-2">
        <Pressable className="flex-1 border rounded-md px-3 py-2.5" style={{ borderColor: colors.outline, backgroundColor: colors.surface }} onPress={() => setShow('date')}>
          <Text className="text-sm" style={{ color: colors.text }}>
            {value.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </Pressable>
        <Pressable className="border rounded-md px-3 py-2.5" style={{ borderColor: colors.outline, backgroundColor: colors.surface }} onPress={() => setShow('time')}>
          <Text className="text-sm" style={{ color: colors.text }}>
            {value.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          </Text>
        </Pressable>
      </View>
      {show ? (
        <DateTimePicker
          value={value}
          mode={show}
          display="default"
          onChange={(event, d) => {
            setShow(null);
            if (event.type !== 'dismissed' && d) onChange(d);
          }}
        />
      ) : null}
    </Field>
  );
}

// ---------- helpers ----------

function relativeDoseLabel(timestamp: number) {
  const hours = Math.round((timestamp - Date.now()) / (1000 * 60 * 60));
  if (hours < 0) return 'Overdue';
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.round(hours / 24)}d`;
}

function formatCompactNumber(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1).replace(/\.0$/, '');
}
