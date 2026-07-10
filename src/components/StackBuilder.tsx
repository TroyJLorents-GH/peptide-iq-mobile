import { useMemo, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { MaterialIcons } from '@expo/vector-icons';
import { Text, TouchableOpacity, View } from '../tw';
import { Banner, Button, Divider, Field, FormModal, Input, Select } from './ui';
import { useThemeMode } from '../context/ThemeModeContext';
import { compounds } from '../data/compounds';
import { computeAggregatePK } from '../utils/blendMath';
import type { UserStack, UserStackComponent } from '../types';

const VIOLET = '#A855F7';

interface StackBuilderProps {
  visible: boolean;
  onClose: () => void;
  onSave: (stack: Omit<UserStack, 'id' | 'userId' | 'createdAt'>) => Promise<UserStack | null>;
}

interface DraftRow {
  rowId: string; // local-only key
  compoundId: string;
  mgInput: string;
}

// Only single peptides — never let users build a blend out of other blends
const SELECTABLE_COMPOUNDS = compounds
  .filter(c => c.category !== 'blend')
  .sort((a, b) => a.genericName.localeCompare(b.genericName));

const newRow = (): DraftRow => ({ rowId: Crypto.randomUUID(), compoundId: '', mgInput: '' });

export default function StackBuilder({ visible, onClose, onSave }: StackBuilderProps) {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<DraftRow[]>([newRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { colors } = useThemeMode();

  const updateRow = (rowId: string, patch: Partial<DraftRow>) => {
    setRows(prev => prev.map(r => (r.rowId === rowId ? { ...r, ...patch } : r)));
  };

  const components: UserStackComponent[] = useMemo(() => {
    return rows
      .filter(r => r.compoundId && parseFloat(r.mgInput) > 0)
      .map(r => {
        const c = SELECTABLE_COMPOUNDS.find(sc => sc.id === r.compoundId);
        return {
          compoundId: r.compoundId,
          label: c?.genericName || r.compoundId,
          mgPerVial: parseFloat(r.mgInput),
        };
      });
  }, [rows]);

  const totalMg = useMemo(() => components.reduce((s, c) => s + c.mgPerVial, 0), [components]);
  const aggregatePK = useMemo(() => computeAggregatePK(components), [components]);

  const canSave = name.trim().length > 0 && components.length >= 2 && totalMg > 0;

  const reset = () => {
    setName('');
    setNotes('');
    setRows([newRow()]);
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    const result = await onSave({
      name: name.trim(),
      totalMg,
      components,
      notes: notes.trim(),
    });
    setSaving(false);
    if (result) {
      reset();
      onClose();
    } else {
      setError('Could not save stack. Make sure the user_stacks table is set up in Supabase.');
    }
  };

  return (
    <FormModal
      visible={visible}
      onClose={handleClose}
      title="Add Your Stack"
      footer={
        <Button
          title={saving ? 'Saving…' : 'Save Stack'}
          onPress={handleSave}
          disabled={!canSave || saving}
        />
      }
    >
      <Text className="font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: VIOLET }}>
        {'// Build your own blend'}
      </Text>
      <Text className="text-xs text-muted mb-3">
        Private to you — won't appear in the main library or for other users.
      </Text>

      <View className="mb-3">
        <Banner tone="info">
          How aggregate values are calculated: we pull pharmacokinetic and safety data from each
          component's curated library entry, then weight it by the exact mg you enter for your vial.
          Half-life and tmax use the slowest component (rate-limiting). Bioavailability is
          mass-weighted across components.
        </Banner>
      </View>

      <Field label="Stack Name">
        <Input value={name} onChangeText={setName} placeholder="e.g., My KLOW 50mg Vial" />
      </Field>

      <Text className="font-mono text-[10px] uppercase tracking-widest text-muted mb-2">
        Components ({components.length} of {rows.length} valid)
      </Text>

      {rows.map(row => {
        const used = new Set(rows.filter(r => r.rowId !== row.rowId).map(r => r.compoundId).filter(Boolean));
        const options = SELECTABLE_COMPOUNDS.filter(c => !used.has(c.id)).map(c => ({
          value: c.id,
          label: c.genericName,
        }));
        return (
          <View key={row.rowId} className="flex-row gap-2 mb-2.5 items-center">
            <View className="flex-[2]">
              <Select
                value={row.compoundId || null}
                options={options}
                onChange={v => updateRow(row.rowId, { compoundId: v })}
                placeholder="Peptide…"
              />
            </View>
            <View className="flex-1">
              <Input
                value={row.mgInput}
                onChangeText={v => updateRow(row.rowId, { mgInput: v })}
                keyboardType="decimal-pad"
                placeholder="mg"
              />
            </View>
            <TouchableOpacity
              onPress={() => setRows(prev => prev.filter(r => r.rowId !== row.rowId))}
              disabled={rows.length === 1}
              hitSlop={8}
            >
              <MaterialIcons
                name="delete-outline"
                size={22}
                color={rows.length === 1 ? colors.divider : colors.muted}
              />
            </TouchableOpacity>
          </View>
        );
      })}

      <TouchableOpacity
        className="flex-row items-center gap-1.5 mb-3"
        onPress={() => setRows(prev => [...prev, newRow()])}
      >
        <MaterialIcons name="add" size={18} color={colors.primary} />
        <Text className="text-sm text-primary font-medium">Add another peptide</Text>
      </TouchableOpacity>

      <Divider className="my-3" />

      <Text className="font-mono text-[10px] uppercase tracking-widest text-muted mb-2">Preview</Text>

      {components.length === 0 ? (
        <Text className="text-[13px] text-muted italic mb-3">
          Add at least 2 components with mg amounts to see the preview.
        </Text>
      ) : (
        <View className="mb-3">
          <View
            className="rounded-lg p-3 mb-3 border"
            style={{ backgroundColor: 'rgba(168, 85, 247, 0.05)', borderColor: 'rgba(168, 85, 247, 0.2)' }}
          >
            <Text className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: VIOLET }}>
              Composition — {totalMg} mg vial
            </Text>
            {components.map(c => (
              <View
                key={c.compoundId}
                className="flex-row justify-between py-1.5 border-b"
                style={{ borderColor: 'rgba(168, 85, 247, 0.2)' }}
              >
                <Text className="text-[13px] font-medium text-ink">{c.label}</Text>
                <Text className="font-mono text-xs font-semibold" style={{ color: VIOLET }}>
                  {c.mgPerVial} mg{' '}
                  <Text className="text-[10px] text-muted font-normal">
                    ({totalMg > 0 ? ((c.mgPerVial / totalMg) * 100).toFixed(1) : '0.0'}%)
                  </Text>
                </Text>
              </View>
            ))}
          </View>

          <View className="flex-row gap-2">
            <PreviewStat label="Half-life" value={`${aggregatePK.halfLifeHours}h`} />
            <PreviewStat label="Tmax" value={`${aggregatePK.tmaxHours}h`} />
            <PreviewStat label="Bioavail." value={`${(aggregatePK.bioavailability * 100).toFixed(0)}%`} />
            <PreviewStat label="Steady" value={`${aggregatePK.steadyStateDays}d`} />
          </View>

          <Text className="text-[10px] text-muted mt-2">
            Computed from each component's library data, weighted by your mg input.
          </Text>
        </View>
      )}

      <Field label="Notes (optional)">
        <Input
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={2}
          placeholder="e.g., vendor name, COA reference, target use case"
          className="min-h-[60px]"
          textAlignVertical="top"
        />
      </Field>

      {error ? <Banner tone="error">{error}</Banner> : null}
    </FormModal>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center rounded-md border border-outline bg-bg px-1 py-2">
      <Text className="font-mono text-[9px] uppercase tracking-widest text-muted mb-0.5">{label}</Text>
      <Text className="font-mono text-base font-semibold text-ink">{value}</Text>
    </View>
  );
}
