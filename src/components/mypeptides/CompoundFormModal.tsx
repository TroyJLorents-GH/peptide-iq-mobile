import { useEffect, useMemo, useState } from 'react';
import { Text, View } from '../../tw';
import { Button, Card, Divider, Field, FormModal, Input, Select } from '../ui';
import DateTimeField from './DateTimeField';
import DayOfWeekPicker from './DayOfWeekPicker';
import ColorPicker from './ColorPicker';
import { useAppContext } from '../../context/AppContext';
import { useThemeMode } from '../../context/ThemeModeContext';
import { compounds } from '../../data/compounds';
import { userStackToCompound } from '../../utils/blendMath';
import { nextFreeColor } from '../../theme/colors';
import type { Route, UserCompound } from '../../types';

export const FREQ_OPTIONS: { value: string; label: string }[] = [
  { value: '8', label: 'Every 8 hours' },
  { value: '12', label: 'Every 12 hours' },
  { value: '24', label: 'Daily' },
  { value: '48', label: 'Every other day' },
  { value: '72', label: 'Every 3 days' },
  { value: '120', label: 'Every 5 days' },
  { value: '168', label: 'Weekly' },
  { value: '672', label: 'Monthly' },
];

export const ROUTE_OPTIONS: { value: Route; label: string }[] = [
  { value: 'subcutaneous', label: 'Subcutaneous' },
  { value: 'intramuscular', label: 'Intramuscular' },
  { value: 'intravenous', label: 'Intravenous' },
  { value: 'intranasal', label: 'Intranasal' },
  { value: 'topical', label: 'Topical' },
  { value: 'oral', label: 'Oral' },
];

export function formatFreq(hours: number): string {
  const found = FREQ_OPTIONS.find(o => Number(o.value) === hours);
  if (!found) return `Every ${hours}h`;
  return found.label.replace('Every other day', 'Every other day');
}

type PlanUnit = 'days' | 'weeks' | 'months';

interface CompoundFormModalProps {
  visible: boolean;
  onClose: () => void;
  /** When set, the modal edits this compound instead of adding a new one. */
  editing?: UserCompound | null;
}

/** Add Peptide / Edit Settings dialog — mirrors the web app's two dialogs. */
export default function CompoundFormModal({ visible, onClose, editing }: CompoundFormModalProps) {
  const { userCompounds, userStacks, addUserCompound, updateUserCompound } = useAppContext();
  const { colors } = useThemeMode();

  const [selectedCompoundId, setSelectedCompoundId] = useState('');
  const [doseAmount, setDoseAmount] = useState('');
  const [doseFreq, setDoseFreq] = useState('24');
  const [route, setRoute] = useState<Route>('subcutaneous');
  const [vialStrength, setVialStrength] = useState('');
  const [waterVol, setWaterVol] = useState('');
  const [planDuration, setPlanDuration] = useState('');
  const [planUnit, setPlanUnit] = useState<PlanUnit>('weeks');
  const [startDate, setStartDate] = useState(new Date());
  const [days, setDays] = useState<number[]>([]);
  const [color, setColor] = useState('');

  // Compounds not yet added — curated peptides + user's custom blends.
  const availableCompounds = useMemo(() => {
    const stackCompounds = userStacks.map(s => userStackToCompound(s));
    return [...compounds, ...stackCompounds]
      .filter(c => !userCompounds.some(uc => uc.compoundId === c.id))
      .sort((a, b) => a.genericName.localeCompare(b.genericName));
  }, [userStacks, userCompounds]);

  // Seed form state when the modal opens
  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setSelectedCompoundId(editing.compoundId);
      setDoseAmount(String(editing.doseAmountMcg / 1000));
      setDoseFreq(String(editing.doseFrequencyHours));
      setRoute(editing.route);
      setVialStrength(editing.vialStrengthMg ? String(editing.vialStrengthMg) : '');
      setWaterVol(editing.waterVolumeMl ? String(editing.waterVolumeMl) : '');
      setStartDate(new Date(editing.startDate));
      setDays(editing.scheduledDaysOfWeek ?? []);
      setColor(editing.color);
      if (editing.plannedDurationDays) {
        const d = editing.plannedDurationDays;
        if (d % 30 === 0 && d >= 30) { setPlanDuration(String(d / 30)); setPlanUnit('months'); }
        else if (d % 7 === 0 && d >= 7) { setPlanDuration(String(d / 7)); setPlanUnit('weeks'); }
        else { setPlanDuration(String(d)); setPlanUnit('days'); }
      } else {
        setPlanDuration('');
        setPlanUnit('weeks');
      }
    } else {
      setSelectedCompoundId('');
      setDoseAmount('');
      setDoseFreq('24');
      setRoute('subcutaneous');
      setVialStrength('');
      setWaterVol('');
      setPlanDuration('');
      setPlanUnit('weeks');
      setStartDate(new Date());
      setDays([]);
      setColor(nextFreeColor(userCompounds.map(uc => uc.color)));
    }
  }, [visible, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const plannedDays = (() => {
    const n = parseFloat(planDuration);
    if (!n || n <= 0) return null;
    return planUnit === 'days' ? n : planUnit === 'weeks' ? n * 7 : n * 30;
  })();

  const handleSave = () => {
    if (editing) {
      updateUserCompound(editing.id, {
        doseAmountMcg: parseFloat(doseAmount) * 1000,
        doseFrequencyHours: parseInt(doseFreq, 10),
        route,
        vialStrengthMg: parseFloat(vialStrength) || 0,
        waterVolumeMl: parseFloat(waterVol) || 0,
        startDate: startDate.toISOString(),
        color,
        scheduledDaysOfWeek: days.length > 0 ? days : null,
        plannedDurationDays: plannedDays,
      });
    } else {
      if (!selectedCompoundId || !doseAmount) return;
      addUserCompound({
        compoundId: selectedCompoundId,
        startDate: startDate.toISOString(),
        doseAmountMcg: parseFloat(doseAmount) * 1000,
        doseFrequencyHours: parseInt(doseFreq, 10),
        route,
        vialStrengthMg: parseFloat(vialStrength) || 0,
        waterVolumeMl: parseFloat(waterVol) || 0,
        active: true,
        plannedDurationDays: plannedDays,
        scheduledDaysOfWeek: days.length > 0 ? days : null,
        color,
      });
    }
    onClose();
  };

  // Live vial math preview (same math as the web dialog)
  const vialMath = (() => {
    const dose = parseFloat(doseAmount);
    const strength = parseFloat(vialStrength);
    const freq = parseInt(doseFreq, 10);
    if (!dose || !strength || !freq) return null;
    const dosesPerVial = Math.floor(strength / dose);
    if (dosesPerVial <= 0) return null;
    const daysPerDose = freq / 24;
    const daysPerVial = Math.round(dosesPerVial * daysPerDose);
    let vialsForPlan: number | null = null;
    let totalDoses: number | null = null;
    if (plannedDays) {
      totalDoses = Math.ceil(plannedDays / daysPerDose);
      vialsForPlan = Math.ceil(totalDoses / dosesPerVial);
    }
    return { dosesPerVial, daysPerVial, vialsForPlan, totalDoses };
  })();

  return (
    <FormModal
      visible={visible}
      onClose={onClose}
      title={editing ? 'Edit Settings' : 'Add Peptide to My Stack'}
      footer={
        <Button
          title={editing ? 'Save' : 'Add Peptide'}
          onPress={handleSave}
          disabled={editing ? !doseAmount : !selectedCompoundId || !doseAmount}
        />
      }
    >
      {!editing ? (
        <Select
          label="Select Compound"
          value={selectedCompoundId || null}
          onChange={v => setSelectedCompoundId(v)}
          options={availableCompounds.map(c => {
            const isUserStack = c.id.startsWith('userstack:');
            let suffix = '';
            if (isUserStack) suffix = ' — Your Blend';
            else if (c.category === 'blend') suffix = ' — Blend';
            else if (c.approvalStatus === 'experimental') suffix = ' — Experimental';
            const brand = !isUserStack && c.brandNames.length > 0 ? ` (${c.brandNames[0]})` : '';
            return { value: c.id, label: `${c.genericName}${brand}${suffix}` };
          })}
        />
      ) : null}

      <Field label="Dose Amount (mg)">
        <Input value={doseAmount} onChangeText={setDoseAmount} keyboardType="decimal-pad" placeholder="e.g., 0.25 for 250 mcg" />
      </Field>
      <Select label="Frequency" value={doseFreq} options={FREQ_OPTIONS} onChange={setDoseFreq} />
      <Select label="Route" value={route} options={ROUTE_OPTIONS} onChange={v => setRoute(v)} />
      <Field label="Vial Strength (mg) — optional">
        <Input value={vialStrength} onChangeText={setVialStrength} keyboardType="decimal-pad" />
      </Field>
      <Field label="Bac Water Volume (mL) — optional">
        <Input value={waterVol} onChangeText={setWaterVol} keyboardType="decimal-pad" />
      </Field>

      <DateTimeField
        label={editing ? 'Schedule Anchor — Date & Time' : 'First Dose — Date & Time'}
        value={startDate}
        onChange={setStartDate}
        helperText="All future scheduled doses use this time-of-day."
      />

      <DayOfWeekPicker
        value={days}
        onChange={setDays}
        label="Specific Days (Optional)"
        helperText="Pick days to take this peptide. Leave empty for pure frequency interval."
      />

      <View className="flex-row gap-2 items-start">
        <View className="flex-1">
          <Field label="Plan Duration">
            <Input value={planDuration} onChangeText={setPlanDuration} keyboardType="decimal-pad" placeholder="How long?" />
          </Field>
        </View>
        <View style={{ width: 120 }}>
          <Select
            label="Unit"
            value={planUnit}
            options={[
              { value: 'days', label: 'Days' },
              { value: 'weeks', label: 'Weeks' },
              { value: 'months', label: 'Months' },
            ]}
            onChange={v => setPlanUnit(v as PlanUnit)}
          />
        </View>
      </View>

      <ColorPicker
        value={color}
        onChange={setColor}
        usedColors={userCompounds.filter(c => c.id !== editing?.id).map(c => c.color)}
      />

      {vialMath ? (
        <Card className="p-3 mt-2">
          <Text className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: colors.muted }}>Vial Math</Text>
          <View className="flex-row flex-wrap">
            <View className="w-1/2 mb-2">
              <Text className="text-[11px]" style={{ color: colors.muted }}>Doses per vial</Text>
              <Text className="font-mono font-semibold text-base" style={{ color: colors.text }}>{vialMath.dosesPerVial}</Text>
            </View>
            <View className="w-1/2 mb-2">
              <Text className="text-[11px]" style={{ color: colors.muted }}>Days per vial</Text>
              <Text className="font-mono font-semibold text-base" style={{ color: colors.text }}>{vialMath.daysPerVial}</Text>
            </View>
            {vialMath.vialsForPlan !== null && vialMath.totalDoses !== null ? (
              <>
                <View className="w-1/2">
                  <Text className="text-[11px]" style={{ color: colors.muted }}>Total doses planned</Text>
                  <Text className="font-mono font-semibold text-base" style={{ color: colors.tealText }}>{vialMath.totalDoses}</Text>
                </View>
                <View className="w-1/2">
                  <Text className="text-[11px]" style={{ color: colors.muted }}>Vials needed</Text>
                  <Text className="font-mono font-semibold text-base" style={{ color: colors.tealText }}>{vialMath.vialsForPlan}</Text>
                </View>
              </>
            ) : null}
          </View>
        </Card>
      ) : null}
      <Divider className="mt-2" />
    </FormModal>
  );
}
