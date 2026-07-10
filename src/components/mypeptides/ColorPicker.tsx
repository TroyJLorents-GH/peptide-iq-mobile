import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from '../../tw';
import { Field } from '../ui';
import { CHART_COLORS } from '../../theme/colors';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  usedColors?: string[]; // colors already taken by other compounds (still selectable)
  label?: string;
}

export default function ColorPicker({ value, onChange, usedColors = [], label = 'Chart Color' }: ColorPickerProps) {
  return (
    <Field label={label}>
      <View className="flex-row flex-wrap gap-2">
        {CHART_COLORS.map(color => {
          const selected = value === color;
          const used = usedColors.includes(color) && !selected;
          return (
            <Pressable
              key={color}
              className="items-center justify-center rounded-full"
              style={{
                width: 34,
                height: 34,
                backgroundColor: color,
                opacity: used ? 0.35 : 1,
                borderWidth: selected ? 3 : 0,
                borderColor: 'rgba(255,255,255,0.9)',
                elevation: selected ? 2 : 0,
              }}
              onPress={() => onChange(color)}
            >
              {selected ? <MaterialIcons name="check" size={16} color="#fff" /> : null}
            </Pressable>
          );
        })}
      </View>
    </Field>
  );
}
