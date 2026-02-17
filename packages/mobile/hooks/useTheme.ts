
import { useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { getTheme, ThemeConfig } from '@/components/themes';
import Colors from '@/constants/Colors';

export const useTheme = () => {
    const { preferences } = useAppStore();

    const activeThemeId = preferences.backgroundTheme;
    const isDark = preferences.theme === 'dark'; // 'dark' | 'light'

    const themeConfig = useMemo(() => {
        return getTheme(activeThemeId);
    }, [activeThemeId]);

    // Merge the specific color mode (light/dark) from the theme
    const activeColors = isDark ? themeConfig.colors.dark : themeConfig.colors.light;

    return {
        ...themeConfig,
        colors: activeColors, // This overrides the full 'colors' object with just the active flat list
        isDark,
    };
};
