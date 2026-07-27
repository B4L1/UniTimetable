import { describe, it, expect } from 'vitest';
import { migrateColorTheme, migrateBackgroundEffect } from '../types';

describe('migrateColorTheme (pre-v3 backgroundTheme → colorTheme)', () => {
    it('keeps an already-migrated colorTheme', () => {
        expect(migrateColorTheme({ colorTheme: 'dark-glass' })).toBe('dark-glass');
    });

    it('maps sapientia and missing values to light', () => {
        expect(migrateColorTheme({ backgroundTheme: 'sapientia' })).toBe('light');
        expect(migrateColorTheme({})).toBe('light');
        expect(migrateColorTheme(null)).toBe('light');
    });

    it('maps faulty-terminal to terminal', () => {
        expect(migrateColorTheme({ backgroundTheme: 'faulty-terminal' })).toBe('terminal');
    });

    it('maps every other old value to dark', () => {
        expect(migrateColorTheme({ backgroundTheme: 'none' })).toBe('dark');
        expect(migrateColorTheme({ backgroundTheme: 'aurora' })).toBe('dark');
        expect(migrateColorTheme({ backgroundTheme: 'liquid-chrome' })).toBe('dark');
    });
});

describe('migrateBackgroundEffect', () => {
    it('carries over old animated backgrounds as the device effect', () => {
        expect(migrateBackgroundEffect({ backgroundTheme: 'aurora' })).toBe('aurora');
        expect(migrateBackgroundEffect({ backgroundTheme: 'faulty-terminal' })).toBe('faulty-terminal');
    });

    it('maps solid themes and unknowns to none', () => {
        expect(migrateBackgroundEffect({ backgroundTheme: 'sapientia' })).toBe('none');
        expect(migrateBackgroundEffect({ backgroundTheme: 'none' })).toBe('none');
        expect(migrateBackgroundEffect({ backgroundTheme: 'silk' })).toBe('none');
        expect(migrateBackgroundEffect(null)).toBe('none');
    });
});
