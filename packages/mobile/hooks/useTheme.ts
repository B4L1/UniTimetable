// Theme hook — returns the shared design tokens.
// (The previous version imported a '@/components/themes' module that never
// existed, which broke the build.)

import { palette, radius, spacing } from '@/constants/theme';

export const useTheme = () => {
    return { colors: palette, radius, spacing, isDark: true };
};
