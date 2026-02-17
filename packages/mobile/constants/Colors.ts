// App color scheme - Dark mode primary with vibrant accents

const tintColorLight = '#6366f1'; // Indigo
const tintColorDark = '#818cf8';  // Lighter indigo

export default {
  light: {
    text: '#1f2937',
    textSecondary: '#6b7280',
    background: '#f9fafb',
    backgroundSecondary: '#f3f4f6',
    card: '#ffffff',
    cardBorder: '#e5e7eb',
    tint: tintColorLight,
    tabIconDefault: '#9ca3af',
    tabIconSelected: tintColorLight,
    accent: '#8b5cf6',     // Purple
    success: '#10b981',    // Emerald
    warning: '#f59e0b',    // Amber
    error: '#ef4444',      // Red
    timeIndicator: '#ef4444',
  },
  dark: {
    text: '#f9fafb',
    textSecondary: '#9ca3af',
    background: '#0f0f1a',
    backgroundSecondary: '#1a1a2e',
    card: '#16162a',
    cardBorder: '#2d2d4a',
    tint: tintColorDark,
    tabIconDefault: '#6b7280',
    tabIconSelected: tintColorDark,
    accent: '#a78bfa',     // Purple
    success: '#34d399',    // Emerald
    warning: '#fbbf24',    // Amber
    error: '#f87171',      // Red
    timeIndicator: '#ef4444',
  },
};

// Subject colors for timetable entries
export const subjectColors = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#84cc16', // Lime
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
  '#eab308', // Yellow
  '#22c55e', // Green
];
