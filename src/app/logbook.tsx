import { useEffect, useMemo, useState } from 'react';
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
  }, [user]);

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

  // Group filtered events by day, cap for scroll performance.
  const dayGroups = useMemo(() => {
    const capped = filtered.slice(0, 100);
    const groups: { key: string; day: Date; events: ActivityEvent[] }[] = [];
    for (const e of capped) {
      const d = new Date(e.timestamp);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const existing = groups.find(g => g.key === key);
      if (existing) existing.events.push(e);
      else groups.push({ key, day: new Date(d.getFullYear(), d.getMonth(), d.getDate()), events: [e] });
    }
    return { groups, truncated: filtered.length > capped.length };
  }, [filtered]);

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
      <Text className="text-xs text-muted mb-3">
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
          <Text className="text-xs text-muted">Estimated body load — last 30 days</Text>
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
            <Text className="text-[13px] text-muted">Log doses to see body-load curves.</Text>
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
                  <Text className="text-[10px] text-muted">{compound.genericName}</Text>
                </View>
              );
            })}
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
              className={`rounded-full border px-3 py-1.5 ${active ? 'bg-primary-tint border-primary' : 'border-outline'}`}
              onPress={() => setFilter(f.key)}
            >
              <Text className={`font-mono text-[10px] uppercase tracking-wider ${active ? 'text-teal-text font-medium' : 'text-muted'}`}>
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

      {/* Event list grouped by day */}
      {dayGroups.groups.length === 0 ? (
        <Card>
          <EmptyState
            icon="history"
            title="No activity in the last 30 days"
            subtitle="Log a dose or adjust the filters to see history here."
          />
        </Card>
      ) : (
        dayGroups.groups.map(group => (
          <View key={group.key} className="mb-3">
            <Text className="font-mono text-[10px] uppercase tracking-widest text-muted mb-1.5">
              {group.day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
            <Card>
              {group.events.map((e, i) => (
                <View key={e.id}>
                  {i > 0 ? <Divider /> : null}
                  <EventCard
                    event={e}
                    onPress={() => handleEventPress(e)}
                    onLongPress={() => handleEventLongPress(e)}
                  />
                </View>
              ))}
            </Card>
          </View>
        ))
      )}
      {dayGroups.truncated ? (
        <Text className="text-[11px] text-muted text-center mb-2">
          Showing the 100 most recent events. Use search or filters to narrow further.
        </Text>
      ) : null}
      {dayGroups.groups.length > 0 ? (
        <Text className="text-[11px] text-muted text-center">
          Tap an entry to edit · long-press to delete
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
          <Text className="font-mono text-[9px] uppercase tracking-widest text-muted">{label}</Text>
          <Text className="font-mono text-xl font-bold text-ink mt-1" numberOfLines={1}>{value}</Text>
          <Text className="text-[11px] text-muted mt-0.5" numberOfLines={1}>{detail}</Text>
        </View>
        <View className="w-9 h-9 rounded-full bg-primary-tint items-center justify-center">
          <MaterialIcons name={icon} size={18} color={colors.primary} />
        </View>
      </View>
    </Card>
  );
}

function EventCard({ event, onPress, onLongPress }: {
  event: ActivityEvent;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const icon: keyof typeof MaterialIcons.glyphMap =
    event.type === 'weight' ? 'monitor-weight' : event.type === 'planned' ? 'schedule' : 'vaccines';
  const time = new Date(event.timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
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
          <Text className="text-[13px] font-semibold text-ink" numberOfLines={1}>{event.title}</Text>
          {event.type === 'planned' ? <Chip label="Planned" tone="warning" /> : null}
        </View>
        <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
          {event.subtitle}{event.detail ? ` · ${event.detail}` : ''}
        </Text>
      </View>
      <Text className="font-mono text-[10px] text-muted">{time}</Text>
    </Pressable>
  );
}

/** Cross-platform date+time field. iOS renders compact inline pickers; Android opens dialogs. */
function DateTimeField({ label, value, onChange }: { label: string; value: Date; onChange: (d: Date) => void }) {
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
        <Pressable className="flex-1 border border-outline rounded-md px-3 py-2.5 bg-surface" onPress={() => setShow('date')}>
          <Text className="text-sm text-ink">
            {value.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </Pressable>
        <Pressable className="border border-outline rounded-md px-3 py-2.5 bg-surface" onPress={() => setShow('time')}>
          <Text className="text-sm text-ink">
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
