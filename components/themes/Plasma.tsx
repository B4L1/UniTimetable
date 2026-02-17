
import React from 'react';
import { ThemeConfig } from './index';
import Colors from '@/constants/Colors';
// @ts-ignore
import Plasma from '@/components/Plasma.jsx';

const PlasmaTheme: ThemeConfig = {
    id: 'plasma',
    name: 'Plasma',
    colors: {
        light: {
            ...Colors.light,
            tint: '#d63384',
        },
        dark: {
            ...Colors.dark,
            background: '#1a0a2e',
            backgroundSecondary: '#2d1b4e',
            card: 'rgba(40, 20, 60, 0.6)',
            cardBorder: '#ff0080',
            tint: '#ff0080', // Hot pink
            accent: '#00d4ff', // Cyan
        },
    },
    borderRadius: {
        card: 24, // Very rounded
        button: 24,
    },
    Component: () => (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
            <Plasma />
        </div>
    ),
};

export default PlasmaTheme;
