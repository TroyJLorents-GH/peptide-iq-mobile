import { useRouter } from 'expo-router';
import { Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from '../../tw';
import { Card, Divider, Screen, SectionLabel } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useThemeMode, type ThemePreference } from '../../context/ThemeModeContext';

const LINKS = [
  { label: 'Activity', href: '/logbook', icon: 'history' as const },
  { label: 'Progress', href: '/progress', icon: 'monitor-weight' as const },
  { label: 'Peptide Library', href: '/library', icon: 'science' as const },
  { label: 'Alerts & Warnings', href: '/alerts', icon: 'warning-amber' as const },
];

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: 'light-mode' | 'dark-mode' | 'brightness-auto' }[] = [
  { value: 'light', label: 'Light', icon: 'light-mode' },
  { value: 'dark', label: 'Dark', icon: 'dark-mode' },
  { value: 'auto', label: 'Auto', icon: 'brightness-auto' },
];

export default function MoreScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { preference, setPreference, colors } = useThemeMode();

  return (
    <Screen>
      <SectionLabel>Browse</SectionLabel>
      <Card className="mb-5">
        {LINKS.map((item, i) => (
          <View key={item.href}>
            {i > 0 ? <Divider /> : null}
            <Pressable
              className="flex-row items-center gap-3 px-4 py-3.5"
              onPress={() => router.push(item.href as any)}
            >
              <MaterialIcons name={item.icon} size={20} color={colors.muted} />
              <Text className="flex-1 text-sm" style={{ color: colors.text }}>{item.label}</Text>
              <MaterialIcons name="chevron-right" size={20} color={colors.muted} />
            </Pressable>
          </View>
        ))}
      </Card>

      <SectionLabel>Theme</SectionLabel>
      <Card className="mb-5 flex-row overflow-hidden">
        {THEME_OPTIONS.map((opt, i) => {
          const active = preference === opt.value;
          return (
            <Pressable
              key={opt.value}
              className={`flex-1 items-center py-3 ${i > 0 ? 'border-l' : ''}`}
              style={{
                backgroundColor: active ? colors.primaryTint : undefined,
                borderLeftColor: i > 0 ? colors.divider : undefined,
              }}
              onPress={() => setPreference(opt.value)}
            >
              <MaterialIcons name={opt.icon} size={18} color={active ? colors.primary : colors.muted} />
              <Text
                className={`font-mono text-[10px] uppercase tracking-wider mt-1 ${active ? 'font-medium' : ''}`}
                style={{ color: active ? colors.tealText : colors.muted }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </Card>

      <SectionLabel>Account</SectionLabel>
      <Card>
        <View className="px-4 py-3">
          <Text className="text-xs" style={{ color: colors.muted }}>Signed in as</Text>
          <Text className="text-sm mt-0.5" style={{ color: colors.text }} numberOfLines={1}>{user?.email}</Text>
        </View>
        <Divider />
        <Pressable
          className="flex-row items-center gap-3 px-4 py-3.5"
          onPress={() => Linking.openURL('mailto:peptide.iq.update@gmail.com?subject=PeptideIQ%20Support')}
        >
          <MaterialIcons name="support-agent" size={20} color={colors.muted} />
          <Text className="flex-1 text-sm" style={{ color: colors.text }}>Contact Support</Text>
        </Pressable>
        <Divider />
        <Pressable className="flex-row items-center gap-3 px-4 py-3.5" onPress={signOut}>
          <MaterialIcons name="logout" size={20} color={colors.error} />
          <Text className="flex-1 text-sm" style={{ color: colors.error }}>Sign Out</Text>
        </Pressable>
      </Card>

      <Text className="text-[11px] text-center mt-6" style={{ color: colors.muted }}>
        Educational tool — not medical advice
      </Text>
    </Screen>
  );
}
