// Background selector - renders the appropriate background based on theme

import React, { memo, Suspense, lazy, useEffect } from 'react';
import type { BackgroundTheme } from '@shared/lib/types';

const Aurora = lazy(() => import('./Aurora'));
const Silk = lazy(() => import('./Silk'));
// @ts-ignore
const LiquidChromeComponent = lazy(() => import('./LiquidChrome.jsx'));
// @ts-ignore
// @ts-ignore
const BeamsComponent = lazy(() => import('./Beams'));
// @ts-ignore
const DitherComponent = lazy(() => import('./Dither'));
// @ts-ignore
const FaultyTerminalComponent = lazy(() => import('./FaultyTerminal.jsx'));
// @ts-ignore
const IridescenceComponent = lazy(() => import('./Iridescence.jsx'));
// @ts-ignore
const PixelBlastComponent = lazy(() => import('./PixelBlast.jsx'));

// Import CSS for React Bits components
import './LiquidChrome.css';
import './Beams.css';
import './Dither.css';
import './FaultyTerminal.css';
import './Iridescence.css';
import './PixelBlast.css';

interface BackgroundSelectorProps {
    theme: BackgroundTheme;
}

function AuroraBg() {
    return (
        <div className="background-container">
            <Aurora />
        </div>
    );
}

function SilkBg() {
    return (
        <div className="background-container">
            <Silk />
        </div>
    );
}

// Wrapper components to add full-screen positioning
function LiquidChrome() {
    return (
        <div className="background-container">
            <LiquidChromeComponent />
        </div>
    );
}

function Beams() {
    return (
        <div className="background-container">
            <BeamsComponent />
        </div>
    );
}

function Dither() {
    return (
        <div className="background-container">
            <DitherComponent />
        </div>
    );
}

function FaultyTerminal() {
    return (
        <div className="background-container">
            <FaultyTerminalComponent />
        </div>
    );
}

function Iridescence() {
    return (
        <div className="background-container">
            <IridescenceComponent />
        </div>
    );
}

function PixelBlast() {
    return (
        <div className="background-container">
            <PixelBlastComponent />
        </div>
    );
}

// Plasma wrapper removed

class BackgroundErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error: any) {
        console.error("Background component crashed:", error);
    }
    render() {
        if (this.state.hasError) {
            return <div className="background-fallback" />;
        }
        return this.props.children;
    }
}

function BackgroundSelector({ theme }: BackgroundSelectorProps) {
    useEffect(() => {
        void import('./Aurora');
        void import('./Silk');
        void import('./LiquidChrome.jsx');
        void import('./Beams');
        void import('./Dither');
        void import('./FaultyTerminal.jsx');
        void import('./Iridescence.jsx');
        void import('./PixelBlast.jsx');
    }, []);

    const renderBackground = () => {
        switch (theme) {
            case 'aurora':
                return <AuroraBg />;

            case 'silk':
                return <SilkBg />;
            case 'beams':
                return <Beams />;
            case 'iridescence':
                return <Iridescence />;
            case 'liquid-chrome':
                return <LiquidChrome />;
            case 'pixel-blast':
                return <PixelBlast />;
            case 'dither':
                return <Dither />;
            case 'faulty-terminal':
                return <FaultyTerminal />;
            default:
                return null;
        }
    };

    return (
        <Suspense fallback={<div className="background-fallback" />}>
            <BackgroundErrorBoundary key={theme}>
                {renderBackground()}
            </BackgroundErrorBoundary>
        </Suspense>
    );
}

export default memo(BackgroundSelector);
