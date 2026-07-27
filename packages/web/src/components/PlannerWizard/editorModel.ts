// Edit-step model (Phase 5): for each class in the picked schedule, find the
// unit it belongs to and that unit's OTHER groups (valid drag targets), each
// flagged for whether swapping to it would collide with the rest of the
// schedule. Pure — reuses the generator's units + parity-aware overlap.

import { AvailableClassEntry, getBaseSubjectName } from '@shared/index';
import {
    buildUnitsFromEntries,
    eventsConflict,
    GenEvent,
    GenOption,
    GenUnit,
} from '@shared/lib/generator';
import { CourseSetting } from './wizardStore';

export interface EventAlternative {
    option: GenOption;
    /** true when swapping to this group collides with the rest of the schedule */
    conflict: boolean;
}

export interface EditableEvent {
    entry: AvailableClassEntry;
    unit: GenUnit;
    currentOption: GenOption;
    /** the unit's other groups — the valid drag targets */
    alternatives: EventAlternative[];
}

export interface EditorModel {
    editable: EditableEvent[];
    /** every option keyed by id, for resolving a drop target back to its events */
    optionById: Map<string, GenOption>;
}

export function buildEditorModel(
    pool: AvailableClassEntry[],
    courseSettings: Record<string, CourseSetting>,
    pickedEventIds: string[],
    homeClassId?: string,
): EditorModel {
    const allKeys = new Set(pool.map(e => getBaseSubjectName(e.subject_name)));
    const includedCourses = [...allKeys].filter(k => courseSettings[k]?.included !== false);
    const optionalCourses = includedCourses.filter(k => courseSettings[k]?.optional === true);
    // MUST match the config StepGenerate used, or picked event ids won't map.
    const units = buildUnitsFromEntries(pool, { includedCourses, optionalCourses, homeClassId });

    const genEventById = new Map<string, GenEvent>();
    const unitByEventId = new Map<string, GenUnit>();
    const optionByEventId = new Map<string, GenOption>();
    const optionById = new Map<string, GenOption>();
    for (const u of units) {
        for (const o of u.options) {
            optionById.set(o.id, o);
            for (const ev of o.events) {
                genEventById.set(ev.id, ev);
                unitByEventId.set(ev.id, u);
                optionByEventId.set(ev.id, o);
            }
        }
    }

    const byId = new Map(pool.map(e => [e.id, e]));
    const editable: EditableEvent[] = [];

    for (const id of pickedEventIds) {
        const entry = byId.get(id);
        const unit = unitByEventId.get(id);
        const currentOption = optionByEventId.get(id);
        if (!entry || !unit || !currentOption) continue;

        // the rest of the schedule = picked events NOT in this class's own group
        const ownIds = new Set(currentOption.events.map(e => e.id));
        const restEvents = pickedEventIds
            .filter(pid => !ownIds.has(pid))
            .map(pid => genEventById.get(pid))
            .filter((e): e is GenEvent => !!e);

        const alternatives: EventAlternative[] = unit.options
            .filter(o => o.id !== currentOption.id)
            .map(o => ({
                option: o,
                conflict: o.events.some(ae => restEvents.some(re => eventsConflict(ae, re))),
            }));

        editable.push({ entry, unit, currentOption, alternatives });
    }

    return { editable, optionById };
}
