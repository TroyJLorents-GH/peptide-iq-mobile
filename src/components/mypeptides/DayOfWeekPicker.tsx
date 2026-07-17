import { Pressable, Text, View } from '../../tw';
import { Field } from '../ui';
import { useThemeMode } from '../../context/ThemeModeContext';

// 0=Sun..6=Sat, laid out Mon-first to match a typical week view.
const DAYS = [
  { num: 1, letter: 'M' },
  { num: 2, letter: 'T' },
  { num: 3, letter: 'W' },
  { num: 4, letter: 'T' },
  { num: 5, letter: 'F' },
  { num: 6, letter: 'S' },
  { num: 0, letter: 'S' },
];

interface DayOfWeekPickerProps {
  value: number[]; // 0=Sun..6=Sat
  onChange: (days: number[]) => void;
  label?: string;
  helperText?: string;
}

export default function DayOfWeekPicker({ value, onChange, label = 'Specific Days', helperText }: DayOfWeekPickerProps) {
  const { colors } = useThemeMode();
  const toggle = (day: number) => {
    onChange(value.includes(day) ? value.filter(d => d !== day) : [...value, day].sort());
  };

  return (
    <Field label={label}>
      {/* Explicit inline styles: the circle geometry, border, and selected
          fill must render regardless of CSS-variable resolution. */}
      <View className="flex-row justify-between">
        {DAYS.map(d => {
          const active = value.includes(d.num);
          return (
            <Pressable
              key={d.num}
              onPress={() => toggle(d.num)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1.5,
                backgroundColor: active ? colors.primarySolid : colors.surface,
                borderColor: active ? colors.primarySolid : colors.outline,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: active ? colors.onPrimary : colors.muted,
                }}
              >
                {d.letter}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {helperText ? <Text className="text-[11px] text-muted mt-1.5">{helperText}</Text> : null}
    </Field>
  );
}
