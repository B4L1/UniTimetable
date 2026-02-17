
import React from 'react';
import { ThemeConfig } from './index';
import Colors from '@/constants/Colors';
// @ts-ignore
import Silk from '@/components/Silk.jsx';

const SilkTheme: ThemeConfig = {
    id: 'silk',
    name: 'Silk',
    colors: {
        light: {
            ...Colors.light,
            tint: '#6c5ce7',
            tabIconSelected: '#6c5ce7',
        },
        dark: {
            ...Colors.dark,
            background: '#0F0F15',
            card: 'rgba(25, 25, 35, 0.6)',
            cardBorder: 'rgba(108, 92, 231, 0.2)',
            tint: '#a29bfe',
            tabIconSelected: '#a29bfe',
        },
    },
    borderRadius: {
        card: 20,
        button: 20, // Rounded buttons
    },
    Component: () => (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
            {/* Adjust colors to match theme */}
            <Silk color="#1a1a2e" speed={2} />
        </div>
    ),
};

export default SilkTheme;
