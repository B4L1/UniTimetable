// Scoring (spec §A12): score = gap_hours*W1 + early_classes*W2 + days_used*W3
// + skip penalty. All three terms are computed per parity week and averaged,
// so a gap that only exists on odd weeks costs half (plan §B6).

import { GenEvent, GeneratorWeights, ScheduleStats, WeekStats, WeekParity } from './types';

export function weekView(events: readonly GenEvent[], parity: 'odd' | 'even'): GenEvent[] {
    return events.filter(e => e.weekType === 'all' || e.weekType === parity);
}

export function weekStats(
    events: readonly GenEvent[],
    earlyStartMin: number,
    minGapMin: number,
): WeekStats {
    const byDay = new Map<number, GenEvent[]>();
    for (const e of events) {
        const list = byDay.get(e.day);
        if (list) list.push(e);
        else byDay.set(e.day, [e]);
    }

    let gapMinutes = 0;
    let earlyCount = 0;
    for (const dayEvents of byDay.values()) {
        dayEvents.sort((a, b) => a.startMin - b.startMin);
        let prevEnd = -1;
        for (const e of dayEvents) {
            if (e.startMin < earlyStartMin) earlyCount++;
            if (prevEnd >= 0) {
                const gap = e.startMin - prevEnd;
                if (gap >= minGapMin) gapMinutes += gap;
            }
            prevEnd = Math.max(prevEnd, e.endMin);
        }
    }

    return {
        gapHours: gapMinutes / 60,
        earlyCount,
        daysUsed: byDay.size,
    };
}

export function computeScheduleStats(
    events: readonly GenEvent[],
    weights: GeneratorWeights,
    earlyStartMin: number,
    minGapMin: number,
    skippedOptional: string[],
): ScheduleStats {
    const odd = weekStats(weekView(events, 'odd'), earlyStartMin, minGapMin);
    const even = weekStats(weekView(events, 'even'), earlyStartMin, minGapMin);

    const gapHours = (odd.gapHours + even.gapHours) / 2;
    const earlyCount = (odd.earlyCount + even.earlyCount) / 2;
    const daysUsed = (odd.daysUsed + even.daysUsed) / 2;

    const score =
        gapHours * weights.gapHour +
        earlyCount * weights.earlyClass +
        daysUsed * weights.dayUsed +
        skippedOptional.length * weights.skipOptional;

    return { odd, even, gapHours, earlyCount, daysUsed, skippedOptional, score };
}

/**
 * Lower bound on the final score of any completion of a partial schedule.
 * Early-class count, days used and skip penalties only ever grow as events
 * are added; gap hours can shrink (an added event can fill a gap), so gaps
 * are left out. Used for branch-and-bound pruning.
 */
export function partialScoreLowerBound(
    events: readonly GenEvent[],
    weights: GeneratorWeights,
    earlyStartMin: number,
    skippedCount: number,
): number {
    const odd = weekStats(weekView(events, 'odd'), earlyStartMin, Number.MAX_SAFE_INTEGER);
    const even = weekStats(weekView(events, 'even'), earlyStartMin, Number.MAX_SAFE_INTEGER);
    return (
        ((odd.earlyCount + even.earlyCount) / 2) * weights.earlyClass +
        ((odd.daysUsed + even.daysUsed) / 2) * weights.dayUsed +
        skippedCount * weights.skipOptional
    );
}

export type { WeekParity };
