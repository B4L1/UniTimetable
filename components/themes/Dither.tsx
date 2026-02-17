
import React from 'react';
import { ThemeConfig } from './index';
import Colors from '@/constants/Colors';
// @ts-ignore
import Dither from '@/components/Dither.jsx';

const DitherTheme: ThemeConfig = {
    id: 'dither',
    name: 'Dither',
    colors: {
        light: {
            ...Colors.light,
            background: '#f0f0f0',
            text: '#111',
        },
        dark: {
            ...Colors.dark,
            background: '#111',
            card: '#222',
            cardBorder: '#444',
            text: '#fff',
            tint: '#fff', // Monochrome tint
            tabIconSelected: '#fff',
        },
    },
    borderRadius: {
        card: 4, // Slightly rounded
        button: 4,
    },
    Component: () => (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
            {/* Dither component usually takes full screen canvas */}
            <Dither />
        </div>
    ),
};

export default DitherTheme;
