import { StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useThemeMode } from '../../context/ThemeModeContext';

export default function TabLayout() {
  const { colors, resolvedMode } = useThemeMode();
  // Liquid Glass is iOS 26+. Elsewhere we keep the solid tab bar.
  const glass = isLiquidGlassAvailable();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: glass
          ? { position: 'absolute', backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0 }
          : { backgroundColor: colors.surface, borderTopColor: colors.divider },
        tabBarBackground: glass
          ? () => (
              <GlassView
                glassEffectStyle="regular"
                colorScheme={resolvedMode}
                style={StyleSheet.absoluteFill}
              />
            )
          : undefined,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="dashboard" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="calendar-month" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calculator"
        options={{
          title: 'Calculator',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="calculate" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="my-peptides"
        options={{
          title: 'My Peptides',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="water-drop" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="menu" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
