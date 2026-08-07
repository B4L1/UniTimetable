// Academic calendar calculations — single source of truth for web, mobile and the widget.
// Based on the Sapientia EMTE 2025/2026 calendar.
// NOTE: update these dates each academic year (or move them to Supabase config).

// Semester 1
const SEM1_START = new Date('2025-09-15');
const SEM1_END = new Date('2025-12-21');

// Semester 2
const SEM2_START = new Date('2026-02-16');
const SEM2_END = new Date('2026-05-31');

// Semester 2 spring break
const BREAK2_START = new Date('2026-04-06');
const BREAK2_END = new Date('2026-04-12');

export interface SemesterBounds {
    semester: 1 | 2;
    start: Date;
    end: Date;
}

/** Exported so callers that need an actual date range (ICS export's
 *  recurrence UNTIL, anchoring odd/even parity) don't re-derive it — this
 *  file stays the one place that knows the semester dates. */
export const SEMESTERS: readonly SemesterBounds[] = [
    { semester: 1, start: SEM1_START, end: SEM1_END },
    { semester: 2, start: SEM2_START, end: SEM2_END },
];

export type WeekType = 'odd' | 'even' | 'break' | 'out_of_term';

export interface AcademicWeek {
    semester: number;
    weekNum: number;
    type: WeekType;
}

/**
 * Calculates the current academic week according to the official calendar.
 * Returns whether it's an odd/even teaching week, a break, or out of term.
 */
export function getAcademicWeek(date: Date = new Date()): AcademicWeek {
    const time = date.getTime();

    // Semester 1
    if (time >= SEM1_START.getTime() && time <= SEM1_END.getTime()) {
        const diffDays = Math.floor((time - SEM1_START.getTime()) / (1000 * 60 * 60 * 24));
        const weekNum = Math.floor(diffDays / 7) + 1;
        return { semester: 1, weekNum, type: weekNum % 2 !== 0 ? 'odd' : 'even' };
    }

    // Semester 2
    if (time >= SEM2_START.getTime() && time <= SEM2_END.getTime()) {
        if (time >= BREAK2_START.getTime() && time <= BREAK2_END.getTime()) {
            return { semester: 2, weekNum: 0, type: 'break' };
        }

        const daysBeforeBreak = Math.max(0, Math.floor((Math.min(time, BREAK2_START.getTime()) - SEM2_START.getTime()) / (1000 * 60 * 60 * 24)));
        const weeksBeforeBreak = Math.floor(daysBeforeBreak / 7);

        let weeksAfterBreak = 0;
        if (time > BREAK2_END.getTime()) {
            const daysAfterBreak = Math.floor((time - BREAK2_END.getTime() - (1000 * 60 * 60 * 24)) / (1000 * 60 * 60 * 24));
            weeksAfterBreak = Math.floor(daysAfterBreak / 7) + 1;
        }

        const weekNum = weeksBeforeBreak + weeksAfterBreak + 1;
        return { semester: 2, weekNum, type: weekNum % 2 !== 0 ? 'odd' : 'even' };
    }

    return { semester: 0, weekNum: 0, type: 'out_of_term' };
}

/**
 * Convenience: current teaching-week parity with optional user inversion.
 * Falls back to 'odd' during breaks / out of term so week-specific entries
 * still render deterministically.
 */
export function getCurrentWeekParity(invert = false, date: Date = new Date()): 'odd' | 'even' {
    const week = getAcademicWeek(date);
    let parity: 'odd' | 'even' = week.type === 'even' ? 'even' : 'odd';
    if (invert) parity = parity === 'odd' ? 'even' : 'odd';
    return parity;
}
