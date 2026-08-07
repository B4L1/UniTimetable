// Ambient background — DEVICE-LOCAL preference.
//
// Still device-local rather than synced: the background is a matter of where
// you're sitting, not who you are, and someone may well want the grid on a
// large monitor and nothing on a phone.
//
// v4: the ambients are CSS textures (see components/backgrounds/), so the old
// performance warning is gone — there is nothing left to be slow. Anything
// still stored under a retired WebGL effect id fails the VALID check below and
// falls back to 'none'.

import { useSyncExternalStore } from 'react';
import type { BackgroundEffect } from '@shared/lib/types';

const STORAGE_KEY = 'uni-bg-effect';

const VALID: BackgroundEffect[] = ['none', 'grid', 'dots', 'scan'];

export function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined'
        && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export function getBackgroundEffect(): BackgroundEffect {
    const stored = localStorage.getItem(STORAGE_KEY) as BackgroundEffect | null;
    return stored && VALID.includes(stored) ? stored : 'none';
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
