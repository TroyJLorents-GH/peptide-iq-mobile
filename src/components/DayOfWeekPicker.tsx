import { Pressable, Text, View } from '../tw';
import { useThemeMode } from '../context/ThemeModeContext';

interface DayOfWeekPickerProps {
  value: number[]; // 0=Sun..6=Sat
  onChange: (days: number[]) => void;
  label?: string;
  helperText?: string;
}

const DAYS = [
  { num: 1, letter: 'M' },
  { num: 2, letter: 'T' },
  { num: 3, letter: 'W' },
  { num: 4, letter: 'T' },
  { num: 5, letter: 'F' },
  { num: 6, letter: 'S' },
  { num: 0, letter: 'S' },
];

export default function DayOfWeekPicker({ value, onChange, label = 'Days of Week', helperText }: DayOfWeekPickerProps) {
  const { colors } = useThemeMode();
  const toggleDay = (day: number) => {
    if (value.includes(day)) {
      onChange(value.filter(d => d !== day));
    } else {
      onChange([...value, day].sort());
    }
  };

  return (
    <View className="mb-3">
      <Text className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: colors.muted }}>{label}</Text>
      <View className="flex-row gap-2 flex-wrap">
        {DAYS.map(d => {
          const selected = value.includes(d.num);
          return (
            <Pressable
              key={d.num}
              className="w-9 h-9 rounded-full items-center justify-center border"
              style={{
                backgroundColor: selected ? colors.primarySolid : 'transparent',
                borderColor: selected ? 'transparent' : colors.outline,
              }}
              onPress={() => toggleDay(d.num)}
            >
              <Text className="font-mono text-[13px] font-semibold" style={{ color: selected ? colors.onPrimary : colors.muted }}>
                {d.letter}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text className="font-mono text-[9px] mt-2" style={{ color: colors.muted }}>
        {value.length === 0
          ? helperText || 'No days selected — uses pure frequency interval'
          : `${value.length} day${value.length === 1 ? '' : 's'}/week selected`}
      </Text>
    </View>
  );
}
