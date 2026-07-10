import { useState } from 'react';
import { Platform } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Pressable, Text, View } from '../../tw';
import { Field } from '../ui';
import { useThemeMode } from '../../context/ThemeModeContext';

interface DateTimeFieldProps {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  helperText?: string;
}

/**
 * Cross-platform datetime field — replaces the web app's datetime-local input.
 * iOS shows the native compact picker inline; Android chains date → time dialogs.
 */
export default function DateTimeField({ label, value, onChange, helperText }: DateTimeFieldProps) {
  const [stage, setStage] = useState<null | 'date' | 'time'>(null);
  const { resolvedMode } = useThemeMode();

  const handleAndroidChange = (e: DateTimePickerEvent, d?: Date) => {
    if (e.type === 'dismissed' || !d) {
      setStage(null);
      return;
    }
    if (stage === 'date') {
      const merged = new Date(d);
      merged.setHours(value.getHours(), value.getMinutes(), 0, 0);
      onChange(merged);
      setStage('time');
    } else {
      onChange(d);
      setStage(null);
    }
  };

  return (
    <Field label={label}>
      {Platform.OS === 'ios' ? (
        <View className="border border-outline rounded-md bg-surface px-1 py-1 items-start">
          <DateTimePicker
            value={value}
            mode="datetime"
            display="compact"
            themeVariant={resolvedMode}
            onChange={(_, d) => d && onChange(d)}
          />
        </View>
      ) : (
        <>
          <Pressable
            className="border border-outline rounded-md px-3 py-2.5 bg-surface"
            onPress={() => setStage('date')}
          >
            <Text className="text-sm text-ink">
              {value.toLocaleString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
              })}
            </Text>
          </Pressable>
          {stage ? (
            <DateTimePicker
              value={value}
              mode={stage}
              onChange={handleAndroidChange}
            />
          ) : null}
        </>
      )}
      {helperText ? <Text className="text-[11px] text-muted mt-1">{helperText}</Text> : null}
    </Field>
  );
}
