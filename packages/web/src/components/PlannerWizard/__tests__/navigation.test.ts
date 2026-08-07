import { describe, it, expect } from 'vitest';
import { canAdvanceFromStep, type CanAdvanceContext } from '../navigation';

const baseCtx: CanAdvanceContext = {
    hasSelectedClass: true,
    includedCourseCount: 3,
    courseSettings: {},
    pickedEventIds: null,
};

describe('canAdvanceFromStep', () => {
    it('step 0 (Profil): requires a selected class', () => {
        expect(canAdvanceFromStep(0, { ...baseCtx, hasSelectedClass: false })).toBe(false);
        expect(canAdvanceFromStep(0, { ...baseCtx, hasSelectedClass: true })).toBe(true);
    });

    it('step 1 (Tárgyak): requires at least one course still included', () => {
        expect(canAdvanceFromStep(1, { ...baseCtx, includedCourseCount: 0 })).toBe(false);
        expect(canAdvanceFromStep(1, {
            ...baseCtx,
            includedCourseCount: 3,
            courseSettings: { a: { included: false, optional: false }, b: { included: false, optional: false }, c: { included: false, optional: false } },
        })).toBe(false);
        expect(canAdvanceFromStep(1, {
            ...baseCtx,
            includedCourseCount: 3,
            courseSettings: { a: { included: true, optional: false }, b: { included: false, optional: false } },
        })).toBe(true);
    });

    it('step 3 (Generálás): regression — must NOT allow advancing without a picked schedule', () => {
        // This is the actual bug: clicking the generic "Tovább" button on the
        // Generálás screen without picking any of the generated schedule cards
        // used to be allowed, landing on step 5 with pickedEventIds still null
        // ("Még nem választottál órarendet.") and no way forward but back.
        expect(canAdvanceFromStep(3, { ...baseCtx, pickedEventIds: null })).toBe(false);
        expect(canAdvanceFromStep(3, { ...baseCtx, pickedEventIds: [] })).toBe(false);
        expect(canAdvanceFromStep(3, { ...baseCtx, pickedEventIds: ['event-1', 'event-2'] })).toBe(true);
    });

    it('steps with no extra precondition (2: Preferenciák) always allow advancing', () => {
        expect(canAdvanceFromStep(2, baseCtx)).toBe(true);
    });
});
