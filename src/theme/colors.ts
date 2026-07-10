// Raw color values for places that can't use Tailwind classes (SVG charts,
// navigation theme, icon tints). Mirrors src/global.css and the web app's
// theme.ts — keep all three in sync.

export type ThemeMode = 'light' | 'dark';

export const palette = {
  light: {
    primary: '#0EA5B7',
    primaryLight: '#22D3EE',
    primaryDark: '#0E7490',
    primarySolid: '#0E7490',
    onPrimary: '#FFFFFF',
    secondary: '#7C3AED',
    tealText: '#0E7490',
    violetText: '#5B21B6',
    bg: '#F8FAFC',
    surface: '#FFFFFF',
    text: '#0F172A',
    muted: '#64748B',
    divider: 'rgba(15, 23, 42, 0.08)',
    cardBorder: 'rgba(15, 23, 42, 0.06)',
    outline: 'rgba(15, 23, 42, 0.12)',
    error: '#DC2626',
    warning: '#D97706',
    success: '#059669',
    info: '#0EA5B7',
  },
  dark: {
    primary: '#22D3EE',
    primaryLight: '#67E8F9',
    primaryDark: '#0E7490',
    primarySolid: '#0891A8',
    onPrimary: '#04141A',
    secondary: '#A78BFA',
    tealText: '#67E8F9',
    violetText: '#C4B5FD',
    bg: '#0B1120',
    surface: '#111827',
    text: '#F1F5F9',
    muted: '#94A3B8',
    divider: 'rgba(148, 163, 184, 0.16)',
    cardBorder: 'rgba(148, 163, 184, 0.14)',
    outline: 'rgba(148, 163, 184, 0.24)',
    error: '#F87171',
    warning: '#FBBF24',
    success: '#34D399',
    info: '#22D3EE',
  },
} as const;

export type Palette = (typeof palette)[ThemeMode];

// Chart line colors — clinical, distinct, colorblind-friendly (same as web)
export const CHART_COLORS = [
  '#0EA5B7', // teal
  '#7C3AED', // violet
  '#059669', // emerald
  '#D97706', // amber
  '#DB2777', // pink
  '#2563EB', // blue
  '#EA580C', // orange
  '#16A34A', // green
  '#C026D3', // fuchsia
  '#0D9488', // dark teal
  '#CA8A04', // yellow
  '#4F46E5', // indigo
  '#E11D48', // rose
  '#65A30D', // lime
  '#9333EA', // purple
];

// Next chart color not already in use; falls back to cycling the palette.
export function nextFreeColor(usedColors: string[], cycleIndex = usedColors.length): string {
  const used = new Set(usedColors);
  return CHART_COLORS.find(c => !used.has(c)) || CHART_COLORS[cycleIndex % CHART_COLORS.length];
}
