import { type ReactNode, useState } from 'react';
import { Modal, type TextInputProps, type ViewProps } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from '../tw';
import { useThemeMode } from '../context/ThemeModeContext';

// ---------- Layout ----------

export function Screen({ children, scroll = true, padded = true }: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
}) {
  if (!scroll) {
    return <View className={`flex-1 bg-bg ${padded ? 'p-4' : ''}`}>{children}</View>;
  }
  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName={padded ? 'p-4 pb-10' : 'pb-10'}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, className = '', ...rest }: ViewProps & { className?: string; children: ReactNode }) {
  return (
    <View className={`bg-surface border border-card-border rounded-lg ${className}`} {...rest}>
      {children}
    </View>
  );
}

export function Divider({ className = '' }: { className?: string }) {
  return <View className={`h-px bg-divider ${className}`} />;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  // Mirrors the web app's mono uppercase overline style
  return (
    <Text className="font-mono text-[10px] uppercase tracking-widest text-muted mb-1.5">
      {children}
    </Text>
  );
}

// ---------- Buttons ----------

export function Button({ title, onPress, variant = 'contained', color = 'primary', disabled, className = '', icon }: {
  title: string;
  onPress?: () => void;
  variant?: 'contained' | 'outlined' | 'text';
  color?: 'primary' | 'danger';
  disabled?: boolean;
  className?: string;
  icon?: ReactNode;
}) {
  const base = 'flex-row items-center justify-center gap-1.5 rounded-md px-4 py-2.5';
  const styles =
    variant === 'contained'
      ? color === 'danger'
        ? 'bg-danger'
        : 'bg-primary-solid'
      : variant === 'outlined'
        ? 'border border-outline bg-transparent'
        : 'bg-transparent';
  const textStyles =
    variant === 'contained'
      ? color === 'danger' ? 'text-white font-semibold' : 'text-on-primary font-semibold'
      : color === 'danger'
        ? 'text-danger font-medium'
        : 'text-primary font-medium';
  return (
    <TouchableOpacity
      className={`${base} ${styles} ${disabled ? 'opacity-40' : ''} ${className}`}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {icon}
      <Text className={`text-sm ${textStyles}`}>{title}</Text>
    </TouchableOpacity>
  );
}

// ---------- Chips / badges ----------

export function Chip({ label, tone = 'default' }: {
  label: string;
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'violet';
}) {
  const tones: Record<string, { box: string; text: string }> = {
    default: { box: 'bg-transparent border-outline', text: 'text-muted' },
    primary: { box: 'bg-primary-tint border-transparent', text: 'text-teal-text' },
    success: { box: 'bg-ok-tint border-transparent', text: 'text-ok' },
    warning: { box: 'bg-warn-tint border-transparent', text: 'text-warn' },
    danger: { box: 'bg-danger-tint border-transparent', text: 'text-danger' },
    violet: { box: 'bg-primary-tint border-transparent', text: 'text-violet-text' },
  };
  const t = tones[tone] ?? tones.default;
  return (
    <View className={`self-start rounded-full border px-2 py-0.5 ${t.box}`}>
      <Text className={`font-mono text-[10px] uppercase tracking-wider font-medium ${t.text}`}>
        {label}
      </Text>
    </View>
  );
}

// ---------- Inputs ----------

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <View className={`mb-3 ${className}`}>
      <Text className="text-xs text-muted mb-1">{label}</Text>
      {children}
    </View>
  );
}

export function Input(props: TextInputProps & { className?: string }) {
  const { colors } = useThemeMode();
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      className={`border border-outline rounded-md px-3 py-2.5 text-sm text-ink bg-surface ${props.className ?? ''}`}
    />
  );
}

// Modal list picker — replaces MUI <Select>
export function Select<T extends string | number>({ label, value, options, onChange, placeholder = 'Select…' }: {
  label?: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const { colors } = useThemeMode();
  const selected = options.find(o => o.value === value);

  const field = (
    <Pressable
      className="border border-outline rounded-md px-3 py-2.5 flex-row items-center justify-between bg-surface"
      onPress={() => setOpen(true)}
    >
      <Text className={`text-sm ${selected ? 'text-ink' : 'text-muted'}`} numberOfLines={1}>
        {selected ? selected.label : placeholder}
      </Text>
      <MaterialIcons name="arrow-drop-down" size={20} color={colors.muted} />
    </Pressable>
  );

  return (
    <>
      {label ? <Field label={label}>{field}</Field> : field}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/50 justify-center px-6" onPress={() => setOpen(false)}>
          <View className="bg-surface rounded-lg border border-card-border max-h-[70%] overflow-hidden">
            {label ? (
              <Text className="px-4 pt-3 pb-2 text-xs text-muted font-medium uppercase tracking-wider">{label}</Text>
            ) : null}
            <ScrollView>
              {options.map(o => (
                <Pressable
                  key={String(o.value)}
                  className={`px-4 py-3 ${o.value === value ? 'bg-primary-tint' : ''}`}
                  onPress={() => { onChange(o.value); setOpen(false); }}
                >
                  <Text className={`text-sm ${o.value === value ? 'text-teal-text font-medium' : 'text-ink'}`}>
                    {o.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// ---------- Alerts (inline banners) ----------

export function Banner({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'success' | 'warning' | 'error' }) {
  const tones = {
    info: { box: 'bg-primary-tint', text: 'text-teal-text', icon: 'info-outline' as const },
    success: { box: 'bg-ok-tint', text: 'text-ok', icon: 'check-circle-outline' as const },
    warning: { box: 'bg-warn-tint', text: 'text-warn', icon: 'warning-amber' as const },
    error: { box: 'bg-danger-tint', text: 'text-danger', icon: 'error-outline' as const },
  };
  const { colors } = useThemeMode();
  const iconColor = { info: colors.info, success: colors.success, warning: colors.warning, error: colors.error }[tone];
  const t = tones[tone];
  return (
    <View className={`flex-row items-start gap-2 rounded-md px-3 py-2.5 ${t.box}`}>
      <MaterialIcons name={t.icon} size={18} color={iconColor} style={{ marginTop: 1 }} />
      <Text className={`flex-1 text-[13px] leading-5 ${t.text}`}>{children}</Text>
    </View>
  );
}

// ---------- Bottom sheet-ish modal for forms ----------

export function FormModal({ visible, onClose, title, children, footer }: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-bg rounded-t-2xl max-h-[90%]">
          <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
            <Text className="text-base font-semibold text-ink">{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Text className="text-sm text-muted">Close</Text>
            </TouchableOpacity>
          </View>
          <Divider />
          <ScrollView contentContainerClassName="p-4 pb-8" keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View className="px-4 pb-6 pt-2">{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

// ---------- Empty state ----------

export function EmptyState({ icon, title, subtitle }: { icon?: keyof typeof MaterialIcons.glyphMap; title: string; subtitle?: string }) {
  const { colors } = useThemeMode();
  return (
    <View className="items-center py-10 px-6">
      {icon ? <MaterialIcons name={icon} size={40} color={colors.muted} /> : null}
      <Text className="text-sm font-medium text-ink mt-3 text-center">{title}</Text>
      {subtitle ? <Text className="text-xs text-muted mt-1 text-center leading-5">{subtitle}</Text> : null}
    </View>
  );
}
