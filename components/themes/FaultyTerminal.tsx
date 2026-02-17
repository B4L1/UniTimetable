
import React from 'react';
import { ThemeConfig } from './index';
import Colors from '@/constants/Colors';
// @ts-ignore
import FaultyTerminal from '@/components/FaultyTerminal.jsx';

const FaultyTerminalTheme: ThemeConfig = {
    id: 'faulty-terminal',
    name: 'Faulty Terminal',
    colors: {
        light: {
            ...Colors.light, // Probably not used much in light mode for this theme
        },
        dark: {
            ...Colors.dark,
            background: '#0a0f0a', // Dark Green/Black
            backgroundSecondary: '#0f1a0f',
            card: '#0a0f0a',
            cardBorder: '#0f380f',
            text: '#33ff33', // Terminal Green
            textSecondary: '#1a801a',
            tint: '#33ff33',
            tabIconSelected: '#33ff33',
            error: '#ff3333',
        },
    },
    borderRadius: {
        card: 0,
        button: 0,
    },
    fontFamily: {
        regular: 'SpaceMono',
        bold: 'SpaceMono',
    },
    Component: () => (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
            {/* @ts-ignore */}
            <FaultyTerminal text="SYSTEM FAILURE" />
        </div>
    ),
};

export default FaultyTerminalTheme;
