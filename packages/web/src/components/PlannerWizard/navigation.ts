// Step-advance rules for the wizard footer's "Tovább" button — pulled out of
// PlannerWizard.tsx as a pure function so the exact bug this was built to
// prevent (regenerating a schedule and being able to click past it with
// nothing picked, landing on a dead-end "Még nem választottál órarendet."
// screen) can be pinned with a plain unit test instead of a full component
// render.
import type { WizardStep, CourseSetting } from './wizardStore';

export interface CanAdvanceContext {
    hasSelectedClass: boolean;
    includedCourseCount: number;
    courseSettings: Record<string, CourseSetting>;
    pickedEventIds: string[] | null;
}

/**
 * Whether the wizard may move past step `s` to the next one.
 *  - 0 (Profil): a class must be selected.
 *  - 1 (Tárgyak): at least one course must still be included.
 *  - 3 (Generálás): a schedule must be picked. Picking a card jumps straight
 *    to step 4 on its own (wizardStore.pickSchedule sets step: 4 as part of
 *    the same action), so the footer's generic "Tovább" button is only ever
 *    visible on this step when NOTHING has been picked yet — it must stay
 *    disabled then, or it strands you on step 5 with pickedEventIds still
 *    null.
 * Every other step has no extra precondition of its own.
 */
export function canAdvanceFromStep(s: WizardStep, ctx: CanAdvanceContext): boolean {
    if (s === 0) return ctx.hasSelectedClass;
    if (s === 1) {
        return ctx.includedCourseCount > 0 &&
            Object.values(ctx.courseSettings).filter(c => !c.included).length < ctx.includedCourseCount;
    }
    // Not just `!!ctx.pickedEventIds` — an empty array is truthy in JS, and
    // an empty pick shouldn't count as "a schedule was chosen".
    if (s === 3) return !!ctx.pickedEventIds?.length;
    return true;
}
