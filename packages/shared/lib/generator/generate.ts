// Constraint-driven schedule generator (spec §A12 pipeline:
// build set → filter → generate → score → return best).
//
// Brute-force DFS over option combinations with parity-aware conflict checks
// and branch-and-bound pruning on the monotone score components (plan §B6:
// cohort-scale inputs make this comfortably fast client-side).

import { EventType } from '../types';
import {
    DEFAULT_WEIGHTS,
    GeneratedSchedule,
    GenerationIssue,
    GenerationResult,
    GeneratorConstraints,
    GeneratorWeights,
    GenEvent,
    GenOption,
    GenUnit,
    IssueReason,
} from './types';
import { eventConflictsWithAny, optionsConflict } from './overlap';
import { computeScheduleStats, partialScoreLowerBound } from './score';
import { buildIssue, buildScheduleExplanation } from './explain';
import { buildUnitsFromEntries, BuildUnitsConfig } from './build';

const DEFAULT_ALLOWED_DAYS = [0, 1, 2, 3, 4, 5];
const DEFAULT_EARLIEST = 0;
const DEFAULT_LATEST = 24 * 60;
const DEFAULT_EARLY_START = 10 * 60;
const DEFAULT_MIN_GAP = 60;
const DEFAULT_MAX_COMBOS = 200_000;
const DEFAULT_TOP_K = 5;

interface PreparedUnit {
    unit: GenUnit;
    /** options that survived hard filtering */
    options: GenOption[];
    /** which filter emptied the list, when one did */
    emptiedBy: IssueReason | null;
}

/** Days a unit's events fall on, across all its original options. */
function unitDays(unit: GenUnit): number[] {
    const days = new Set<number>();
    for (const opt of unit.options) for (const e of opt.events) days.add(e.day);
    return Array.from(days);
}

function filterUnit(
    unit: GenUnit,
    allowedDays: Set<number>,
    earliestStartMin: number,
    latestEndMin: number,
    excluded: Set<string>,
    locked: Set<string>,
): PreparedUnit {
    // Filters run one at a time so the FIRST one that empties the list names
    // the failure — that ordering is what makes §A15 messages precise.
    let options = unit.options;
    let emptiedBy: IssueReason | null = unit.options.length === 0 ? 'no-options' : null;

    const apply = (reason: IssueReason, keep: (o: GenOption) => boolean) => {
        if (emptiedBy) return;
        const next = options.filter(keep);
        if (next.length === 0 && options.length > 0) emptiedBy = reason;
        options = next;
    };

    apply('all-excluded', o => !o.events.some(e => excluded.has(e.id)));
    apply('day-not-allowed', o => o.events.every(e => allowedDays.has(e.day)));
    apply('outside-time-window', o =>
        o.events.every(e => e.startMin >= earliestStartMin && e.endMin <= latestEndMin));

    // Locked events restrict their unit to options that contain them all.
    const unitEventIds = new Set<string>();
    for (const o of unit.options) for (const e of o.events) unitEventIds.add(e.id);
    const relevantLocks = Array.from(locked).filter(id => unitEventIds.has(id));
    if (relevantLocks.length > 0) {
        apply('conflicts-with-locked', o =>
            relevantLocks.every(id => o.events.some(e => e.id === id)));
    }

    return { unit, options, emptiedBy };
}

/** When nothing enumerates, find a required pair whose options all collide. */
function findRequiredConflict(prepared: PreparedUnit[]): GenerationIssue | null {
    const required = prepared.filter(p => p.unit.required && p.options.length > 0);
    for (let i = 0; i < required.length; i++) {
        for (let j = i + 1; j < required.length; j++) {
            const a = required[i];
            const b = required[j];
            const allConflict = a.options.every(oa =>
                b.options.every(ob => optionsConflict(oa, ob)));
            if (allConflict) {
                return buildIssue('required-conflict', {
                    courseName: a.unit.courseName,
                    typeLabel: a.unit.type,
                    conflictWith: b.unit.courseName,
                    unitId: a.unit.id,
                });
            }
        }
    }
    return null;
}

export function generateSchedules(
    units: GenUnit[],
    constraints: GeneratorConstraints = {},
): GenerationResult {
    const weights: GeneratorWeights = { ...DEFAULT_WEIGHTS, ...constraints.weights };
    const allowedDays = new Set(constraints.allowedDays ?? DEFAULT_ALLOWED_DAYS);
    const earliestStartMin = constraints.earliestStartMin ?? DEFAULT_EARLIEST;
    const latestEndMin = constraints.latestEndMin ?? DEFAULT_LATEST;
    const earlyStartMin = constraints.earlyStartMin ?? DEFAULT_EARLY_START;
    const minGapMin = constraints.minGapMin ?? DEFAULT_MIN_GAP;
    const maxCombos = constraints.maxCombos ?? DEFAULT_MAX_COMBOS;
    const topK = constraints.topK ?? DEFAULT_TOP_K;
    const excluded = new Set(constraints.excludedEventIds ?? []);
    const locked = new Set(constraints.lockedEventIds ?? []);

    const issues: GenerationIssue[] = [];

    // ---- filter (hard constraints §A11) ----
    const prepared = units.map(u =>
        filterUnit(u, allowedDays, earliestStartMin, latestEndMin, excluded, locked));

    const alwaysSkipped: string[] = []; // optional units with no surviving options
    for (const p of prepared) {
        if (p.options.length > 0) continue;
        if (p.unit.required) {
            issues.push(buildIssue(p.emptiedBy ?? 'no-options', {
                courseName: p.unit.courseName,
                typeLabel: p.unit.type,
                days: unitDays(p.unit),
                unitId: p.unit.id,
            }));
        } else {
            alwaysSkipped.push(p.unit.courseName);
        }
    }

    // A required course that can't be scheduled is a hard stop: returning
    // schedules without it would silently violate §A11.
    if (issues.length > 0) {
        return { schedules: [], issues, truncated: false, combosEvaluated: 0 };
    }

    // ---- generate (DFS with pruning) ----
    // Fewest-options-first shrinks the tree; required before optional so
    // conflicts surface early.
    const searchUnits = prepared
        .filter(p => p.options.length > 0)
        .sort((a, b) =>
            Number(b.unit.required) - Number(a.unit.required) ||
            a.options.length - b.options.length);

    interface Candidate {
        key: string;
        score: number;
        events: GenEvent[];
        picks: Record<string, string | null>;
        skipped: string[];
    }
    const bestByKey = new Map<string, Candidate>();
    let best: Candidate[] = []; // sorted by score asc, ≤ topK
    let combosEvaluated = 0;
    let truncated = false;

    const worstAccepted = () =>
        best.length < topK ? Number.POSITIVE_INFINITY : best[best.length - 1].score;

    const insert = (candidate: Candidate) => {
        const existing = bestByKey.get(candidate.key);
        if (existing) {
            if (candidate.score >= existing.score) return;
            best = best.filter(c => c !== existing);
        }
        bestByKey.set(candidate.key, candidate);
        best.push(candidate);
        best.sort((a, b) => a.score - b.score);
        if (best.length > topK) {
            const dropped = best.pop()!;
            bestByKey.delete(dropped.key);
        }
    };

    const chosenEvents: GenEvent[] = [];
    const picks: Record<string, string | null> = {};
    const skipped: string[] = [...alwaysSkipped];

    const dfs = (index: number): void => {
        if (truncated) return;

        // prune: even with zero future cost this branch can't reach the top-K
        if (best.length === topK) {
            const bound = partialScoreLowerBound(chosenEvents, weights, earlyStartMin, skipped.length);
            if (bound > worstAccepted() + 1e-9) return;
        }

        if (index === searchUnits.length) {
            combosEvaluated++;
            if (combosEvaluated > maxCombos) {
                truncated = true;
                return;
            }
            const stats = computeScheduleStats(
                chosenEvents, weights, earlyStartMin, minGapMin, [...skipped]);
            const eventIds = chosenEvents.map(e => e.id).sort();
            insert({
                key: eventIds.join('+'),
                score: stats.score,
                events: [...chosenEvents],
                picks: { ...picks },
                skipped: [...skipped],
            });
            return;
        }

        const { unit, options } = searchUnits[index];
        for (const option of options) {
            let conflicts = false;
            for (const e of option.events) {
                if (eventConflictsWithAny(e, chosenEvents)) {
                    conflicts = true;
                    break;
                }
            }
            if (conflicts) continue;

            picks[unit.id] = option.id;
            chosenEvents.push(...option.events);
            dfs(index + 1);
            chosenEvents.length -= option.events.length;
            delete picks[unit.id];
            if (truncated) return;
        }

        if (!unit.required) {
            picks[unit.id] = null;
            skipped.push(unit.courseName);
            dfs(index + 1);
            skipped.pop();
            delete picks[unit.id];
        }
    };
    dfs(0);

    // ---- score & explain finalists ----
    if (best.length === 0) {
        const conflictIssue = findRequiredConflict(prepared);
        issues.push(conflictIssue ?? buildIssue('no-valid-combination', { courseName: '' }));
        return { schedules: [], issues, truncated, combosEvaluated };
    }

    const finalists = best.map(c => ({
        candidate: c,
        stats: computeScheduleStats(c.events, weights, earlyStartMin, minGapMin, c.skipped),
    }));
    const bestStats = finalists[0].stats;

    const schedules: GeneratedSchedule[] = finalists.map(({ candidate, stats }, i) => ({
        eventIds: candidate.events.map(e => e.id).sort(),
        optionsByUnit: candidate.picks,
        stats,
        explanation: buildScheduleExplanation(stats, i === 0 ? null : bestStats),
    }));

    return { schedules, issues, truncated, combosEvaluated };
}

/** Convenience: build units from raw entries and generate in one call. */
export function generateFromEntries(
    entries: Parameters<typeof buildUnitsFromEntries>[0],
    buildConfig: BuildUnitsConfig = {},
    constraints: GeneratorConstraints = {},
): GenerationResult {
    return generateSchedules(buildUnitsFromEntries(entries, buildConfig), constraints);
}
