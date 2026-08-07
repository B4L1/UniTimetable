// The university's fixed 2-hour teaching slots and weekday list — the one
// piece of domain data that Timetable.tsx, Planner.tsx, ScheduleGrid.tsx and
// export.tsx (web) all need to lay out a grid, and previously each kept its
// own copy of. That already caused a real bug: the PNG export's copy drifted
// out of sync with the live grid's design because there was no single place
// to change. See computeSlotSpan below for the other half of the
// duplication — the overlap math each of those files also re-implemented.
import { timeToMinutes } from './generator';

export interface TimeSlotDef {
    /** e.g. "1-2" */
    label: string;
    /** "HH:MM" */
    start: string;
    /** "HH:MM" */
    end: string;
}

export const TIME_SLOTS: readonly TimeSlotDef[] = [
    { label: '1-2', start: '08:00', end: '09:50' },
    { label: '3-4', start: '10:00', end: '11:50' },
    { label: '5-6', start: '12:30', end: '14:20' },
    { label: '7-8', start: '14:30', end: '16:20' },
    { label: '9-10', start: '16:30', end: '18:20' },
    { label: '11-12', start: '18:30', end: '20:20' },
];

/** Monday–Saturday. Saturday (index 5) only shows up in a grid when the
 *  displayed data actually has a Saturday entry — see `hasSaturday` callers. */
export const DAY_NAMES = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'] as const;

/**
 * Which slots (by index into TIME_SLOTS) a [start, end) time range overlaps,
 * and how many rows that spans. Returns null if it doesn't touch any slot.
 *
 * This is the exact overlap test — `Math.max(entryStart, slotStart) <
 * Math.min(entryEnd, slotEnd)` — that Timetable.tsx, Planner.tsx and
 * export.tsx each carried their own copy of.
 */
export function computeSlotSpan(
    entryStart: string,
    entryEnd: string,
    slots: readonly TimeSlotDef[] = TIME_SLOTS,
): { startSlot: number; span: number } | null {
    const entryStartMin = timeToMinutes(entryStart);
    const entryEndMin = timeToMinutes(entryEnd);

    let startSlot = -1;
    let endSlot = -1;
    slots.forEach((slot, i) => {
        const slotStart = timeToMinutes(slot.start);
        const slotEnd = timeToMinutes(slot.end);
        if (Math.max(entryStartMin, slotStart) < Math.min(entryEndMin, slotEnd)) {
            if (startSlot === -1) startSlot = i;
            endSlot = i;
        }
    });

    if (startSlot === -1) return null;
    return { startSlot, span: endSlot - startSlot + 1 };
}
