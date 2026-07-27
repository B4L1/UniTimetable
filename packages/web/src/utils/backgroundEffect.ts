// Animated background effect — DEVICE-LOCAL preference.
//
// Deliberately not synced to Supabase: enabling a heavy WebGL background on a
// desktop must never slow down the same account's phone. Off by default,
// lazy-loaded on selection, force-disabled under prefers-reduced-motion.

import { useSyncExternalStore } from 'react';
import type { BackgroundEffect } from '@shared/lib/types';

const STORAGE_KEY = 'uni-bg-effect';
/** Set once the user has acknowledged the performance warning. */
const WARNING_ACK_KEY = 'uni-bg-effect-warning-ack';

const VALID: BackgroundEffect[] = [
    'none', 'aurora', 'pixel-blast', 'iridescence', 'liquid-chrome', 'faulty-terminal',
];

export function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined'
        && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export function getBackgroundEffect(): BackgroundEffect {
    const stored = localStorage.getItem(STORAGE_KEY) as BackgroundEffect | null;
    return stored && VALID.includes(stored) ? stored : 'none';
}

export function hasAcknowledgedPerfWarning(): boolean {
    return localStorage.getItem(WARNING_ACK_KEY) === '1';
}

export function acknowledgePerfWarning(): void {
    localStorage.setItem(WARNING_ACK_KEY, '1');
}

// -- Tiny external store so any component can subscribe to effect changes -----

const listeners = new Set<() => void>();

export function setBackgroundEffect(effect: BackgroundEffect): void {
    if (effect === 'none') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, effect);
    listeners.forEach(l => l());
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** React hook: current device-local background effect. */
export function useBackgroundEffect(): BackgroundEffect {
    return useSyncExternalStore(subscribe, getBackgroundEffect, () => 'none' as BackgroundEffect);
}
