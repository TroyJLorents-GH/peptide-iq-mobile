import { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from '../../tw';
import { Banner, Button, Card, Chip, Divider, EmptyState, Field, FormModal, Input, Screen, SectionLabel, Select } from '../../components/ui';
import EvidenceBadge from '../../components/EvidenceBadge';
import ColorPicker from '../../components/ColorPicker';
import DayOfWeekPicker from '../../components/DayOfWeekPicker';
import DateTimeField from '../../components/DateTimeField';
import LineChart from '../../components/LineChart';
import { useAppContext } from '../../context/AppContext';
import { useThemeMode } from '../../context/ThemeModeContext';
import { calculateSerumCurve, getCurrentConcentration, type GraphMode } from '../../utils/serumModel';
import { calculateDose, formatDose } from '../../utils/calculator';
import { getUpcomingDoses } from '../../utils/schedule';
import { formatWeeks, planProgress, vialRemainingMg } from '../../utils/tracking';
import type { Route } from '../../types';

const RANGE_OPTIONS = [
  { label: 'Current', days: 1 },
  { label: '7D', days: 7 },
  { label: '14D', days: 14 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: 'All', days: 0 },
];

const ROUTE_OPTIONS: { value: Route; label: string }[] = [
  { value: 'subcutaneous', label: 'Subcutaneous' },
  { value: 'intramuscular', label: 'Intramuscular' },
  { value: 'intravenous', label: 'Intravenous' },
  { value: 'intranasal', label: 'Intranasal' },
  { value: 'topical', label: 'Topical' },
  { value: 'oral', label: 'Oral' },
];

const FREQ_OPTIONS = [
  { value: 8, label: 'Every 8 hours' },
  { value: 12, label: 'Every 12 hours' },
  { value: 24, label: 'Daily' },
  { value: 48, label: 'Every other day' },
  { value: 72, label: 'Every 3 days' },
  { value: 120, label: 'Every 5 days' },
  { value: 168, label: 'Weekly' },
  { value: 672, label: 'Monthly' },
];

export default function CompoundDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useThemeMode();
  const {
    userCompounds,
    doseLogs,
    updateUserCompound,
    addDoseLog,
    updateDoseLog,
    removeDoseLog,
    userVials,
    startUserVial,
    updateUserVial,
    resolveCompound,
  } = useAppContext();

  const userCompound = userCompounds.find(uc => uc.id === id);
  const compound = userCompound ? resolveCompound(userCompound.compoundId) : undefined;
  const compoundDoses = useMemo(
    () =>
      doseLogs
        .filter(d => d.compoundId === userCompound?.compoundId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [doseLogs, userCompound?.compoundId],
  );

  const [rangeDays, setRangeDays] = useState(7);
  const [graphMode, setGraphMode] = useState<GraphMode>('bodyLoad');

  // Settings modal
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editDose, setEditDose] = useState('');
  const [editFreq, setEditFreq] = useState(24);
  const [editRoute, setEditRoute] = useState<Route>('subcutaneous');
  const [editVial, setEditVial] = useState('');
  const [editWater, setEditWater] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editPlanDuration, setEditPlanDuration] = useState('');
  const [editPlanUnit, setEditPlanUnit] = useState<'days' | 'weeks' | 'months'>('weeks');
  const [editStartDate, setEditStartDate] = useState(new Date());
  const [editDays, setEditDays] = useState<number[]>([]);

  // Log dose modal
  const [logOpen, setLogOpen] = useState(false);
  const [logDoseMg, setLogDoseMg] = useState('');
  const [logUnits, setLogUnits] = useState('');
  const [logDate, setLogDate] = useState(new Date());
  const [logRoute, setLogRoute] = useState<Route>('subcutaneous');
  const [logSite, setLogSite] = useState('');
  const [logNotes, setLogNotes] = useState('');
  const [editingDoseId, setEditingDoseId] = useState<string | null>(null);

  // Dose history filters
  const [doseSearch, setDoseSearch] = useState('');
  const [routeFilter, setRouteFilter] = useState<'all' | Route>('all');
  const [doseHistoryExpanded, setDoseHistoryExpanded] = useState(false);

  // Vial modal
  const [vialOpen, setVialOpen] = useState(false);
  const [vialStrengthInput, setVialStrengthInput] = useState('');
  const [vialWaterInput, setVialWaterInput] = useState('');
  const [vialOpenedAt, setVialOpenedAt] = useState(new Date());
  const [vialNotes, setVialNotes] = useState('');
  const [vialError, setVialError] = useState('');
  const [editingVialId, setEditingVialId] = useState<string | null>(null);

  if (!userCompound || !compound) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Compound' }} />
        <EmptyState icon="search-off" title="Compound not found" />
        <Button title="Back to My Peptides" variant="outlined" onPress={() => router.back()} />
      </Screen>
    );
  }

  const currentLevel = compoundDoses.length > 0 ? getCurrentConcentration(compoundDoses, compound, graphMode) : 0;
  const nextDose = getUpcomingDoses(userCompounds, doseLogs, Date.now()).find(d => d.userCompoundId === userCompound.id);
  const vialStatus = vialRemainingMg(userCompound, compoundDoses, userVials);
  const plan = planProgress(userCompound);
  const concentration =
    userCompound.vialStrengthMg > 0 && userCompound.waterVolumeMl > 0
      ? ((userCompound.vialStrengthMg * 1000) / userCompound.waterVolumeMl).toFixed(0)
      : null;
  const dayLabels = userCompound.scheduledDaysOfWeek?.length
    ? userCompound.scheduledDaysOfWeek.map(dayLabel).join(', ')
    : 'Interval based';
  const activeVialStrengthMg = vialStatus.activeVial?.vialStrengthMg ?? userCompound.vialStrengthMg;
  const activeWaterVolumeMl = vialStatus.activeVial?.waterVolumeMl ?? userCompound.waterVolumeMl;
  const syringeUnits =
    activeVialStrengthMg > 0 && activeWaterVolumeMl > 0
      ? calculateDose(userCompound.doseAmountMcg, activeVialStrengthMg, activeWaterVolumeMl).syringeUnits
      : null;

  const filteredDoses = compoundDoses.filter(d => {
    if (routeFilter !== 'all' && d.route !== routeFilter) return false;
    const q = doseSearch.trim().toLowerCase();
    if (!q) return true;
    return [
      formatDose(d.doseMcg),
      d.units ? `${d.units} units` : '',
      d.route,
      d.injectionSite,
      d.notes,
      new Date(d.timestamp).toLocaleString(),
    ].some(value => (value ?? '').toLowerCase().includes(q));
  });
  const visibleDoses = doseHistoryExpanded ? filteredDoses : filteredDoses.slice(0, 8);

  const chartData = (() => {
    if (compoundDoses.length === 0) return null;
    const now = Date.now();
    let rangeStart: number;
    if (rangeDays === 0) {
      const firstDoseTime = compoundDoses.map(d => new Date(d.timestamp).getTime()).reduce((min, t) => Math.min(min, t), now);
      rangeStart = firstDoseTime - 24 * 60 * 60 * 1000;
    } else {
      rangeStart = now - rangeDays * 24 * 60 * 60 * 1000;
    }
    const totalDays = (now - rangeStart) / (24 * 60 * 60 * 1000);
    const pointsPerDay = rangeDays === 1 ? 24 : totalDays > 14 ? 2 : 4;
    const points = Math.min(Math.max(Math.round(totalDays * pointsPerDay), 50), 200);
    const curve = calculateSerumCurve(compoundDoses, compound, rangeStart, now, points, graphMode);
    return {
      series: [{ color: userCompound.color, points: curve.map(p => ({ x: p.timestamp, y: p.concentration })) }],
    };
  })();

  const xFormatter = (x: number) => {
    const d = new Date(x);
    return rangeDays === 1
      ? d.toLocaleTimeString(undefined, { hour: 'numeric' })
      : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const openSettings = () => {
    setEditDose(String(userCompound.doseAmountMcg / 1000));
    setEditFreq(userCompound.doseFrequencyHours);
    setEditRoute(userCompound.route);
    setEditVial(String(userCompound.vialStrengthMg || ''));
    setEditWater(String(userCompound.waterVolumeMl || ''));
    setEditColor(userCompound.color);
    setEditStartDate(new Date(userCompound.startDate));
    setEditDays(userCompound.scheduledDaysOfWeek ?? []);
    if (userCompound.plannedDurationDays) {
      const d = userCompound.plannedDurationDays;
      if (d % 30 === 0 && d >= 30) {
        setEditPlanDuration(String(d / 30));
        setEditPlanUnit('months');
      } else if (d % 7 === 0 && d >= 7) {
        setEditPlanDuration(String(d / 7));
        setEditPlanUnit('weeks');
      } else {
        setEditPlanDuration(String(d));
        setEditPlanUnit('days');
      }
    } else {
      setEditPlanDuration('');
      setEditPlanUnit('weeks');
    }
    setSettingsOpen(true);
  };

  const saveSettings = () => {
    updateUserCompound(userCompound.id, {
      doseAmountMcg: parseFloat(editDose) * 1000,
      doseFrequencyHours: editFreq,
      route: editRoute,
      vialStrengthMg: parseFloat(editVial) || 0,
      waterVolumeMl: parseFloat(editWater) || 0,
      color: editColor,
      startDate: editStartDate.toISOString(),
      scheduledDaysOfWeek: editDays.length > 0 ? editDays : null,
      plannedDurationDays: (() => {
        const n = parseFloat(editPlanDuration);
        if (!n || n <= 0) return null;
        return editPlanUnit === 'days' ? n : editPlanUnit === 'weeks' ? n * 7 : n * 30;
      })(),
    });
    setSettingsOpen(false);
  };

  const autoUnits = (mg: number) => {
    if (activeVialStrengthMg > 0 && activeWaterVolumeMl > 0 && mg > 0) {
      const calc = calculateDose(mg * 1000, activeVialStrengthMg, activeWaterVolumeMl);
      setLogUnits(String(calc.syringeUnits));
    }
  };

  const openLogDose = () => {
    setEditingDoseId(null);
    setLogDoseMg(String(userCompound.doseAmountMcg / 1000));
    setLogRoute(userCompound.route);
    setLogDate(new Date());
    setLogSite('');
    setLogNotes('');
    if (activeVialStrengthMg > 0 && activeWaterVolumeMl > 0) {
      const calc = calculateDose(userCompound.doseAmountMcg, activeVialStrengthMg, activeWaterVolumeMl);
      setLogUnits(String(calc.syringeUnits));
    } else {
      setLogUnits('');
    }
    setLogOpen(true);
  };

  const openEditDose = (doseId: string) => {
    const dose = doseLogs.find(d => d.id === doseId);
    if (!dose) return;
    setEditingDoseId(doseId);
    setLogDoseMg(String(dose.doseMcg / 1000));
    setLogUnits(String(dose.units));
    setLogDate(new Date(dose.timestamp));
    setLogRoute(dose.route);
    setLogSite(dose.injectionSite);
    setLogNotes(dose.notes);
    setLogOpen(true);
  };

  const handleLogDose = () => {
    if (!logDoseMg) return;
    const payload = {
      compoundId: userCompound.compoundId,
      userCompoundId: userCompound.id,
      timestamp: logDate.toISOString(),
      doseMcg: parseFloat(logDoseMg) * 1000,
      units: parseFloat(logUnits) || 0,
      route: logRoute,
      injectionSite: logSite,
      notes: logNotes,
    };
    if (editingDoseId) {
      updateDoseLog(editingDoseId, payload);
    } else {
      addDoseLog(payload);
    }
    setLogOpen(false);
  };

  const confirmRemoveDose = (doseId: string) => {
    Alert.alert('Delete dose?', 'This removes the dose log permanently.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeDoseLog(doseId) },
    ]);
  };

  const openStartVial = () => {
    setEditingVialId(null);
    setVialStrengthInput(String(userCompound.vialStrengthMg || ''));
    setVialWaterInput(String(userCompound.waterVolumeMl || ''));
    setVialOpenedAt(new Date());
    setVialNotes('');
    setVialError('');
    setVialOpen(true);
  };

  const openEditActiveVial = () => {
    const activeVial = vialStatus.activeVial;
    if (!activeVial) {
      openStartVial();
      return;
    }
    setEditingVialId(activeVial.id);
    setVialStrengthInput(String(activeVial.vialStrengthMg || ''));
    setVialWaterInput(String(activeVial.waterVolumeMl || ''));
    setVialOpenedAt(new Date(activeVial.openedAt));
    setVialNotes(activeVial.notes ?? '');
    setVialError('');
    setVialOpen(true);
  };

  const handleSaveVial = async () => {
    const vialStrengthMg = parseFloat(vialStrengthInput);
    const waterVolumeMl = parseFloat(vialWaterInput);
    if (!vialStrengthMg || vialStrengthMg <= 0) return;
    if (editingVialId) {
      const saved = await updateUserVial(editingVialId, {
        vialStrengthMg,
        waterVolumeMl: waterVolumeMl || 0,
        openedAt: vialOpenedAt.toISOString(),
        notes: vialNotes,
      });
      if (saved) setVialOpen(false);
      else setVialError('Could not update this vial. Please try again.');
      return;
    }
    const created = await startUserVial({
      userCompoundId: userCompound.id,
      compoundId: userCompound.compoundId,
      vialStrengthMg,
      waterVolumeMl: waterVolumeMl || 0,
      openedAt: vialOpenedAt.toISOString(),
      notes: vialNotes,
    });
    if (created) setVialOpen(false);
    else setVialError('Could not save this vial. Please try again.');
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: compound.genericName }} />

      {/* Header */}
      <View className="mb-4">
        <View className="flex-row items-center gap-2 flex-wrap">
          <Text className="text-2xl font-extrabold text-ink">{compound.genericName}</Text>
          <EvidenceBadge tier={compound.evidenceTier} />
        </View>
        <Text className="text-[13px] text-muted mt-1">
          {compound.brandNames.length > 0 ? `${compound.brandNames.join(', ')} — ` : ''}
          {compound.category} — {compound.approvalStatus}
        </Text>
        <View className="flex-row gap-2 mt-3">
          <Button
            title="Settings"
            variant="outlined"
            className="flex-1"
            onPress={openSettings}
            icon={<MaterialIcons name="settings" size={16} color={colors.primary} />}
          />
          <Button
            title="Log Dose"
            className="flex-1"
            onPress={openLogDose}
            icon={<MaterialIcons name="post-add" size={16} color={colors.onPrimary} />}
          />
        </View>
      </View>

      {/* Stat cards */}
      <View className="flex-row flex-wrap gap-3 mb-3">
        <MiniCard
          label="Current Level"
          value={`${graphMode === 'bodyLoad' ? currentLevel.toFixed(3) : currentLevel.toFixed(1)} ${graphMode === 'bodyLoad' ? 'mg' : 'mcg'}`}
          color={userCompound.color}
        />
        <MiniCard
          label="Next Dose"
          value={nextDose ? new Date(nextDose.scheduledAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'None'}
          detail={nextDose ? new Date(nextDose.scheduledAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : 'No upcoming slot'}
        />
        <MiniCard
          label="Vial Remaining"
          value={vialStatus.remainingMg !== null ? `${vialStatus.remainingMg.toFixed(2)} mg` : 'Not set'}
          detail={
            vialStatus.remainingPct !== null
              ? `${vialStatus.remainingPct.toFixed(0)}% ${vialStatus.source === 'vial' ? 'active vial' : 'configured vial'}`
              : 'Add vial info'
          }
          progress={vialStatus.remainingPct ?? undefined}
          color={userCompound.color}
        />
        <MiniCard label="Total Doses" value={String(compoundDoses.length)} detail="logged doses" />
      </View>

      {/* Reconstitution */}
      {concentration ? (
        <Card className="mb-3 p-3" style={{ borderLeftWidth: 4, borderLeftColor: userCompound.color }}>
          <SectionLabel>Reconstitution</SectionLabel>
          <Text className="text-[13px] font-semibold text-ink">
            {userCompound.vialStrengthMg} mg vial + {userCompound.waterVolumeMl} mL bac water = {concentration} mcg/mL
          </Text>
        </Card>
      ) : null}

      {/* Chart */}
      <Card className="p-4 mb-3">
        <View className="flex-row items-center justify-between mb-3 flex-wrap gap-2">
          <Text className="text-base font-extrabold text-ink">
            {graphMode === 'bodyLoad' ? 'Body Load' : 'Concentration'}
          </Text>
          <SegmentControl
            options={[
              { value: 'bodyLoad', label: 'Body Load' },
              { value: 'concentration', label: 'Conc.' },
            ]}
            value={graphMode}
            onChange={v => setGraphMode(v as GraphMode)}
          />
        </View>
        <SegmentControl
          options={RANGE_OPTIONS.map(o => ({ value: String(o.days), label: o.label }))}
          value={String(rangeDays)}
          onChange={v => setRangeDays(Number(v))}
          className="mb-3"
        />
        {chartData ? (
          <LineChart
            series={chartData.series}
            height={260}
            xFormatter={xFormatter}
            yFormatter={y => (graphMode === 'bodyLoad' ? y.toFixed(y >= 10 ? 0 : 2) : y.toFixed(0))}
          />
        ) : (
          <EmptyState icon="show-chart" title="No doses logged yet" />
        )}
      </Card>

      {/* Next dose card */}
      <Card className="p-4 mb-3">
        <SectionLabel>Next Dose</SectionLabel>
        <Text className="text-2xl font-extrabold text-primary">
          {nextDose ? new Date(nextDose.scheduledAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'None'}
        </Text>
        <Text className="text-[13px] text-muted mt-0.5">
          {nextDose ? new Date(nextDose.scheduledAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : 'No upcoming dose'}
        </Text>
        <Divider className="my-3" />
        <MetricLine label="Dose" value={formatDose(userCompound.doseAmountMcg)} />
        <MetricLine label="Units" value={syringeUnits !== null ? `${syringeUnits} units` : 'Not set'} />
        <MetricLine label="Route" value={userCompound.route} />
        <Button
          title="Log Now"
          className="mt-3"
          onPress={openLogDose}
          icon={<MaterialIcons name="post-add" size={16} color={colors.onPrimary} />}
        />
        <View className="flex-row gap-2 mt-2">
          <Button title="Start New Vial" variant="outlined" className="flex-1" onPress={openStartVial} />
          <Button
            title="Edit Active Vial"
            variant="outlined"
            className="flex-1"
            onPress={openEditActiveVial}
            disabled={!vialStatus.activeVial}
          />
        </View>
      </Card>

      {/* Schedule card */}
      <Card className="p-4 mb-3">
        <SectionLabel>Schedule</SectionLabel>
        <MetricLine label="Frequency" value={formatFreq(userCompound.doseFrequencyHours)} />
        <MetricLine label="Days" value={dayLabels} />
        <MetricLine label="Start" value={new Date(userCompound.startDate).toLocaleDateString()} />
        <MetricLine label="Plan" value={plan ? `${formatWeeks(plan.totalWeeks)} total` : 'Ongoing'} />
        {plan ? (
          <>
            <MetricLine label="Remaining" value={formatWeeks(plan.remainingWeeks)} />
            <MetricLine label="Ends" value={plan.endDate.toLocaleDateString()} />
          </>
        ) : null}
        <View className="flex-row gap-1.5 mt-3">
          {[1, 2, 3, 4, 5, 6, 0].map(day => {
            const selected = userCompound.scheduledDaysOfWeek?.includes(day) ?? false;
            return (
              <View
                key={day}
                className={`w-7 h-7 rounded-full items-center justify-center ${selected ? 'bg-primary-solid' : 'bg-primary-tint'}`}
              >
                <Text className={`text-[11px] font-extrabold ${selected ? 'text-on-primary' : 'text-muted'}`}>
                  {dayLabel(day).slice(0, 1)}
                </Text>
              </View>
            );
          })}
        </View>
      </Card>

      {/* Dose history */}
      <Card className="p-4 mb-3">
        <Text className="text-base font-bold text-ink mb-3">Dose History ({compoundDoses.length})</Text>
        <Input placeholder="Search dose history" value={doseSearch} onChangeText={setDoseSearch} className="mb-2" />
        <Select
          value={routeFilter}
          onChange={v => setRouteFilter(v as 'all' | Route)}
          options={[{ value: 'all' as 'all' | Route, label: 'All routes' }, ...ROUTE_OPTIONS]}
        />
        <View className="mt-3 gap-2">
          {filteredDoses.length === 0 ? (
            <Text className="text-[13px] text-muted text-center py-3">No doses match the current filters.</Text>
          ) : (
            visibleDoses.map(d => (
              <View key={d.id} className="border border-card-border rounded-md p-3 bg-surface">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[13px] font-extrabold text-ink">
                    {formatDose(d.doseMcg)}
                    {d.units > 0 ? ` — ${d.units} units` : ''}
                  </Text>
                  <View className="flex-row gap-3">
                    <Pressable onPress={() => openEditDose(d.id)} hitSlop={8}>
                      <MaterialIcons name="edit" size={16} color={colors.muted} />
                    </Pressable>
                    <Pressable onPress={() => confirmRemoveDose(d.id)} hitSlop={8}>
                      <MaterialIcons name="delete" size={16} color={colors.error} />
                    </Pressable>
                  </View>
                </View>
                <Text className="text-[11px] text-muted mt-1">
                  {new Date(d.timestamp).toLocaleString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
                <View className="flex-row items-center gap-2 mt-1.5">
                  <Chip label={d.route} tone="primary" />
                  <Text className="text-[11px] text-muted flex-1" numberOfLines={1}>
                    {d.injectionSite || 'No site'}
                    {d.notes ? ` — ${d.notes}` : ''}
                  </Text>
                </View>
              </View>
            ))
          )}
          {filteredDoses.length > 8 ? (
            <Button
              title={doseHistoryExpanded ? 'Show Less' : `Show ${filteredDoses.length - 8} More`}
              variant="outlined"
              onPress={() => setDoseHistoryExpanded(prev => !prev)}
            />
          ) : null}
        </View>
      </Card>

      {/* PK profile */}
      <Card className="p-4">
        <SectionLabel>Pharmacokinetic Profile</SectionLabel>
        <View className="flex-row flex-wrap gap-3">
          <MiniCard label="Half-life" value={`${compound.pk.halfLifeHours}h`} detail={`${(compound.pk.halfLifeHours / 24).toFixed(1)} days`} flat />
          <MiniCard label="Tmax" value={`${compound.pk.tmaxHours}h`} detail="estimated peak" flat />
          <MiniCard label="Bioavailability" value={`${(compound.pk.bioavailability * 100).toFixed(0)}%`} detail="population estimate" flat />
        </View>
      </Card>

      {/* Settings modal */}
      <FormModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title={`Edit Settings — ${compound.genericName}`}
        footer={
          <View className="flex-row gap-2">
            <Button title="Cancel" variant="outlined" className="flex-1" onPress={() => setSettingsOpen(false)} />
            <Button title="Save" className="flex-1" onPress={saveSettings} />
          </View>
        }
      >
        <DateTimeField label="Schedule Anchor — Date & Time" value={editStartDate} onChange={setEditStartDate} />
        <Text className="text-[11px] text-muted -mt-2 mb-3">
          All future scheduled doses are computed from this datetime + your frequency.
        </Text>
        <Field label="Dose Amount (mg)">
          <Input value={editDose} onChangeText={setEditDose} keyboardType="decimal-pad" />
        </Field>
        <Select label="Frequency" value={editFreq} options={FREQ_OPTIONS} onChange={setEditFreq} />
        <Select label="Route" value={editRoute} options={ROUTE_OPTIONS} onChange={setEditRoute} />
        <Divider className="my-3" />
        <Text className="text-xs text-muted font-semibold mb-2">Reconstitution (for auto-calculating syringe units)</Text>
        <Field label="Vial Strength (mg)">
          <Input value={editVial} onChangeText={setEditVial} keyboardType="decimal-pad" />
        </Field>
        <Field label="Bac Water Volume (mL)">
          <Input value={editWater} onChangeText={setEditWater} keyboardType="decimal-pad" />
        </Field>
        <Divider className="my-3" />
        <DayOfWeekPicker
          value={editDays}
          onChange={setEditDays}
          label="Specific Days (Optional)"
          helperText="Leave empty for pure frequency-based schedule"
        />
        <Divider className="my-3" />
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Field label="Plan Duration">
              <Input value={editPlanDuration} onChangeText={setEditPlanDuration} keyboardType="decimal-pad" />
            </Field>
          </View>
          <View className="w-32">
            <Select
              label="Unit"
              value={editPlanUnit}
              options={[
                { value: 'days' as const, label: 'Days' },
                { value: 'weeks' as const, label: 'Weeks' },
                { value: 'months' as const, label: 'Months' },
              ]}
              onChange={setEditPlanUnit}
            />
          </View>
        </View>
        <Divider className="my-3" />
        <ColorPicker
          value={editColor}
          onChange={setEditColor}
          usedColors={userCompounds.filter(c => c.id !== userCompound.id).map(c => c.color)}
          label="Chart Color"
        />
      </FormModal>

      {/* Log dose modal */}
      <FormModal
        visible={logOpen}
        onClose={() => setLogOpen(false)}
        title={editingDoseId ? 'Edit Dose' : 'Log Dose'}
        footer={
          <View className="flex-row gap-2">
            <Button title="Cancel" variant="outlined" className="flex-1" onPress={() => setLogOpen(false)} />
            <Button
              title={editingDoseId ? 'Save Changes' : 'Log Dose'}
              className="flex-1"
              onPress={handleLogDose}
              disabled={!logDoseMg}
            />
          </View>
        }
      >
        <Field label="Dose Amount (mg)">
          <Input
            value={logDoseMg}
            keyboardType="decimal-pad"
            onChangeText={v => {
              setLogDoseMg(v);
              autoUnits(parseFloat(v));
            }}
          />
        </Field>
        <Field label="Syringe Units">
          <Input value={logUnits} onChangeText={setLogUnits} keyboardType="decimal-pad" />
        </Field>
        <Text className="text-[11px] text-muted -mt-2 mb-3">
          {activeVialStrengthMg > 0 && activeWaterVolumeMl > 0
            ? `Auto-calculated from ${activeVialStrengthMg} mg vial + ${activeWaterVolumeMl} mL water`
            : 'Set vial strength & water in Settings to auto-calculate'}
        </Text>
        <DateTimeField label="Date & Time" value={logDate} onChange={setLogDate} />
        <Select label="Route" value={logRoute} options={ROUTE_OPTIONS} onChange={setLogRoute} />
        <Field label="Injection Site (optional)">
          <Input value={logSite} onChangeText={setLogSite} placeholder="e.g., Abdomen left, Thigh right" />
        </Field>
        <Field label="Notes (optional)">
          <Input value={logNotes} onChangeText={setLogNotes} multiline numberOfLines={2} />
        </Field>
      </FormModal>

      {/* Vial modal */}
      <FormModal
        visible={vialOpen}
        onClose={() => setVialOpen(false)}
        title={editingVialId ? 'Edit Active Vial' : 'Start New Vial'}
        footer={
          <View className="flex-row gap-2">
            <Button title="Cancel" variant="outlined" className="flex-1" onPress={() => setVialOpen(false)} />
            <Button
              title={editingVialId ? 'Save Vial' : 'Start Vial'}
              className="flex-1"
              onPress={handleSaveVial}
              disabled={!parseFloat(vialStrengthInput)}
            />
          </View>
        }
      >
        {vialError ? (
          <View className="mb-3">
            <Banner tone="error">{vialError}</Banner>
          </View>
        ) : null}
        <Field label="Vial Strength (mg)">
          <Input value={vialStrengthInput} onChangeText={setVialStrengthInput} keyboardType="decimal-pad" />
        </Field>
        <Text className="text-[11px] text-muted -mt-2 mb-3">
          Only doses logged on or after the opened date are counted against this vial.
        </Text>
        <Field label="Bac Water Volume (mL)">
          <Input value={vialWaterInput} onChangeText={setVialWaterInput} keyboardType="decimal-pad" />
        </Field>
        <DateTimeField label="Opened Date & Time" value={vialOpenedAt} onChange={setVialOpenedAt} />
        <Field label="Notes (optional)">
          <Input value={vialNotes} onChangeText={setVialNotes} multiline numberOfLines={2} placeholder="e.g., vendor, lot, fridge location" />
        </Field>
      </FormModal>
    </Screen>
  );
}

function MiniCard({ label, value, detail, color, progress, flat }: {
  label: string;
  value: string;
  detail?: string;
  color?: string;
  progress?: number;
  flat?: boolean;
}) {
  return (
    <Card
      className="p-3 grow basis-[45%]"
      style={color && !flat ? { borderLeftWidth: 4, borderLeftColor: color } : undefined}
    >
      <SectionLabel>{label}</SectionLabel>
      <Text className="font-mono text-lg font-extrabold text-ink" numberOfLines={1}>
        {value}
      </Text>
      {detail ? (
        <Text className="text-[11px] text-muted mt-0.5" numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
      {progress !== undefined ? (
        <View className="h-1.5 bg-divider rounded-full overflow-hidden mt-2">
          <View className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: color ?? '#0EA5B7' }} />
        </View>
      ) : null}
    </Card>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-3 py-2 border-b border-divider">
      <Text className="text-xs text-muted">{label}</Text>
      <Text className="text-xs font-extrabold text-ink text-right flex-1" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function SegmentControl({ options, value, onChange, className = '' }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <View className={`flex-row border border-outline rounded-md overflow-hidden self-start ${className}`}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            className={`px-2.5 py-1.5 ${active ? 'bg-primary-tint' : ''} ${i > 0 ? 'border-l border-outline' : ''}`}
            onPress={() => onChange(o.value)}
          >
            <Text className={`font-mono text-[10px] uppercase tracking-wider ${active ? 'text-teal-text font-medium' : 'text-muted'}`}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function dayLabel(day: number) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day] ?? 'Day';
}

function formatFreq(hours: number): string {
  if (hours < 24) return `Every ${hours}h`;
  if (hours === 24) return 'Daily';
  if (hours === 48) return 'Every other day';
  if (hours === 72) return 'Every 3 days';
  const days = hours / 24;
  if (days === 7) return 'Weekly';
  if (days === 14) return 'Every 2 weeks';
  if (days === 28) return 'Monthly';
  if (Number.isInteger(days)) return `Every ${days} days`;
  return `Every ${hours}h`;
}
