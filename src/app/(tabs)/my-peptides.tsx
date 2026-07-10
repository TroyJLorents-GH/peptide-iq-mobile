import { useMemo, useState } from 'react';
import { Alert, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, TouchableOpacity, View } from '../../tw';
import { Button, Card, Chip, Divider, EmptyState, Screen, SectionLabel } from '../../components/ui';
import CompoundFormModal, { formatFreq } from '../../components/mypeptides/CompoundFormModal';
import LogDoseModal from '../../components/mypeptides/LogDoseModal';
import StackBuilder from '../../components/StackBuilder';
import { useAppContext } from '../../context/AppContext';
import { useThemeMode } from '../../context/ThemeModeContext';
import { formatDose } from '../../utils/calculator';
import { getUpcomingDoses } from '../../utils/schedule';
import { formatWeeks, planProgress, vialRemainingMg } from '../../utils/tracking';
import { userStackCompoundId } from '../../utils/blendMath';
import type { DoseLog, EvidenceTier, UserCompound } from '../../types';

const TIER_LABELS: Record<EvidenceTier, string> = {
  'fda-label': 'FDA Label',
  'clinical-trial': 'Clinical Trial',
  'peer-reviewed': 'Peer Reviewed',
  'case-report': 'Case Report',
  experimental: 'Experimental',
  'user-note': 'User Note',
};

function EvidenceBadge({ tier }: { tier: EvidenceTier }) {
  const tone = tier === 'fda-label' ? 'success' : tier === 'clinical-trial' || tier === 'peer-reviewed' ? 'primary' : 'warning';
  return <Chip label={TIER_LABELS[tier]} tone={tone} />;
}

function ProtocolMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <View className="flex-1 border border-outline rounded-md bg-surface p-2.5">
      <Text className="font-mono text-[9px] uppercase tracking-widest text-muted font-bold" numberOfLines={1}>
        {label}
      </Text>
      <Text className="text-sm font-bold text-ink mt-1">{value}</Text>
      <Text className="text-[11px] text-muted mt-0.5" numberOfLines={1}>{detail}</Text>
    </View>
  );
}

export default function MyPeptidesScreen() {
  const router = useRouter();
  const {
    userCompounds, doseLogs, userStacks, userVials,
    removeUserCompound, toggleCompoundActive, removeDoseLog, addUserStack, removeUserStack, resolveCompound,
  } = useAppContext();
  const { colors } = useThemeMode();

  const [addOpen, setAddOpen] = useState(false);
  const [stackBuilderOpen, setStackBuilderOpen] = useState(false);
  const [editingUC, setEditingUC] = useState<UserCompound | null>(null);
  const [logUC, setLogUC] = useState<UserCompound | null>(null);
  const [editingDose, setEditingDose] = useState<DoseLog | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const upcomingDoses = useMemo(
    () => getUpcomingDoses(userCompounds, doseLogs, Date.now()),
    [userCompounds, doseLogs],
  );

  const confirmDeleteCompound = (uc: UserCompound) => {
    const compound = resolveCompound(uc.compoundId);
    Alert.alert(
      'Remove peptide?',
      `This deletes ${compound?.genericName ?? 'this compound'} and all of its dose logs. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removeUserCompound(uc.id) },
      ],
    );
  };

  const confirmDeleteDose = (doseId: string) => {
    Alert.alert('Delete this dose log?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeDoseLog(doseId) },
    ]);
  };

  return (
    <Screen>
      <Text className="text-[13px] text-muted mb-3">Manage your active compounds and log doses.</Text>
      <View className="flex-row gap-2 mb-4">
        <Button
          title="Add Peptide"
          onPress={() => { setEditingUC(null); setAddOpen(true); }}
          icon={<MaterialIcons name="add" size={18} color={colors.onPrimary} />}
          className="flex-1"
        />
        <Button
          title="Add Your Stack"
          variant="outlined"
          onPress={() => setStackBuilderOpen(true)}
          className="flex-1"
        />
      </View>
      <StackBuilder
        visible={stackBuilderOpen}
        onClose={() => setStackBuilderOpen(false)}
        onSave={addUserStack}
      />

      {userCompounds.length === 0 ? (
        <Card>
          <EmptyState
            icon="water-drop"
            title="No peptides added yet"
            subtitle="Add peptides you're currently taking to start tracking."
          />
        </Card>
      ) : (
        userCompounds.map(uc => {
          const compound = resolveCompound(uc.compoundId);
          if (!compound) return null;
          const compoundDoses = doseLogs
            .filter(d => d.compoundId === uc.compoundId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          const nextDose = upcomingDoses.find(d => d.userCompoundId === uc.id);
          const vialStatus = vialRemainingMg(uc, compoundDoses, userVials);
          const plan = planProgress(uc);

          return (
            <Card
              key={uc.id}
              className={`mb-3 p-3.5 ${uc.active ? '' : 'opacity-50'}`}
              style={{ borderLeftWidth: 4, borderLeftColor: uc.color }}
            >
              {/* Title row */}
              <Pressable
                className="flex-row items-center gap-2 flex-wrap"
                onPress={() => router.push(`/compound/${uc.id}` as any)}
              >
                <Text className="text-lg font-extrabold text-ink flex-shrink" numberOfLines={1}>
                  {compound.genericName}
                </Text>
                {compound.category === 'blend' ? (
                  <Chip label={uc.compoundId.startsWith('userstack:') ? 'Your Blend' : 'Blend'} tone="violet" />
                ) : null}
                <EvidenceBadge tier={compound.evidenceTier} />
                <MaterialIcons name="chevron-right" size={18} color={colors.muted} />
              </Pressable>

              <Text className="text-[13px] text-muted mt-1">
                {formatDose(uc.doseAmountMcg)} — {formatFreq(uc.doseFrequencyHours)} — {uc.route}
              </Text>
              {uc.vialStrengthMg > 0 && uc.waterVolumeMl > 0 ? (
                <Text className="text-[11px] text-muted">
                  {uc.vialStrengthMg}mg vial + {uc.waterVolumeMl}mL water
                </Text>
              ) : null}
              <Text className="text-[11px] text-muted">
                Start: {new Date(uc.startDate).toLocaleDateString()} | Doses: {compoundDoses.length}
                {plan ? ` | Weeks remaining: ${formatWeeks(plan.remainingWeeks)}` : ''}
              </Text>

              {/* Metrics */}
              <View className="flex-row gap-2 mt-3">
                <ProtocolMetric
                  label="Next dose"
                  value={nextDose ? new Date(nextDose.scheduledAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'None'}
                  detail={nextDose ? new Date(nextDose.scheduledAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : 'No upcoming slot'}
                />
                <ProtocolMetric
                  label="Vial left"
                  value={vialStatus.remainingMg !== null ? `${vialStatus.remainingMg.toFixed(2)} mg` : 'Not set'}
                  detail={vialStatus.vialStrengthMg ? `${vialStatus.vialStrengthMg} mg ${vialStatus.source === 'vial' ? 'active vial' : 'configured'}` : 'Add vial info'}
                />
                <ProtocolMetric
                  label="Schedule"
                  value={formatFreq(uc.doseFrequencyHours)}
                  detail={uc.scheduledDaysOfWeek?.length ? `${uc.scheduledDaysOfWeek.length} specific days` : 'Interval based'}
                />
              </View>

              {/* Actions */}
              <View className="flex-row items-center gap-2 mt-3">
                <Button
                  title="Log Dose"
                  variant="outlined"
                  className="flex-1 py-2"
                  icon={<MaterialIcons name="post-add" size={16} color={colors.primary} />}
                  onPress={() => { setLogUC(uc); setEditingDose(null); setLogOpen(true); }}
                />
                <TouchableOpacity className="p-2" onPress={() => { setEditingUC(uc); setAddOpen(true); }} hitSlop={4}>
                  <MaterialIcons name="settings" size={20} color={colors.muted} />
                </TouchableOpacity>
                <Switch
                  value={uc.active}
                  onValueChange={() => toggleCompoundActive(uc.id)}
                  trackColor={{ true: colors.primary }}
                />
                <TouchableOpacity className="p-2" onPress={() => confirmDeleteCompound(uc)} hitSlop={4}>
                  <MaterialIcons name="delete-outline" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>

              {/* Recent doses */}
              {compoundDoses.length > 0 ? (
                <View className="mt-3">
                  <Divider className="mb-2" />
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-[11px] font-semibold text-muted">Recent Doses</Text>
                    {compoundDoses.length > 3 ? (
                      <Pressable onPress={() => router.push(`/compound/${uc.id}` as any)}>
                        <Text className="text-[11px] text-primary">View all {compoundDoses.length} doses</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {compoundDoses.slice(0, 3).map(d => (
                    <View key={d.id} className="flex-row items-center py-1">
                      <Text className="flex-1 text-[11px] text-muted" numberOfLines={1}>
                        {new Date(d.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        {' — '}{formatDose(d.doseMcg)}
                        {d.units > 0 ? ` (${d.units}u)` : ''}
                        {d.injectionSite ? ` — ${d.injectionSite}` : ''}
                      </Text>
                      <TouchableOpacity
                        className="p-1"
                        onPress={() => { setLogUC(uc); setEditingDose(d); setLogOpen(true); }}
                        hitSlop={4}
                      >
                        <MaterialIcons name="edit" size={14} color={colors.muted} />
                      </TouchableOpacity>
                      <TouchableOpacity className="p-1" onPress={() => confirmDeleteDose(d.id)} hitSlop={4}>
                        <MaterialIcons name="delete-outline" size={14} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : null}
            </Card>
          );
        })
      )}

      {/* Saved blend recipes */}
      {userStacks.length > 0 ? (
        <View className="mt-5">
          <SectionLabel>Your saved blends ({userStacks.length})</SectionLabel>
          <Text className="text-[11px] text-muted mb-2">
            Recipes saved to your Peptide Library + Add Peptide list. Use the active card above to log doses.
          </Text>
          {userStacks.map(s => {
            const isInUse = userCompounds.some(uc => uc.compoundId === userStackCompoundId(s.id));
            return (
              <Card key={s.id} className="mb-2 p-3" style={{ borderLeftWidth: 4, borderLeftColor: '#A855F7' }}>
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <Text className="text-sm font-semibold text-ink">{s.name}</Text>
                      <Chip label="Your Blend" tone="violet" />
                    </View>
                    <Text className="text-[11px] text-muted mt-0.5">
                      {s.totalMg} mg vial · {s.components.length} components
                    </Text>
                    <Text className="text-[11px] text-muted mt-0.5">
                      {s.components.map(c => `${c.label} ${c.mgPerVial}mg`).join(' · ')}
                    </Text>
                  </View>
                  {!isInUse ? (
                    <TouchableOpacity
                      className="p-1"
                      onPress={() =>
                        Alert.alert('Delete this saved blend?', undefined, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => removeUserStack(s.id) },
                        ])
                      }
                      hitSlop={4}
                    >
                      <MaterialIcons name="delete-outline" size={18} color={colors.muted} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Text className={`text-[11px] mt-1.5 ${isInUse ? 'text-ok' : 'text-muted'}`}>
                  {isInUse
                    ? '✓ In your Peptide Library — being tracked on the active card above'
                    : 'Saved to your Library + Add Peptide list. Tap Add Peptide above to start tracking.'}
                </Text>
              </Card>
            );
          })}
        </View>
      ) : null}

      <CompoundFormModal
        visible={addOpen}
        onClose={() => { setAddOpen(false); setEditingUC(null); }}
        editing={editingUC}
      />
      <LogDoseModal
        visible={logOpen}
        onClose={() => { setLogOpen(false); setEditingDose(null); }}
        userCompound={logUC}
        editingDose={editingDose}
      />
    </Screen>
  );
}
