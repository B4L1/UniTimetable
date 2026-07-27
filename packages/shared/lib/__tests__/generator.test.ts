import { describe, it, expect } from 'vitest';
import {
    paritiesIntersect,
    eventsConflict,
    optionsConflict,
} from '../generator/overlap';
import { weekStats, weekView, computeScheduleStats } from '../generator/score';
import {
    buildUnitsFromEntries,
    getTypeFromSubjectName,
    getDisplayBaseName,
    timeToMinutes,
} from '../generator/build';
import { generateSchedules, generateFromEntries } from '../generator/generate';
import { DEFAULT_WEIGHTS, GenEvent, GenUnit, WeekParity } from '../generator/types';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

let nextId = 0;
function ev(day: number, start: string, end: string, weekType: WeekParity = 'all', id?: string): GenEvent {
    return {
        id: id ?? `e${nextId++}`,
        day,
        startMin: timeToMinutes(start),
        endMin: timeToMinutes(end),
        weekType,
    };
}

function unit(
    id: string,
    options: GenEvent[][],
    { required = true }: { required?: boolean } = {},
): GenUnit {
    return {
        id,
        courseKey: id,
        courseName: id,
        type: 'other',
        required,
        options: options.map(events => ({
            id: events.map(e => e.id).sort().join('+'),
            classId: null,
            events,
        })),
    };
}

// ---------------------------------------------------------------------------
// overlap matrix (plan §B1 — parity-aware)
// ---------------------------------------------------------------------------

describe('parity-aware overlap', () => {
    it('parities: odd/even never intersect, all intersects both', () => {
        const cases: Array<[WeekParity, WeekParity, boolean]> = [
            ['all', 'all', true],
            ['all', 'odd', true],
            ['all', 'even', true],
            ['odd', 'all', true],
            ['odd', 'odd', true],
            ['odd', 'even', false],
            ['even', 'odd', false],
            ['even', 'even', true],
        ];
        for (const [a, b, expected] of cases) {
            expect(paritiesIntersect(a, b), `${a} vs ${b}`).toBe(expected);
        }
    });

    it('same slot, odd vs even do NOT conflict', () => {
        expect(eventsConflict(ev(2, '14:30', '16:20', 'odd'), ev(2, '14:30', '16:20', 'even'))).toBe(false);
    });

    it('same slot, all vs odd DO conflict', () => {
        expect(eventsConflict(ev(2, '14:30', '16:20', 'all'), ev(2, '14:30', '16:20', 'odd'))).toBe(true);
    });

    it('different days never conflict', () => {
        expect(eventsConflict(ev(0, '08:00', '09:50'), ev(1, '08:00', '09:50'))).toBe(false);
    });

    it('back-to-back times do not conflict (end == start)', () => {
        expect(eventsConflict(ev(0, '08:00', '10:00'), ev(0, '10:00', '11:50'))).toBe(false);
    });

    it('partial time overlap conflicts', () => {
        expect(eventsConflict(ev(0, '08:00', '10:00'), ev(0, '09:00', '11:00'))).toBe(true);
    });

    it('optionsConflict finds any pairwise event conflict', () => {
        const a = { id: 'a', classId: null, events: [ev(0, '08:00', '09:50'), ev(2, '10:00', '11:50')] };
        const b = { id: 'b', classId: null, events: [ev(2, '10:00', '11:50')] };
        const c = { id: 'c', classId: null, events: [ev(4, '08:00', '09:50')] };
        expect(optionsConflict(a, b)).toBe(true);
        expect(optionsConflict(a, c)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// scoring
// ---------------------------------------------------------------------------

describe('scoring', () => {
    it('counts a free slot as a gap but not the 10-min/lunch breaks', () => {
        // Sapientia rhythm: 8:00–9:50, 10:00–11:50, lunch, 12:30–14:20
        const contiguous = [ev(0, '08:00', '09:50'), ev(0, '10:00', '11:50'), ev(0, '12:30', '14:20')];
        expect(weekStats(contiguous, 600, 60).gapHours).toBe(0);

        // skipping the 10:00 slot: 9:50 → 12:30 = 2h40m gap
        const withHole = [ev(0, '08:00', '09:50'), ev(0, '12:30', '14:20')];
        expect(weekStats(withHole, 600, 60).gapHours).toBeCloseTo(160 / 60);
    });

    it('an odd-week-only gap costs half of an every-week gap (plan §B6)', () => {
        // every week: 8-9:50 then 12:30-14:20 both weeks
        const everyWeek = [ev(0, '08:00', '09:50', 'all'), ev(0, '12:30', '14:20', 'all')];
        // odd weeks only: the 12:30 class is odd-only → gap exists only on odd weeks
        const oddOnly = [ev(0, '08:00', '09:50', 'all'), ev(0, '12:30', '14:20', 'odd')];

        const every = computeScheduleStats(everyWeek, DEFAULT_WEIGHTS, 600, 60, []);
        const odd = computeScheduleStats(oddOnly, DEFAULT_WEIGHTS, 600, 60, []);
        expect(odd.gapHours).toBeCloseTo(every.gapHours / 2);
    });

    it('early classes and days used are parity-averaged too', () => {
        const stats = computeScheduleStats(
            [ev(0, '08:00', '09:50', 'odd')], // Monday 8:00 only on odd weeks
            DEFAULT_WEIGHTS, 600, 60, []);
        expect(stats.earlyCount).toBe(0.5);
        expect(stats.daysUsed).toBe(0.5);
    });

    it('weekView: odd view = all + odd events', () => {
        const events = [ev(0, '08:00', '09:50', 'all'), ev(1, '08:00', '09:50', 'odd'), ev(2, '08:00', '09:50', 'even')];
        expect(weekView(events, 'odd')).toHaveLength(2);
        expect(weekView(events, 'even')).toHaveLength(2);
    });
});

// ---------------------------------------------------------------------------
// unit building from entries
// ---------------------------------------------------------------------------

describe('buildUnitsFromEntries', () => {
    const entry = (id: string, subject: string, classId: string, day: number, start: string, end: string, week: 'all' | 'odd' | 'even' = 'all') => ({
        id, subject_name: subject, class_id: classId, day_of_week: day,
        start_time: `${start}:00`, end_time: `${end}:00`, week_type: week,
    });

    it('derives type from the Hungarian suffix', () => {
        expect(getTypeFromSubjectName('Osztott rendszerek e.a.')).toBe('lecture');
        expect(getTypeFromSubjectName('Osztott rendszerek gyak.')).toBe('lab');
        expect(getTypeFromSubjectName('Adatbázisok lab.')).toBe('lab');
        expect(getTypeFromSubjectName('Menedzsment szem.')).toBe('seminar');
        expect(getTypeFromSubjectName('Valós ideju rendszerek proj')).toBe('other');
        expect(getDisplayBaseName('Osztott rendszerek gyak.')).toBe('Osztott rendszerek');
    });

    it('groups lecture and lab of the same course into separate units, options per class', () => {
        const units = buildUnitsFromEntries([
            entry('1', 'Osztott rendszerek e.a.', 'B', 0, '08:00', '09:50'),
            entry('2', 'Osztott rendszerek gyak.', 'B', 2, '14:30', '16:20'),
            entry('3', 'Osztott rendszerek gyak.', 'C', 3, '10:00', '11:50'),
        ]);
        expect(units).toHaveLength(2);
        const lab = units.find(u => u.type === 'lab')!;
        expect(lab.options).toHaveLength(2); // B and C alternatives
        const lecture = units.find(u => u.type === 'lecture')!;
        expect(lecture.options).toHaveLength(1);
    });

    it('respects includedCourses and optionalCourses (normalized keys)', () => {
        const units = buildUnitsFromEntries([
            entry('1', 'Osztott rendszerek e.a.', 'B', 0, '08:00', '09:50'),
            entry('2', 'Menedzsment e.a.', 'B', 1, '10:00', '11:50'),
        ], { includedCourses: ['osztott rendszerek', 'menedzsment'], optionalCourses: ['menedzsment'] });
        expect(units.find(u => u.courseKey === 'menedzsment')!.required).toBe(false);
        expect(units.find(u => u.courseKey === 'osztott rendszerek')!.required).toBe(true);

        const onlyOne = buildUnitsFromEntries([
            entry('1', 'Osztott rendszerek e.a.', 'B', 0, '08:00', '09:50'),
            entry('2', 'Menedzsment e.a.', 'B', 1, '10:00', '11:50'),
        ], { includedCourses: ['menedzsment'] });
        expect(onlyOne).toHaveLength(1);
    });

    // A lecture held for the whole year is scraped once per group — identical
    // day/time/room/teacher. Those are the SAME physical class, not choices.
    const shared = (id: string, cls: string, room = 'A1', teacher = 'Kiss T.') => ({
        id, subject_name: 'Analízis e.a.', class_id: cls, day_of_week: 0,
        start_time: '08:00:00', end_time: '09:50:00', week_type: 'all' as const,
        classroom: room, teacher_name: teacher,
    });

    it('collapses a lecture shared across groups into ONE option, keeping the home group', () => {
        const units = buildUnitsFromEntries(
            [shared('la', 'A'), shared('lb', 'B'), shared('lc', 'C')],
            { homeClassId: 'B' },
        );
        expect(units).toHaveLength(1);
        expect(units[0].options).toHaveLength(1);      // not three
        expect(units[0].options[0].classId).toBe('B'); // home representative
        expect(units[0].options[0].events[0].id).toBe('lb');
    });

    it('keeps genuinely different same-time sessions (different rooms) as separate options', () => {
        const units = buildUnitsFromEntries([
            shared('x', 'A', 'R1'), shared('y', 'B', 'R2'),
        ]);
        expect(units[0].options).toHaveLength(2);
    });

    it('a shared lecture no longer multiplies the generated schedules', () => {
        const units = buildUnitsFromEntries([shared('la', 'A'), shared('lb', 'B'), shared('lc', 'C')]);
        const res = generateSchedules(units);
        expect(res.schedules).toHaveLength(1); // was 3 identical schedules before dedup
        expect(res.combosEvaluated).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// generation: known-best fixtures
// ---------------------------------------------------------------------------

describe('generateSchedules', () => {
    it('picks the gap-free combination as best', () => {
        // course A fixed Mon 8:00; course B choice: Mon 10:00 (no gap) or Mon 14:30 (gap)
        const a = unit('A', [[ev(0, '08:00', '09:50', 'all', 'a1')]]);
        const b = unit('B', [
            [ev(0, '10:00', '11:50', 'all', 'b-good')],
            [ev(0, '14:30', '16:20', 'all', 'b-gap')],
        ]);
        const result = generateSchedules([a, b]);
        expect(result.issues).toHaveLength(0);
        expect(result.schedules[0].eventIds).toContain('b-good');
        expect(result.schedules[0].stats.gapHours).toBe(0);
        expect(result.schedules[0].explanation).toContain('Legjobb');
        // the alternative also returned, ranked worse
        expect(result.schedules[1].eventIds).toContain('b-gap');
        expect(result.schedules[1].stats.score).toBeGreaterThan(result.schedules[0].stats.score);
    });

    it('prefers fewer days when gaps are equal', () => {
        const a = unit('A', [[ev(0, '08:00', '09:50', 'all', 'a1')]]);
        const b = unit('B', [
            [ev(0, '10:00', '11:50', 'all', 'b-same-day')],
            [ev(1, '10:00', '11:50', 'all', 'b-new-day')],
        ]);
        const result = generateSchedules([a, b]);
        expect(result.schedules[0].eventIds).toContain('b-same-day');
    });

    it('uses odd/even parity to fit two courses into one slot', () => {
        const a = unit('A', [[ev(2, '14:30', '16:20', 'odd', 'a-odd')]]);
        const b = unit('B', [[ev(2, '14:30', '16:20', 'even', 'b-even')]]);
        const result = generateSchedules([a, b]);
        expect(result.issues).toHaveLength(0);
        expect(result.schedules[0].eventIds).toEqual(['a-odd', 'b-even']);
    });

    it('returns at most topK deduplicated schedules, best first', () => {
        // 3 independent courses × 3 options each = 27 combos
        const mk = (name: string, day: number) => unit(name, [
            [ev(day, '08:00', '09:50', 'all', `${name}-1`)],
            [ev(day, '10:00', '11:50', 'all', `${name}-2`)],
            [ev(day, '12:30', '14:20', 'all', `${name}-3`)],
        ]);
        const result = generateSchedules([mk('A', 0), mk('B', 1), mk('C', 2)]);
        expect(result.schedules.length).toBeLessThanOrEqual(5);
        // branch-and-bound may prune hopeless branches, so ≤ 27 leaves
        expect(result.combosEvaluated).toBeLessThanOrEqual(27);
        expect(result.combosEvaluated).toBeGreaterThanOrEqual(5);
        const keys = result.schedules.map(s => s.eventIds.join('+'));
        expect(new Set(keys).size).toBe(keys.length);
        for (let i = 1; i < result.schedules.length; i++) {
            expect(result.schedules[i].stats.score)
                .toBeGreaterThanOrEqual(result.schedules[i - 1].stats.score);
        }
    });
});

// ---------------------------------------------------------------------------
// generation: hard constraints & impossible cases (spec §A15)
// ---------------------------------------------------------------------------

describe('constraints and issues', () => {
    it('day-not-allowed: required Friday-only course with Friday disabled', () => {
        const friday = unit('Frontend', [[ev(4, '08:00', '09:50', 'all', 'f1')]]);
        const result = generateSchedules([friday], { allowedDays: [0, 1, 2, 3] });
        expect(result.schedules).toHaveLength(0);
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0].reason).toBe('day-not-allowed');
        expect(result.issues[0].days).toEqual([4]);
        expect(result.issues[0].message).toContain('péntek');
        expect(result.issues[0].resolutions).toContain('allow-day');
        expect(result.issues[0].resolutions).toContain('remove-course');
    });

    it('outside-time-window: course entirely after latestEnd', () => {
        const late = unit('Esti', [[ev(0, '18:30', '20:20', 'all', 'l1')]]);
        const result = generateSchedules([late], { latestEndMin: timeToMinutes('18:00') });
        expect(result.issues[0].reason).toBe('outside-time-window');
        expect(result.issues[0].resolutions).toContain('widen-time-window');
    });

    it('required-conflict: two single-option courses in the same slot', () => {
        const a = unit('A', [[ev(0, '08:00', '09:50', 'all', 'a1')]]);
        const b = unit('B', [[ev(0, '08:00', '09:50', 'all', 'b1')]]);
        const result = generateSchedules([a, b]);
        expect(result.schedules).toHaveLength(0);
        expect(result.issues[0].reason).toBe('required-conflict');
        expect(result.issues[0].courseName).toBe('A');
        expect(result.issues[0].conflictWith).toBe('B');
    });

    it('optional course that conflicts is skipped, not fatal', () => {
        const a = unit('A', [[ev(0, '08:00', '09:50', 'all', 'a1')]]);
        const b = unit('B', [[ev(0, '08:00', '09:50', 'all', 'b1')]], { required: false });
        const result = generateSchedules([a, b]);
        expect(result.issues).toHaveLength(0);
        expect(result.schedules[0].eventIds).toEqual(['a1']);
        expect(result.schedules[0].stats.skippedOptional).toEqual(['B']);
        expect(result.schedules[0].optionsByUnit['B']).toBeNull();
    });

    it('excluded events remove options; all-excluded on a required course is an issue', () => {
        const b = unit('B', [
            [ev(0, '10:00', '11:50', 'all', 'b1')],
            [ev(1, '10:00', '11:50', 'all', 'b2')],
        ]);
        const partial = generateSchedules([b], { excludedEventIds: ['b1'] });
        expect(partial.schedules[0].eventIds).toEqual(['b2']);

        const total = generateSchedules([b], { excludedEventIds: ['b1', 'b2'] });
        expect(total.schedules).toHaveLength(0);
        expect(total.issues[0].reason).toBe('all-excluded');
    });

    it('locked event forces its option even when a better one exists', () => {
        const a = unit('A', [[ev(0, '08:00', '09:50', 'all', 'a1')]]);
        const b = unit('B', [
            [ev(0, '10:00', '11:50', 'all', 'b-good')],
            [ev(3, '14:30', '16:20', 'all', 'b-locked')],
        ]);
        const result = generateSchedules([a, b], { lockedEventIds: ['b-locked'] });
        expect(result.schedules).toHaveLength(1);
        expect(result.schedules[0].eventIds).toContain('b-locked');
    });
});

// ---------------------------------------------------------------------------
// end-to-end from raw entries
// ---------------------------------------------------------------------------

describe('generateFromEntries', () => {
    it('builds units and generates in one call', () => {
        const entries = [
            { id: '1', subject_name: 'Osztott rendszerek e.a.', class_id: 'B', day_of_week: 0, start_time: '08:00:00', end_time: '09:50:00', week_type: 'all' as const },
            { id: '2', subject_name: 'Osztott rendszerek gyak.', class_id: 'B', day_of_week: 0, start_time: '10:00:00', end_time: '11:50:00', week_type: 'all' as const },
            { id: '3', subject_name: 'Osztott rendszerek gyak.', class_id: 'C', day_of_week: 3, start_time: '14:30:00', end_time: '16:20:00', week_type: 'all' as const },
        ];
        const result = generateFromEntries(entries);
        expect(result.issues).toHaveLength(0);
        // best schedule: lecture + same-day lab (1 day, no gap)
        expect(result.schedules[0].eventIds).toEqual(['1', '2']);
        expect(result.schedules[0].stats.daysUsed).toBe(1);
    });
});
