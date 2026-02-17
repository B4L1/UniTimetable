
import React from 'react';
import { ThemeConfig } from './index';
import Colors from '@/constants/Colors';
// @ts-ignore
import LiquidChrome from '@/components/LiquidChrome.jsx';

const LiquidChromeTheme: ThemeConfig = {
    id: 'liquid-chrome',
    name: 'Liquid Chrome',
    colors: {
        light: {
            ...Colors.light,
            background: '#e0e0e0',
            backgroundSecondary: '#f5f5f5',
            card: 'rgba(255, 255, 255, 0.8)',
            cardBorder: '#bdc3c7',
            text: '#2c3e50',
            tint: '#2980b9',
            tabIconSelected: '#2980b9',
        },
        dark: {
            ...Colors.dark,
            background: '#0a0a12', // Slightly bluish dark
            backgroundSecondary: '#151520',
            card: 'rgba(30, 30, 40, 0.7)',
            cardBorder: '#34495e',
            text: '#ecf0f1',
            tint: '#3498db',
            tabIconSelected: '#3498db',
        },
    },
    borderRadius: {
        card: 16,
        button: 12,
    },
    Component: () => (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
            <LiquidChrome
                baseColor={[0.1, 0.1, 0.2]}
                speed={0.4}
                amplitude={0.3}
                interactive={true}
            />
        </div>
    ),
};

export default LiquidChromeTheme;
