import { Pressable, Text, View } from '../../tw';
import { Field } from '../ui';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface DayOfWeekPickerProps {
  value: number[]; // 0=Sun..6=Sat
  onChange: (days: number[]) => void;
  label?: string;
  helperText?: string;
}

export default function DayOfWeekPicker({ value, onChange, label = 'Specific Days', helperText }: DayOfWeekPickerProps) {
  const toggle = (day: number) => {
    onChange(value.includes(day) ? value.filter(d => d !== day) : [...value, day].sort());
  };

  return (
    <Field label={label}>
      <View className="flex-row gap-1.5">
        {DAYS.map((name, i) => {
          const active = value.includes(i);
          return (
            <Pressable
              key={name}
              className={`flex-1 items-center rounded-md border py-2 ${active ? 'bg-primary-tint border-primary' : 'border-outline bg-surface'}`}
              onPress={() => toggle(i)}
            >
              <Text className={`font-mono text-[10px] uppercase tracking-wide ${active ? 'text-teal-text font-semibold' : 'text-muted'}`}>
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {helperText ? <Text className="text-[11px] text-muted mt-1">{helperText}</Text> : null}
    </Field>
  );
}
