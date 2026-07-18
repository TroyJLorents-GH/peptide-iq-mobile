import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TouchableOpacity, View } from '../../tw';
import { Banner, Button, Card, Field, Input, Screen, Select, SectionLabel } from '../../components/ui';
import SyringeVisual from '../../components/SyringeVisual';
import SplitDoseCalculator from '../../components/calculator/SplitDoseCalculator';
import TitrationPlanner from '../../components/calculator/TitrationPlanner';
import ProteinCalculator from '../../components/calculator/ProteinCalculator';
import WaterCalculator from '../../components/calculator/WaterCalculator';
import FiberCalculator from '../../components/calculator/FiberCalculator';
import { useThemeMode } from '../../context/ThemeModeContext';
import { calculateDose } from '../../utils/calculator';
import type { CalculatorResult } from '../../types';

type CalcTool = 'recon' | 'split' | 'titration' | 'protein' | 'water' | 'fiber';
const TOOLS: { key: CalcTool; label: string }[] = [
  { key: 'recon', label: 'Reconstitution' },
  { key: 'split', label: 'Split Dose' },
  { key: 'titration', label: 'Titration' },
  { key: 'protein', label: 'Protein' },
  { key: 'water', label: 'Water' },
  { key: 'fiber', label: 'Fiber' },
];

// Preset dose options (in mcg)
const DOSE_OPTIONS = [
  { label: '0.1 mg (100 mcg)', value: 100 },
  { label: '0.25 mg (250 mcg)', value: 250 },
  { label: '0.5 mg (500 mcg)', value: 500 },
  { label: '1 mg (1000 mcg)', value: 1000 },
  { label: '1.5 mg (1500 mcg)', value: 1500 },
  { label: '2 mg (2000 mcg)', value: 2000 },
  { label: '2.5 mg (2500 mcg)', value: 2500 },
  { label: '5 mg (5000 mcg)', value: 5000 },
  { label: '7.5 mg (7500 mcg)', value: 7500 },
  { label: '10 mg (10000 mcg)', value: 10000 },
  { label: '12.5 mg (12500 mcg)', value: 12500 },
  { label: '25 mg (25000 mcg)', value: 25000 },
  { label: '50 mg (50000 mcg)', value: 50000 },
];

const STRENGTH_OPTIONS = [1, 5, 10, 15, 20, 30, 50, 1000];
const WATER_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 5];

const COMMON_PRESETS = [
  { name: 'BPC-157', strength: '10 mg' },
  { name: 'NAD+', strength: '1000 mg' },
  { name: 'GLP-1s', strength: 'varies' },
  { name: 'Ipamorelin', strength: '5 mg' },
  { name: 'Sermorelin', strength: '15 mg' },
  { name: 'TB-500', strength: '5 mg' },
];

// One calculator input: preset dropdown with a custom-value escape hatch
function PresetOrCustom({ label, unit, options, presetValue, setPresetValue, custom, setCustom, useCustom, setUseCustom }: {
  label: string;
  unit: string;
  options: { value: number; label: string }[];
  presetValue: number | null;
  setPresetValue: (v: number) => void;
  custom: string;
  setCustom: (v: string) => void;
  useCustom: boolean;
  setUseCustom: (v: boolean) => void;
}) {
  const { colors } = useThemeMode();
  return (
    <View className="mb-1">
      {!useCustom ? (
        <>
          <Field label={label}>
            <Select value={presetValue} options={options} onChange={setPresetValue} />
          </Field>
          <TouchableOpacity onPress={() => setUseCustom(true)} className="-mt-2 mb-2">
            <Text className="text-[11px]" style={{ color: colors.primary }}>Enter custom value</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Field label={`${label} (${unit})`}>
            <Input
              value={custom}
              onChangeText={setCustom}
              keyboardType="decimal-pad"
              placeholder={`e.g. 2.5 ${unit}`}
            />
          </Field>
          <TouchableOpacity onPress={() => { setUseCustom(false); setCustom(''); }} className="-mt-2 mb-2">
            <Text className="text-[11px]" style={{ color: colors.primary }}>Use presets</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

export default function CalculatorScreen() {
  const { colors } = useThemeMode();
  const [tool, setTool] = useState<CalcTool>('recon');
  const [desiredDoseMcg, setDesiredDoseMcg] = useState<number | null>(null);
  const [customDose, setCustomDose] = useState('');
  const [useCustomDose, setUseCustomDose] = useState(false);

  const [vialStrengthMg, setVialStrengthMg] = useState<number | null>(null);
  const [customStrength, setCustomStrength] = useState('');
  const [useCustomStrength, setUseCustomStrength] = useState(false);

  const [waterVolumeMl, setWaterVolumeMl] = useState<number | null>(null);
  const [customWater, setCustomWater] = useState('');
  const [useCustomWater, setUseCustomWater] = useState(false);

  const result: CalculatorResult | null = useMemo(() => {
    const dose = useCustomDose ? parseFloat(customDose) * 1000 : desiredDoseMcg;
    const strength = useCustomStrength ? parseFloat(customStrength) : vialStrengthMg;
    const water = useCustomWater ? parseFloat(customWater) : waterVolumeMl;

    if (!dose || !strength || !water) return null;
    if (dose <= 0 || strength <= 0 || water <= 0) return null;

    return calculateDose(dose, strength, water);
  }, [desiredDoseMcg, vialStrengthMg, waterVolumeMl, customDose, customStrength, customWater, useCustomDose, useCustomStrength, useCustomWater]);

  const handleReset = () => {
    setDesiredDoseMcg(null); setCustomDose(''); setUseCustomDose(false);
    setVialStrengthMg(null); setCustomStrength(''); setUseCustomStrength(false);
    setWaterVolumeMl(null); setCustomWater(''); setUseCustomWater(false);
  };

  return (
    <Screen>
      {/* Tool switcher */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3" contentContainerClassName="gap-1.5">
        {TOOLS.map(t => {
          const active = tool === t.key;
          return (
            <Pressable
              key={t.key}
              className="items-center rounded-full border px-3 py-2"
              style={{
                backgroundColor: active ? colors.primaryTint : 'transparent',
                borderColor: active ? colors.primary : colors.outline,
              }}
              onPress={() => setTool(t.key)}
            >
              <Text
                className={`font-mono text-[10px] uppercase tracking-wider ${active ? 'font-semibold' : ''}`}
                style={{ color: active ? colors.tealText : colors.muted }}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {tool === 'split' ? <SplitDoseCalculator /> : null}
      {tool === 'titration' ? <TitrationPlanner /> : null}
      {tool === 'protein' ? <ProteinCalculator /> : null}
      {tool === 'water' ? <WaterCalculator /> : null}
      {tool === 'fiber' ? <FiberCalculator /> : null}

      {tool === 'recon' ? (
      <>
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-sm flex-1" style={{ color: colors.muted }}>
          Accurate dosing for reconstituted peptides on a U-100 insulin syringe.
        </Text>
        <Button title="Reset" variant="outlined" onPress={handleReset} className="py-1.5 px-3" />
      </View>

      {/* Common presets */}
      <SectionLabel>Common strengths</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerClassName="gap-1.5">
        {COMMON_PRESETS.map(p => (
          <View key={p.name} className="rounded-full border px-2.5 py-1" style={{ borderColor: colors.outline }}>
            <Text className="font-mono text-[10px] uppercase tracking-wider" style={{ color: colors.muted }}>
              {p.name}: {p.strength}
            </Text>
          </View>
        ))}
      </ScrollView>

      <Card className="p-4 mb-4">
        <Text className="text-[13px] font-semibold mb-2" style={{ color: colors.text }}>1. Set Your Dose</Text>
        <PresetOrCustom
          label="Desired Dose"
          unit="mg"
          options={DOSE_OPTIONS}
          presetValue={desiredDoseMcg}
          setPresetValue={setDesiredDoseMcg}
          custom={customDose}
          setCustom={setCustomDose}
          useCustom={useCustomDose}
          setUseCustom={setUseCustomDose}
        />

        <Text className="text-[13px] font-semibold mb-2 mt-2" style={{ color: colors.text }}>2. Peptide Strength</Text>
        <PresetOrCustom
          label="Vial Strength"
          unit="mg"
          options={STRENGTH_OPTIONS.map(s => ({ value: s, label: `${s} mg` }))}
          presetValue={vialStrengthMg}
          setPresetValue={setVialStrengthMg}
          custom={customStrength}
          setCustom={setCustomStrength}
          useCustom={useCustomStrength}
          setUseCustom={setUseCustomStrength}
        />

        <Text className="text-[13px] font-semibold mb-2 mt-2" style={{ color: colors.text }}>3. Bacteriostatic Water</Text>
        <PresetOrCustom
          label="Water Volume"
          unit="mL"
          options={WATER_OPTIONS.map(w => ({ value: w, label: `${w} mL` }))}
          presetValue={waterVolumeMl}
          setPresetValue={setWaterVolumeMl}
          custom={customWater}
          setCustom={setCustomWater}
          useCustom={useCustomWater}
          setUseCustom={setUseCustomWater}
        />

        {result ? (
          <Banner tone="info">
            Draw {result.syringeUnits} units ({result.drawVolumeMl} mL) for a{' '}
            {result.desiredDoseMcg >= 1000 ? `${result.desiredDoseMcg / 1000} mg` : `${result.desiredDoseMcg} mcg`} dose.
            Concentration: {result.concentrationMgPerMl} mg/mL. Vial has {result.dosesPerVial} doses at this amount.
          </Banner>
        ) : null}
      </Card>

      {/* Syringe visual + results */}
      <Card className="p-4 mb-4">
        <Text className="font-mono text-[11px] uppercase tracking-widest text-center mb-3" style={{ color: colors.muted }}>
          {result ? 'Reconstitution Result' : 'Enter values to see dosage'}
        </Text>
        <SyringeVisual result={result} />
        {result ? (
          <View className="flex-row flex-wrap gap-2 mt-4">
            <ResultStat label="Draw To" value={`${result.syringeUnits}`} unit="units" highlight />
            <ResultStat
              label="Dose"
              value={result.desiredDoseMcg >= 1000 ? (result.desiredDoseMcg / 1000).toFixed(2) : `${result.desiredDoseMcg}`}
              unit={result.desiredDoseMcg >= 1000 ? 'mg' : 'mcg'}
            />
            <ResultStat label="Concentration" value={`${result.concentrationMgPerMl}`} unit="mg/mL" />
            <ResultStat label="Per Vial" value={`${result.dosesPerVial}`} unit="doses" />
          </View>
        ) : null}
      </Card>

      {/* Formula explanation */}
      {result ? (
        <Card className="p-4">
          <Text className="text-[13px] font-semibold mb-1.5" style={{ color: colors.text }}>How this was calculated</Text>
          <Text className="text-[13px] leading-6" style={{ color: colors.muted }}>
            {result.vialStrengthMg} mg = {result.vialStrengthMg * 1000} mcg of peptide dissolved in{' '}
            {result.waterVolumeMl} mL of water = {result.concentrationMcgPerMl} mcg/mL concentration.{'\n'}
            To get {result.desiredDoseMcg >= 1000 ? `${result.desiredDoseMcg / 1000} mg` : `${result.desiredDoseMcg} mcg`}:{' '}
            {result.desiredDoseMcg} mcg ÷ {result.concentrationMcgPerMl} mcg/mL = {result.drawVolumeMl} mL ={' '}
            {result.syringeUnits} units on a U-100 syringe.
          </Text>
        </Card>
      ) : null}
      </>
      ) : null}
    </Screen>
  );
}

function ResultStat({ label, value, unit, highlight }: {
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
}) {
  const { colors } = useThemeMode();
  return (
    <View
      className="basis-[47%] grow rounded-md border px-3.5 py-3.5 min-h-[90px] justify-between"
      style={
        highlight
          ? { backgroundColor: colors.primaryTint, borderColor: colors.outline, borderTopWidth: 2, borderTopColor: colors.primary }
          : { backgroundColor: colors.surface, borderColor: colors.cardBorder }
      }
    >
      <Text className="font-mono text-[9px] uppercase tracking-widest" style={{ color: colors.muted }}>{label}</Text>
      <View className="flex-row items-baseline gap-1 mt-1 flex-wrap">
        <Text className="font-mono font-semibold text-[26px] leading-7" style={{ color: highlight ? colors.tealText : colors.text }}>
          {value}
        </Text>
        <Text className="font-mono text-[10px] uppercase tracking-wide" style={{ color: colors.muted }}>{unit}</Text>
      </View>
    </View>
  );
}
