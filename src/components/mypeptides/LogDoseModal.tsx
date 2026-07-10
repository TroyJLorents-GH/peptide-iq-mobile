import { useEffect, useState } from 'react';
import { Text } from '../../tw';
import { Button, Field, FormModal, Input, Select } from '../ui';
import DateTimeField from './DateTimeField';
import { ROUTE_OPTIONS } from './CompoundFormModal';
import { useAppContext } from '../../context/AppContext';
import { calculateDose } from '../../utils/calculator';
import { getActiveVial } from '../../utils/tracking';
import type { DoseLog, Route, UserCompound } from '../../types';

interface LogDoseModalProps {
  visible: boolean;
  onClose: () => void;
  userCompound: UserCompound | null;
  /** When set, edits this dose log instead of creating a new one. */
  editingDose?: DoseLog | null;
}

/** Log Dose / Edit Dose dialog — auto-calculates syringe units from the active vial. */
export default function LogDoseModal({ visible, onClose, userCompound, editingDose }: LogDoseModalProps) {
  const { userVials, addDoseLog, updateDoseLog, resolveCompound } = useAppContext();

  const [doseMg, setDoseMg] = useState('');
  const [units, setUnits] = useState('');
  const [date, setDate] = useState(new Date());
  const [route, setRoute] = useState<Route>('subcutaneous');
  const [site, setSite] = useState('');
  const [notes, setNotes] = useState('');

  const activeVial = userCompound ? getActiveVial(userCompound.id, userVials) : null;
  const vialStrengthMg = activeVial?.vialStrengthMg ?? userCompound?.vialStrengthMg ?? 0;
  const waterVolumeMl = activeVial?.waterVolumeMl ?? userCompound?.waterVolumeMl ?? 0;
  const canAutoCalc = vialStrengthMg > 0 && waterVolumeMl > 0;

  useEffect(() => {
    if (!visible || !userCompound) return;
    if (editingDose) {
      setDoseMg(String(editingDose.doseMcg / 1000));
      setUnits(String(editingDose.units));
      setDate(new Date(editingDose.timestamp));
      setRoute(editingDose.route);
      setSite(editingDose.injectionSite);
      setNotes(editingDose.notes);
    } else {
      const mg = userCompound.doseAmountMcg / 1000;
      setDoseMg(String(mg));
      setDate(new Date());
      setRoute(userCompound.route);
      setSite('');
      setNotes('');
      setUnits(canAutoCalc ? String(calculateDose(userCompound.doseAmountMcg, vialStrengthMg, waterVolumeMl).syringeUnits) : '');
    }
  }, [visible, editingDose, userCompound]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDoseChange = (v: string) => {
    setDoseMg(v);
    const mg = parseFloat(v);
    if (canAutoCalc && mg > 0) {
      setUnits(String(calculateDose(mg * 1000, vialStrengthMg, waterVolumeMl).syringeUnits));
    }
  };

  const handleSave = () => {
    if (!userCompound || !doseMg) return;
    const payload = {
      compoundId: userCompound.compoundId,
      userCompoundId: userCompound.id,
      timestamp: date.toISOString(),
      doseMcg: parseFloat(doseMg) * 1000,
      units: parseFloat(units) || 0,
      route,
      injectionSite: site,
      notes,
    };
    if (editingDose) {
      updateDoseLog(editingDose.id, payload);
    } else {
      addDoseLog({ ...payload, scheduledFor: null });
    }
    onClose();
  };

  const compound = userCompound ? resolveCompound(userCompound.compoundId) : undefined;

  return (
    <FormModal
      visible={visible}
      onClose={onClose}
      title={`${editingDose ? 'Edit Dose' : 'Log Dose'}${compound ? ` — ${compound.genericName}` : ''}`}
      footer={
        <Button title={editingDose ? 'Save Changes' : 'Log Dose'} onPress={handleSave} disabled={!doseMg} />
      }
    >
      <Field label="Dose Amount (mg)">
        <Input value={doseMg} onChangeText={handleDoseChange} keyboardType="decimal-pad" />
      </Field>
      <Field label="Syringe Units to Draw">
        <Input value={units} onChangeText={setUnits} keyboardType="decimal-pad" />
      </Field>
      <Text className="text-[11px] text-muted -mt-2 mb-3">
        {canAutoCalc
          ? `Auto-calculated from ${vialStrengthMg} mg vial + ${waterVolumeMl} mL water. 1 mL = 100 units on U-100 syringe.`
          : 'Set vial strength & water volume on your compound to auto-calculate units.'}
      </Text>
      <DateTimeField label="Date & Time" value={date} onChange={setDate} />
      <Select label="Route" value={route} options={ROUTE_OPTIONS} onChange={v => setRoute(v)} />
      <Field label="Injection Site (optional)">
        <Input value={site} onChangeText={setSite} placeholder="e.g., Abdomen left, Thigh right" />
      </Field>
      <Field label="Notes (optional)">
        <Input value={notes} onChangeText={setNotes} multiline numberOfLines={2} className="min-h-16" />
      </Field>
    </FormModal>
  );
}
