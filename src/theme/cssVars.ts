import type { ThemeMode } from './colors';

/**
 * Concrete per-mode values for every Tailwind theme token declared in
 * global.css. Fed to react-native-css's VariableContextProvider at the app
 * root so var()-based classes resolve reliably everywhere — including inside
 * native <Modal>s (React context crosses the modal boundary; the CSS-side
 * :root/light-dark() pipeline does not) — and flip instantly with the
 * resolved theme mode.
 *
 * Keep in sync with the :root block in src/global.css.
 */
export const cssVars: Record<ThemeMode, Record<`--${string}`, string>> = {
  light: {
    '--color-primary': '#0ea5b7',
    '--color-primary-light': '#22d3ee',
    '--color-primary-dark': '#0e7490',
    '--color-primary-solid': '#0e7490',
    '--color-on-primary': '#ffffff',
    '--color-secondary': '#7c3aed',
    '--color-secondary-light': '#a78bfa',
    '--color-secondary-dark': '#5b21b6',
    '--color-teal-text': '#0e7490',
    '--color-violet-text': '#5b21b6',
    '--color-bg': '#f8fafc',
    '--color-surface': '#ffffff',
    '--color-surface-raised': '#ffffff',
    '--color-ink': '#0f172a',
    '--color-muted': '#64748b',
    '--color-divider': 'rgba(15, 23, 42, 0.08)',
    '--color-card-border': 'rgba(15, 23, 42, 0.06)',
    '--color-outline': 'rgba(15, 23, 42, 0.12)',
    '--color-danger': '#dc2626',
    '--color-warn': '#d97706',
    '--color-ok': '#059669',
    '--color-info': '#0ea5b7',
    '--color-primary-tint': 'rgba(14, 165, 183, 0.08)',
    '--color-danger-tint': 'rgba(220, 38, 38, 0.08)',
    '--color-warn-tint': 'rgba(217, 119, 6, 0.1)',
    '--color-ok-tint': 'rgba(5, 150, 105, 0.08)',
  },
  dark: {
    '--color-primary': '#22d3ee',
    '--color-primary-light': '#67e8f9',
    '--color-primary-dark': '#0e7490',
    '--color-primary-solid': '#0891a8',
    '--color-on-primary': '#04141a',
    '--color-secondary': '#a78bfa',
    '--color-secondary-light': '#c4b5fd',
    '--color-secondary-dark': '#7c3aed',
    '--color-teal-text': '#67e8f9',
    '--color-violet-text': '#c4b5fd',
    '--color-bg': '#0b1120',
    '--color-surface': '#111827',
    '--color-surface-raised': '#1f2937',
    '--color-ink': '#f1f5f9',
    '--color-muted': '#94a3b8',
    '--color-divider': 'rgba(148, 163, 184, 0.16)',
    '--color-card-border': 'rgba(148, 163, 184, 0.14)',
    '--color-outline': 'rgba(148, 163, 184, 0.24)',
    '--color-danger': '#f87171',
    '--color-warn': '#fbbf24',
    '--color-ok': '#34d399',
    '--color-info': '#22d3ee',
    '--color-primary-tint': 'rgba(34, 211, 238, 0.14)',
    '--color-danger-tint': 'rgba(248, 113, 113, 0.14)',
    '--color-warn-tint': 'rgba(251, 191, 36, 0.14)',
    '--color-ok-tint': 'rgba(52, 211, 153, 0.14)',
  },
};
