import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from '../tw';
import { CHART_COLORS } from '../theme/colors';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  usedColors?: string[];
  label?: string;
}

// Swatch grid of CHART_COLORS. (Web's free-form custom color input has no
// native equivalent — the curated palette covers chart-legible colors.)
export default function ColorPicker({ value, onChange, usedColors = [], label = 'Color' }: ColorPickerProps) {
  return (
    <View className="mb-3">
      <Text className="font-mono text-[10px] uppercase tracking-widest text-muted mb-2">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {CHART_COLORS.map(color => {
          const selected = color === value;
          const inUse = usedColors.includes(color) && !selected;
          return (
            <Pressable
              key={color}
              className="w-8 h-8 rounded-md items-center justify-center"
              style={{ backgroundColor: color, opacity: inUse ? 0.45 : 1 }}
              onPress={() => onChange(color)}
            >
              {selected ? <MaterialIcons name="check" size={18} color="#FFFFFF" /> : null}
            </Pressable>
          );
        })}
      </View>
      <Text className="font-mono text-[9px] text-muted mt-2">
        Current: {value ? value.toUpperCase() : '—'}
      </Text>
    </View>
  );
}
