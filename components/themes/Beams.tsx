
import React from 'react';
import { ThemeConfig } from './index';
import Colors from '@/constants/Colors';
// @ts-ignore
import Beams from '@/components/Beams.jsx';

const BeamsTheme: ThemeConfig = {
    id: 'beams',
    name: 'Beams',
    colors: {
        light: {
            ...Colors.light,
            tint: '#8a2be2',
        },
        dark: {
            ...Colors.dark,
            background: '#0a0a0a',
            backgroundSecondary: '#151515',
            card: 'rgba(20, 20, 20, 0.8)',
            cardBorder: '#8a2be2',
            tint: '#8a2be2', // BlueViolet
            text: '#e0e0e0',
        },
    },
    borderRadius: {
        card: 12,
        button: 12,
    },
    Component: () => (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
            <Beams />
        </div>
    ),
};

export default BeamsTheme;
