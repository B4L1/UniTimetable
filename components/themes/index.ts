
import { BackgroundTheme } from '@/stores/appStore';
import Colors from '@/constants/Colors';
import React from 'react';
import { View } from 'react-native';

// Use the existing Colors structure as the base for our theme colors
type ColorScheme = typeof Colors.dark;

export interface ThemeConfig {
    id: BackgroundTheme;
    name: string;
    colors: {
        light: ColorScheme;
        dark: ColorScheme;
    };
    borderRadius: {
        card: number;
        button: number;
        // Add more specific radiuses if needed
    };
    fontFamily?: {
        // We can expand this later as we identify font needs
        regular: string;
        bold: string;
    };
    // The background component to render
    Component: React.ComponentType<any>;
}

// Default fallback theme (None)
const DefaultThemeConfig: ThemeConfig = {
    id: 'none',
    name: 'Nincs',
    colors: Colors,
    borderRadius: {
        card: 12, // Maintain current default
        button: 10,
    },
    Component: () => null, // No background
};

import LiquidChromeTheme from './LiquidChrome';
import SilkTheme from './Silk';
import AuroraTheme from './Aurora';
import PlasmaTheme from './Plasma';
import PixelBlastTheme from './PixelBlast';
import BeamsTheme from './Beams';
import DitherTheme from './Dither';
import FaultyTerminalTheme from './FaultyTerminal';
import IridescenceTheme from './Iridescence';

// Registry of all themes
export const themes: Record<BackgroundTheme, ThemeConfig> = {
    'none': DefaultThemeConfig,
    'silk': SilkTheme,
    'aurora': AuroraTheme,
    'plasma': PlasmaTheme,
    'pixel-blast': PixelBlastTheme,
    'beams': BeamsTheme,
    'dither': DitherTheme,
    'faulty-terminal': FaultyTerminalTheme,
    'iridescence': IridescenceTheme,
    'liquid-chrome': LiquidChromeTheme,
};

export const getTheme = (id: BackgroundTheme): ThemeConfig => {
    return themes[id] || themes['none'];
};
