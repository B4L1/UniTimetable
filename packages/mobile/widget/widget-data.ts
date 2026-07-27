// Pure logic for the home-screen widget: builds the ordered list of
// current/upcoming classes from the cached timetable.

import type { TimetableEntry } from '@unitimetable/shared';
import { getCurrentWeekParity, getSubjectColor, assignSubjectColors } from '@unitimetable/shared';

export const DAYS_HU = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek'];

export interface UpcomingClass {
    entry: TimetableEntry;
    start: Date;
    end: Date;
    isNow: boolean;
    dayLabel: string;
    color: string;
}

function timeOn(date: Date, timeStr: string): Date {
    const [h, m] = (timeStr || '0:0').split(':').map(Number);
    const d = new Date(date);
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
}

/**
 * Returns classes from `now` onward (including one currently running),
 * looking ahead up to 14 days so week parity is respected across the
 * week boundary. Sorted by start time.
 */
export function buildUpcoming(
    entries: TimetableEntry[],
    invertParity = false,
    now: Date = new Date(),
    maxItems = 10,
): UpcomingClass[] {
    if (!entries || entries.length === 0) return [];

    // Assign colors from the FULL subject set (sorted internally) so the
    // widget's colors match the app's regardless of which classes are upcoming.
    assignSubjectColors(entries.map(e => e.subject_name));

    const result: UpcomingClass[] = [];

    for (let dayOffset = 0; dayOffset <= 13 && result.length < maxItems * 2; dayOffset++) {
        const date = new Date(now);
        date.setDate(date.getDate() + dayOffset);

        const weekday = (date.getDay() + 6) % 7; // 0 = Monday
        if (weekday > 4) continue; // weekend

        const parity = getCurrentWeekParity(invertParity, date);

        for (const entry of entries) {
            if (entry.day_of_week !== weekday) continue;
            if (entry.week_type !== 'all' && entry.week_type !== parity) continue;

            const start = timeOn(date, entry.start_time);
            const end = timeOn(date, entry.end_time);
            if (end.getTime() <= now.getTime()) continue; // already over

            result.push({
                entry,
                start,
                end,
                isNow: start.getTime() <= now.getTime() && now.getTime() <= end.getTime(),
                dayLabel: dayOffset === 0 ? 'Ma' : dayOffset === 1 ? 'Holnap' : DAYS_HU[weekday],
                color: '', // filled below in stable order
            });
        }
    }

    result.sort((a, b) => a.start.getTime() - b.start.getTime());
    const sliced = result.slice(0, maxItems);

    for (const item of sliced) {
        item.color = getSubjectColor(item.entry.subject_name);
    }

    return sliced;
}

export function formatTimeRange(item: UpcomingClass): string {
    const fmt = (d: Date) =>
        `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    return `${fmt(item.start)} – ${fmt(item.end)}`;
}
