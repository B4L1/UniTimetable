// Interactive schedule grid for the Edit step (Phase 5, spec §A13).
// Slot-based like the classic Planner (fixed 2-hour rows) so each class gets a
// roomy, readable cell. Only the slots actually used are shown.
// - lock / exclude per class (always-visible controls)
// - a grip marks the classes that can move; drag one onto another of its
//   groups' slots (valid alternatives only, Part E #2) → snaps and swaps;
//   conflicting target cells light red and are rejected.

import { useMemo, useState } from 'react';
import { AnimatePresence, motion, PanInfo } from 'motion/react';
import { AvailableClassEntry, getSubjectColor } from '@shared/index';
import { timeToMinutes } from '@shared/lib/generator';
import { CourseSetting } from './wizardStore';
import { buildEditorModel, EditableEvent } from './editorModel';

const DAY_SHORT = ['Hétfő', 'Kedd', 'Szerda', 'Csüt.', 'Péntek', 'Szombat'];

// The Sapientia 2-hour teaching slots (classes are slot-aligned).
const TIME_SLOTS = [
    { start: 8 * 60, label: '08:00' },
    { start: 10 * 60, label: '10:00' },
    { start: 12 * 60 + 30, label: '12:30' },
    { start: 14 * 60 + 30, label: '14:30' },
    { start: 16 * 60 + 30, label: '16:30' },
    { start: 18 * 60 + 30, label: '18:30' },
];

function slotOf(startMin: number): number {
    for (let i = 0; i < TIME_SLOTS.length; i++) {
        const next = TIME_SLOTS[i + 1]?.start ?? Infinity;
        if (startMin >= TIME_SLOTS[i].start && startMin < next) return i;
    }
    return 0;
}

const LockGlyph = () => (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
    </svg>
);
const CloseGlyph = () => (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M6 6l12 12M18 6 6 18" />
    </svg>
);
const GripGlyph = () => (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
        <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
        <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
    </svg>
);

interface Props {
    pool: AvailableClassEntry[];
    pickedEventIds: string[];
    lockedSet: Set<string>;
    excludedSet: Set<string>;
    courseSettings: Record<string, CourseSetting>;
    homeClassId?: string;
    onToggleLock: (id: string) => void;
    onToggleExclude: (id: string) => void;
    onSwapOption: (removeIds: string[], addIds: string[]) => void;
}

/** a drag target: one alternative group occupies this (day, slot) cell */
interface Ghost {
    optionId: string;
    day: number;
    slot: number;
    conflict: boolean;
    label: string;
}

function pointFromEvent(e: MouseEvent | TouchEvent | PointerEvent): { x: number; y: number } | null {
    if ('clientX' in e) return { x: e.clientX, y: e.clientY };
    if ('changedTouches' in e && e.changedTouches[0]) {
        return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return null;
}

const weekLabel = (w: 'all' | 'odd' | 'even') =>
    w === 'odd' ? 'páratlan' : w === 'even' ? 'páros' : '';

export default function ScheduleGrid({
    pool, pickedEventIds, lockedSet, excludedSet, courseSettings, homeClassId,
    onToggleLock, onToggleExclude, onSwapOption,
}: Props) {
    const { editable, optionById } = useMemo(
        () => buildEditorModel(pool, courseSettings, pickedEventIds, homeClassId),
        [pool, courseSettings, pickedEventIds, homeClassId],
    );

    const [draggingId, setDraggingId] = useState<string | null>(null);

    const dayCount = useMemo(
        () => (editable.some(e => e.entry.day_of_week === 5) ? 6 : 5),
        [editable],
    );

    // Only show the contiguous band of slots the schedule (+ its drag
    // alternatives) actually touches — no empty early/late rows.
    const usedSlots = useMemo(() => {
        let min = TIME_SLOTS.length, max = -1;
        const touch = (startMin: number) => {
            const s = slotOf(startMin);
            if (s < min) min = s;
            if (s > max) max = s;
        };
        for (const e of editable) {
            touch(timeToMinutes(e.entry.start_time));
            for (const alt of e.alternatives) for (const ev of alt.option.events) touch(ev.startMin);
        }
        if (max < 0) return [0, 1, 2];
        return Array.from({ length: max - min + 1 }, (_, i) => min + i);
    }, [editable]);

    // cards indexed by `${day}-${slot}`
    const cardsByCell = useMemo(() => {
        const map = new Map<string, EditableEvent[]>();
        for (const e of editable) {
            const key = `${e.entry.day_of_week}-${slotOf(timeToMinutes(e.entry.start_time))}`;
            (map.get(key) ?? map.set(key, []).get(key)!).push(e);
        }
        return map;
    }, [editable]);

    const ghosts: Ghost[] = useMemo(() => {
        if (!draggingId) return [];
        const dragged = editable.find(e => e.entry.id === draggingId);
        if (!dragged) return [];
        const out: Ghost[] = [];
        for (const alt of dragged.alternatives) {
            for (const ev of alt.option.events) {
                out.push({
                    optionId: alt.option.id,
                    day: ev.day,
                    slot: slotOf(ev.startMin),
                    conflict: alt.conflict,
                    label: alt.option.className ?? 'másik csoport',
                });
            }
        }
        return out;
    }, [draggingId, editable]);
    const ghostByCell = useMemo(() => {
        const map = new Map<string, Ghost>();
        for (const g of ghosts) map.set(`${g.day}-${g.slot}`, g);
        return map;
    }, [ghosts]);

    const handleDragEnd = (
        dragged: EditableEvent,
        nativeEvent: MouseEvent | TouchEvent | PointerEvent,
        info: PanInfo,
    ) => {
        setDraggingId(null);
        const pt = pointFromEvent(nativeEvent) ?? info.point;
        const targets = document.querySelectorAll<HTMLElement>('[data-ghost="1"][data-conflict="0"]');
        for (const t of targets) {
            const r = t.getBoundingClientRect();
            if (pt.x >= r.left && pt.x <= r.right && pt.y >= r.top && pt.y <= r.bottom) {
                const target = optionById.get(t.dataset.optionId!);
                if (target) {
                    onSwapOption(
                        dragged.currentOption.events.map(e => e.id),
                        target.events.map(e => e.id),
                    );
                }
                return;
            }
        }
    };

    const renderCard = (item: EditableEvent) => {
        const { entry } = item;
        const locked = lockedSet.has(entry.id);
        const excluded = excludedSet.has(entry.id);
        const draggable = item.alternatives.length > 0 && !locked && !excluded;
        const wl = weekLabel(entry.week_type);
        return (
            <motion.div
                key={entry.id}
                layout={false}
                drag={draggable}
                dragSnapToOrigin
                dragElastic={0.12}
                dragMomentum={false}
                onDragStart={() => setDraggingId(entry.id)}
                onDragEnd={(e, info) => handleDragEnd(item, e as PointerEvent, info)}
                whileDrag={{ scale: 1.04, zIndex: 40, cursor: 'grabbing' }}
                className={
                    'sg-card' +
                    (locked ? ' locked' : '') +
                    (excluded ? ' excluded' : '') +
                    (draggable ? ' draggable' : '') +
                    (draggingId === entry.id ? ' dragging' : '')
                }
                style={{ ['--c' as string]: getSubjectColor(entry.subject_name) }}
                title={draggable ? 'Húzd egy másik csoport időpontjára' : undefined}
            >
                <span className="sg-card-name">{entry.subject_name}</span>
                {wl && <span className={`sg-week ${entry.week_type}`}>{wl}</span>}
                {draggable && <span className="sg-grip" title="Húzható másik csoportra"><GripGlyph /></span>}
                <div className="sg-card-actions" onPointerDown={e => e.stopPropagation()}>
                    <button
                        className={`sg-icon-btn${locked ? ' on' : ''}`}
                        aria-pressed={locked}
                        title={locked ? 'Rögzítés feloldása' : 'Rögzítés — maradjon'}
                        onClick={() => onToggleLock(entry.id)}
                    ><LockGlyph /></button>
                    <button
                        className={`sg-icon-btn danger${excluded ? ' on' : ''}`}
                        aria-pressed={excluded}
                        title={excluded ? 'Kizárás visszavonása' : 'Kizárás — ne ez legyen'}
                        onClick={() => onToggleExclude(entry.id)}
                    ><CloseGlyph /></button>
                </div>
            </motion.div>
        );
    };

    return (
        <div
            className="sg-slots"
            style={{
                gridTemplateColumns: `46px repeat(${dayCount}, 1fr)`,
                // rows share the available height equally → the whole week fits
                // without scrolling; cards adapt to whatever height that gives
                gridTemplateRows: `auto repeat(${usedSlots.length}, minmax(0, 1fr))`,
            }}
        >
            {/* header row */}
            <div className="sg-corner" />
            {Array.from({ length: dayCount }, (_, day) => (
                <div key={`h${day}`} className="sg-col-head">{DAY_SHORT[day]}</div>
            ))}

            {/* slot rows */}
            {usedSlots.map(slot => (
                <div key={`row${slot}`} className="sg-row" style={{ display: 'contents' }}>
                    <div className="sg-time">{TIME_SLOTS[slot].label}</div>
                    {Array.from({ length: dayCount }, (_, day) => {
                        const cards = cardsByCell.get(`${day}-${slot}`) ?? [];
                        const ghost = ghostByCell.get(`${day}-${slot}`);
                        return (
                            <div key={`${day}-${slot}`} className="sg-cell">
                                {cards.map(renderCard)}
                                <AnimatePresence>
                                    {ghost && (
                                        <motion.div
                                            key={ghost.optionId}
                                            data-ghost="1"
                                            data-option-id={ghost.optionId}
                                            data-conflict={ghost.conflict ? '1' : '0'}
                                            className={`sg-ghost${ghost.conflict ? ' conflict' : ' free'}`}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.14 }}
                                        >
                                            <span className="sg-ghost-label">
                                                {ghost.conflict ? '✕' : '✓'}
                                            </span>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
