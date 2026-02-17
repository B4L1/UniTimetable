// Animated backgrounds for timetable
// Uses direct DOM manipulation for CSS animations on web

import { useEffect, useRef } from 'react';
import { View, Platform } from 'react-native';
import { BackgroundTheme } from '@/stores/appStore';

interface AnimatedBackgroundProps {
    theme: BackgroundTheme;
}

const backgroundStyles: Record<string, string> = {
    aurora: `
        background: linear-gradient(135deg, #0c0015 0%, #1a0033 25%, #0d1b2a 50%, #1b263b 75%, #0c0015 100%);
        background-size: 400% 400%;
        animation: aurora 15s ease infinite;
    `,
    silk: `
        background: linear-gradient(45deg, #1a1a2e 0%, #16213e 25%, #0f3460 50%, #1a1a2e 75%, #16213e 100%);
        background-size: 400% 400%;
        animation: silk 20s ease infinite;
    `,
    plasma: `
        background: radial-gradient(ellipse at 20% 80%, #4a0080 0%, transparent 50%), 
                    radial-gradient(ellipse at 80% 20%, #00d4ff 0%, transparent 50%), 
                    radial-gradient(ellipse at 50% 50%, #ff0080 0%, transparent 60%), 
                    linear-gradient(180deg, #0a0a1a 0%, #1a0a2e 100%);
        animation: plasma 10s ease-in-out infinite;
    `,
    'pixel-blast': `
        background-color: #0d0d0d;
        background-image: radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px);
        background-size: 20px 20px;
        animation: pixelBlast 3s steps(5) infinite;
    `,
    beams: `
        background: linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 100%);
        background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(138, 43, 226, 0.08) 10px, rgba(138, 43, 226, 0.08) 20px);
        animation: beams 8s linear infinite;
    `,
    dither: `
        background-color: #0d0d1a;
        background-image: radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 2px);
        background-size: 4px 4px;
    `,
    'faulty-terminal': `
        background: linear-gradient(180deg, #0a0f0a 0%, #0d1a0d 50%, #0a0f0a 100%);
        animation: terminal 0.15s steps(2) infinite;
    `,
    iridescence: `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%);
        background-size: 400% 400%;
        animation: iridescence 8s ease infinite;
        opacity: 0.2;
    `,
    'liquid-chrome': `
        background: linear-gradient(135deg, #2c3e50 0%, #4ca1af 25%, #c4e0e5 50%, #4ca1af 75%, #2c3e50 100%);
        background-size: 400% 400%;
        animation: liquidChrome 10s ease infinite;
        opacity: 0.25;
    `,
};

// Inject keyframes once
if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const existingStyle = document.getElementById('animated-bg-keyframes');
    if (!existingStyle) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'animated-bg-keyframes';
        styleSheet.textContent = `
            @keyframes aurora {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
            }
            @keyframes silk {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
            }
            @keyframes plasma {
                0%, 100% { filter: hue-rotate(0deg); }
                50% { filter: hue-rotate(30deg); }
            }
            @keyframes pixelBlast {
                0%, 100% { background-position: 0px 0px; }
                25% { background-position: 10px 10px; }
                50% { background-position: 0px 20px; }
                75% { background-position: -10px 10px; }
            }
            @keyframes beams {
                0% { background-position: 0 0; }
                100% { background-position: 40px 40px; }
            }
            @keyframes terminal {
                0%, 49% { opacity: 1; }
                50%, 100% { opacity: 0.97; }
            }
            @keyframes iridescence {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
            }
            @keyframes liquidChrome {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
            }
        `;
        document.head.appendChild(styleSheet);
    }
}

export default function AnimatedBackground({ theme }: AnimatedBackgroundProps) {
    const containerRef = useRef<View>(null);

    useEffect(() => {
        if (Platform.OS === 'web' && containerRef.current && theme !== 'none') {
            // Get the DOM node and apply styles directly
            const node = containerRef.current as unknown as HTMLElement;
            if (node && backgroundStyles[theme]) {
                node.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: -1;
                    pointer-events: none;
                    ${backgroundStyles[theme]}
                `;
            }
        }
    }, [theme]);

    if (theme === 'none') {
        return null;
    }

    if (Platform.OS !== 'web') {
        return null;
    }

    return (
        <View
            ref={containerRef}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: -1,
            }}
        />
    );
}
