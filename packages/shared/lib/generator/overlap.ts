// Parity-aware overlap detection (plan §B1 — the critical domain fact).

import { GenEvent, GenOption, WeekParity } from './types';

/** Do two week parities ever share a physical week? odd↔even never do. */
export function paritiesIntersect(a: WeekParity, b: WeekParity): boolean {
    return a === 'all' || b === 'all' || a === b;
}

/** True when attending both events is physically impossible. */
export function eventsConflict(a: GenEvent, b: GenEvent): boolean {
    return (
        a.day === b.day &&
        a.startMin < b.endMin &&
        b.startMin < a.endMin &&
        paritiesIntersect(a.weekType, b.weekType)
    );
}

export function eventConflictsWithAny(e: GenEvent, others: readonly GenEvent[]): boolean {
    for (const o of others) {
        if (eventsConflict(e, o)) return true;
    }
    return false;
}

export function optionsConflict(a: GenOption, b: GenOption): boolean {
    for (const ea of a.events) {
        if (eventConflictsWithAny(ea, b.events)) return true;
    }
    return false;
}
