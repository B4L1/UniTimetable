
import React from 'react';
import { ThemeConfig } from './index';
import Colors from '@/constants/Colors';
// @ts-ignore
import Aurora from '@/components/Aurora.jsx';

const AuroraTheme: ThemeConfig = {
    id: 'aurora',
    name: 'Aurora',
    colors: {
        light: {
            ...Colors.light,
            tint: '#10b981', // Emerald
        },
        dark: {
            ...Colors.dark,
            background: '#0c0015', // Deep purple/black
            backgroundSecondary: '#1a0033',
            card: 'rgba(20, 20, 30, 0.6)',
            cardBorder: '#2d004d',
            tint: '#00ff9d', // Bright green
            text: '#e0e0ff',
        },
    },
    borderRadius: {
        card: 18,
        button: 8,
    },
    Component: () => (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
            <Aurora
                color="#0c0015" // Base color matching background
                speed={1}
                amplitude={1}
            />
        </div>
    ),
};

export default AuroraTheme;
