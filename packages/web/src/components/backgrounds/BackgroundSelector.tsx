// Background effect renderer.
//
// v3 rules (SPEC_V3_PLAN.md B5/B9):
// - effects are device-local and OFF by default
// - every effect is a lazy chunk, fetched only when actually selected
//   (no preloading — the default bundle must stay free of three.js/ogl)
// - prefers-reduced-motion disables all effects

import React, { memo, Suspense, lazy } from 'react';
import type { BackgroundEffect } from '@shared/lib/types';
import { useBackgroundEffect, prefersReducedMotion } from '../../utils/backgroundEffect';

const Aurora = lazy(() => import('./Aurora'));
// @ts-expect-error untyped .jsx module
const LiquidChromeComponent = lazy(() => import('./LiquidChrome.jsx'));
// @ts-expect-error untyped .jsx module
const FaultyTerminalComponent = lazy(() => import('./FaultyTerminal.jsx'));
// @ts-expect-error untyped .jsx module
const IridescenceComponent = lazy(() => import('./Iridescence.jsx'));
// @ts-expect-error untyped .jsx module
const PixelBlastComponent = lazy(() => import('./PixelBlast.jsx'));

// Effect CSS is small; keeping these static keeps styling glitch-free
import './LiquidChrome.css';
import './FaultyTerminal.css';
import './Iridescence.css';
import './PixelBlast.css';

class BackgroundErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error: unknown) {
        console.error('Background component crashed:', error);
    }
    render() {
        if (this.state.hasError) {
            return <div className="background-fallback" />;
        }
        return this.props.children;
    }
}

const EFFECT_COMPONENTS: Partial<Record<BackgroundEffect, React.LazyExoticComponent<React.ComponentType>>> = {
    'aurora': Aurora,
    'liquid-chrome': LiquidChromeComponent,
    'faulty-terminal': FaultyTerminalComponent,
    'iridescence': IridescenceComponent,
    'pixel-blast': PixelBlastComponent,
};

function BackgroundSelector() {
    const effect = useBackgroundEffect();

    if (effect === 'none' || prefersReducedMotion()) return null;

    const EffectComponent = EFFECT_COMPONENTS[effect];
    if (!EffectComponent) return null;

    return (
        <Suspense fallback={<div className="background-fallback" />}>
            <BackgroundErrorBoundary key={effect}>
                <div className="background-container">
                    <EffectComponent />
                </div>
            </BackgroundErrorBoundary>
        </Suspense>
    );
}

export default memo(BackgroundSelector);
