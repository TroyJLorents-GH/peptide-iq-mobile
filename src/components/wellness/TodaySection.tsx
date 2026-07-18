import { useState } from 'react';
import Svg, { Circle } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, TouchableOpacity, View } from '../../tw';
import { Button, Card, Field, FormModal, Input, SectionLabel } from '../ui';
import { useThemeMode } from '../../context/ThemeModeContext';
import { useWellness, type WellnessKind, type WellnessTargets } from '../../hooks/useWellness';

const WATER_STEP = 8; // oz
const PROTEIN_STEP = 25; // g
const FIBER_STEP = 5; // g

/** MeAgain-style daily wellness grid: water glass, protein ring, fiber bar. */
export default function TodaySection() {
  const { colors } = useThemeMode();
  const { totals, targets, add, removeLast, saveTargets } = useWellness();

  const [targetsOpen, setTargetsOpen] = useState(false);
  const [tWater, setTWater] = useState('');
  const [tProtein, setTProtein] = useState('');
  const [tFiber, setTFiber] = useState('');

  const waterColor = colors.info;
  const proteinColor = colors.warning;
  const fiberColor = colors.success;

  const openTargets = () => {
    setTWater(String(targets.water));
    setTProtein(String(targets.protein));
    setTFiber(String(targets.fiber));
    setTargetsOpen(true);
  };

  const handleSaveTargets = () => {
    const next: WellnessTargets = {
      water: parseFloat(tWater) || targets.water,
      protein: parseFloat(tProtein) || targets.protein,
      fiber: parseFloat(tFiber) || targets.fiber,
    };
    saveTargets(next);
    setTargetsOpen(false);
  };

  return (
    <View className="mb-3">
      <View className="flex-row items-center justify-between mb-1.5">
        <SectionLabel>Today</SectionLabel>
        <TouchableOpacity onPress={openTargets} hitSlop={6}>
          <MaterialIcons name="tune" size={16} color={colors.muted} />
        </TouchableOpacity>
      </View>

      <View className="flex-row gap-2">
        {/* Protein ring */}
        <Card className="flex-1 p-3 items-center">
          <CardHeader icon="egg" label="Protein" color={proteinColor} />
          <MiniRing
            value={totals.protein}
            target={targets.protein}
            color={proteinColor}
            centerLabel={`${Math.round(totals.protein)}g`}
            subLabel={`of ${Math.round(targets.protein)}g`}
          />
          <Stepper
            color={proteinColor}
            step={`${PROTEIN_STEP}g`}
            onMinus={() => removeLast('protein')}
            onPlus={() => add('protein', PROTEIN_STEP)}
          />
        </Card>

        {/* Water glass */}
        <Card className="flex-1 p-3 items-center">
          <CardHeader icon="water-drop" label="Water" color={waterColor} />
          <WaterGlass value={totals.water} target={targets.water} color={waterColor} />
          <Stepper
            color={waterColor}
            step={`${WATER_STEP}oz`}
            onMinus={() => removeLast('water')}
            onPlus={() => add('water', WATER_STEP)}
          />
        </Card>
      </View>

      {/* Fiber bar */}
      <Card className="p-3 mt-2">
        <View className="flex-row items-center justify-between">
          <CardHeader icon="grass" label="Fiber" color={fiberColor} />
          <Text className="font-mono text-[13px] font-bold" style={{ color: colors.text }}>
            {Math.round(totals.fiber)}g
            <Text className="font-mono text-[11px]" style={{ color: colors.muted }}> /{Math.round(targets.fiber)}g</Text>
          </Text>
        </View>
        <View className="h-2.5 rounded-full overflow-hidden mt-2 mb-2" style={{ backgroundColor: colors.divider }}>
          <View
            className="h-full rounded-full"
            style={{ width: `${Math.min(100, (totals.fiber / targets.fiber) * 100)}%`, backgroundColor: fiberColor }}
          />
        </View>
        <Stepper
          color={fiberColor}
          step={`${FIBER_STEP}g`}
          onMinus={() => removeLast('fiber')}
          onPlus={() => add('fiber', FIBER_STEP)}
          row
        />
      </Card>

      {/* Targets modal */}
      <FormModal
        visible={targetsOpen}
        onClose={() => setTargetsOpen(false)}
        title="Daily Targets"
        footer={<Button title="Save Targets" onPress={handleSaveTargets} />}
      >
        <Field label="Water (oz / day)">
          <Input value={tWater} onChangeText={setTWater} keyboardType="decimal-pad" />
        </Field>
        <Field label="Protein (g / day)">
          <Input value={tProtein} onChangeText={setTProtein} keyboardType="decimal-pad" />
        </Field>
        <Field label="Fiber (g / day)">
          <Input value={tFiber} onChangeText={setTFiber} keyboardType="decimal-pad" />
        </Field>
        <Text className="text-[11px] mt-1" style={{ color: colors.muted }}>
          Tip: the Calculator tab's Protein, Water, and Fiber tools suggest targets for your body and activity level.
        </Text>
      </FormModal>
    </View>
  );
}

function CardHeader({ icon, label, color }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; color: string }) {
  const { colors } = useThemeMode();
  return (
    <View className="flex-row items-center gap-1.5 self-start mb-2">
      <MaterialIcons name={icon} size={15} color={color} />
      <Text className="text-[13px] font-bold" style={{ color: colors.text }}>{label}</Text>
    </View>
  );
}

function Stepper({ color, step, onMinus, onPlus, row }: {
  color: string;
  step: string;
  onMinus: () => void;
  onPlus: () => void;
  row?: boolean;
}) {
  const { colors } = useThemeMode();
  return (
    <View className={`flex-row items-center gap-3 ${row ? 'self-start' : 'mt-2'}`}>
      <Pressable
        className="w-7 h-7 rounded-full items-center justify-center"
        style={{ backgroundColor: colors.divider }}
        onPress={onMinus}
        hitSlop={4}
      >
        <MaterialIcons name="remove" size={16} color={colors.muted} />
      </Pressable>
      <Text className="font-mono text-[11px]" style={{ color: colors.muted }}>{step}</Text>
      <Pressable
        className="w-7 h-7 rounded-full items-center justify-center"
        style={{ backgroundColor: `${color}33` }}
        onPress={onPlus}
        hitSlop={4}
      >
        <MaterialIcons name="add" size={16} color={color} />
      </Pressable>
    </View>
  );
}

function MiniRing({ value, target, color, centerLabel, subLabel }: {
  value: number;
  target: number;
  color: string;
  centerLabel: string;
  subLabel: string;
}) {
  const { colors } = useThemeMode();
  const size = 92;
  const c = size / 2;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(1, target > 0 ? value / target : 0);
  const dash = pct * circumference;
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={radius} fill="none" stroke={colors.divider} strokeWidth="9" />
        <Circle
          cx={c}
          cy={c}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </Svg>
      <View className="absolute items-center">
        <Text className="font-mono text-[15px] font-extrabold" style={{ color: colors.text }}>{centerLabel}</Text>
        <Text className="text-[9px]" style={{ color: colors.muted }}>{subLabel}</Text>
      </View>
    </View>
  );
}

function WaterGlass({ value, target, color }: { value: number; target: number; color: string }) {
  const { colors } = useThemeMode();
  const pct = Math.min(1, target > 0 ? value / target : 0);
  return (
    <View className="items-center">
      <View
        className="w-[64px] h-[84px] rounded-b-2xl rounded-t-md overflow-hidden justify-end"
        style={{ borderWidth: 2.5, borderColor: colors.outline }}
      >
        <View style={{ height: `${pct * 100}%`, backgroundColor: `${color}99` }} />
      </View>
      <Text className="font-mono text-[15px] font-extrabold mt-1" style={{ color: colors.text }}>
        {Math.round(value)}oz
        <Text className="font-mono text-[10px]" style={{ color: colors.muted }}> /{Math.round(target)}oz</Text>
      </Text>
    </View>
  );
}
