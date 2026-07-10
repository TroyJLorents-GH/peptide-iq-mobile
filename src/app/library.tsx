import { useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, TouchableOpacity, View } from '../tw';
import { Banner, Button, Card, Chip, Divider, Field, FormModal, Input, Screen, Select } from '../components/ui';
import EvidenceBadge from '../components/EvidenceBadge';
import StackBuilder from '../components/StackBuilder';
import { useThemeMode } from '../context/ThemeModeContext';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import {
  compounds,
  getApprovedCompounds,
  getBlendCompounds,
  getExperimentalCompounds,
  getNonPeptideCompounds,
} from '../data/compounds';
import { isUserStackCompoundId, parseUserStackCompoundId, userStackToCompound } from '../utils/blendMath';
import type { Compound } from '../types';

const VIOLET = '#A855F7';

interface PeptideRequest {
  id: string;
  peptide_name: string;
  brand_names: string;
  category: string;
  notes: string;
  status: string;
  created_at: string;
}

const REQUEST_CATEGORIES = [
  'GLP-1 Agonist', 'GHRP', 'GHRH', 'Regenerative', 'Antimicrobial',
  'Metabolic', 'Anabolic', 'Nootropic', 'Hormone', 'Other',
];

const TABS = ['All', 'Approved', 'Experimental', 'Blends', 'Non-Peptide'] as const;

function formatHalfLife(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} minutes`;
  if (hours >= 24) return `${Math.round(hours / 24)} days`;
  return `${hours} hours`;
}

function formatFrequency(hours: number): string {
  if (hours <= 12) return `Every ${hours} hours`;
  if (hours === 24) return 'Daily';
  if (hours <= 72) return `Every ${hours / 24} days`;
  if (hours === 168) return 'Weekly';
  if (hours === 672) return 'Monthly';
  return `Every ${Math.round(hours / 24)} days`;
}

export default function LibraryScreen() {
  const { user } = useAuth();
  const { userStacks, addUserStack, removeUserStack } = useAppContext();
  const { colors } = useThemeMode();
  const userStackCompounds = userStacks.map(s => userStackToCompound(s));

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState(0);
  const [stackBuilderOpen, setStackBuilderOpen] = useState(false);
  const [detail, setDetail] = useState<Compound | null>(null);

  // Request-a-peptide dialog state
  const [requestOpen, setRequestOpen] = useState(false);
  const [reqName, setReqName] = useState('');
  const [reqBrands, setReqBrands] = useState('');
  const [reqCategory, setReqCategory] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [reqLoading, setReqLoading] = useState(false);
  const [reqSuccess, setReqSuccess] = useState('');
  const [reqError, setReqError] = useState('');
  const [myRequests, setMyRequests] = useState<PeptideRequest[]>([]);

  useEffect(() => {
    if (user) loadMyRequests();
  }, [user]);

  const loadMyRequests = async () => {
    const { data } = await supabase
      .from('peptide_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setMyRequests(data as PeptideRequest[]);
  };

  const handleSubmitRequest = async () => {
    if (!reqName.trim() || !user) return;
    setReqLoading(true);
    setReqError('');

    const { error } = await supabase.from('peptide_requests').insert({
      user_id: user.id,
      peptide_name: reqName.trim(),
      brand_names: reqBrands.trim(),
      category: reqCategory,
      notes: reqNotes.trim(),
    });

    if (error) {
      setReqError(error.message);
    } else {
      setReqSuccess(`"${reqName}" submitted for review. If approved, you'll see it in the library within 24–48 hours.`);
      setReqName('');
      setReqBrands('');
      setReqCategory('');
      setReqNotes('');
      loadMyRequests();
    }
    setReqLoading(false);
  };

  const handleDeleteStack = (compound: Compound) => {
    const stackId = parseUserStackCompoundId(compound.id);
    if (!stackId) return;
    Alert.alert(
      'Delete stack?',
      `"${compound.genericName}" will be removed. Dose history stays intact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            removeUserStack(stackId);
            setDetail(null);
          },
        },
      ],
    );
  };

  const tabCounts = [
    compounds.length + userStackCompounds.length,
    getApprovedCompounds().length,
    getExperimentalCompounds().filter(c => c.category !== 'blend').length,
    getBlendCompounds().length + userStackCompounds.length,
    getNonPeptideCompounds().length,
  ];

  const filteredCompounds = (() => {
    let list: Compound[];
    if (tab === 0) list = [...compounds, ...userStackCompounds];
    else if (tab === 1) list = getApprovedCompounds();
    else if (tab === 2) list = getExperimentalCompounds().filter(c => c.category !== 'blend');
    else if (tab === 3) list = [...userStackCompounds, ...getBlendCompounds()];
    else list = getNonPeptideCompounds();

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.genericName.toLowerCase().includes(q) ||
        c.brandNames.some(b => b.toLowerCase().includes(q)) ||
        c.category.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q),
      );
    }
    return list;
  })();

  return (
    <Screen>
      <Text className="text-xs text-muted mb-3">
        {compounds.length} compounds — each entry shows evidence tier, PK profile, dosing, and safety data.
      </Text>

      <View className="flex-row gap-2 mb-3">
        <TouchableOpacity
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-md px-3 py-2.5"
          style={{ backgroundColor: '#9333EA' }}
          onPress={() => setStackBuilderOpen(true)}
          activeOpacity={0.7}
        >
          <MaterialIcons name="layers" size={16} color="#fff" />
          <Text className="text-[13px] font-semibold text-white">Add Your Stack</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-md px-3 py-2.5 bg-primary-solid"
          onPress={() => { setRequestOpen(true); setReqSuccess(''); setReqError(''); }}
          activeOpacity={0.7}
        >
          <MaterialIcons name="add-circle-outline" size={16} color="#fff" />
          <Text className="text-[13px] font-semibold text-white">Request a Peptide</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View className="flex-row items-center border border-outline rounded-md bg-surface px-3 mb-3">
        <MaterialIcons name="search" size={18} color={colors.muted} />
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search peptides..."
          className="flex-1 border-0 bg-transparent"
        />
      </View>

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerClassName="gap-2">
        {TABS.map((t, i) => {
          const active = tab === i;
          return (
            <Pressable
              key={t}
              className={`rounded-full border px-3 py-1.5 ${active ? 'bg-primary-tint border-primary' : 'border-outline'}`}
              onPress={() => setTab(i)}
            >
              <Text className={`font-mono text-[11px] uppercase tracking-wider ${active ? 'text-teal-text font-medium' : 'text-muted'}`}>
                {t} ({tabCounts[i]})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Compound list */}
      {filteredCompounds.map(compound => (
        <Pressable key={compound.id} onPress={() => setDetail(compound)}>
          <Card className="mb-2.5 p-3.5">
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-1">
                <Text className="text-sm font-semibold text-ink">{compound.genericName}</Text>
                {compound.brandNames.length > 0 ? (
                  <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
                    ({compound.brandNames.join(', ')})
                  </Text>
                ) : null}
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.muted} />
            </View>
            <View className="flex-row flex-wrap gap-1.5 mt-2">
              {compound.category === 'blend' ? (
                <View
                  className="self-start rounded-full px-2 py-0.5 border"
                  style={{ backgroundColor: 'rgba(168, 85, 247, 0.12)', borderColor: 'rgba(168, 85, 247, 0.3)' }}
                >
                  <Text className="text-[10px] font-semibold" style={{ color: VIOLET }}>
                    {isUserStackCompoundId(compound.id) ? 'Your Blend' : 'Blend'}
                  </Text>
                </View>
              ) : null}
              <EvidenceBadge tier={compound.evidenceTier} />
              {compound.category !== 'blend' ? <Chip label={compound.category} /> : null}
            </View>
            <View className="flex-row gap-4 mt-2">
              <Text className="font-mono text-[10px] text-muted">t½ {formatHalfLife(compound.pk.halfLifeHours)}</Text>
              <Text className="font-mono text-[10px] text-muted">{formatFrequency(compound.pk.doseFrequencyHours)}</Text>
            </View>
          </Card>
        </Pressable>
      ))}

      {filteredCompounds.length === 0 ? (
        <Text className="text-center text-muted py-8 text-sm">No compounds match your search.</Text>
      ) : null}

      {/* My requests */}
      {myRequests.length > 0 ? (
        <Card className="mt-4 p-3.5">
          <Text className="text-sm font-semibold text-ink mb-2">Your Requests</Text>
          {myRequests.map((r, i) => (
            <View key={r.id}>
              {i > 0 ? <Divider /> : null}
              <View className="flex-row items-center justify-between py-2">
                <View className="flex-1 mr-2">
                  <Text className="text-[13px] font-medium text-ink">
                    {r.peptide_name}
                    {r.brand_names ? <Text className="text-xs text-muted"> ({r.brand_names})</Text> : null}
                  </Text>
                  {r.category ? <Text className="text-[11px] text-muted">{r.category}</Text> : null}
                </View>
                <Chip
                  label={r.status}
                  tone={r.status === 'pending' ? 'warning' : r.status === 'added' ? 'success' : 'primary'}
                />
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {/* Stack builder */}
      <StackBuilder
        visible={stackBuilderOpen}
        onClose={() => setStackBuilderOpen(false)}
        onSave={addUserStack}
      />

      {/* Compound detail */}
      <CompoundDetailModal
        compound={detail}
        onClose={() => setDetail(null)}
        onDeleteStack={handleDeleteStack}
      />

      {/* Request dialog */}
      <FormModal
        visible={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Request a Peptide"
        footer={
          <Button
            title={reqLoading ? 'Submitting…' : 'Submit Request'}
            onPress={handleSubmitRequest}
            disabled={!reqName.trim() || reqLoading}
          />
        }
      >
        <Text className="text-[13px] text-muted mb-3">
          Can't find a compound in our library? Let us know and we'll add it.
        </Text>
        {reqSuccess ? <View className="mb-3"><Banner tone="success">{reqSuccess}</Banner></View> : null}
        {reqError ? <View className="mb-3"><Banner tone="error">{reqError}</Banner></View> : null}
        <Field label="Peptide Name *">
          <Input value={reqName} onChangeText={setReqName} placeholder="e.g., Epithalon" />
        </Field>
        <Field label="Brand Names (optional)">
          <Input value={reqBrands} onChangeText={setReqBrands} placeholder="e.g., Epitalon, Epithalone" />
        </Field>
        <Select
          label="Category (optional)"
          value={reqCategory || null}
          options={REQUEST_CATEGORIES.map(c => ({ value: c, label: c }))}
          onChange={setReqCategory}
        />
        <Field label="Notes (optional)">
          <Input
            value={reqNotes}
            onChangeText={setReqNotes}
            multiline
            numberOfLines={2}
            placeholder="Anything helpful — dosing info, links to research, etc."
            className="min-h-[60px]"
            textAlignVertical="top"
          />
        </Field>
      </FormModal>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between items-baseline py-1 gap-3">
      <Text className="text-xs text-muted">{label}</Text>
      <Text className="text-xs font-semibold text-ink flex-1 text-right">{value}</Text>
    </View>
  );
}

function CompoundDetailModal({ compound, onClose, onDeleteStack }: {
  compound: Compound | null;
  onClose: () => void;
  onDeleteStack: (c: Compound) => void;
}) {
  const { colors } = useThemeMode();
  if (!compound) return null;
  const isUserStack = isUserStackCompoundId(compound.id);

  return (
    <FormModal visible={!!compound} onClose={onClose} title={compound.genericName}>
      <View className="flex-row flex-wrap gap-1.5 mb-3">
        {compound.category === 'blend' ? (
          <View
            className="self-start rounded-full px-2 py-0.5 border"
            style={{ backgroundColor: 'rgba(168, 85, 247, 0.12)', borderColor: 'rgba(168, 85, 247, 0.3)' }}
          >
            <Text className="text-[10px] font-semibold" style={{ color: VIOLET }}>
              {isUserStack ? 'Your Blend' : 'Blend'}
            </Text>
          </View>
        ) : null}
        <EvidenceBadge tier={compound.evidenceTier} />
        {compound.category !== 'blend' ? <Chip label={compound.category} /> : null}
      </View>

      {compound.brandNames.length > 0 ? (
        <Text className="text-xs text-muted mb-2">({compound.brandNames.join(', ')})</Text>
      ) : null}

      <Text className="text-[13px] leading-5 text-muted mb-3">{compound.description}</Text>

      {/* Blend composition */}
      {compound.category === 'blend' && compound.blendComposition && compound.blendComposition.length > 0 ? (
        <View
          className="rounded-lg p-3 mb-3 border"
          style={{ backgroundColor: 'rgba(168, 85, 247, 0.05)', borderColor: 'rgba(168, 85, 247, 0.2)' }}
        >
          <Text className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: VIOLET }}>
            Blend composition{compound.blendVialTotalMg ? ` — ${compound.blendVialTotalMg} mg vial` : ''}
          </Text>
          {compound.blendComposition.map(c => (
            <View
              key={c.compoundId}
              className="flex-row justify-between items-baseline py-1.5 border-b"
              style={{ borderColor: 'rgba(168, 85, 247, 0.2)' }}
            >
              <Text className="text-[13px] font-semibold text-ink flex-1 mr-2">{c.label}</Text>
              <Text className="font-mono text-xs font-semibold" style={{ color: VIOLET }}>
                {c.mgPerVial} mg <Text className="text-[10px] text-muted font-normal">({(c.pctByMass * 100).toFixed(0)}%)</Text>
              </Text>
            </View>
          ))}
          <Text className="text-[10px] text-muted mt-2">
            PK and dosing fields below are aggregated from component data — see each component's library entry for exact values.
          </Text>
        </View>
      ) : null}

      {/* Boxed warning */}
      {compound.safety.boxedWarning ? (
        <View className="rounded-lg p-3 mb-3 bg-danger-tint border border-danger">
          <View className="flex-row items-center gap-1.5 mb-1">
            <MaterialIcons name="warning-amber" size={18} color={colors.error} />
            <Text className="text-xs font-bold text-danger">BOXED WARNING</Text>
          </View>
          <Text className="text-[13px] leading-5 text-danger">{compound.safety.boxedWarning}</Text>
        </View>
      ) : null}

      {/* PK */}
      <Text className="text-sm font-semibold text-ink mb-1">Pharmacokinetics</Text>
      <InfoRow label="Half-life" value={formatHalfLife(compound.pk.halfLifeHours)} />
      <InfoRow label="Tmax" value={`${compound.pk.tmaxHours} hours`} />
      <InfoRow label="Bioavailability" value={`${(compound.pk.bioavailability * 100).toFixed(0)}%`} />
      {compound.pk.steadyStateDays ? (
        <InfoRow label="Steady state" value={`~${compound.pk.steadyStateDays} days`} />
      ) : null}
      <InfoRow label="Dose frequency" value={formatFrequency(compound.pk.doseFrequencyHours)} />
      <InfoRow label="Routes" value={compound.routes.join(', ')} />

      <Divider className="my-3" />

      {/* Dosing */}
      <Text className="text-sm font-semibold text-ink mb-1">Dosing</Text>
      <InfoRow label="Start dose" value={compound.dosing.standardStartDose} />
      <InfoRow label="Max dose" value={compound.dosing.maxDose} />
      {compound.dosing.titrationSteps.length > 0 ? (
        <View className="mt-1 mb-1">
          <Text className="text-xs font-semibold text-muted mb-0.5">Titration:</Text>
          {compound.dosing.titrationSteps.map((step, i) => (
            <Text key={i} className="text-xs text-muted pl-2 leading-5">
              {i + 1}. {step}
            </Text>
          ))}
        </View>
      ) : null}
      <InfoRow label="Reconstitution" value={compound.dosing.reconstitutionSupported ? 'Yes' : 'No (pre-filled)'} />

      <Divider className="my-3" />

      {/* Safety */}
      <Text className="text-sm font-semibold text-ink mb-2">Safety & Side Effects</Text>
      {compound.safety.commonSideEffects.length > 0 ? (
        <View className="mb-3">
          <Text className="text-xs font-semibold text-warn mb-1.5">Common Side Effects</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {compound.safety.commonSideEffects.map(se => (
              <Chip key={se} label={se} />
            ))}
          </View>
        </View>
      ) : null}
      {compound.safety.seriousSideEffects.length > 0 ? (
        <View className="mb-3">
          <Text className="text-xs font-semibold text-danger mb-1.5">Serious Side Effects</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {compound.safety.seriousSideEffects.map(se => (
              <Chip key={se} label={se} tone="danger" />
            ))}
          </View>
        </View>
      ) : null}

      {compound.safety.hydrationWarning ? (
        <View className="mb-3">
          <Banner tone="info">Hydration note: {compound.safety.hydrationWarning}</Banner>
        </View>
      ) : null}

      {/* Sources */}
      {compound.sources.length > 0 ? (
        <View className="mt-1">
          <Text className="text-xs font-semibold text-muted mb-1.5">Sources</Text>
          {compound.sources.map((src, i) => (
            <View key={i} className="flex-row items-center gap-2 mb-1.5">
              <EvidenceBadge tier={src.type} />
              <TouchableOpacity onPress={() => Linking.openURL(src.url)} className="flex-1">
                <Text className="text-xs text-primary underline" numberOfLines={1}>{src.label}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}

      {isUserStack ? (
        <View className="mt-4">
          <Button title="Delete This Stack" variant="outlined" color="danger" onPress={() => onDeleteStack(compound)} />
        </View>
      ) : null}
    </FormModal>
  );
}
