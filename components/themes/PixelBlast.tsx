
import React from 'react';
import { ThemeConfig } from './index';
import Colors from '@/constants/Colors';
// @ts-ignore
import PixelBlast from '@/components/PixelBlast.jsx';

const PixelBlastTheme: ThemeConfig = {
    id: 'pixel-blast',
    name: 'Pixel Blast',
    colors: {
        light: {
            ...Colors.light,
            tint: '#000',
        },
        dark: {
            ...Colors.dark,
            background: '#0d0d0d',
            backgroundSecondary: '#1a1a1a',
            card: '#000000',
            cardBorder: '#33ff00', // Retro Green
            tint: '#33ff00',
            text: '#33ff00',
            textSecondary: '#1a8000',
        },
    },
    borderRadius: {
        card: 0, // Sharp corners
        button: 0,
    },
    fontFamily: {
        regular: 'SpaceMono', // We have this font
        bold: 'SpaceMono',
    },
    Component: () => (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
            {/* @ts-ignore */}
            <PixelBlast />
        </div>
    ),
};

export default PixelBlastTheme;
