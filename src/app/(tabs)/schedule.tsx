import { useMemo, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { ScrollView, Text, View } from '../../tw';
import {
  Banner,
  Button,
  Card,
  Divider,
  Field,
  FormModal,
  Input,
  Screen,
  SectionLabel,
  Select,
} from '../../components/ui';
import { useAppContext } from '../../context/AppContext';
import { useThemeMode } from '../../context/ThemeModeContext';
import { calculateDose, formatDose } from '../../utils/calculator';
import { formatTimeUntil, getUpcomingDoses, type UpcomingDose } from '../../utils/schedule';
import { toLocalDateTimeString } from '../../utils/dateTime';
import type { Compound, Route, UserCompound } from '../../types';

const ROUTE_OPTIONS: { value: Route; label: string }[] = [
  { value: 'subcutaneous', label: 'Subcutaneous' },
  { value: 'intramuscular', label: 'Intramuscular' },
  { value: 'intravenous', label: 'Intravenous' },
  { value: 'intranasal', label: 'Intranasal' },
  { value: 'topical', label: 'Topical' },
  { value: 'oral', label: 'Oral' },
];

export default function ScheduleScreen() {
  const { userCompounds, doseLogs, addDoseLog, resolveCompound } = useAppContext();
  const { colors } = useThemeMode();
  const now = Date.now();

  const [logOpen, setLogOpen] = useState(false);
  const [logTarget, setLogTarget] = useState<UpcomingDose | null>(null);
  const [logTargetUc, setLogTargetUc] = useState<UserCompound | null>(null);
  const [logDoseMg, setLogDoseMg] = useState('');
  const [logUnits, setLogUnits] = useState('');
  const [logRoute, setLogRoute] = useState<Route>('subcutaneous');
  const [logDate, setLogDate] = useState('');
  const [logSite, setLogSite] = useState('');
  const [logNotes, setLogNotes] = useState('');

  const upcoming = useMemo(
    () => getUpcomingDoses(userCompounds, doseLogs, now),
    [userCompounds, doseLogs, now],
  );

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = todayStart.getTime() + 24 * 60 * 60 * 1000;
  const weekEnd = todayStart.getTime() + 7 * 24 * 60 * 60 * 1000;
  const todayDoses = upcoming.filter(d => d.scheduledAt < tomorrowStart);
  const weekDoses = upcoming.filter(d => d.scheduledAt >= tomorrowStart && d.scheduledAt < weekEnd);
  const displayUpcoming = upcoming.slice(0, 6);
  const activeCount = userCompounds.filter(c => c.active).length;

  const lastDose = doseLogs.length > 0
    ? [...doseLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
    : null;
  const nextDose = upcoming[0] ?? null;

  const weekDays = Array.from({ length: 7 }, (_, idx) => {
    const start = todayStart.getTime() + idx * 24 * 60 * 60 * 1000;
    const end = start + 24 * 60 * 60 * 1000;
    return {
      date: new Date(start),
      doses: upcoming.filter(d => d.scheduledAt >= start && d.scheduledAt < end),
    };
  });

  const openMarkTaken = (dose: UpcomingDose) => {
    const uc = userCompounds.find(c => c.id === dose.userCompoundId);
    if (!uc) return;
    setLogTarget(dose);
    setLogTargetUc(uc);
    setLogDoseMg(String(uc.doseAmountMcg / 1000));
    setLogRoute(uc.route);
    setLogDate(toLocalDateTimeString(new Date(dose.scheduledAt)));
    setLogSite('');
    setLogNotes('');
    if (uc.vialStrengthMg > 0 && uc.waterVolumeMl > 0) {
      const calc = calculateDose(uc.doseAmountMcg, uc.vialStrengthMg, uc.waterVolumeMl);
      setLogUnits(String(calc.syringeUnits));
    } else {
      setLogUnits('');
    }
    setLogOpen(true);
  };

  const handleDoseMgChange = (value: string) => {
    setLogDoseMg(value);
    if (logTargetUc && logTargetUc.vialStrengthMg > 0 && logTargetUc.waterVolumeMl > 0) {
      const mg = parseFloat(value);
      if (mg > 0) {
        setLogUnits(String(calculateDose(mg * 1000, logTargetUc.vialStrengthMg, logTargetUc.waterVolumeMl).syringeUnits));
      }
    }
  };

  const handleConfirmTaken = () => {
    if (!logTarget || !logTargetUc) return;
    const parsedDate = new Date(logDate);
    addDoseLog({
      compoundId: logTargetUc.compoundId,
      userCompoundId: logTargetUc.id,
      timestamp: (isNaN(parsedDate.getTime()) ? new Date() : parsedDate).toISOString(),
      scheduledFor: new Date(logTarget.scheduledAt).toISOString(),
      doseMcg: parseFloat(logDoseMg) * 1000,
      units: parseFloat(logUnits) || 0,
      route: logRoute,
      injectionSite: logSite,
      notes: logNotes,
    });
    setLogOpen(false);
    setLogTarget(null);
    setLogTargetUc(null);
  };

  return (
    <Screen>
      <Text className="text-[13px] text-muted mb-4">
        Your upcoming injections, organized by what needs attention next.
      </Text>

      {/* Stats */}
      <StatCard
        label="Next Dose"
        value={nextDose ? formatTimeUntil(nextDose.scheduledAt, now) : 'None'}
        detail={nextDose ? `${resolveCompound(nextDose.compoundId)?.genericName ?? 'Unknown'} — ${formatDose(nextDose.doseMcg)}` : 'No dose scheduled'}
        icon="vaccines"
        accent
      />
      <StatCard
        label="Last Dose"
        value={lastDose ? new Date(lastDose.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'None'}
        detail={lastDose ? `${resolveCompound(lastDose.compoundId)?.genericName ?? 'Unknown'} — ${formatDose(lastDose.doseMcg)}` : 'No logged doses'}
        icon="event-available"
      />
      <StatCard
        label="Shots Taken"
        value={doseLogs.length.toString()}
        detail="Total doses logged"
        icon="check-circle"
      />

      {/* Today */}
      <Card className="p-4 mt-2 mb-3">
        <SectionLabel>
          Today — {todayStart.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
        </SectionLabel>
        {todayDoses.length === 0 ? (
          <View className="items-center py-6">
            <View className="w-14 h-14 rounded-full border-2 border-primary bg-primary-tint items-center justify-center mb-3">
              <MaterialIcons name="check-circle" size={26} color={colors.primary} />
            </View>
            <Text className="text-sm font-bold text-ink">No doses scheduled today.</Text>
            <Text className="text-[13px] text-muted mt-0.5">Enjoy the day off.</Text>
          </View>
        ) : (
          todayDoses.map((dose, i) => (
            <View key={`${dose.userCompoundId}-${dose.doseNumber}`}>
              {i > 0 ? <Divider /> : null}
              <DoseRow
                dose={dose}
                uc={userCompounds.find(c => c.id === dose.userCompoundId)}
                resolveCompound={resolveCompound}
                onMarkTaken={() => openMarkTaken(dose)}
              />
            </View>
          ))
        )}
      </Card>

      {/* Upcoming */}
      <Card className="p-4 mb-3">
        <View className="flex-row justify-between items-center mb-1">
          <SectionLabel>Upcoming</SectionLabel>
          <Text className="text-xs text-muted font-bold">{weekDoses.length} this week</Text>
        </View>
        {displayUpcoming.length === 0 ? (
          <Banner tone="info">No upcoming doses scheduled.</Banner>
        ) : (
          displayUpcoming.map((dose, i) => (
            <View key={`${dose.userCompoundId}-${dose.doseNumber}`}>
              {i > 0 ? <Divider /> : null}
              <DoseRow
                dose={dose}
                uc={userCompounds.find(c => c.id === dose.userCompoundId)}
                resolveCompound={resolveCompound}
                onMarkTaken={() => openMarkTaken(dose)}
                showDate
              />
            </View>
          ))
        )}
      </Card>

      {/* This week — horizontal day strip */}
      <Card className="p-4 mb-3">
        <View className="flex-row justify-between items-center mb-2">
          <SectionLabel>This Week</SectionLabel>
          <Text className="text-xs text-muted font-bold">{weekDoses.length} doses scheduled</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {weekDays.map(day => (
            <WeekDayCard key={day.date.toDateString()} day={day} userCompounds={userCompounds} resolveCompound={resolveCompound} />
          ))}
        </ScrollView>
      </Card>

      {activeCount === 0 ? (
        <Banner tone="info">Add active peptides from My Peptides to see your schedule.</Banner>
      ) : null}

      {/* Confirm dose modal */}
      <FormModal
        visible={logOpen}
        onClose={() => setLogOpen(false)}
        title="Confirm Dose"
        footer={
          <View className="flex-row gap-2">
            <Button title="Cancel" variant="outlined" onPress={() => setLogOpen(false)} className="flex-1" />
            <Button title="Mark Taken" onPress={handleConfirmTaken} disabled={!logDoseMg} className="flex-1" />
          </View>
        }
      >
        {logTargetUc ? (
          <View className="mb-3">
            <Banner tone="success">
              Logging dose for {resolveCompound(logTargetUc.compoundId)?.genericName ?? 'compound'}
            </Banner>
          </View>
        ) : null}
        <Field label="Dose Amount (mg)">
          <Input value={logDoseMg} onChangeText={handleDoseMgChange} keyboardType="decimal-pad" />
        </Field>
        <Field label="Syringe Units">
          <Input value={logUnits} onChangeText={setLogUnits} keyboardType="decimal-pad" />
        </Field>
        <Field label="Date & Time (YYYY-MM-DDTHH:MM)">
          <Input value={logDate} onChangeText={setLogDate} autoCapitalize="none" />
        </Field>
        <Select
          label="Route"
          value={logRoute}
          options={ROUTE_OPTIONS}
          onChange={v => setLogRoute(v)}
        />
        <Field label="Injection Site (optional)">
          <Input value={logSite} onChangeText={setLogSite} placeholder="e.g., Abdomen left" />
        </Field>
        <Field label="Notes (optional)">
          <Input value={logNotes} onChangeText={setLogNotes} multiline numberOfLines={2} className="min-h-16" />
        </Field>
      </FormModal>
    </Screen>
  );
}

function DoseRow({ dose, uc, resolveCompound, onMarkTaken, showDate }: {
  dose: UpcomingDose;
  uc: UserCompound | undefined;
  resolveCompound: (id: string) => Compound | undefined;
  onMarkTaken: () => void;
  showDate?: boolean;
}) {
  const compound = uc ? resolveCompound(uc.compoundId) : null;
  if (!compound || !uc) return null;
  const when = new Date(dose.scheduledAt);
  return (
    <View className="flex-row items-center gap-3 py-2.5">
      <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: uc.color }} />
      <View className="w-[74px]">
        <Text className="font-mono text-xs font-bold text-ink">
          {when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </Text>
        {showDate ? (
          <Text className="font-mono text-[10px] text-muted">
            {when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </Text>
        ) : null}
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-[13px] font-bold text-ink" numberOfLines={1}>{compound.genericName}</Text>
        <Text className="text-xs text-muted">{formatDose(dose.doseMcg)} — Dose #{dose.doseNumber}</Text>
      </View>
      <Button title="Log Now" onPress={onMarkTaken} className="px-3 py-1.5" />
    </View>
  );
}

function WeekDayCard({ day, userCompounds, resolveCompound }: {
  day: { date: Date; doses: UpcomingDose[] };
  userCompounds: UserCompound[];
  resolveCompound: (id: string) => Compound | undefined;
}) {
  return (
    <View className="w-[110px] min-h-[120px] border border-outline rounded-md p-2.5 bg-surface mr-2">
      <Text className="text-[10px] font-bold uppercase text-muted">
        {day.date.toLocaleDateString(undefined, { weekday: 'short' })}
      </Text>
      <Text className="font-mono text-[11px] font-bold text-ink mt-0.5">
        {day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
      </Text>
      <View className="mt-2 gap-1.5">
        {day.doses.slice(0, 2).map(dose => {
          const uc = userCompounds.find(c => c.id === dose.userCompoundId);
          const compound = resolveCompound(dose.compoundId);
          return (
            <View
              key={`${dose.userCompoundId}-${dose.doseNumber}`}
              className="pl-1.5 border-l-[3px]"
              style={{ borderLeftColor: uc?.color ?? '#0EA5B7' }}
            >
              <Text className="font-mono text-[10px] font-bold text-ink">
                {new Date(dose.scheduledAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </Text>
              <Text className="text-[11px] font-bold text-ink" numberOfLines={1}>
                {compound?.genericName ?? 'Dose'}
              </Text>
              <Text className="text-[10px] text-muted">{formatDose(dose.doseMcg)}</Text>
            </View>
          );
        })}
        {day.doses.length === 0 ? <Text className="text-[11px] text-muted mt-1">No dose</Text> : null}
      </View>
    </View>
  );
}

function StatCard({ label, value, detail, icon, accent }: {
  label: string;
  value: string;
  detail: string;
  icon: 'vaccines' | 'event-available' | 'check-circle';
  accent?: boolean;
}) {
  const { colors } = useThemeMode();
  return (
    <Card className={`p-4 mb-2 ${accent ? 'border-t-[3px] border-t-primary' : ''}`}>
      <View className="flex-row justify-between items-center gap-3">
        <View className="flex-1 min-w-0">
          <SectionLabel>{label}</SectionLabel>
          <Text
            className={`font-mono text-[22px] font-bold ${accent ? 'text-primary' : 'text-ink'}`}
            numberOfLines={1}
          >
            {value}
          </Text>
          <Text className="text-xs text-muted mt-1" numberOfLines={1}>{detail}</Text>
        </View>
        <View className="w-10 h-10 rounded-full bg-primary-tint items-center justify-center">
          <MaterialIcons name={icon} size={19} color={colors.tealText} />
        </View>
      </View>
    </Card>
  );
}
