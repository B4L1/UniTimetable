
import React from 'react';
import { ThemeConfig } from './index';
import Colors from '@/constants/Colors';
// @ts-ignore
import Iridescence from '@/components/Iridescence.jsx';

const IridescenceTheme: ThemeConfig = {
    id: 'iridescence',
    name: 'Iridescence',
    colors: {
        light: {
            ...Colors.light,
            background: '#fff0f5', // Lavender blush
            tint: '#ff69b4', // Hot pink
        },
        dark: {
            ...Colors.dark,
            background: '#1a1a2e',
            backgroundSecondary: '#16213e',
            card: 'rgba(255, 255, 255, 0.1)', // Glassmorphism
            cardBorder: 'rgba(255, 105, 180, 0.3)',
            tint: '#ff69b4',
            text: '#fff',
        },
    },
    borderRadius: {
        card: 20,
        button: 20,
    },
    Component: () => (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
            <Iridescence
                color={[1, 0.5, 0.8]}
                speed={1}
                amplitude={0.1}
            />
        </div>
    ),
};

export default IridescenceTheme;
