// Stepper state (SPEC_V3_PLAN.md Phase 4) — persisted so the flow is
// resumable across reloads, including the last generation result (so leaving
// the wizard and returning keeps the schedules). A stored input signature
// flags when the results are stale against changed settings.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GenerationResult } from '@shared/lib/generator';

export interface GenMeta {
    combos: number;
    ms: number;
    truncated: boolean;
}

export const WIZARD_STEPS = ['Profil', 'Tárgyak', 'Preferenciák', 'Generálás', 'Véglegesítés'] as const;
export type WizardStep = 0 | 1 | 2 | 3 | 4;

export interface CourseSetting {
    included: boolean;
    optional: boolean;
}

interface WizardState {
    step: WizardStep;
    /** per-course include/optional flags, keyed by normalized course key */
    courseSettings: Record<string, CourseSetting>;
    /** "Bővített keresés" — cross-major alternatives in the option pool */
    crossMajor: boolean;

    // preferences (→ GeneratorConstraints)
    allowedDays: number[];
    earliestStart: string; // "HH:MM"
    latestEnd: string;
    wGaps: number;
    wEarly: number;
    wDays: number;

    /** chosen schedule (event ids + its explanation), survives reload */
    pickedEventIds: string[] | null;
    pickedExplanation: string | null;

    // Phase 5 smart editing (spec §A13). These mirror user_event_preferences;
    // the table is authoritative (loaded on wizard mount, written through on
    // toggle) — kept here too for reactive UI.
    lockedEventIds: string[];
    excludedEventIds: string[];

    /** last generation result, persisted so results survive navigation */
    genResult: GenerationResult | null;
    genMeta: GenMeta | null;
    /** signature of the inputs used → detect when results went stale */
    genInputSig: string | null;

    setStep: (step: WizardStep) => void;
    setCourseSetting: (courseKey: string, setting: Partial<CourseSetting>) => void;
    setCrossMajor: (v: boolean) => void;
    setAllowedDays: (days: number[]) => void;
    setTimeWindow: (earliest: string, latest: string) => void;
    setWeights: (w: { wGaps?: number; wEarly?: number; wDays?: number }) => void;
    pickSchedule: (eventIds: string[], explanation: string) => void;
    /** replace the current schedule in place (drag / improve) without leaving the step */
    updatePicked: (eventIds: string[], explanation: string) => void;
    clearPicked: () => void;
    setGeneration: (result: GenerationResult, meta: GenMeta, inputSig: string) => void;
    /** seed lock/exclude from the server (table wins over local) */
    setEventPrefs: (locked: string[], excluded: string[]) => void;
    toggleLock: (eventId: string) => void;
    toggleExclude: (eventId: string) => void;
    resetWizard: () => void;
}

const DEFAULTS = {
    step: 0 as WizardStep,
    courseSettings: {},
    crossMajor: false,
    allowedDays: [0, 1, 2, 3, 4],
    earliestStart: '08:00',
    latestEnd: '20:30',
    // 0–3 question-slider levels; the value doubles as the generator weight
    wGaps: 1,
    wEarly: 2,
    wDays: 2,
    pickedEventIds: null,
    pickedExplanation: null,
    lockedEventIds: [],
    excludedEventIds: [],
    genResult: null,
    genMeta: null,
    genInputSig: null,
};

const toggleIn = (list: string[], id: string) =>
    list.includes(id) ? list.filter(x => x !== id) : [...list, id];

export const useWizardStore = create<WizardState>()(
    persist(
        (set) => ({
            ...DEFAULTS,

            setStep: (step) => set({ step }),
            setCourseSetting: (courseKey, setting) =>
                set((s) => ({
                    courseSettings: {
                        ...s.courseSettings,
                        [courseKey]: {
                            included: true,
                            optional: false,
                            ...s.courseSettings[courseKey],
                            ...setting,
                        },
                    },
                })),
            setCrossMajor: (crossMajor) => set({ crossMajor }),
            setAllowedDays: (allowedDays) => set({ allowedDays }),
            setTimeWindow: (earliestStart, latestEnd) => set({ earliestStart, latestEnd }),
            setWeights: (w) => set((s) => ({
                wGaps: w.wGaps ?? s.wGaps,
                wEarly: w.wEarly ?? s.wEarly,
                wDays: w.wDays ?? s.wDays,
            })),
            pickSchedule: (pickedEventIds, pickedExplanation) =>
                set({ pickedEventIds, pickedExplanation, step: 4 }),
            updatePicked: (pickedEventIds, pickedExplanation) =>
                set({ pickedEventIds, pickedExplanation }),
            clearPicked: () => set({ pickedEventIds: null, pickedExplanation: null }),
            setGeneration: (genResult, genMeta, genInputSig) =>
                set({ genResult, genMeta, genInputSig }),
            setEventPrefs: (lockedEventIds, excludedEventIds) =>
                set({ lockedEventIds, excludedEventIds }),
            // An event can't be both locked and excluded — toggling one clears the other.
            toggleLock: (id) => set((s) => ({
                lockedEventIds: toggleIn(s.lockedEventIds, id),
                excludedEventIds: s.excludedEventIds.filter(x => x !== id),
            })),
            toggleExclude: (id) => set((s) => ({
                excludedEventIds: toggleIn(s.excludedEventIds, id),
                lockedEventIds: s.lockedEventIds.filter(x => x !== id),
            })),
            resetWizard: () => set({ ...DEFAULTS }),
        }),
        { name: 'uni-wizard' },
    ),
);
