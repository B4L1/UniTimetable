// Design tokens — mirrors packages/web/src/index.css so the mobile app
// looks identical to the web app. Keep the two in sync.

export const palette = {
    // Colors — dark theme (matches web :root)
    bgPrimary: '#12121a',
    bgSecondary: '#181824',
    bgCard: '#1a1a24',
    bgTertiary: '#222230',
    textPrimary: '#ffffff',
    textSecondary: '#a0a0b0',
    accent: '#6366f1',
    accentHover: '#818cf8',
    border: 'rgba(255, 255, 255, 0.1)',
    borderStrong: 'rgba(255, 255, 255, 0.15)',
    error: '#ef4444',
    success: '#22c55e',

    // Glass (RN has no backdrop blur on plain Views — use the solid tint)
    glassBg: 'rgba(20, 20, 28, 0.8)',
    glassBorder: 'rgba(255, 255, 255, 0.12)',

    // Week parity chips (matches web .week-indicator-chip)
    weekOdd: '#6366f1',
    weekOddText: '#a5b4fc',
    weekEven: '#a855f7',
    weekEvenText: '#d8b4fe',
} as const;

// Radius scale — identical to web --radius-* tokens
export const radius = {
    xs: 6,
    sm: 8,
    md: 12,
    lg: 16,
    pill: 999,
} as const;

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
} as const;

export type Palette = typeof palette;
