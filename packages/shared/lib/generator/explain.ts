// Hungarian explanation builders (spec §A12 per-schedule explanations and
// §A15 constraint-violation messages). Kept separate from the solver so the
// texts can be swapped for i18n later without touching logic.

import { EventType } from '../types';
import {
    GenerationIssue,
    IssueReason,
    IssueResolution,
    ScheduleStats,
} from './types';

export const DAY_NAMES_HU = ['hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];

const TYPE_LABELS_HU: Record<EventType, string> = {
    lecture: 'előadás',
    lab: 'gyakorlat',
    seminar: 'szeminárium',
    other: '',
};

/** 1.5 → "1,5", 2 → "2" */
function fmtNum(n: number): string {
    return (Math.round(n * 10) / 10).toString().replace('.', ',');
}

function fmtDays(days: number[]): string {
    return days
        .slice()
        .sort((a, b) => a - b)
        .map(d => DAY_NAMES_HU[d] ?? `${d}. nap`)
        .join(', ');
}

/** One-line summary of a schedule, with deltas relative to the best one. */
export function buildScheduleExplanation(
    stats: ScheduleStats,
    best: ScheduleStats | null,
): string {
    const parts = [
        `${fmtNum(stats.daysUsed)} nap`,
        `${fmtNum(stats.gapHours)} óra lyukasóra`,
        `${fmtNum(stats.earlyCount)} korai (10:00 előtti) kezdés`,
    ];
    if (stats.skippedOptional.length > 0) {
        parts.push(`kihagyva: ${stats.skippedOptional.join(', ')}`);
    }

    if (!best || best === stats) {
        return `Legjobb pontszám — ${parts.join(' · ')}`;
    }

    const deltas: string[] = [];
    const gapDiff = stats.gapHours - best.gapHours;
    if (gapDiff > 0.01) deltas.push(`+${fmtNum(gapDiff)} óra lyukasóra`);
    else if (gapDiff < -0.01) deltas.push(`${fmtNum(-gapDiff)} órával kevesebb lyukasóra`);

    const dayDiff = stats.daysUsed - best.daysUsed;
    if (dayDiff > 0.01) deltas.push(`+${fmtNum(dayDiff)} nap`);
    else if (dayDiff < -0.01) deltas.push(`${fmtNum(-dayDiff)} nappal kevesebb`);

    const earlyDiff = stats.earlyCount - best.earlyCount;
    if (earlyDiff > 0.01) deltas.push(`+${fmtNum(earlyDiff)} korai kezdés`);
    else if (earlyDiff < -0.01) deltas.push(`${fmtNum(-earlyDiff)}-gyel kevesebb korai kezdés`);

    const skipDiff = stats.skippedOptional.length - best.skippedOptional.length;
    if (skipDiff > 0) deltas.push(`${skipDiff} tárggyal kevesebb`);

    if (deltas.length === 0) {
        // score tie with the best: same quality, different group assignment
        return `${parts.join(' · ')} — a legjobbal azonos mutatók, másik csoportbeosztás`;
    }
    return `${parts.join(' · ')} (a legjobbhoz képest: ${deltas.join(', ')})`;
}

export interface IssueContext {
    courseName: string;
    typeLabel?: EventType;
    days?: number[];
    conflictWith?: string;
    unitId?: string;
}

/** Build a spec-§A15-style issue: what's wrong + what the user can do. */
export function buildIssue(reason: IssueReason, ctx: IssueContext): GenerationIssue {
    const typeSuffix = ctx.typeLabel && TYPE_LABELS_HU[ctx.typeLabel]
        ? ` (${TYPE_LABELS_HU[ctx.typeLabel]})`
        : '';
    const course = `„${ctx.courseName}”${typeSuffix}`;

    let message: string;
    let resolutions: IssueResolution[];
    switch (reason) {
        case 'day-not-allowed':
            message = `A(z) ${course} csak ezeken a napokon létezik: ${fmtDays(ctx.days ?? [])}. ` +
                `Engedélyezd valamelyik napot, vagy vedd ki a tárgyat.`;
            resolutions = ['allow-day', 'make-optional', 'remove-course'];
            break;
        case 'outside-time-window':
            message = `A(z) ${course} minden időpontja a beállított idősávon kívül esik. ` +
                `Bővítsd az idősávot, vagy vedd ki a tárgyat.`;
            resolutions = ['widen-time-window', 'remove-course'];
            break;
        case 'all-excluded':
            message = `A(z) ${course} összes időpontját kizártad. Állíts vissza legalább egyet, vagy vedd ki a tárgyat.`;
            resolutions = ['restore-excluded', 'remove-course'];
            break;
        case 'conflicts-with-locked':
            message = `A(z) ${course} egyik csoportja sem fér össze a rögzített órákkal. ` +
                `Oldd fel valamelyik rögzítést, vagy vedd ki a tárgyat.`;
            resolutions = ['unlock-event', 'remove-course'];
            break;
        case 'required-conflict':
            message = `A(z) ${course} és a(z) „${ctx.conflictWith}” minden csoportja ütközik egymással. ` +
                `Tedd valamelyiket opcionálissá, vagy vedd ki az egyiket.`;
            resolutions = ['make-optional', 'remove-course'];
            break;
        case 'no-options':
            message = `A(z) ${course} tárgyhoz nem található időpont.`;
            resolutions = ['remove-course'];
            break;
        case 'no-valid-combination':
        default:
            message = 'Nem található ütközésmentes órarend a jelenlegi beállításokkal. ' +
                'Engedélyezz több napot, bővítsd az idősávot, vagy vegyél ki egy tárgyat.';
            resolutions = ['allow-day', 'widen-time-window', 'remove-course'];
            break;
    }

    return {
        reason,
        unitId: ctx.unitId,
        courseName: ctx.courseName,
        conflictWith: ctx.conflictWith,
        days: ctx.days,
        message,
        resolutions,
    };
}
