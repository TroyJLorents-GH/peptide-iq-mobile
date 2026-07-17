import { useState } from 'react';
import { Platform } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from '../tw';
import { Field } from './ui';
import { useThemeMode } from '../context/ThemeModeContext';

/**
 * Cross-platform date/time input — replaces the web app's datetime-local
 * fields. iOS shows inline pickers; Android opens the system dialogs
 * (date and time as separate taps, per platform convention).
 */
export default function DateTimeField({ label, value, onChange, mode = 'datetime' }: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  /** 'date' hides the time control */
  mode?: 'datetime' | 'date';
}) {
  const { colors } = useThemeMode();
  const [androidShow, setAndroidShow] = useState<'date' | 'time' | null>(null);

  const handleAndroidChange = (kind: 'date' | 'time') => (event: DateTimePickerEvent, d?: Date) => {
    setAndroidShow(null);
    if (event.type === 'set' && d) onChange(d);
  };

  if (Platform.OS === 'ios') {
    return (
      <Field label={label}>
        <View className="flex-row items-center gap-2">
          <DateTimePicker
            value={value}
            mode="date"
            onChange={(_e: DateTimePickerEvent, d?: Date) => d && onChange(d)}
          />
          {mode === 'datetime' ? (
            <DateTimePicker
              value={value}
              mode="time"
              onChange={(_e: DateTimePickerEvent, d?: Date) => d && onChange(d)}
            />
          ) : null}
        </View>
      </Field>
    );
  }

  return (
    <Field label={label}>
      <View className="flex-row gap-2">
        <Pressable
          className="flex-1 border rounded-md px-3 py-2.5 flex-row items-center justify-between"
          style={{ borderColor: colors.outline, backgroundColor: colors.surface }}
          onPress={() => setAndroidShow('date')}
        >
          <Text className="text-sm" style={{ color: colors.text }}>
            {value.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
          <MaterialIcons name="calendar-today" size={16} color={colors.muted} />
        </Pressable>
        {mode === 'datetime' ? (
          <Pressable
            className="flex-1 border rounded-md px-3 py-2.5 flex-row items-center justify-between"
            style={{ borderColor: colors.outline, backgroundColor: colors.surface }}
            onPress={() => setAndroidShow('time')}
          >
            <Text className="text-sm" style={{ color: colors.text }}>
              {value.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            </Text>
            <MaterialIcons name="schedule" size={16} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {androidShow === 'date' ? (
        <DateTimePicker value={value} mode="date" onChange={handleAndroidChange('date')} />
      ) : null}
      {androidShow === 'time' ? (
        <DateTimePicker value={value} mode="time" onChange={handleAndroidChange('time')} />
      ) : null}
    </Field>
  );
}
