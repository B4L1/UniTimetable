// Convert TimetableEntry rows into generator units.
//
// Unit = (course, type): "Osztott rendszerek" lecture and "Osztott rendszerek"
// lab are chosen independently. Option = all of one cohort's events for that
// unit — matching how the app works today: you attend a class's section as a
// whole. (Finer subgroup/parity splitting is a Phase 4 refinement; until then
// the manual week-type override covers it.)

import { TimetableEntry, EventType } from '../types';
import { getBaseSubjectName } from '../colors';
import { GenEvent, GenOption, GenUnit } from './types';

const SUFFIX_PATTERN = /\s+(e\.a\.|gyak\.|szem\.|lab\.|koll\.)$/i;

/** Base subject name for display: suffix stripped, original casing kept. */
export function getDisplayBaseName(subjectName: string): string {
    return subjectName.trim().replace(SUFFIX_PATTERN, '').trim();
}

/** Derive the event type from the Hungarian subject suffix. */
export function getTypeFromSubjectName(subjectName: string): EventType {
    const name = subjectName.trim();
    if (/\se\.a\.$/i.test(name)) return 'lecture';
    if (/\s(gyak|lab)\.$/i.test(name)) return 'lab';
    if (/\sszem\.$/i.test(name)) return 'seminar';
    return 'other';
}

/** "16:30:00" | "16:30" → minutes from midnight. */
export function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

export interface BuildUnitsConfig {
    /**
     * Course keys (normalized base names, see getBaseSubjectName) to include.
     * Default: every course present in the entries.
     */
    includedCourses?: string[];
    /** Course keys the user marked optional; everything else is required. */
    optionalCourses?: string[];
    /**
     * The user's own cohort. When several groups share the identical class
     * (a lecture held for the whole year — same day/time/room/teacher, stored
     * once per group), the duplicates collapse to ONE option; the home group's
     * copy is kept as the representative so the saved entry is "theirs".
     */
    homeClassId?: string;
}

interface EntryLike extends Partial<TimetableEntry> {
    id: string;
    subject_name: string;
    class_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    week_type: 'all' | 'odd' | 'even';
    class_name?: string;
}

/**
 * Content signature of one group's option: what the class actually IS,
 * independent of which group's timetable it was scraped into. A lecture held
 * for groups A/B/C produces three options with the identical signature; they
 * are the same physical class and must not be enumerated as alternatives.
 * Room/teacher are included so genuinely different same-time sessions (two
 * labs at 10:00 in different rooms) stay distinct.
 */
function optionContentSig(events: { key: string }[]): string {
    return events.map(e => e.key).sort().join('§');
}

export function buildUnitsFromEntries(
    entries: readonly EntryLike[],
    config: BuildUnitsConfig = {},
): GenUnit[] {
    const included = config.includedCourses ? new Set(config.includedCourses) : null;
    const optional = new Set(config.optionalCourses ?? []);

    // unitId → classId → { events, per-event content keys }
    const unitMap = new Map<string, {
        courseKey: string;
        courseName: string;
        type: EventType;
        byClass: Map<string, { className?: string; events: GenEvent[]; keys: { key: string }[] }>;
    }>();

    for (const entry of entries) {
        const courseKey = getBaseSubjectName(entry.subject_name);
        if (included && !included.has(courseKey)) continue;

        const type = entry.event_type ?? getTypeFromSubjectName(entry.subject_name);
        const unitId = `${courseKey}|${type}`;

        let unit = unitMap.get(unitId);
        if (!unit) {
            unit = {
                courseKey,
                courseName: getDisplayBaseName(entry.subject_name),
                type,
                byClass: new Map(),
            };
            unitMap.set(unitId, unit);
        }

        let option = unit.byClass.get(entry.class_id);
        if (!option) {
            option = { className: entry.class_name, events: [], keys: [] };
            unit.byClass.set(entry.class_id, option);
        }
        const startMin = timeToMinutes(entry.start_time);
        const endMin = timeToMinutes(entry.end_time);
        option.events.push({
            id: entry.id,
            day: entry.day_of_week,
            startMin,
            endMin,
            weekType: entry.week_type,
        });
        const room = (entry.classroom ?? '').trim();
        const teacher = (entry.teacher_name ?? '').trim();
        option.keys.push({
            key: `${entry.day_of_week}|${startMin}|${endMin}|${entry.week_type}|${room}|${teacher}`,
        });
    }

    const units: GenUnit[] = [];
    for (const [unitId, unit] of unitMap) {
        // Order groups so the home cohort is seen first — it becomes the
        // representative of any shared class, and later duplicates are dropped.
        const classIds = [...unit.byClass.keys()].sort((a, b) => {
            if (a === config.homeClassId) return -1;
            if (b === config.homeClassId) return 1;
            return a < b ? -1 : a > b ? 1 : 0;
        });

        const bySig = new Map<string, GenOption>();
        for (const classId of classIds) {
            const opt = unit.byClass.get(classId)!;
            const sig = optionContentSig(opt.keys);
            if (bySig.has(sig)) continue; // same physical class as an earlier group
            const sortedIds = opt.events.map(e => e.id).sort();
            bySig.set(sig, {
                id: sortedIds.join('+'),
                classId,
                className: opt.className,
                events: opt.events,
            });
        }

        units.push({
            id: unitId,
            courseKey: unit.courseKey,
            courseName: unit.courseName,
            type: unit.type,
            required: !optional.has(unit.courseKey),
            options: [...bySig.values()],
        });
    }
    return units;
}
