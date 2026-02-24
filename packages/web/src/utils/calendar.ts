/**
 * Utility functions for academic calendar calculations
 * Based on Sapientia EMTE 2025/2026 Calendar
 */

// Semester 1
const SEM1_START = new Date('2025-09-15');
const SEM1_END = new Date('2025-12-21');

// Semester 1 Breaks
const BREAK1_START = new Date('2025-12-22');
const BREAK1_END = new Date('2026-01-04');

// Exams
const EXAM1_START = new Date('2026-01-05');
const EXAM1_END = new Date('2026-02-15');

// Semester 2
const SEM2_START = new Date('2026-02-16');
const SEM2_END = new Date('2026-05-31');

// Semester 2 Breaks
const BREAK2_START = new Date('2026-04-06');
const BREAK2_END = new Date('2026-04-12');

export type WeekType = 'odd' | 'even' | 'break' | 'out_of_term';

export interface AcademicWeek {
    semester: number;
    weekNum: number;
    type: WeekType;
}

/**
 * Calculates the current academic week according to the official calendar
 * Returns whether it's an odd/even teaching week, a break, or out of term.
 */
export function getAcademicWeek(date: Date = new Date()): AcademicWeek {
    const time = date.getTime();

    // Sem 1
    if (time >= SEM1_START.getTime() && time <= SEM1_END.getTime()) {
        const diffDays = Math.floor((time - SEM1_START.getTime()) / (1000 * 60 * 60 * 24));
        const weekNum = Math.floor(diffDays / 7) + 1;
        return { semester: 1, weekNum, type: weekNum % 2 !== 0 ? 'odd' : 'even' };
    }

    // Sem 2
    if (time >= SEM2_START.getTime() && time <= SEM2_END.getTime()) {
        // Are we active in the break?
        if (time >= BREAK2_START.getTime() && time <= BREAK2_END.getTime()) {
            return { semester: 2, weekNum: 0, type: 'break' };
        }

        // Calculate weeks before the break 
        // We use Math.min so that if time is AFTER the break, we accurately cap the before limit to the break start.
        const daysBeforeBreak = Math.max(0, Math.floor((Math.min(time, BREAK2_START.getTime()) - SEM2_START.getTime()) / (1000 * 60 * 60 * 24)));
        const weeksBeforeBreak = Math.floor(daysBeforeBreak / 7);

        // Calculate teaching weeks after the break
        let weeksAfterBreak = 0;
        if (time > BREAK2_END.getTime()) {
            // Count days starting exactly from the end of the break
            const daysAfterBreak = Math.floor((time - BREAK2_END.getTime() - (1000 * 60 * 60 * 24)) / (1000 * 60 * 60 * 24));
            weeksAfterBreak = Math.floor(daysAfterBreak / 7) + 1;
        }

        const weekNum = weeksBeforeBreak + weeksAfterBreak + 1;
        return { semester: 2, weekNum, type: weekNum % 2 !== 0 ? 'odd' : 'even' };
    }

    // Anything else (Winter break, Exams, Summer break)
    return { semester: 0, weekNum: 0, type: 'out_of_term' };
}
