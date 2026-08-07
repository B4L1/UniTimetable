// Design tokens — mirrors packages/web/src/index.css (Blueprint v4) so the
// mobile app matches the web app exactly. Keep the two in sync.

export const palette = {
    // Surfaces — opaque, stepped by value (dark only; mobile has no light theme yet)
    bgApp: '#08090a',
    bgSurface: '#0c0e10',
    bgElevated: '#131619',
    bgInset: '#050506',

    // Hairlines — opaque, not alpha
    borderSubtle: '#1c1f23',
    borderDefault: '#26292e',
    borderStrong: '#383c43',
    gridLine: '#16181b',

    // Text
    textPrimary: '#edeef0',
    textSecondary: '#969ba3',
    textTertiary: '#5f646c',

    // Accent — Sapientia green
    accent: '#3fbb7d',
    accentHover: '#5ed296',
    accentSubtle: 'rgba(63, 187, 125, 0.12)',
    accentLine: 'rgba(63, 187, 125, 0.4)',

    // Status
    danger: '#e5534b',
    warning: '#d99a2b',
    success: '#3fbb7d',
} as const;

// Radius — one value. All names resolve to 2px, matching web's --radius-* tokens.
export const radius = {
    xs: 2,
    sm: 2,
    md: 2,
    lg: 2,
    pill: 999,
} as const;

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
} as const;

// Loaded via @expo-google-fonts in app/_layout.tsx — see useFonts() there.
export const fonts = {
    sans: 'Outfit_400Regular',
    sansMedium: 'Outfit_500Medium',
    sansSemiBold: 'Outfit_600SemiBold',
    sansBold: 'Outfit_700Bold',
    mono: 'JetBrainsMono_400Regular',
    monoMedium: 'JetBrainsMono_500Medium',
    monoBold: 'JetBrainsMono_700Bold',
} as const;

export type Palette = typeof palette;
