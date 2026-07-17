import { type ReactNode, useState } from 'react';
import { Modal, type TextInputProps, type ViewProps } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from '../tw';
import { useThemeMode } from '../context/ThemeModeContext';

// A translucent (absolute) glass tab bar needs scroll content to clear it.
const TAB_INSET = isLiquidGlassAvailable() ? 'pb-28' : 'pb-10';

/*
 * Color rendering note: on native (nativewind 5 preview + inlineVariables:false),
 * Tailwind color utilities that resolve through CSS variables — bg-*, border-*,
 * and tint classes — silently fail to apply, especially inside <Modal>s. Layout
 * and sizing utilities work fine. So every primitive here keeps layout in
 * className and applies colors via inline styles from the palette. See
 * ColorPicker for the same pattern.
 */

// ---------- Layout ----------

export function Screen({ children, scroll = true, padded = true }: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
}) {
  const { colors } = useThemeMode();
  if (!scroll) {
    return <View className={`flex-1 ${padded ? 'p-4' : ''}`} style={{ backgroundColor: colors.bg }}>{children}</View>;
  }
  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: colors.bg }}
      contentContainerClassName={padded ? `p-4 ${TAB_INSET}` : TAB_INSET}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, className = '', style, ...rest }: ViewProps & { className?: string; children: ReactNode }) {
  const { colors, resolvedMode } = useThemeMode();
  // Soft elevation. Shadows read on light bg; on dark we lean on the border.
  const shadow =
    resolvedMode === 'light'
      ? { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 }
      : null;
  return (
    <View
      className={`border rounded-lg ${className}`}
      style={[{ backgroundColor: colors.surface, borderColor: colors.cardBorder }, shadow, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

export function Divider({ className = '' }: { className?: string }) {
  const { colors } = useThemeMode();
  return <View className={`h-px ${className}`} style={{ backgroundColor: colors.divider }} />;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  // Mirrors the web app's mono uppercase overline style
  const { colors } = useThemeMode();
  return (
    <Text className="font-mono text-[10px] uppercase tracking-widest mb-1.5" style={{ color: colors.muted }}>
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
  const { colors } = useThemeMode();
  const base = 'flex-row items-center justify-center gap-1.5 rounded-md px-4 py-2.5';

  const containerStyle =
    variant === 'contained'
      ? { backgroundColor: color === 'danger' ? colors.error : colors.primarySolid }
      : variant === 'outlined'
        ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.outline }
        : { backgroundColor: 'transparent' };

  const textColor =
    variant === 'contained'
      ? colors.onPrimary
      : color === 'danger'
        ? colors.error
        : colors.primary;
  const textWeight = variant === 'contained' ? 'font-semibold' : 'font-medium';

  return (
    <TouchableOpacity
      className={`${base} ${className}`}
      style={[containerStyle, disabled ? { opacity: 0.4 } : null]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {icon}
      <Text className={`text-sm ${textWeight}`} style={{ color: textColor }}>{title}</Text>
    </TouchableOpacity>
  );
}

// ---------- Chips / badges ----------

export function Chip({ label, tone = 'default' }: {
  label: string;
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'violet';
}) {
  const { colors } = useThemeMode();
  const tones: Record<string, { box: string; border: string; text: string }> = {
    default: { box: 'transparent', border: colors.outline, text: colors.muted },
    primary: { box: colors.primaryTint, border: 'transparent', text: colors.tealText },
    success: { box: colors.successTint, border: 'transparent', text: colors.success },
    warning: { box: colors.warningTint, border: 'transparent', text: colors.warning },
    danger: { box: colors.errorTint, border: 'transparent', text: colors.error },
    violet: { box: colors.primaryTint, border: 'transparent', text: colors.violetText },
  };
  const t = tones[tone] ?? tones.default;
  return (
    <View className="self-start rounded-full border px-2 py-0.5" style={{ backgroundColor: t.box, borderColor: t.border }}>
      <Text className="font-mono text-[10px] uppercase tracking-wider font-medium" style={{ color: t.text }}>
        {label}
      </Text>
    </View>
  );
}

// ---------- Inputs ----------

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  const { colors } = useThemeMode();
  return (
    <View className={`mb-3 ${className}`}>
      <Text className="text-xs mb-1" style={{ color: colors.muted }}>{label}</Text>
      {children}
    </View>
  );
}

export function Input(props: TextInputProps & { className?: string }) {
  const { colors } = useThemeMode();
  const { style, className, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...rest}
      className={`border rounded-md px-3 py-2.5 text-sm ${className ?? ''}`}
      style={[{ borderColor: colors.outline, backgroundColor: colors.surface, color: colors.text }, style]}
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
      className="border rounded-md px-3 py-2.5 flex-row items-center justify-between"
      style={{ borderColor: colors.outline, backgroundColor: colors.surface }}
      onPress={() => setOpen(true)}
    >
      <Text className="text-sm" style={{ color: selected ? colors.text : colors.muted }} numberOfLines={1}>
        {selected ? selected.label : placeholder}
      </Text>
      <MaterialIcons name="arrow-drop-down" size={20} color={colors.muted} />
    </Pressable>
  );

  return (
    <>
      {label ? <Field label={label}>{field}</Field> : field}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          className="flex-1 justify-center px-6"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onPress={() => setOpen(false)}
        >
          <View
            className="rounded-lg border max-h-[70%] overflow-hidden"
            style={{ backgroundColor: colors.surface, borderColor: colors.cardBorder }}
          >
            {label ? (
              <Text className="px-4 pt-3 pb-2 text-xs font-medium uppercase tracking-wider" style={{ color: colors.muted }}>
                {label}
              </Text>
            ) : null}
            <ScrollView>
              {options.map(o => (
                <Pressable
                  key={String(o.value)}
                  className="px-4 py-3"
                  style={o.value === value ? { backgroundColor: colors.primaryTint } : undefined}
                  onPress={() => { onChange(o.value); setOpen(false); }}
                >
                  <Text
                    className={`text-sm ${o.value === value ? 'font-medium' : ''}`}
                    style={{ color: o.value === value ? colors.tealText : colors.text }}
                  >
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
  const { colors } = useThemeMode();
  const tones = {
    info: { box: colors.primaryTint, text: colors.tealText, icon: 'info-outline' as const, iconColor: colors.info },
    success: { box: colors.successTint, text: colors.success, icon: 'check-circle-outline' as const, iconColor: colors.success },
    warning: { box: colors.warningTint, text: colors.warning, icon: 'warning-amber' as const, iconColor: colors.warning },
    error: { box: colors.errorTint, text: colors.error, icon: 'error-outline' as const, iconColor: colors.error },
  };
  const t = tones[tone];
  return (
    <View className="flex-row items-start gap-2 rounded-md px-3 py-2.5" style={{ backgroundColor: t.box }}>
      <MaterialIcons name={t.icon} size={18} color={t.iconColor} style={{ marginTop: 1 }} />
      <Text className="flex-1 text-[13px] leading-5" style={{ color: t.text }}>{children}</Text>
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
  const { colors } = useThemeMode();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
        <View className="rounded-t-2xl max-h-[90%]" style={{ backgroundColor: colors.bg }}>
          <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
            <Text className="text-base font-semibold" style={{ color: colors.text }}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Text className="text-sm" style={{ color: colors.muted }}>Close</Text>
            </TouchableOpacity>
          </View>
          <View className="h-px" style={{ backgroundColor: colors.divider }} />
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
      <Text className="text-sm font-medium mt-3 text-center" style={{ color: colors.text }}>{title}</Text>
      {subtitle ? <Text className="text-xs mt-1 text-center leading-5" style={{ color: colors.muted }}>{subtitle}</Text> : null}
    </View>
  );
}
