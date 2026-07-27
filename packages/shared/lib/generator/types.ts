// Generator domain types (SPEC_V3_PLAN.md Phase 3, spec §A10–A13)
//
// The generator is pure: it never touches Supabase. `build.ts` converts
// TimetableEntry rows into GenUnits; everything below works on those.

import { EventType } from '../types';

export type WeekParity = 'all' | 'odd' | 'even';

export interface GenEvent {
    id: string;
    day: number; // 0=Mon … 5=Sat
    startMin: number; // minutes from midnight
    endMin: number;
    weekType: WeekParity;
}

/** One choosable alternative of a unit — picking it means attending ALL its events. */
export interface GenOption {
    id: string; // sorted event ids joined with '+'
    classId: string | null; // cohort this option comes from
    className?: string;
    events: GenEvent[];
}

/**
 * The unit of choice: one (course, type) pair, e.g. "Osztott rendszerek" lab.
 * The generator picks exactly one option per required unit, and one-or-none
 * per optional unit.
 */
export interface GenUnit {
    id: string; // `${courseKey}|${type}`
    courseKey: string; // normalized base subject name (colors.ts identity)
    courseName: string; // display base name, original casing
    type: EventType;
    required: boolean;
    options: GenOption[];
}

export interface GeneratorWeights {
    /** cost per parity-averaged gap hour (spec W1) */
    gapHour: number;
    /** cost per class starting before the early threshold (spec W2) */
    earlyClass: number;
    /** cost per parity-averaged day with any class (spec W3) */
    dayUsed: number;
    /** cost of dropping an optional unit entirely */
    skipOptional: number;
}

export const DEFAULT_WEIGHTS: GeneratorWeights = {
    gapHour: 1.0,
    earlyClass: 1.5,
    dayUsed: 2.0,
    skipOptional: 4.0,
};

export interface GeneratorConstraints {
    /** hard: days classes may fall on (0=Mon) */
    allowedDays?: number[];
    /** hard: earliest acceptable class start, minutes */
    earliestStartMin?: number;
    /** hard: latest acceptable class end, minutes */
    latestEndMin?: number;
    /** soft: "early class" threshold, default 600 (10:00) */
    earlyStartMin?: number;
    /** gaps shorter than this are ordinary breaks, not "lyukasóra"; default 60 */
    minGapMin?: number;
    /** events that must be part of the schedule (smart editing, §A13) */
    lockedEventIds?: string[];
    /** events that must never be reintroduced (§A13) */
    excludedEventIds?: string[];
    weights?: Partial<GeneratorWeights>;
    /** safety valve for pathological inputs; default 200 000 leaves */
    maxCombos?: number;
    /** how many schedules to return, default 5 */
    topK?: number;
}

export interface WeekStats {
    gapHours: number;
    earlyCount: number;
    daysUsed: number;
}

export interface ScheduleStats {
    odd: WeekStats;
    even: WeekStats;
    /** parity-averaged — an odd-only gap costs half (plan §B6) */
    gapHours: number;
    earlyCount: number;
    daysUsed: number;
    skippedOptional: string[]; // course names of dropped optional units
    score: number;
}

export interface GeneratedSchedule {
    eventIds: string[];
    /** unitId → chosen optionId, or null when an optional unit was skipped */
    optionsByUnit: Record<string, string | null>;
    stats: ScheduleStats;
    /** Hungarian one-liner, relative to the best schedule */
    explanation: string;
}

export type IssueReason =
    | 'no-options'
    | 'day-not-allowed'
    | 'outside-time-window'
    | 'all-excluded'
    | 'conflicts-with-locked'
    | 'required-conflict'
    | 'no-valid-combination';

export type IssueResolution =
    | 'allow-day'
    | 'widen-time-window'
    | 'make-optional'
    | 'remove-course'
    | 'unlock-event'
    | 'restore-excluded';

/** Constraint-violation explanation with actionable resolutions (spec §A15). */
export interface GenerationIssue {
    reason: IssueReason;
    unitId?: string;
    courseName?: string;
    /** the other course, for required-conflict */
    conflictWith?: string;
    /** days the course actually exists on, for day-not-allowed */
    days?: number[];
    message: string; // Hungarian
    resolutions: IssueResolution[];
}

export interface GenerationResult {
    schedules: GeneratedSchedule[];
    issues: GenerationIssue[];
    truncated: boolean;
    combosEvaluated: number;
}
